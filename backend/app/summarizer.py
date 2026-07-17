"""Cluster summarization — STUB until an LLM provider is chosen (~Jul 24).

The interface is final: ``summarize(cluster_alerts, root_cause, dna_match)``
returns a short incident description. Swapping the template below for one LLM
API call is a change inside this file only; nothing else in the pipeline moves.
"""

from __future__ import annotations


def summarize(cluster_alerts: list[dict], root_cause: dict,
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


# def summarize(cluster_alerts, root_cause, dna_match=None) -> str:
#     """Real version: one short LLM call per cluster. Enable once the provider
#     and API key are decided; cache results so the live demo never depends on
#     a network call succeeding."""
#     ...
