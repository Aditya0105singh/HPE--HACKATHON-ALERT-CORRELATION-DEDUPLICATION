"""The golden incident must tell the same story every time.

These pin the demo's headline claims to the engine's real output:
17 signals -> 1 incident, postgres-primary as root cause, the disk decoy
rejected by the shared-context gate, P1 from the explicit score, and nothing
published without a human.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.main import app  # noqa: E402


@pytest.fixture()
def run():
    client = TestClient(app)
    body = client.post("/engine/golden").json()
    return client, body


def test_seventeen_signals_become_one_incident(run):
    _, body = run
    rep = body["report"]
    assert rep["signals_ingested"] == 18          # 17 incident signals + 1 decoy
    assert rep["incidents_formed"] == 1
    assert rep["noise_signals"] == 1
    assert len(body["queue"]) == 1


def test_root_cause_is_postgres_not_the_loudest_symptom(run):
    client, body = run
    ev = client.get(f"/engine/queue/{body['queue'][0]['draft_id']}/evidence").json()
    assert ev["raw_signals"] == 17
    rc = ev["root_cause"]
    assert rc["service"] == "postgres-primary"
    top = rc["candidates"][0]
    assert top["service"] == "postgres-primary" and top["survived_counterfactual"]
    # every other candidate is a symptom rejected by the counterfactual check
    others = {c["service"] for c in rc["candidates"][1:]}
    assert others == {"order-api", "payment-svc", "checkout-bff"}
    assert set(rc["rejected_by_counterfactual"]) == others


def test_disk_warning_is_rejected_with_reasons(run):
    client, body = run
    ev = client.get(f"/engine/queue/{body['queue'][0]['draft_id']}/evidence").json()
    assert [x["service"] for x in ev["excluded"]] == ["log-archive"]
    checks = ev["excluded"][0]["checks"]
    assert checks and all(c["ok"] is False for c in checks)
    assert "log-archive" not in {s["service"] for s in ev["signals"]}


def test_every_included_signal_has_shared_context(run):
    """Time coincidence alone never groups: each signal names its gate."""
    client, body = run
    ev = client.get(f"/engine/queue/{body['queue'][0]['draft_id']}/evidence").json()
    for s in ev["signals"]:
        assert s["join"]["joined"] and s["join"]["gate"], s["service"]


def test_twelve_repeats_collapse_into_one_signal(run):
    client, body = run
    ev = client.get(f"/engine/queue/{body['queue'][0]['draft_id']}/evidence").json()
    logs = [s for s in ev["signals"] if s["source"] == "cloudwatch_log"]
    assert len(logs) == 1 and logs[0]["occurrences"] == 12


def test_p1_score_is_explainable(run):
    client, body = run
    ev = client.get(f"/engine/queue/{body['queue'][0]['draft_id']}/evidence").json()
    sev = ev["severity"]
    assert sev["priority"] == "P1" and sev["score"] >= sev["p1_threshold"]
    total = sum(f["contribution"] for f in sev["factors"])
    assert total == pytest.approx(sev["score"], abs=0.01)
    assert sum(f["weight"] for f in sev["factors"]) == pytest.approx(1.0)


def test_draft_awaits_review_and_jira_is_not_created(run):
    client, body = run
    q = body["queue"][0]
    assert q["status"] == "awaiting_review" and q["jira_key"] is None
    assert body["report"]["auto_published"] == 0


def test_golden_is_deterministic():
    client = TestClient(app)
    a = client.post("/engine/golden").json()["queue"][0]
    b = client.post("/engine/golden").json()["queue"][0]
    assert (a["priority"], a["severity_score"], a["signal_count"]) == (
        b["priority"], b["severity_score"], b["signal_count"])
