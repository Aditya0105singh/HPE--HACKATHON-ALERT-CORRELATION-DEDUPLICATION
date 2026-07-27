# Phase 4 Checkpoint — Composed Pages + Missing Features

Status: **complete and verified**. Backend, ML and business logic untouched. Old `frontend/` still intact.

This phase was expanded beyond the original plan after an audit showed the plan had been drawn from the old *page* list and missed several features that lived in *components*.

## Built and verified against live data

| Page / feature | Verified |
|---|---|
| `/` **Home** overview | All 6 original stats: 4 incidents, 62 firing, 14 groups, 28 suppressed, 97% noise reduction, 130 raw |
| `/pipeline` | All 7 stages + run log; real algorithm params (DBSCAN eps 1.00/min_samples 3, TF-IDF, 5-min dedup window) |
| `/evaluation` | 91.7% detection, 91.4% purity, 91.5% noise excluded, 96.6% DNA accuracy, per-seed table |
| `/forecast` + `/forecast/[id]` | Risk 80%, blast radius 6 services, projection timeline, 5 reasoning bullets |
| `/timemachine` + `/timemachine/[id]` | 35.7% similarity to INC-0389, full breakdown, current-vs-historical, suggested actions |
| **AI Assistant** (floating, app-wide) | Asked "top risk incidents" → real answer naming INC 3/1/2 with risk % and alert counts |
| **DataSourceMenu** | Loghub / AIOps / Synthetic buttons on Home + Pipeline, wired to the loader endpoints |
| **Faceted filtering** | 5 facets with live counts; selecting `critical` filtered the table and rescoped other counts (16+11 = 27) |

## Notes on the work

- **Assistant** is page-aware: suggested prompts change per route, and on an incident route (`/incidents/[id]`, `/forecast/[id]`, `/timemachine/[id]`) it switches to incident mode and passes `incident_id`, matching the old widget's behaviour. LLM output is rendered through KeepHQ's `MarkdownHTML`, which sanitizes HTML.
- **Facets** OR within a facet and AND across facets — the original `FacetSidebar` semantics. Counts are computed against alerts filtered by every *other* facet, so a count shows what you'd actually get by adding that option.
- **Pipeline stage parameters** (DBSCAN eps/min_samples, TF-IDF method, dedup window, DNA threshold) are mirrored from backend source in `lib/buildStages.ts` — the backend does not expose them over the API, so they are kept in sync by hand. If those constants change in `backend/app/*.py`, update that file too.
- **Home stat definitions** were copied exactly from the old `Home.jsx` (including "Correlated groups" meaning fingerprints that collapsed >1 duplicate, not cluster count) so the numbers match what you're used to.

## Verification

- **Production build succeeds** (`next build`, exit 0); all new routes compiled.
- **Typecheck clean** across app code (remaining `tsc` output is KeepHQ's own `__tests__`, pre-existing upstream).
- Every page above loaded in-browser against the live backend.
- One dev-server crash was hit mid-verification ("Jest worker … exceeding retry limit") — a Next.js dev-mode worker failure, not app code; cleared by restarting. Worth knowing it can recur in long dev sessions.

## Still outstanding

**Phase 4b (deferred by agreement — presentation flourishes, not core function):**
- `ChaosOrder.jsx` (207 ln) — chaos→order DNA visualization
- `storm.jsx` (176 ln) — storm replay with 5 scenarios, play/pause/fast-forward

**Phase 5** — KeepHQ-only pages on mock data: Workflows, Providers, Notifications Hub, Mapping, Extraction, Dashboards, Settings. These currently render Keep's original UI and **hang on Keep's API**.

**Phase 6** — cutover: delete old `frontend/`, prune unused deps, update deploy config.

**Unverified:** `/topology` edges still can't be confirmed in the preview browser (its `ResizeObserver` never fires — see Phase 3 notes). Please check that page in real Chrome/Edge.

## Run it

```bash
cd "D:/1 placement/project/ALERT correlation/frontend-next" && npx next dev --turbopack -p 3001
```
