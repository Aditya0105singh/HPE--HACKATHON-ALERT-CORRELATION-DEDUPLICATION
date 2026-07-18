"""Cluster summarization — real LLM call via Cerebras (OpenAI-compatible
chat completions API), with the original deterministic template kept as a
fallback so a network hiccup or missing key never breaks the pipeline.

Interface is unchanged: ``summarize(cluster_alerts, root_cause, dna_match)``
returns a short incident description. Everything else in the pipeline is
untouched by this file.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from pathlib import Path

CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions"
CEREBRAS_MODEL = os.environ.get("CEREBRAS_MODEL", "llama-3.3-70b")
# Repo-root .env — same file and convention app/assistant.py's Groq client uses,
# so both AI features share one config file instead of two conflicting ones.
_ENV_PATH = Path(__file__).resolve().parents[2] / ".env"


def _load_api_key() -> str | None:
    key = os.environ.get("CEREBRAS_API_KEY")
    if key:
        return key
    if not _ENV_PATH.exists():
        return None
    for line in _ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("CEREBRAS_API_KEY="):
            return line.split("=", 1)[1].strip()
    return None


_API_KEY = _load_api_key()


def _template_summary(cluster_alerts: list[dict], root_cause: dict,
                       dna_match: dict | None = None) -> str:
    services = sorted({a["service"] for a in cluster_alerts})
    n_critical = sum(1 for a in cluster_alerts if a["severity"] == "critical")

    text = (f"Suspected root cause: {root_cause['alertname']} on {root_cause['service']} — "
            f"{len(cluster_alerts)} related alerts ({n_critical} critical) across "
            f"{len(services)} service(s): {', '.join(services)}.")
    if dna_match:
        text += (f" Resembles {dna_match['incident_id']} ({dna_match['similarity_pct']}% similar) — "
                 f"previous fix: {dna_match['resolution']} ({dna_match['resolution_minutes']} min).")
    return text


def _build_prompt(cluster_alerts: list[dict], root_cause: dict,
                   dna_match: dict | None) -> str:
    services = sorted({a["service"] for a in cluster_alerts})
    n_critical = sum(1 for a in cluster_alerts if a["severity"] == "critical")
    sample_msgs = [a["message"] for a in cluster_alerts[:5]]

    lines = [
        "You are an SRE incident summarizer. Using ONLY the facts below, write a "
        "single tight paragraph (max 2 sentences) an on-call engineer would read "
        "in a 3-second glance: what broke, how big is the blast radius. "
        "Do not invent metrics, timings, or causes not listed below.",
        "",
        f"Root cause alert: {root_cause['alertname']} on service {root_cause['service']}",
        f"Cluster size: {len(cluster_alerts)} alerts ({n_critical} critical) across "
        f"{len(services)} service(s): {', '.join(services)}",
        "Sample alert messages:",
    ]
    lines += [f"- {m}" for m in sample_msgs]
    if dna_match:
        lines.append(
            f"Similar past incident: {dna_match['incident_id']} "
            f"({dna_match['similarity_pct']}% similar), resolved by: "
            f"{dna_match['resolution']} in {dna_match['resolution_minutes']} min."
        )
    return "\n".join(lines)


def _cerebras_summary(cluster_alerts: list[dict], root_cause: dict,
                       dna_match: dict | None) -> str | None:
    if not _API_KEY:
        return None
    prompt = _build_prompt(cluster_alerts, root_cause, dna_match)
    body = json.dumps({
        "model": CEREBRAS_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 120,
        "temperature": 0.2,
    }).encode("utf-8")
    req = urllib.request.Request(
        CEREBRAS_API_URL,
        data=body,
        headers={
            "Authorization": f"Bearer {_API_KEY}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=6) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return data["choices"][0]["message"]["content"].strip()
    except (urllib.error.URLError, urllib.error.HTTPError, KeyError, IndexError,
            TimeoutError, ValueError) as e:
        print(f"[summarizer] Cerebras call failed, falling back to template: {e}")
        return None


def summarize(cluster_alerts: list[dict], root_cause: dict,
              dna_match: dict | None = None) -> str:
    llm_text = _cerebras_summary(cluster_alerts, root_cause, dna_match)
    if llm_text:
        return llm_text
    return _template_summary(cluster_alerts, root_cause, dna_match)
