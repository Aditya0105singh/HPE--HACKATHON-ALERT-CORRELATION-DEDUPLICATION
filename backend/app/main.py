"""FastAPI app — pipeline API for the dashboard.

POST /ingest      run the full chain on a JSON list of alerts
GET  /pipeline    latest processed state (clusters, dedup stats, noise)
POST /demo/load   generate a fresh synthetic batch and run it (demo/dev)

On startup the app loads one synthetic batch so the dashboard always has data.
"""

from __future__ import annotations

import os
import sys
from contextlib import asynccontextmanager
from pathlib import Path

os.environ.setdefault("USE_TF", "0")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sentence_transformers import SentenceTransformer

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "data"))
from synthetic_alert_generator import generate_batch  # noqa: E402

from .assistant import IncidentAssistantRequest, ask_incident_assistant
from .alert_dna import AlertDNA
from .clustering import MODEL_NAME, cluster_alerts, group_by_label, pick_root_cause
from .dedup import deduplicate
from .risk_score import escalation_risk
from .summarizer import summarize

_model: SentenceTransformer | None = None
_dna: AlertDNA | None = None
_state: dict = {"dedup_stats": None, "clusters": [], "noise": [], "raw_alerts": [], "evaluation": None}

# Rough triage-time model for the MTTR framing: minutes an on-call engineer
# would spend manually reading and grouping this many raw alerts (~30s each),
# minus the ~2 min it takes to read one correlated incident card.
TRIAGE_SEC_PER_ALERT = 30
TRIAGE_MIN_PER_INCIDENT = 2

# Fixed incident_key -> seed_incident_library.json id, used only to measure
# whether Alert DNA matched the *correct* past incident (evaluation page).
EXPECTED_DNA_MATCH = {
    "db_connection_exhaustion": "INC-0389",
    "redis_memory_pressure": "INC-0412",
    "disk_full_logging": "INC-0367",
    "auth_cascade_failure": "INC-0401",
    "network_packet_loss": "INC-0355",
}
EVAL_SEEDS = [42, 7, 123, 2026, 555, 9, 77, 314]


def get_model() -> SentenceTransformer:
    global _model, _dna
    if _model is None:
        _model = SentenceTransformer(MODEL_NAME)
        _dna = AlertDNA(_model)
    return _model


def run_pipeline(alerts: list[dict]) -> dict:
    model = get_model()

    unique, dedup_stats = deduplicate(alerts)
    labels, _ = cluster_alerts(unique, model)
    groups = group_by_label(unique, labels)

    clusters = []
    for label, members in sorted(groups.items()):
        if label == -1:
            continue
        root = pick_root_cause(members)
        risk = escalation_risk(members)
        dna = _dna.match(members)
        raw_in_cluster = sum(m.get("duplicate_count", 1) for m in members)
        saved = max(round(raw_in_cluster * TRIAGE_SEC_PER_ALERT / 60) - TRIAGE_MIN_PER_INCIDENT, 0)
        clusters.append({
            "cluster_id": label,
            "size": len(members),
            "raw_alert_count": raw_in_cluster,
            "root_cause": root,
            "risk": risk,
            "dna_match": dna,
            "summary": summarize(members, root, dna),
            "est_triage_minutes_saved": saved,
            "alerts": sorted(members, key=lambda a: a["timestamp"]),
        })

    clusters.sort(key=lambda c: c["risk"]["score"], reverse=True)
    _state.update({
        "dedup_stats": dedup_stats,
        "clusters": clusters,
        "noise": groups.get(-1, []),
        "raw_alerts": sorted(alerts, key=lambda a: a["timestamp"], reverse=True),
    })
    return {
        "raw_alerts": dedup_stats["raw_count"],
        "after_dedup": dedup_stats["unique_count"],
        "clusters_formed": len(clusters),
        "uncorrelated": len(groups.get(-1, [])),
    }


def compute_evaluation() -> dict:
    """Measures the pipeline against the generator's hidden ground truth,
    across a fixed seed set — same methodology as notebooks/poc_clustering.ipynb.
    The pipeline never reads ground_truth; this is an external measurement."""
    model = get_model()
    tp_n = tp_d = dna_ok = dna_t = frag = missed = inc_total = noise_cl = noise_total = 0

    for seed in EVAL_SEEDS:
        raw = generate_batch(3, 20, 45, seed=seed)
        unique, _ = deduplicate(raw)
        labels, _ = cluster_alerts(unique, model)
        groups = group_by_label(unique, labels)

        incidents = {a["ground_truth"] for a in unique if a["ground_truth"] != "noise"}
        inc_total += len(incidents)
        noise_total += sum(1 for a in unique if a["ground_truth"] == "noise")
        inc_map: dict[str, set] = {i: set() for i in incidents}

        for label, members in groups.items():
            if label == -1:
                continue
            counts: dict[str, int] = {}
            for a in members:
                counts[a["ground_truth"]] = counts.get(a["ground_truth"], 0) + 1
            majority = max(counts, key=counts.get)
            tp_n += counts[majority]
            tp_d += len(members)
            noise_cl += counts.get("noise", 0)
            for truth in counts:
                if truth != "noise":
                    inc_map[truth].add(label)
            if majority in EXPECTED_DNA_MATCH:
                dna_t += 1
                match = _dna.match(members)
                if match and match["incident_id"] == EXPECTED_DNA_MATCH[majority]:
                    dna_ok += 1

        frag += sum(max(0, len(v) - 1) for v in inc_map.values())
        missed += sum(1 for v in inc_map.values() if not v)

    return {
        "seeds_tested": len(EVAL_SEEDS),
        "incidents_total": inc_total,
        "incidents_detected": inc_total - missed,
        "incident_detection_pct": round(100 * (inc_total - missed) / inc_total, 1) if inc_total else 0,
        "cluster_purity_pct": round(100 * tp_n / tp_d, 1) if tp_d else 0,
        "fragmentation_events": frag,
        "noise_excluded_pct": round(100 * (1 - noise_cl / noise_total), 1) if noise_total else 0,
        "dna_correct": dna_ok,
        "dna_total": dna_t,
        "dna_accuracy_pct": round(100 * dna_ok / dna_t, 1) if dna_t else 0,
    }


@asynccontextmanager
async def lifespan(app: FastAPI):
    run_pipeline(generate_batch(n_incidents=4, n_noise=80, window_minutes=45,
                                seed=7, noise_window_hours=48))
    _state["evaluation"] = compute_evaluation()
    yield


app = FastAPI(title="Alert Correlation & Dedup Engine", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_methods=["*"], allow_headers=["*"])


@app.post("/ingest")
def ingest(alerts: list[dict]) -> dict:
    return run_pipeline(alerts)


@app.post("/demo/load")
def demo_load(incidents: int = 4, noise: int = 80, seed: int | None = None,
              scenario: str | None = None) -> dict:
    return run_pipeline(generate_batch(incidents, noise, 45, seed=seed,
                                       noise_window_hours=48, force_scenario=scenario))


@app.get("/pipeline")
def pipeline_state() -> dict:
    return _state


@app.get("/evaluation")
def evaluation_state() -> dict:
    if _state["evaluation"] is None:
        get_model()
        _state["evaluation"] = compute_evaluation()
    return _state["evaluation"]


@app.post("/assistant")
def assistant(payload: IncidentAssistantRequest) -> dict:
    return ask_incident_assistant(_state, payload)
