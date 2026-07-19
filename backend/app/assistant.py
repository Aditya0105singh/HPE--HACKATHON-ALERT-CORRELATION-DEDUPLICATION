"""Incident copilot — Cerebras or Groq, whichever key is actually configured.

This module is intentionally isolated from the ML pipeline. It only explains
the current incident state using structured data already produced by the
pipeline. Both providers speak the same OpenAI-compatible chat completions
API, so this calls it directly over HTTP (stdlib only, no provider SDK) and
picks whichever provider has a real key set — Cerebras first, since that's
the key this project actually has deployed; Groq as a fallback if its key is
ever added too.
"""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Literal
from pathlib import Path

from pydantic import BaseModel, Field

UNAVAILABLE_MESSAGE = "AI Assistant unavailable."
RATE_LIMIT_MESSAGE = "AI Assistant is temporarily rate limited. Please try again in a moment."
MAX_CONTEXT_ALERTS = 8
MAX_CONVERSATION_TURNS = 8

PROVIDERS = [
    # (env var, chat completions URL, model)
    ("CEREBRAS_API_KEY", "https://api.cerebras.ai/v1/chat/completions", "llama-3.3-70b"),
    ("GROQ_API_KEY", "https://api.groq.com/openai/v1/chat/completions", "llama-3.3-70b-versatile"),
]


def _load_env_file() -> None:
    env_path = Path(__file__).resolve().parents[2] / ".env"
    if not env_path.exists():
        return

    try:
        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue
            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and not os.getenv(key):
                os.environ[key] = value
    except Exception:
        # If the .env cannot be read, fall back to whatever is already in the environment.
        return


_load_env_file()


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class IncidentAssistantRequest(BaseModel):
    incident_id: str
    question: str
    conversation: list[ConversationTurn] = Field(default_factory=list)


def find_incident(state: dict[str, Any], incident_id: str) -> dict[str, Any] | None:
    for cluster in state.get("clusters", []):
        if str(cluster.get("cluster_id")) == str(incident_id):
            return cluster
    return None


def _sorted_alerts(incident: dict[str, Any]) -> list[dict[str, Any]]:
    return sorted(incident.get("alerts", []), key=lambda a: a.get("timestamp", ""))


def build_incident_context(state: dict[str, Any], incident: dict[str, Any]) -> dict[str, Any]:
    dedup_stats = state.get("dedup_stats") or {}
    alerts = _sorted_alerts(incident)
    dna = incident.get("dna_match") or {}
    risk = incident.get("risk") or {}

    return {
        "incident_id": incident.get("cluster_id"),
        "root_cause": {
            "service": (incident.get("root_cause") or {}).get("service"),
            "alertname": (incident.get("root_cause") or {}).get("alertname"),
            "severity": (incident.get("root_cause") or {}).get("severity"),
        },
        "summary": incident.get("summary"),
        "risk_score": risk.get("score"),
        "risk_level": risk.get("level"),
        "risk_factors": risk.get("factors") or {},
        "affected_services": sorted({a.get("service") for a in alerts if a.get("service")}),
        "alert_count": incident.get("raw_alert_count", len(alerts)),
        "duplicate_count": sum(max(int(a.get("duplicate_count", 1)), 1) - 1 for a in alerts),
        "historical_match": {
            "incident_id": dna.get("incident_id"),
            "title": dna.get("title"),
            "similarity_pct": dna.get("similarity_pct"),
        } if dna else None,
        "historical_resolution": dna.get("resolution") if dna else None,
        "timeline": [
            {
                "timestamp": a.get("timestamp"),
                "service": a.get("service"),
                "alertname": a.get("alertname"),
                "severity": a.get("severity"),
            }
            for a in alerts[:MAX_CONTEXT_ALERTS]
        ],
        "noise_reduction_pct": (dedup_stats.get("reduction_pct") if dedup_stats else None),
        "unique_alert_count": incident.get("size", len(alerts)),
        "noise_alert_count": len(state.get("noise", [])),
    }


