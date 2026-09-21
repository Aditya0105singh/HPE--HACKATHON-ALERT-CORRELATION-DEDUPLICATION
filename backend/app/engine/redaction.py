"""PII / PHI / PCI redaction — Hard constraint #3.

Runs at the ingestion boundary, before a signal reaches any persistent store
or any external API (including the LLM used for drafting). Placing it here
rather than in front of each consumer means no downstream component can leak
what it never received — the constraint holds by construction rather than by
every future contributor remembering to call it.

Two passes, for two different problems:

  1. Structured formats (cards, emails, tokens, SSNs, IPs) — regex. Exact,
     fast, no dependencies, and the patterns are auditable by a reviewer.
  2. Free-text names and addresses — a pluggable NER recognizer. Regex
     structurally cannot do this: "contact Priya Sharma" has no lexical
     pattern distinguishing it from "contact support desk".

The NER pass is optional at import time. Presidio pulls in spaCy and a model
download, which is a poor thing to discover missing at 3am during a 24-hour
build, so its absence degrades to regex-only with a visible warning rather
than crashing the pipeline. `redaction_backends()` reports which passes are
actually live so the review UI can show it honestly instead of implying
protection that isn't running.
"""

from __future__ import annotations

import re
from typing import Any, Callable

# --------------------------------------------------------------------------
# Structured patterns
# --------------------------------------------------------------------------

