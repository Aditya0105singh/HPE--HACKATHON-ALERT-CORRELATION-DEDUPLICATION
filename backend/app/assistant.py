"""Groq-powered incident copilot.

This module is intentionally isolated from the ML pipeline. It only explains
the current incident state using structured data already produced by the
pipeline.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from pydantic import BaseModel, Field

MODEL_NAME = "llama-3.3-70b-versatile"
UNAVAILABLE_MESSAGE = "AI Assistant unavailable."
RATE_LIMIT_MESSAGE = "AI Assistant is temporarily rate limited. Please try again in a moment."
MAX_CONTEXT_ALERTS = 8
MAX_CONVERSATION_TURNS = 8


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


def ask_incident_assistant(state: dict[str, Any], payload: IncidentAssistantRequest) -> dict[str, Any]:
    incident = find_incident(state, payload.incident_id)
    if incident is None:
        return {
            "status": "error",
            "available": False,
            "incident_id": payload.incident_id,
            "error": "Incident not found in the current pipeline state.",
        }

    api_key = os.getenv("GROQ_API_KEY", "").strip()
    if not api_key:
        return {
            "status": "unavailable",
            "available": False,
            "incident_id": payload.incident_id,
            "error": UNAVAILABLE_MESSAGE,
        }

    try:
        from groq import Groq
    except Exception:
        return {
            "status": "unavailable",
            "available": False,
            "incident_id": payload.incident_id,
            "error": UNAVAILABLE_MESSAGE,
        }

    context = build_incident_context(state, incident)
    messages = _build_messages(context, payload.question, payload.conversation)

    try:
        client = Groq(api_key=api_key)
        completion = client.chat.completions.create(
            model=MODEL_NAME,
            messages=messages,
            temperature=0.2,
        )
        answer = (completion.choices[0].message.content or "").strip()
    except Exception as exc:
        error_text = str(exc).lower()
        if "429" in error_text or "rate" in error_text:
            return {
                "status": "error",
                "available": True,
                "retryable": True,
                "incident_id": payload.incident_id,
                "error": RATE_LIMIT_MESSAGE,
            }
        return {
            "status": "error",
            "available": True,
            "retryable": True,
            "incident_id": payload.incident_id,
            "error": "AI Assistant temporarily unavailable. Please retry.",
        }

    if not answer:
        return {
            "status": "error",
            "available": True,
            "retryable": True,
            "incident_id": payload.incident_id,
            "error": "AI Assistant returned an empty response.",
        }

    return {
        "status": "ok",
        "available": True,
        "incident_id": payload.incident_id,
        "model": MODEL_NAME,
        "provider": "groq",
        "answer": answer,
        "context": {
            "incident_id": context.get("incident_id"),
            "risk_level": context.get("risk_level"),
            "risk_score": context.get("risk_score"),
        },
    }