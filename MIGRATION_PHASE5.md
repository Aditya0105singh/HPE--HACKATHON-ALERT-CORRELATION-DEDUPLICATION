# Phase 5 Checkpoint — KeepHQ-Native Pages on Demo Data

Status: **complete and verified**. Backend, ML and business logic untouched. Old `frontend/` still intact.

## Approach: mock at the API layer, not the UI layer

Rather than rewriting these pages, I added a demo-data layer behind the existing proxy. `middleware.ts` now checks whether a `/backend/*` path is a KeepHQ-only endpoint; if so it rewrites to `/api/mock/*` instead of FastAPI. **Every KeepHQ page component is therefore used completely unmodified** — which is what "reuse KeepHQ's components rather than recreating them" asks for.

```
/backend/pipeline    → FastAPI (real AlertLens engine)
/backend/workflows   → /api/mock/workflows (demo data)
```

New files: `mocks/keepMockData.ts` (the data), `mocks/keepMockRoutes.ts` (the routing table), `app/api/mock/[...path]/route.ts` (the handler).

## Safety: no AlertLens endpoint is shadowed

This design's one real risk is a mock prefix accidentally capturing a real endpoint. I hit exactly that while building it — my first draft listed `alerts/` as Keep-only, which would have **silently broken ack/assign/dismiss/escalate** (`/alerts/{id}/ack`). Fixes applied:

1. The route table is now the single source of truth — a path is Keep-only *iff* it resolves there, so the list and the router can't drift.
2. Prefix matching requires an exact match or a `prefix/` boundary, so `alerts/query` (Keep) can coexist with `alerts/{id}/ack` (AlertLens).
3. Asserted it: all **17** AlertLens endpoints verified still routing to FastAPI.

Confirmed live after the change: `/backend/pipeline` returns real engine output while `/backend/workflows` returns demo data.

## Pages now rendering (KeepHQ UI, demo data)

| Page | State |
|---|---|
| `/providers` | Full catalogue — 4 connected (Prometheus, Datadog, Grafana, GCP Monitoring) + 15 available, with tag/category filters |
| `/workflows` | 4 workflows with descriptions, triggers, enabled/disabled, execution history |
| `/mapping` | 2 enrichment rules (service→team/channel, service→tier) |
| `/extraction` | 2 regex extraction rules |
| `/rules` | 1 correlation rule |
| `/maintenance` | Maintenance window editor |
| `/dashboard` | Dashboard canvas (added a `/dashboard` index route — Keep only ships `/dashboard/[id]`) |
| `/settings` | Users, Groups, Roles, Permissions, API Keys, SSO, Webhook, SMTP, Provider Icons |
| `/notifications-hub` | Renders (upstream is a stub page in Keep itself) |
| `/ai` | Renders Keep's AI-plugins page |

Demo data uses AlertLens's own service names (api-gateway, order-api, auth-service…) so these pages feel continuous with the real ones.

## One upstream bug fixed

`features/filter/store/create-facets-store.ts` — `setFacets` did `facets.forEach(...)`, but `FacetsPanel` passes the raw SWR value, which is `undefined` until the first fetch resolves. Upstream never trips this because Keep's server-side prefetch always seeds the panel; here that prefetch can fail (server-side calls bypass the middleware mock layer), so the page crashed. Added a guard. This is the **only** KeepHQ source file changed in this phase.

Worth knowing: **server-side** API calls (`createServerApiClient`) go straight to FastAPI and are not mocked. Pages that prefetch on the server fall back to their client-side fetch, which is mocked — hence the guard above.

## Branding

15 page titles rebranded `Keep - X` → `X | AlertLens`. Body copy inside Keep's pages still says "Keep" in places (e.g. Providers' subtitle); those are inside component bodies rather than metadata and were left alone for now.

## Verification

- **Production build succeeds** (`next build`, exit 0).
- **Typecheck clean** across app code (remaining output is KeepHQ's own `__tests__`, pre-existing upstream).
- Every page above loaded in-browser.
- Both data paths confirmed working simultaneously after the final restart.

## Remaining

**Phase 4b** (deferred): `ChaosOrder.jsx` and `storm.jsx` — demo flourishes from the old UI.

**Phase 6** — cutover: delete old `frontend/`, prune unused deps, update deploy config.

**Unverified:** `/topology` edges — the preview browser's `ResizeObserver` never fires, so React Flow can't measure nodes there. Needs a check in real Chrome/Edge.

## Run it

```bash
cd "D:/1 placement/project/ALERT correlation/frontend-next" && npx next dev --turbopack -p 3001
```