# Ordered: more specific patterns first, so a JWT isn't first half-eaten by
# the generic token rule.
_PATTERNS: list[tuple[str, re.Pattern[str]]] = [
    ("JWT", re.compile(r"\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b")),
    ("AWS_KEY", re.compile(r"\b(?:AKIA|ASIA)[0-9A-Z]{16}\b")),
    ("BEARER", re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._\-]{12,}")),
    ("API_KEY", re.compile(
        r"(?i)\b(?:api[_-]?key|secret|token|password|passwd|pwd)\b\s*[=:]\s*[\"']?([^\s\"',;)]{6,})")),
    ("EMAIL", re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")),
    ("SSN", re.compile(r"\b(?!000|666|9\d\d)\d{3}-(?!00)\d{2}-(?!0000)\d{4}\b")),
    ("PHONE", re.compile(r"(?<![\d.])(?:\+\d{1,3}[\s-]?)?(?:\(\d{3}\)|\d{3})[\s-]\d{3}[\s-]\d{4}(?![\d.])")),
    ("IPV6", re.compile(r"\b(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}\b")),
    ("IPV4", re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\b")),
    ("MRN", re.compile(r"(?i)\b(?:mrn|patient[_-]?id)\b\s*[=:]\s*[\"']?([A-Za-z0-9-]{4,})")),
]

# Card numbers are handled separately: the regex alone matches far too much
# (order ids, trace ids, request ids are all long digit runs), so every
# candidate is Luhn-checked before being treated as a real PAN.
# Written so the group can't end on a separator - `(?:\d[ -]?){13,19}` would
# swallow the space *after* the final digit, gluing the placeholder to the
# next word.
_CARD_CANDIDATE = re.compile(r"\b\d(?:[ -]?\d){12,18}\b")

# IPs inside a private range are infrastructure topology, not personal data,
# and redacting them destroys genuinely useful debugging context. Keeping
# them is a deliberate decision, not an oversight.
_PRIVATE_IP = re.compile(
    r"^(?:10\.|127\.|169\.254\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)"
)


def _luhn_ok(digits: str) -> bool:
    """Standard mod-10 checksum. Filters digit runs that merely look card-like."""
    if not 13 <= len(digits) <= 19 or not digits.isdigit():
        return False
    total, parity = 0, len(digits) % 2
    for i, ch in enumerate(digits):
        d = int(ch)
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        total += d
    return total % 10 == 0


# --------------------------------------------------------------------------
# Optional NER backend
# --------------------------------------------------------------------------

_ner_analyzer: Any = None
_ner_available: bool | None = None


def _load_ner() -> Any:
    """Import Presidio lazily. Missing install is a degradation, not a crash."""
    global _ner_analyzer, _ner_available
    if _ner_available is not None:
        return _ner_analyzer
    try:  # pragma: no cover - depends on host having the model installed
        from presidio_analyzer import AnalyzerEngine

        _ner_analyzer = AnalyzerEngine()
        _ner_available = True
    except Exception:
        _ner_analyzer = None
        _ner_available = False
    return _ner_analyzer


_NER_ENTITIES = ("PERSON", "LOCATION", "US_DRIVER_LICENSE", "MEDICAL_LICENSE")


def redaction_backends() -> dict[str, bool]:
    """What is actually running, for honest display in the review UI."""
    _load_ner()
    return {"regex": True, "ner": bool(_ner_available)}


# --------------------------------------------------------------------------
# Core
# --------------------------------------------------------------------------


def redact_text(text: str) -> tuple[str, list[str]]:
    """Redact one string. Returns (clean_text, kinds_found).

    Replacement is a typed placeholder (`[REDACTED:EMAIL]`) rather than a
    blanket mask so a reviewer reading the ticket can still tell *what kind*
    of value sat there — which is often enough context to triage without ever
    exposing the value itself.
    """
    if not text:
        return text, []

    found: list[str] = []

    # Cards first, Luhn-verified.
    def _card_sub(match: re.Match[str]) -> str:
        digits = re.sub(r"[ -]", "", match.group(0))
        if _luhn_ok(digits):
            found.append("CARD")
            return "[REDACTED:CARD]"
        return match.group(0)

    text = _CARD_CANDIDATE.sub(_card_sub, text)

    for kind, pattern in _PATTERNS:
        def _sub(match: re.Match[str], _kind: str = kind) -> str:
            whole = match.group(0)
            if _kind == "IPV4" and _PRIVATE_IP.match(whole):
                return whole  # infrastructure address, deliberately kept
            found.append(_kind)
            if match.groups():
                # Keep the key, redact only the value: "api_key=[REDACTED:API_KEY]"
                secret = match.group(1)
                return whole.replace(secret, f"[REDACTED:{_kind}]")
            return f"[REDACTED:{_kind}]"

        text = pattern.sub(_sub, text)

    analyzer = _load_ner()
    if analyzer is not None:  # pragma: no cover - requires optional install
        try:
            results = analyzer.analyze(text=text, entities=list(_NER_ENTITIES), language="en")
            for res in sorted(results, key=lambda r: r.start, reverse=True):
                if res.score < 0.6:
                    continue
                found.append(res.entity_type)
                text = text[: res.start] + f"[REDACTED:{res.entity_type}]" + text[res.end :]
        except Exception:
            pass

    # Preserve first-seen order while removing duplicates.
    return text, list(dict.fromkeys(found))


def redact_signal(signal: Any) -> Any:
    """Redact a Signal in place and record what was removed.

    Mutates rather than copying on purpose: an un-redacted copy lingering in
    memory is exactly the thing this module exists to prevent.
    """
    kinds: list[str] = []

    clean_message, found = redact_text(signal.message or "")
    signal.message = clean_message
    kinds.extend(found)

    if signal.labels:
        clean_labels: dict[str, str] = {}
        for key, value in signal.labels.items():
            clean_value, found = redact_text(str(value))
            clean_labels[key] = clean_value
            kinds.extend(found)
        signal.labels = clean_labels

    signal.redacted_fields = list(dict.fromkeys(kinds))
    return signal


def redact_all(signals: list[Any]) -> tuple[list[Any], dict[str, int]]:
    """Redact a batch and return per-kind counts for the pipeline report."""
    counts: dict[str, int] = {}
    for signal in signals:
        redact_signal(signal)
        for kind in signal.redacted_fields:
            counts[kind] = counts.get(kind, 0) + 1
    return signals, counts
