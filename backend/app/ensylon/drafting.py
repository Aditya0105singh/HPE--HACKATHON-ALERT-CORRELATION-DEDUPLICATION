"""DRAFT — turn an analysed incident into a human-ready Jira ticket.

Facts and prose come from two different mechanisms, deliberately.

Everything a reviewer needs to *act* — title, priority, affected services,
evidence timeline, root cause, what was considered and excluded — is assembled
deterministically from the cluster. It is reproducible on replay, debuggable
when wrong, and identical every time the same incident is drafted.

Only the narrative summary and the suggested investigation steps come from an
LLM, and its prompt is restricted to facts already computed above. The model
narrates data it is handed; it is never the source of a fact.

That boundary is what makes the output safe to put in front of a reviewer. A
hallucinated sentence is visible and correctable in seconds. A hallucinated
severity score would not be — it would look exactly like a real one.

If no LLM is configured, or the call fails, drafting degrades to a templated
summary and a rule-derived checklist rather than failing. A ticket with plain
prose still gets the incident in front of a human; no ticket does not.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime

from .causal import CausalResult
from .correlate import Cluster
from .severity import SeverityBreakdown
from .signal import Signal, SignalSource

MAX_TIMELINE_ROWS = 12


@dataclass
class TimelineEntry:
    at: datetime
    source: str
    service: str
    detail: str
    count: int = 1

    def render(self) -> str:
        stamp = self.at.strftime("%H:%M:%S")
        multiplier = f" ×{self.count}" if self.count > 1 else ""
        return f"{stamp}  [{self.source}]  {self.service}{multiplier} — {self.detail}"


@dataclass
class ExcludedSignal:
    service: str
    at: datetime
    detail: str
    reason: str


@dataclass
class IncidentDraft:
    """A complete ticket, pending human review. Never auto-published."""

    draft_id: str
    title: str
    priority: str
    severity_score: float
    severity_line: str
    correlation_confidence: float
    causal_confidence: int
    root_cause_service: str | None
    root_cause_detail: str
    affected_services: list[str]
    signal_count: int
    started_at: datetime
    timeline: list[TimelineEntry]
    considered_excluded: list[ExcludedSignal]
    severity_factors: dict[str, str]
    causal_reasoning: list[str]
    summary: str = ""
    investigation_steps: list[str] = field(default_factory=list)
    summary_source: str = "template"
    suppressed: bool = False
    suppression_reason: str = ""
    redaction_kinds: list[str] = field(default_factory=list)
    status: str = "awaiting_review"

    def to_jira_fields(self) -> dict:
        """Shape this into Jira REST API v3 issue fields."""
        return {
            "summary": self.title,
            "description": self.render_description(),
            "labels": ["alertlens", f"priority-{self.priority.lower()}"]
                      + [f"svc-{s}" for s in self.affected_services[:5]],
        }

    def render_description(self) -> str:
        lines = [
            f"*Severity*: {self.severity_line}",
            f"*Correlation confidence*: {self.correlation_confidence:.2f}",
            f"*Causal confidence*: {self.causal_confidence}%",
            "",
            f"*Root cause*: {self.root_cause_detail}",
            "",
            f"*Affected services* ({len(self.affected_services)}): "
            + ", ".join(self.affected_services),
            "",
            "*Summary*",
            self.summary or "(no summary available)",
            "",
            "*Evidence timeline*",
        ]
        lines += [f"  {entry.render()}" for entry in self.timeline]

        if self.causal_reasoning:
            lines += ["", "*Why this root cause*"]
            lines += [f"  - {reason}" for reason in self.causal_reasoning]

        if self.investigation_steps:
            lines += ["", "*Suggested investigation*"]
            lines += [f"  {i}. {step}" for i, step in enumerate(self.investigation_steps, 1)]

        if self.considered_excluded:
            lines += ["", "*Considered and excluded*"]
            lines += [
                f"  - {x.service} at {x.at.strftime('%H:%M:%S')} ({x.detail}) — {x.reason}"
                for x in self.considered_excluded
            ]

        lines += ["", "*Severity factors*"]
        lines += [f"  - {name}: {detail}" for name, detail in self.severity_factors.items()]

        if self.redaction_kinds:
            lines += ["", f"_Redacted before processing: {', '.join(self.redaction_kinds)}_"]
        if self.suppressed:
            lines += ["", f"_Suppressed from escalation: {self.suppression_reason}_"]

        lines += ["", "_Drafted by AlertLens. Not published until a human approves._"]
        return "\n".join(lines)


# --------------------------------------------------------------------------
# deterministic assembly
# --------------------------------------------------------------------------

_SOURCE_LABEL = {
    SignalSource.CLOUDWATCH_METRIC: "cloudwatch",
    SignalSource.CLOUDWATCH_LOG: "cw-logs",
    SignalSource.GRAFANA_ALERT: "grafana",
    SignalSource.APP_LOG: "app-log",
    SignalSource.TRACE_SPAN: "trace",
}


def build_timeline(cluster: Cluster) -> list[TimelineEntry]:
    """Collapse repeats so a 12× log burst is one readable row, not twelve.

    A raw event dump is technically complete and practically useless — the
    reviewer has to reconstruct the shape of the incident themselves. Grouping
    consecutive identical events preserves every fact while making the
    sequence legible at a glance.
    """
    entries: list[TimelineEntry] = []
    for signal in sorted(cluster.signals, key=lambda s: s.timestamp):
        label = _SOURCE_LABEL.get(signal.source, str(signal.source))
        detail = _signal_detail(signal)
        if entries:
            last = entries[-1]
            if last.service == signal.service and last.detail == detail and last.source == label:
                last.count += 1
                continue
        entries.append(TimelineEntry(signal.timestamp, label, signal.service, detail))

    if len(entries) > MAX_TIMELINE_ROWS:
        head = entries[: MAX_TIMELINE_ROWS - 1]
        hidden = len(entries) - len(head)
        tail = entries[-1]
        tail.detail = f"(+{hidden} further events) {tail.detail}"
        return head + [tail]
    return entries


def _signal_detail(signal: Signal) -> str:
    if signal.metric and signal.value is not None:
        threshold = f" (threshold {signal.threshold:g})" if signal.threshold is not None else ""
        return f"{signal.metric} = {signal.value:g}{threshold}"
    text = (signal.message or "").strip().replace("\n", " ")
    return text[:110] + ("…" if len(text) > 110 else "")


def build_title(cluster: Cluster, causal: CausalResult, severity: SeverityBreakdown) -> str:
    root = causal.root_cause_service or (cluster.services[0] if cluster.services else "unknown")
    signal = causal.root_cause_signal
    what = "failure"
    if signal is not None:
        if signal.metric:
            what = signal.metric
        elif signal.labels.get("alertname"):
            what = signal.labels["alertname"]
        elif signal.message:
            what = signal.message.split(":")[0][:48]

    others = [s for s in cluster.services if s != root]
    spread = f" cascading to {len(others)} service(s)" if others else ""
    return f"[DRAFT] {root}: {what}{spread}"


def _root_cause_detail(causal: CausalResult) -> str:
    if not causal.root_cause_service:
        return "not determined — no candidate survived causal analysis"
    signal = causal.root_cause_signal
    detail = causal.root_cause_service
    if signal is not None:
        detail += f" — {_signal_detail(signal)}"
        detail += f" (first seen {signal.timestamp.strftime('%H:%M:%S')})"
    return detail


def _fallback_summary(cluster: Cluster, causal: CausalResult, severity: SeverityBreakdown) -> str:
    root = causal.root_cause_service or "an unidentified service"
    others = [s for s in cluster.services if s != causal.root_cause_service]
    text = (
        f"{len(cluster.signals)} correlated signals across {len(cluster.services)} "
        f"service(s), scored {severity.priority}. Causal analysis points to {root}"
    )
    if others:
        text += f", with knock-on failures in {', '.join(others[:3])}"
    return text + "."


def _fallback_steps(causal: CausalResult, cluster: Cluster) -> list[str]:
    root = causal.root_cause_service
    steps: list[str] = []
    if root:
        steps.append(f"Inspect {root} first — causal analysis identifies it as the origin.")
        signal = causal.root_cause_signal
        if signal is not None and signal.metric:
            steps.append(
                f"Check {signal.metric} on {root} against its threshold "
                f"({signal.threshold:g})." if signal.threshold is not None
                else f"Check {signal.metric} on {root}."
            )
    downstream = [s for s in cluster.services if s != root]
    if downstream:
        steps.append(
            f"Confirm {', '.join(downstream[:3])} recover once {root} is healthy — "
            "if they do not, there is a second independent fault."
        )
    steps.append("Approve, edit, or reject this draft in the review queue.")
    return steps


# --------------------------------------------------------------------------
# LLM narrative
# --------------------------------------------------------------------------


def _llm_narrative(draft: IncidentDraft) -> tuple[str, list[str]] | None:
    """Ask an LLM for prose, grounded strictly in already-computed facts.

    Reuses the provider plumbing in app.summarizer so both AI features share
    one configuration and one failure path.
    """
    try:
        from ..summarizer import _call_chat_api, _configured_providers
    except Exception:
        return None

    providers = _configured_providers()
    if not providers:
        return None

    timeline = "\n".join(f"  {e.render()}" for e in draft.timeline)
    reasoning = "\n".join(f"  - {r}" for r in draft.causal_reasoning)
    prompt = f"""You are an SRE writing an incident ticket. Using ONLY the facts below,
