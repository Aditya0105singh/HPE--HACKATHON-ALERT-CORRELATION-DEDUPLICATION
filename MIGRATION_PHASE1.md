# Phase 1 Checkpoint — Foundation (KeepHQ shell running on AlertLens)

Status: **complete and verified**. Nothing in AlertLens's backend, ML logic, or existing `frontend/` was modified or deleted.

## What was done

**Approach change worth knowing:** rather than hand-recreating KeepHQ's 777-file frontend, I copied `keephq/keep-ui` wholesale into `ALERT correlation/frontend-next/` and adapted it in place. This literally makes KeepHQ the frontend layer (your Option A) and means every KeepHQ component is available for Phases 3–5 instead of being reimplemented.

1. **Scaffold** — `keep-ui` copied to `frontend-next/` (1072 files), excluding `node_modules`, `.next`, and KeepHQ's `.env.local` (secrets never copied; only `.env.local.example` came across). Package renamed `keep-ui` → `alertlens-ui`.
2. **Dependencies** — installed from KeepHQ's exact `package-lock.json`. My first install without the lockfile produced a drifted tree (duplicate nested `@xyflow/system`) that caused ~10 type errors; adopting the lockfile eliminated all of them.
3. **NO_AUTH** — `AUTH_TYPE=NO_AUTH` in `.env.local`. KeepHQ's `SignInForm` auto-signs-in via the NoAuth provider, so no login screen appears. I also renamed the no-auth user `Keep` → `AlertLens` and emptied the two fake tenants KeepHQ ships, which otherwise render a bogus "Switch Tenant" dropdown.
4. **API proxy** — `API_URL=http://127.0.0.1:8000`. KeepHQ's client calls `/backend/*` and `middleware.ts` rewrites that to `API_URL` — structurally identical to the Vite proxy AlertLens used, so no client rewiring was needed.
5. **Navbar** — KeepHQ's link sections (`AlertsLinks`, `IncidentsLinks`, `NoiseReductionLinks`, `DashboardLinks`) all call Keep-only endpoints (presets, dashboards, `useTenantConfiguration`) that AlertLens's backend does not serve, so they'd hang on skeletons. Replaced with `components/navbar/AlertLensLinks.tsx`, built from KeepHQ's own `LinkWithIcon` + Headless UI `Disclosure` — identical visual language, zero dependency on missing endpoints.
6. **Branding** — `AlertLensMark` SVG (KeepHQ's orange accent) replaces the Keep logo in the sidebar and signin layout; Keep's Slack/Docs/GitHub/Twitter links and Keep-specific search shortcuts replaced with AlertLens routes.
7. **Route stubs** — themed `EmptyStateCard` placeholders for the 9 AlertLens-only routes (`/`, `/feed`, `/firing`, `/5xx`, `/correlations`, `/forecast`, `/timemachine`, `/evaluation`, `/pipeline`).

## Verified

- Dev server runs; **production build succeeds** (`next build`, exit 0) — all routes compile, KeepHQ's and AlertLens's alike.
- Typecheck clean across all app code. Remaining `tsc` errors are confined to KeepHQ's own `__tests__` files (pre-existing upstream, not in the build path).
- NO_AUTH auto-signin works — no login screen, no redirect loop.
- All 20 sidebar links render across 6 groups; routing and per-page titles work (`Forecast | AlertLens`).
- Dark mode toggle works (Light/Dark/System, persists to localStorage).
- Sidebar minimize works.
- **Backend integration proven**: `GET localhost:3001/backend/pipeline` → 200 with real AlertLens data (130 raw alerts → 105 unique, 19.2% dedup reduction). This is the path all Phase 2 hooks will use.
- Pusher/PostHog/Sentry correctly disabled — no failed connections.

## Known/expected state

- **KeepHQ's own pages still call Keep's API.** `/incidents`, `/providers`, `/workflows`, etc. render KeepHQ's real UI but hang on "getting your data" because AlertLens's backend doesn't serve Keep's shapes. This is exactly the Phase 3–5 work, not a defect.
- **Hydration warning on `<html>` class.** KeepHQ's `ThemeScript` mutates `documentElement` pre-hydration to prevent theme flash; React logs a mismatch. Upstream KeepHQ behavior, present in Keep itself, cosmetic only.
- App runs on **port 3001**, not 3000 — an unrelated node process (started before this session, PID 18928) owns 3000 and I did not touch it. `NEXTAUTH_URL` is set to 3001 to match.
- Old `frontend/` (Vite SPA) is untouched and still runnable. Deletion happens in Phase 6, only after every page is verified.

## Run it

```bash
cd "D:/1 placement/project/ALERT correlation/frontend-next" && npx next dev --turbopack -p 3001
```

Backend must be on `127.0.0.1:8000` (it was already running during verification).

## Next: Phase 2 — Data layer

Build SWR hooks for all 18 AlertLens endpoints following KeepHQ's `entities/*/model/useXxx.ts` convention, and adapt `ApiClient` (drop the Bearer-token requirement, which currently throws without a session token). No UI work — this is the plumbing every later phase consumes.
