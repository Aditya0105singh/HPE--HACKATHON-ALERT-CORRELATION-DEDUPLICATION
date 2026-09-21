# AlertLens

**From raw telemetry to a human-approved ticket.** An AIOps system that turns a storm of
alerts into one explained incident, and never publishes a ticket without a human.

```
INGEST -> REDACT -> DEDUPLICATE -> DETECT -> CORRELATE -> CAUSAL -> SCORE -> DRAFT -> HUMAN REVIEW -> JIRA
```

Built for the Ensylon AIOps hackathon. The design lives in the Phase 1 submission; this repo
is the working system behind it.

## The 90-second story (the golden incident)

Click **Inject failure** on the Overview. A fixed, deterministic failure runs through the real
engine:

| Step | What you see |
|---|---|
| Ingest | 18 signals from CloudWatch metrics and logs, Grafana, OpenTelemetry traces |
| Deduplicate | 12 identical "connection pool exhausted" errors collapse into 1 signal |
| Correlate | 17 signals become **1 incident**; an unrelated disk-usage alarm in the same minute is **rejected** |
| Explain | Per signal: which shared-context link joined it, its similarity score, and what was rejected and why |
| Root cause | `postgres-primary` (0.89), not the loudest symptom; downstream services ruled out by a counterfactual check |
| Score | P1 = 0.846 from four visible weighted factors (blast radius, criticality, trend, diversity) |
| Draft | Computed facts and AI prose shown separately; the LLM cannot add evidence |
| Review | "AWAITING HUMAN REVIEW - Jira not created" until a named person approves |
| Act | Approve -> single-use approval token -> one (mock) Jira issue |
| Live | A late related alert attaches to the same incident, or becomes a comment on the same Jira issue |
| Context | Resembles seeded past incident INC-0417 (90% similar) and shows how it was resolved; context only, never forces a grouping |

Two more one-click scenarios sit next to the Inject failure button: the same failure inside a declared **maintenance window** (still drafted, not escalated as a page) and a **flapping** service (4 threshold crossings become 1 incident with a flap count).

## Hard constraints and where they are enforced

| Constraint | Enforcement | Test |
|---|---|---|
| No auto-publish | `JiraClient.create_issue` requires an `ApprovalToken`, minted only in `ReviewQueue.approve`; tokens are single-use and draft-bound (`backend/app/engine/review.py`) | `test_engine_review_gate.py`, `test_engine_golden.py` |
| One Jira write path | `add_comment` only extends an issue that already consumed an approval token | `test_engine_lifecycle.py` |
| No duplicate tickets | idempotency key = draft id; a second approve is rejected | `test_engine_lifecycle.py` |
| Read-only infrastructure | telemetry is only received or parsed; nothing writes to a customer environment | design + adapters |
| No PII/PCI stored | regex (plus optional Presidio NER) redaction runs first, before dedup, storage or the LLM (`engine/redaction.py`) | `test_engine_adapters.py` |
| Time alone never groups | shared-context gate: same service, dependency edge, or common trace (`engine/correlate.py`) | `test_engine_golden.py` |

## Mock vs real (honest status)

| Piece | Status |
|---|---|
| Correlation, causal ranking, severity, drafting, review gate, lifecycle | **Real, tested code** |
| CloudWatch / Grafana / OTel parsers and push endpoints (`/engine/ingest/*`) | **Real parsers**, fed by generated payloads |
| Live CloudWatch polling with a read-only IAM role | Not connected (needs AWS credentials) |
| Jira | **Mock transport** behind the real client interface; a swap needs URL, email, API token, project key |
| LLM narrative | Deterministic template fallback; the grounded LLM path is written but needs a key |
| Historical matches | Seeded demo history (5 illustrative past incidents), not real tickets |
| Counterfactual check | Rule-based graph ablation, not a trained causal model |
| Reviewer feedback | Rule-based nudge to similarity weights for that service pattern; visible and resettable |
| State | In memory per backend run; the dataset pipeline persists to SQLite |

## Run it

```bash
# backend (Python 3.10+)
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --port 8001

# frontend (Node 20+), in a second terminal
cd frontend-next
npm install
# .env.local: API_URL=http://127.0.0.1:8001  AUTH_TYPE=NO_AUTH  NEXTAUTH_SECRET=<any random string>
npm run dev -- -p 3001
```

Open http://localhost:3001 and click **Inject failure**. To see scale, click **Loghub BGL**
(9,695 real supercomputer log alerts, 114 incidents) on the same page.

## Tests

```bash
cd backend && python -m pytest -q          # 280 tests
cd frontend-next && npx jest               # 266 tests
```

## Layout

```
backend/app/engine/         the pipeline: adapters, redaction, dedup, detect, correlate, causal,
                            severity, drafting, review gate, lifecycle, feedback, evidence, golden scenario
backend/app/engine_api.py   HTTP surface: /engine/golden, /queue, /ingest/*, /feedback ...
backend/app/                the dataset pipeline used for the BGL / synthetic scale demo
frontend-next/             Next.js UI: Overview, Incidents, Review Queue + incident investigation,
                            Correlations, Deduplication, Topology, Evaluation, Pipeline
docs/                       demo script; the original hackathon README
```

The evidence panels (Correlation Explorer, root-cause candidates, severity and confidence
breakdowns) are served by `GET /engine/queue/{draft_id}/evidence`, computed with the same
functions the correlator used, so what you see is what the engine acted on.

See [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) for the click path.