def _format_context(context: dict[str, Any]) -> str:
    root = context.get("root_cause") or {}
    risk_factors = context.get("risk_factors") or {}
    historical_match = context.get("historical_match")
    timeline = context.get("timeline") or []

    lines = [
        f"Incident ID: {context.get('incident_id')}",
        f"Root Cause: {root.get('service') or 'unknown'} / {root.get('alertname') or 'unknown'} ({root.get('severity') or 'unknown'})",
        f"Summary: {context.get('summary') or 'unavailable'}",
        f"Risk Score: {context.get('risk_score') if context.get('risk_score') is not None else 'unavailable'} ({context.get('risk_level') or 'unknown'})",
        "Risk Factors:",
        f"  - Growth Rate: {risk_factors.get('growth_rate', 'unavailable')}",
        f"  - Severity Trend: {risk_factors.get('severity_trend', 'unavailable')}",
        f"  - Service Spread: {risk_factors.get('service_spread', 'unavailable')}",
        f"Affected Services: {', '.join(context.get('affected_services') or []) or 'unavailable'}",
        f"Alert Count: {context.get('alert_count') if context.get('alert_count') is not None else 'unavailable'}",
        f"Duplicate Count: {context.get('duplicate_count') if context.get('duplicate_count') is not None else 'unavailable'}",
        "Historical Match: " + (
            f"{historical_match.get('incident_id')} ({historical_match.get('similarity_pct')}% similar)"
            if historical_match else "none"
        ),
        "Historical Resolution: " + (context.get("historical_resolution") or "none"),
        f"Noise Reduction: {context.get('noise_reduction_pct') if context.get('noise_reduction_pct') is not None else 'unavailable'}%",
        "Timeline:",
    ]

    if timeline:
        for alert in timeline:
            lines.append(
                f"  - {alert.get('timestamp')} | {alert.get('severity')} | {alert.get('service')} | {alert.get('alertname')}"
            )
        if context.get("alert_count", 0) > len(timeline):
            lines.append(f"  - ... {context.get('alert_count') - len(timeline)} more alerts")
    else:
        lines.append("  - unavailable")

    return "\n".join(lines)


def _template_answer(question: str, context: dict[str, Any]) -> str:
    """A real, computed answer built directly from the structured incident
    context — used when no LLM provider is reachable. Keyword-routes the
    question to the most relevant section rather than always dumping
    everything, but never invents anything beyond what build_incident_context
    already computed from the real pipeline output."""
    root = context.get("root_cause") or {}
    risk_factors = context.get("risk_factors") or {}
    historical_match = context.get("historical_match")
    services = context.get("affected_services") or []
    q = question.lower()

    def risk_section() -> str:
        f = risk_factors
        return (
            f"Risk score is {context.get('risk_score')} ({context.get('risk_level')}), "
            f"driven by growth rate {f.get('growth_rate', 'n/a')}, severity trend {f.get('severity_trend', 'n/a')}, "
            f"and service spread {f.get('service_spread', 'n/a')} across {len(services)} service(s)."
        )

    def dna_section() -> str:
        if not historical_match:
            return "No Alert DNA match — this doesn't resemble anything in the known incident library, so it's a novel pattern."
        return (
            f"{historical_match.get('similarity_pct')}% similar to {historical_match.get('incident_id')} "
            f"({historical_match.get('title') or 'past incident'}). Last fix: {context.get('historical_resolution') or 'unrecorded'}."
        )

    def fix_section() -> str:
        if historical_match and context.get("historical_resolution"):
            return f"Closest known fix (from {historical_match.get('incident_id')}, {historical_match.get('similarity_pct')}% similar): {context.get('historical_resolution')}."
        return (
            f"No matching past incident to base a fix on. Start with the root cause: "
            f"{root.get('alertname') or 'unknown alert'} on {root.get('service') or 'unknown service'}."
        )

    def impact_section() -> str:
        dup = context.get("duplicate_count")
        noise = context.get("noise_reduction_pct")
        return (
            f"{context.get('alert_count')} alerts across {len(services)} service(s)"
            + (f", {dup} were duplicate re-fires collapsed by dedup" if dup else "")
            + (f". Noise reduction this window: {noise}%." if noise is not None else ".")
        )

    def summary_section() -> str:
        return context.get("summary") or "No summary available."

    if any(k in q for k in ("risk", "escalat", "why")):
        body = risk_section()
    elif any(k in q for k in ("dna", "similar", "resembl", "seen before", "past incident")):
        body = dna_section()
    elif any(k in q for k in ("fix", "resolve", "remediat", "next step", "should i do")):
        body = fix_section()
    elif any(k in q for k in ("business", "impact", "cost", "customer")):
        body = impact_section()
    else:
        # summary_section() already covers root cause + DNA (it's the same
        # template the cluster card shows) — just add the risk breakdown,
        # which isn't part of that summary.
        body = f"{summary_section()} {risk_section()}"

    return "_AI provider unreachable right now — answering directly from the real incident data instead:_\n\n" + body


