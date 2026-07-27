# Phase 2 Checkpoint — Data Layer

Status: **complete and verified against the live backend**. No backend, ML, or business-logic file was touched. No UI was built yet — this is the plumbing Phases 3–5 consume.

## What was built

All hooks live in `frontend-next/entities/alertlens/`, namespaced deliberately so they never collide with KeepHQ's own `entities/alerts` and `entities/incidents` (which stay intact for reuse in later phases).

```
entities/alertlens/
  index.ts                        barrel export
  model/types.ts                  types captured from live backend responses
  model/usePipeline.ts            GET /pipeline + derived selectors
  model/usePipelineActions.ts     /ingest, /demo/load, /demo/load-real, /demo/load-aiops
  model/useAlertActions.ts        ack / assign / dismiss / escalate
  model/useIncidentInsights.ts    forecast, comparison, root-cause XAI, playbook, evaluation, summarizer-check
  model/useAssistant.ts           /assistant and /assistant/workspace
```

All **17 backend endpoints** are covered. Hooks follow KeepHQ's existing convention exactly (`utils/hooks/useProviders.ts` as the reference): `useApi()` → `api.isReady()` null-gate → `useSWR`/`useSWRImmutable`.

## Design decisions worth knowing

- **`ApiClient` needed no changes.** I had planned to strip its Bearer-token requirement, but under NO_AUTH the session carries a token string, so `isReady()`/`getHeaders()` pass and FastAPI simply ignores the header. Less churn than planned; KeepHQ's client is used completely unmodified.
- **One SWR key feeds the whole app.** Everything reads `PIPELINE_KEY` (`/pipeline`), with `useClusters`/`useIncident`/`useRawAlerts`/`useNoiseAlerts`/`useDedupStats`/`useFilteredAlerts` as cache-derived selectors. This replaces the old Vite app's prop-drilling of one `data` object from `App.jsx` — same single-fetch behaviour, without the drilling.
- **Mutations revalidate rather than patch.** The mutating endpoints return a *summary* (`{raw_alerts, after_dedup, clusters_formed, uncorrelated}`), not new state. Alert actions also replay the whole batch server-side, so they can change cluster membership and risk — not just a badge. Every mutation therefore revalidates `/pipeline` instead of locally patching one alert. Patching locally would silently desync the UI.
- **`/evaluation` and `/playbook` are `useSWRImmutable`.** Evaluation runs the pipeline over 8 seeds on first call (took ~30s cold in testing); playbook is an LLM call. Neither should re-fire on window focus.
- **Incident-scoped hooks are null-keyed until they have an id**, since those endpoints 404 on unknown ids.
- **`cluster_id` is a number**, not a string — verified from live data. Comparisons in `useIncident` are `String()`-normalised so route params work.

## Verified end-to-end

Built a temporary probe page rendering real data through the full `ApiClient` → SWR path, loaded it in the browser, then deleted it. Results:

| Check | Result |
|---|---|
| `usePipelineState` | `dedup:130->105 (19.2%)` |
| `useClusters` | `4` |
| `useRawAlerts` / `useNoiseAlerts` | `130` / `91` |
| `useIncident(3)` selector | `size=3, risk=high` |
| `useForecast(3)` | `risk=80, blast=6, 3 points` |
| `useAlertActions.ackAlert` | `ok clusters_formed=4 raw=130` |
| Write persisted to DB | confirmed `acked=true` in backend state |

Typecheck: **zero errors** across all app code. (Remaining `tsc` output is confined to KeepHQ's own `__tests__` files — pre-existing upstream, outside the build path.)

**Test data restored**: the 2 alerts I acked during verification were un-acked afterwards; backend now reports 0 acked, as before.

## Next: Phase 3 — Direct/medium-match pages

Wire real UI using these hooks, in risk order: **Deduplication** and **Topology** (closest KeepHQ structural matches), then **Feed**, **Incidents** (+ detail tabs), **Correlations**. This is where KeepHQ's `GenericTable`, `Drawer`, facets and topology canvas start carrying AlertLens data.
