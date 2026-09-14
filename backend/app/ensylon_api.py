"""HTTP surface for the Ensylon AIOps engine — the Hours 18-24 gap.

The engine itself (app/ensylon/) has been real, tested code since Phase 1:
adapters, detection, correlation, the causal engine, severity scoring, and a
review gate proven against 192 measured scenarios. Nothing in that engine
changes here. This module only exposes it over HTTP so it can actually be
demoed — a scenario run, a review queue a reviewer can click through, and the
same approve/reject/merge gate the engine already enforces internally.

State is process-local and in-memory, mirroring the pattern the rest of this
app already uses for pipeline state (see `_state` in main.py) — appropriate
for a single-process demo, not a claim about production durability.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .ensylon import scenarios
from .ensylon.causal import CausalResult
from .ensylon.correlate import Cluster, DependencyGraph
from .ensylon.drafting import IncidentDraft
from .ensylon.pipeline import Evaluation, PipelineResult, run as run_pipeline
from .ensylon.review import DraftStatus, QueueItem, ReviewQueue
from .ensylon.severity import SeverityBreakdown

router = APIRouter(prefix="/ensylon", tags=["ensylon"])


@dataclass
class _EnsylonState:
    result: PipelineResult | None = None
    evaluation: Evaluation | None = None
    queue: ReviewQueue = field(default_factory=ReviewQueue)
    scenario_desc: str = ""


_state = _EnsylonState()


# --------------------------------------------------------------------------
# request bodies
# --------------------------------------------------------------------------


class DemoRunRequest(BaseModel):
    n_incidents: int = 3
    noise_signals: int = 40
    seed: int = 7
    stagger_minutes: float = 45.0
    topology: str | None = None  # ecommerce | media | fintech | iot | None (random)
    use_llm: bool = False


class ApproveRequest(BaseModel):
    actor: str
    edits: dict[str, Any] | None = None


class RejectRequest(BaseModel):
    actor: str
    note: str = ""


class MergeRequest(BaseModel):
    actor: str
    into: str
    note: str = ""


# --------------------------------------------------------------------------
# serialization — deliberately explicit rather than auto-serializing the
# internal dataclasses, so the API surface is a chosen contract, not an
# accident of internal structure.
# --------------------------------------------------------------------------


def _queue_summary(item: QueueItem) -> dict:
    draft = item.draft
    return {
        "draft_id": draft.draft_id,
        "title": draft.title,
        "priority": draft.priority,
        "severity_score": draft.severity_score,
        "correlation_confidence": draft.correlation_confidence,
        "causal_confidence": draft.causal_confidence,
        "root_cause_service": draft.root_cause_service,
        "affected_services": draft.affected_services,
        "signal_count": draft.signal_count,
        "started_at": draft.started_at.isoformat(),
        "status": item.status.value,
        "jira_key": item.jira_key,
        "merged_into": item.merged_into,
        "reviewer": item.reviewer,
        "suppressed": draft.suppressed,
        "summary_source": draft.summary_source,
    }


def _draft_detail(item: QueueItem) -> dict:
    draft = item.draft
    return {
        **_queue_summary(item),
        "severity_line": draft.severity_line,
        "root_cause_detail": draft.root_cause_detail,
        "summary": draft.summary,
        "investigation_steps": draft.investigation_steps,
        "causal_reasoning": draft.causal_reasoning,
        "severity_factors": draft.severity_factors,
        "redaction_kinds": draft.redaction_kinds,
        "timeline": [
            {
                "at": e.at.isoformat(),
                "source": e.source,
                "service": e.service,
                "detail": e.detail,
                "count": e.count,
            }
            for e in draft.timeline
        ],
        "considered_excluded": [
            {
                "service": x.service,
                "at": x.at.isoformat(),
                "detail": x.detail,
                "reason": x.reason,
            }
            for x in draft.considered_excluded
        ],
        "jira_fields": draft.to_jira_fields() if item.status == DraftStatus.PUBLISHED else None,
        "note": item.note,
        "decided_at": item.decided_at.isoformat() if item.decided_at else None,
    }


def _report_dict() -> dict:
    if _state.result is None:
        return {}
    r = _state.result.report
    out = {
        "scenario": _state.scenario_desc,
        "signals_ingested": r.signals_ingested,
        "redaction_counts": r.redaction_counts,
        "redaction_backends": r.redaction_backends,
        "unique_signals": r.unique_signals,
        "dedup_collapsed": r.dedup_collapsed,
        "dedup_collapsed_pct": r.dedup_collapsed_pct,
        "dedup_bucket_minutes": r.dedup_bucket_minutes,
        "anomalies_detected": r.anomalies_detected,
        "within_baseline": r.within_baseline,
        "incidents_formed": r.incidents_formed,
        "noise_signals": r.noise_signals,
        "root_causes_identified": r.root_causes_identified,
        "drafts_created": r.drafts_created,
        "auto_published": r.auto_published,
        "priorities": r.priorities,
        "noise_reduction_pct": r.noise_reduction_pct,
        "possible_pairs": r.possible_pairs,
        "candidate_pairs": r.candidate_pairs,
        "blocking_saved_pct": r.blocking_saved_pct,
        "calibration_warning": r.calibration_warning,
        "elapsed_ms": r.elapsed_ms,
        "causal_splits": r.causal_splits,
    }
    if _state.evaluation is not None:
        ev = _state.evaluation
        out["evaluation"] = {
            "pair_precision": ev.pair_precision,
            "pair_recall": ev.pair_recall,
            "pair_f1": ev.pair_f1,
            "cluster_purity": ev.cluster_purity,
            "incidents_expected": ev.incidents_expected,
            "incidents_formed": ev.incidents_formed,
            "root_cause_correct": ev.root_cause_correct,
            "root_cause_total": ev.root_cause_total,
            "root_cause_accuracy": ev.root_cause_accuracy,
            "noise_precision": ev.noise_precision,
        }
    return out


# --------------------------------------------------------------------------
# routes
# --------------------------------------------------------------------------


@router.post("/demo/run")
def demo_run(body: DemoRunRequest) -> dict:
    """Generate a fault-injected scenario and run the full pipeline on it.

    This is the one entry point that seeds a fresh in-memory state — every
    other route below reads or acts on whatever this last produced. A second
    call replaces the queue and audit history, same as /demo/load does for
    the original AlertLens pipeline.
    """
    sc = scenarios.generate(
        n_incidents=body.n_incidents,
        noise_signals=body.noise_signals,
        seed=body.seed,
        stagger_minutes=body.stagger_minutes,
        topology=body.topology,
    )
    sigs = scenarios.build_signals(sc)
    graph = DependencyGraph(scenarios.dependency_edges(sc))

    queue = ReviewQueue()
    result = run_pipeline(
        sigs, graph, queue=queue, use_llm=body.use_llm,
        criticality=scenarios.criticality_map(sc),
    )

    _state.result = result
    _state.evaluation = None
    try:
        from .ensylon.pipeline import evaluate
        _state.evaluation = evaluate(result, sc.incident_count)
    except Exception:
        pass
    _state.queue = queue
    _state.scenario_desc = sc.describe()

    return {"report": _report_dict(), "queue": [_queue_summary(i) for i in queue.pending()]}


@router.get("/report")
def get_report() -> dict:
    return _report_dict()


@router.get("/queue")
def get_queue(status: str | None = None) -> list[dict]:
    """List review-queue items, optionally filtered by status
    (awaiting_review | published | rejected | merged)."""
    items = list(_state.queue.items.values())
    if status:
        items = [i for i in items if i.status.value == status]
    items.sort(key=lambda i: i.draft.severity_score, reverse=True)
    return [_queue_summary(i) for i in items]


@router.get("/queue/{draft_id}")
def get_draft(draft_id: str) -> dict:
    item = _state.queue.items.get(draft_id)
    if item is None:
        raise HTTPException(404, f"no draft {draft_id}")
    return _draft_detail(item)


@router.post("/queue/{draft_id}/approve")
def approve(draft_id: str, body: ApproveRequest) -> dict:
    """The one path to Jira. See app/ensylon/review.py — this route is a
    thin wrapper; every guarantee (approval token, single-use, audit log)
    is enforced inside ReviewQueue.approve, not here."""
    try:
        item = _state.queue.approve(draft_id, body.actor, body.edits)
    except KeyError as e:
        raise HTTPException(404, str(e))
    except Exception as e:  # ApprovalRequired and friends
        raise HTTPException(400, str(e))
    return _draft_detail(item)


@router.post("/queue/{draft_id}/reject")
def reject(draft_id: str, body: RejectRequest) -> dict:
    try:
        item = _state.queue.reject(draft_id, body.actor, body.note)
    except KeyError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(400, str(e))
    return _draft_detail(item)


@router.post("/queue/{draft_id}/merge")
def merge(draft_id: str, body: MergeRequest) -> dict:
    try:
        item = _state.queue.merge(draft_id, body.into, body.actor, body.note)
    except KeyError as e:
        raise HTTPException(404, str(e))
    except Exception as e:
        raise HTTPException(400, str(e))
    return _draft_detail(item)


@router.get("/audit")
def get_audit() -> list[dict]:
    return [
        {
            "at": e.at.isoformat(), "actor": e.actor, "action": e.action,
            "draft_id": e.draft_id, "detail": e.detail,
        }
        for e in reversed(_state.queue.audit)
    ]


@router.get("/topologies")
def list_topologies() -> list[dict]:
    """What /demo/run accepts for `topology`, so the frontend doesn't
    hardcode a list that could drift from scenarios.py."""
    return [
        {
            "name": t.name,
            "services": sorted(t.services()),
            "archetype_roles": sorted({r for r in t.roles.values()}),
        }
        for t in scenarios.TOPOLOGIES
    ]