produce exactly two sections and nothing else.

SUMMARY: two sentences describing what broke and the blast radius.
STEPS: three numbered investigation steps, most useful first.

Do not invent metrics, timings, causes, or service names that do not appear below.
Do not restate the severity score.

Root cause (already determined): {draft.root_cause_detail}
Priority: {draft.priority}
Affected services: {', '.join(draft.affected_services)}
Signals correlated: {draft.signal_count}

Evidence timeline:
{timeline}

Causal analysis:
{reasoning}
"""

    for _name, key, url, model in providers:
        try:
            reply = _call_chat_api(key, url, model, prompt)
        except Exception:
            continue
        if reply:
            return _parse_narrative(reply)
    return None


def _parse_narrative(reply: str) -> tuple[str, list[str]]:
    """Split the model's reply into summary and steps.

    Tolerant by design — a model that ignores the format still yields a usable
    summary rather than an empty ticket.
    """
    import re

    summary_part, steps_part = reply, ""
    match = re.search(r"STEPS\s*:?", reply, re.IGNORECASE)
    if match:
        summary_part = reply[: match.start()]
        steps_part = reply[match.end():]

    summary = re.sub(r"^\s*SUMMARY\s*:?", "", summary_part, flags=re.IGNORECASE).strip()

    steps: list[str] = []
    for line in steps_part.splitlines():
        line = line.strip()
        if not line:
            continue
        line = re.sub(r"^[-*\d.)\s]+", "", line).strip()
        if line:
            steps.append(line)

    return summary, steps[:5]


# --------------------------------------------------------------------------
# entry point
# --------------------------------------------------------------------------


def build_draft(
    cluster: Cluster,
    causal: CausalResult,
    severity: SeverityBreakdown,
    excluded: list[ExcludedSignal] | None = None,
    use_llm: bool = True,
) -> IncidentDraft:
    timeline = build_timeline(cluster)
    redaction_kinds = sorted({k for s in cluster.signals for k in s.redacted_fields})

    draft = IncidentDraft(
        draft_id=f"draft-{cluster.cluster_id}-{int(cluster.start.timestamp())}",
        title=build_title(cluster, causal, severity),
        priority=severity.priority,
        severity_score=severity.score,
        severity_line=severity.as_line(),
        correlation_confidence=cluster.confidence,
        causal_confidence=causal.confidence_pct,
        root_cause_service=causal.root_cause_service,
        root_cause_detail=_root_cause_detail(causal),
        affected_services=cluster.services,
        signal_count=len(cluster.signals),
        started_at=cluster.start,
        timeline=timeline,
        considered_excluded=excluded or [],
        severity_factors=severity.factors,
        causal_reasoning=causal.reasoning,
        suppressed=severity.suppressed,
        suppression_reason=severity.suppression_reason,
        redaction_kinds=redaction_kinds,
    )

    narrative = _llm_narrative(draft) if use_llm else None
    if narrative and narrative[0]:
        draft.summary, steps = narrative
        draft.investigation_steps = steps or _fallback_steps(causal, cluster)
        draft.summary_source = "llm"
    else:
        draft.summary = _fallback_summary(cluster, causal, severity)
        draft.investigation_steps = _fallback_steps(causal, cluster)
        draft.summary_source = "template"

    return draft
