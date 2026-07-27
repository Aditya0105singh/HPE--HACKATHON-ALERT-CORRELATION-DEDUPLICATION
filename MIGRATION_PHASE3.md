# Phase 3 Checkpoint — Direct/Medium-Match Pages

Status: **complete and verified against the live backend**. Backend, ML and business logic untouched. Old `frontend/` (Vite SPA) still intact — cutover is Phase 6.

## Pages now running on real AlertLens data

| Route | What it shows | Verified with live data |
|---|---|---|
| `/deduplication` | Dedup stats + collapsed-duplicate table | 130 raw → 105 unique, 25 removed, 19.2% |
| `/feed` | All alerts, searchable, click-through drawer | 130 alerts |
| `/firing` | Status filter | only `firing` rows |
| `/5xx` | Severity filter | only `Critical` rows |
| `/correlations` | Incidents + noise + triage-saved stats | 4 incidents, 14 correlated, 91 noise, 7m saved |
| `/incidents` | Incident cards ranked by escalation risk | 4 incidents with DNA matches |
| `/incidents/[id]` | 5-tab detail | all 5 tabs live (below) |
| `/topology` | Service graph from correlation data | 23 services, 6 correlated links |

**Incident detail tabs — all confirmed against the backend:**
- **Alerts** — cluster members with duplicate counts
- **Root cause** — XAI candidate ranking, 98% confidence with evidence bullets
- **Forecast** — risk 80%, blast radius 6 services, projection timeline
- **History** — 35.7% similarity to INC-0389, full similarity breakdown
- **Playbook** — LLM-generated remediation steps with durations

Alert actions (ack / escalate / assign / suppress / resolve) are wired through the drawer to `useAlertActions`, which revalidates the pipeline afterwards.

## Reused vs. built

Reused from KeepHQ unchanged: `GenericTable` (TanStack), `Drawer` (Radix), `SeverityLabel`, `EmptyStateCard`, `KeepLoader`, `PageTitle`/`PageSubtitle`, Tremor `Card`/`Badge`/`ProgressBar`/`TabGroup`, toast helpers.

New AlertLens-specific pieces (in `entities/alertlens/`): `StatCard`, `AlertFeed`, `AlertDetailDrawer`, `ClusterCard`, `lib/format.ts`, `lib/buildTopology.ts`.

## Two findings worth knowing

**1. `raw_alerts` has no `fingerprint`/`duplicate_count`.** It's the *pre-dedup* list; those fields are added by the dedup step and exist only on `clusters[].alerts` and `noise`. My Phase 2 types wrongly marked them required, which rendered an empty "×" in the drawer. Types are now optional and both call sites guard. This is why `/deduplication` reads from clusters+noise rather than `raw_alerts`.

**2. The topology graph draws no edges *in the in-app browser preview only*.** Root cause, confirmed by reducing to a textbook 2-node/1-edge React Flow that failed identically: **`ResizeObserver` exists in the preview browser but never fires its callback.** React Flow v12 depends on it to measure nodes, so `nodesInitialized` never flips — which kills edge routing *and* `fitView` together. Not a bundler issue (reproduced under both Turbopack and webpack) and not our code.

- Nodes, positions (dagre), handles, and all 6 edges are confirmed correct in React Flow's own state.
- **Please open `/topology` in real Chrome/Edge to confirm the edges draw.** I could not verify that myself — the preview browser can't.
- Two changes made while diagnosing are worth keeping regardless: `useNodesState`/`useEdgesState` with `onNodesChange` (matches KeepHQ's own topology usage) and explicit `width`/`height` on nodes so React Flow has dimensions without relying on measurement.

## Verification

- **Production build succeeds** (`next build`, exit 0) — every route compiles.
- **Typecheck clean** across all app code (remaining `tsc` output is KeepHQ's own `__tests__`, pre-existing upstream).
- All Phase 3 routes respond; pages confirmed rendering real data in the browser.
- No test data left behind — no alert actions were committed during this phase.

## Files removed (recoverable from the keephq repo)

Keep's dedup-*rule* components (`client.tsx`, `DeduplicationTable/Sidebar/Placeholder`) — Keep's page configures rules, AlertLens's shows results. `models.tsx` was restored because Keep's `/rules` page imports its types. Keep's incidents subtree was replaced; `predicted-incidents-table.tsx` kept because `features/incidents/incident-list` imports it. Keep's topology page body replaced (its `api/`, `model/`, `ui/` remain for reference).

## Run it

```bash
cd "D:/1 placement/project/ALERT correlation/frontend-next" && npx next dev --turbopack -p 3001
```

App on **http://localhost:3001**, backend expected on `127.0.0.1:8000`. Port 3001 because an unrelated process still owns 3000.

## Next: Phase 4 — Composed pages on real data

Home, Forecast, TimeMachine, Evaluation, Pipeline — the AlertLens-only views with no KeepHQ template, built from the component kit now proven in this phase. Pipeline also gets the dataset-loading controls (`loadDemo`/`loadReal`/`loadAiops`) that currently have no UI.