def _build_messages(context: dict[str, Any], question: str, conversation: list[ConversationTurn]) -> list[dict[str, str]]:
    system_prompt = (
        "You are an SRE Incident Response Assistant for AlertLens. "
        "Use only the supplied incident context. Never hallucinate metrics, services, root causes, or historical incidents. "
        "If information is missing, say so. Be concise, professional, and technical. "
        "When useful, explain the root cause, correlation, Alert DNA match, risk score, recommended remediation, and business impact."
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "system", "content": "Structured incident context:\n" + _format_context(context)},
    ]

    for turn in conversation[-MAX_CONVERSATION_TURNS:]:
        messages.append({"role": turn.role, "content": turn.content.strip()})

    messages.append({"role": "user", "content": question.strip()})
    return messages


def _configured_providers() -> list[tuple[str, str, str, str]]:
    """Returns (provider_name, api_key, url, model) for every provider that
    has a real key set, in priority order. Checked at request time — not
    just once at startup — so if one provider's network path is blocked
    (e.g. a host's outbound IP range flagged by a provider's WAF) the next
    configured provider is tried automatically instead of failing outright."""
    out = []
    for env_var, url, model in PROVIDERS:
        key = os.getenv(env_var, "").strip()
        if key:
            name = "cerebras" if "cerebras" in url else "groq"
            out.append((name, key, url, model))
    return out


def _call_chat_api(api_key: str, url: str, model: str, messages: list[dict[str, str]]) -> str:
    body = json.dumps({
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "max_tokens": 600,
    }).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=20) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    return (data["choices"][0]["message"]["content"] or "").strip()


def ask_incident_assistant(state: dict[str, Any], payload: IncidentAssistantRequest) -> dict[str, Any]:
    incident = find_incident(state, payload.incident_id)
    if incident is None:
        return {
            "status": "error",
            "available": False,
            "incident_id": payload.incident_id,
            "error": "Incident not found in the current pipeline state.",
        }

    context = build_incident_context(state, incident)
    providers = _configured_providers()

    answer = None
    used_provider = used_model = None
    last_error = None

    if providers:
        messages = _build_messages(context, payload.question, payload.conversation)
        for provider, api_key, url, model in providers:
            try:
                answer = _call_chat_api(api_key, url, model, messages)
                used_provider, used_model = provider, model
                break
            except urllib.error.HTTPError as exc:
                last_error = f"{provider}: HTTP {exc.code}"
            except Exception as exc:
                last_error = f"{provider}: {exc}"
    else:
        last_error = "no AI provider key configured"

    # No LLM reachable (no key configured, or every configured provider's
    # network path failed) — answer directly from the real structured
    # incident data instead of erroring out. Still a real, honest answer,
    # just not LLM-generated prose.
    if not answer or not answer.strip():
        return {
            "status": "ok",
            "available": True,
            "generated": "template",
            "incident_id": payload.incident_id,
            "provider": "template",
            "answer": _template_answer(payload.question, context),
            "note": f"AI providers unreachable ({last_error}); answered from real incident data instead.",
        }

    return {
        "status": "ok",
        "available": True,
        "incident_id": payload.incident_id,
        "model": used_model,
        "provider": used_provider,
        "answer": answer,
        "context": {
            "incident_id": context.get("incident_id"),
            "risk_level": context.get("risk_level"),
            "risk_score": context.get("risk_score"),
        },
    }