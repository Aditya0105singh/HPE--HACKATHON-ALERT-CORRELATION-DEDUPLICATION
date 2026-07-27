# AlertLens → KeepHQ Frontend Migration Report

Generated 2026-07-27. No code has been changed. This is the report requested before any migration work begins.

---

## 0. Critical framing note (read first)

This is not a "reskin." KeepHQ's frontend and AlertLens's frontend are built on **different frameworks**, not just different design systems:

| | AlertLens (current) | KeepHQ (target) |
|---|---|---|
| Framework | Vite 8 + React 19 SPA | Next.js 15, App Router (SSR + Server Components + Server Actions) |
| Routing | `react-router-dom` v7, one `<Routes>` block | File-based App Router, route groups, nested layouts |
| Auth | **None** — no login, no session, no protected routes | NextAuth v5 (Credentials/Keycloak/Auth0/Entra/Okta/OneLogin/NO_AUTH/OAuth2-proxy) |
| State/data | Plain `useState`/`useEffect`, prop drilling | SWR (58+ hooks) + Zustand (narrow UI state) |
| API client | Flat `fetch()` wrappers in `api.js` | Hand-written `ApiClient` class with Bearer-token injection, read-only-mode gating, config from server |
| Styling | Tailwind v4 | Tailwind v3 + Tremor + Radix UI + Headless UI |
| Scale | ~15 components, ~4,300 LOC | 777 files, ~90,600 LOC |

Adopting KeepHQ's *components* is very feasible. Adopting KeepHQ's *app shell* (Next.js App Router, NextAuth, SWR data layer, its `ApiClient`) means AlertLens's frontend becomes a new Next.js application that happens to call AlertLens's FastAPI backend — a full rewrite of the frontend, not a component swap. Section 9 gives you the actual choice to make here; everything below assumes the full framework adoption path you described, but flags where the lighter-weight alternative would diverge.

---

## 1. Page Mapping

KeepHQ's domain (alert routing/dedup/workflows/providers) and AlertLens's domain (correlation, forecasting, AI root-cause, time-travel comparison) overlap on alerts/incidents but diverge heavily elsewhere. Most AlertLens pages have **no KeepHQ equivalent** and must be newly composed from KeepHQ's component kit rather than "found and recreated."

| AlertLens page | Route | KeepHQ equivalent | Fit |
|---|---|---|---|
| Home (overview dashboard) | `/` | `dashboard/[id]` (widget dashboard) | Partial — KeepHQ dashboards are widget-configurable, AlertLens Home is fixed-layout. Reuse widget/card primitives, not the page itself. |
| Feed (raw alerts, firing/5xx variants) | `/feed`, `/firing`, `/5xx` | Alerts list (inside incidents/presets flow, `alerts/[id]`, `alerts/fingerprint/[fp]`) | Good — KeepHQ's `GenericTable` + filters/facets map well onto an alert feed. |
| Deduplication | `/deduplication` | `deduplication/page.tsx` | **Direct match** — same concept (dedup rules/stats), reuse layout directly. |
| Correlations | `/correlations` | `rules/page.tsx` (correlation rules) | Partial — KeepHQ's "rules" is about *defining* correlation rules; AlertLens's page *displays* correlation/clustering results. Reuse table/card chrome, not logic. |
| Incidents (list + detail) | `/incidents`, `/incidents/:clusterId` | `incidents/page.tsx` + `[id]/activity`\|`alerts`\|`timeline`\|`topology`\|`workflows` tabs | **Good match** — KeepHQ's incident detail tab structure is a strong template for AlertLens's cluster detail view. |
| Forecast | `/forecast`, `/forecast/:clusterId` | *No equivalent* | None — net-new page, build with KeepHQ chart/card components (Tremor/chart.js). |
| TimeMachine (historical comparator) | `/timemachine`, `/timemachine/:clusterId` | *No equivalent* | None — net-new, closest borrowable pattern is incident `timeline` tab. |
| Evaluation (model accuracy) | `/evaluation` | *No equivalent* | None — net-new, build from Tremor stat/chart components. |
| Pipeline | `/pipeline` | *No equivalent* (workflow *execution* view `[workflow_id]/runs/[id]` is closest visually) | Weak — borrow the execution/run visualization chrome only. |
| Topology | `/topology` | `topology/page.tsx` | **Direct match** — both use a graph canvas (AlertLens: `@xyflow/react`; KeepHQ: also React Flow-based in `widgets/workflow-builder`, plus its own `topology` page). Best reuse candidate. |
| Workflows (stub) | `/workflows` | `workflows/page.tsx`, builder, runs, versions | KeepHQ's is a full YAML workflow builder — far beyond AlertLens's current stub. Decide scope: keep as stub with new chrome, or leave unbuilt. |
| Providers (stub) | `/providers` | `providers/page.tsx` | Same as above — KeepHQ's is a full integrations catalog; AlertLens's is explicitly out of scope per existing code comments. |
| *(none)* | — | `settings/page.tsx`, `settings/auth/` | N/A — AlertLens has no settings page or auth to migrate; skip or omit entirely. |
| *(none)* | — | `(signin)/signin/`, `/error`, `/mobile` | N/A — no auth in AlertLens; only relevant if you deliberately add auth as part of this migration (not requested). |

**5 of 12 AlertLens routes have a genuine KeepHQ structural counterpart** (Feed, Dedup, Incidents, Topology, and partially Correlations). The rest (Forecast, TimeMachine, Evaluation, Pipeline, Home) are AlertLens-only concepts that must be *composed* from KeepHQ's component library, not migrated page-for-page.

---

## 2. Component Mapping

| AlertLens component | Replace with (KeepHQ) |
|---|---|
| `Sidebar.jsx`, `TopBar.jsx` | `components/navbar/Navbar.tsx` + `Menu.tsx`, `Search.tsx`, `UserAvatar.tsx` (strip auth-dependent bits: `UserInfo`, `ChangePasswordModal`) |
| `AlertDrawer.jsx` | `shared/ui/Drawer/` (Radix Dialog-based) |
| `FacetSidebar.jsx` | `features/filter/` (facets panel + CEL query builder) — likely oversized for AlertLens's needs; consider using just the presentational shell |
| `AssistantChat.jsx`, `GlobalAssistantChat.jsx`, `AssistantMessage.jsx`, `SuggestedQuestions.jsx` | No direct KeepHQ equivalent (Keep uses CopilotKit route `app/api/copilotkit`, different integration model) — keep AlertLens's existing chat components, restyle with KeepHQ tokens only |
| `RemediationPlaybook.jsx`, `RootCauseConfidenceGraph.jsx`, `HistoricalComparator.jsx` | No KeepHQ equivalent — net-new UI built from `shared/ui/JsonCard`, `DebugJSON`, chart primitives |
| `ui.jsx` (shared primitives) | `components/ui/*` + `shared/ui/*` wholesale |
| Tables (ad hoc per page) | `components/table/GenericTable.tsx` (`@tanstack/react-table`-based) |
| Charts (`recharts` direct usage) | KeepHQ's `chart.js`/`react-chartjs-2` + Tremor chart wrappers, or keep `recharts` since KeepHQ also uses it in dashboard widgets — no forced switch needed |
| Topology graph (`@xyflow/react` + `dagre`) | Same libraries already used by KeepHQ's `topology` page and `widgets/workflow-builder` — **can reuse near-verbatim**, best-fit component in this whole migration |
| Empty/loading states (ad hoc) | `shared/ui/EmptyState/`, `shared/ui/KeepLoader/`, `components/ui/EmptyStateTable.tsx` |
| Filters (`FacetSidebar`) | `components/filters/GenericFilters.tsx` |

---

## 3. UI Components to Replace (full list)

Layout: Sidebar, TopBar/Navbar, page layout wrapper, route structure.
Primitives: buttons, inputs, selects, cards, badges, tabs, modals/drawers, tooltips, dropdowns.
Data display: tables, pagination, charts, empty states, skeletons/loading states.
Theme: color tokens, dark mode mechanism, typography, spacing scale, Tailwind config.
Icons: swap `lucide-react`/`react-icons` usage to KeepHQ's icon set conventions (`@heroicons/react`, `lucide-react`, `@remixicon/react` — actually overlapping, low friction).

This matches your original scope list — nothing there requires revision.

---

## 4. Components That Can Be Reused As-Is (from AlertLens)

- **All business logic**: `clustering.py`, `dedup.py`, `alert_dna.py`, `risk_score.py`, `forecast.py`, `root_cause_confidence.py`, `playbook.py`, `summarizer.py`, `assistant.py`, `db.py`, `models.py` — zero frontend dependency, untouched.
- **`api.js` and `api/assistant.js`** — the *logic* of what to call is reusable; only the transport layer gets rewritten (see §5).
- Domain-specific visual components with no KeepHQ analog (`AssistantChat`, `RootCauseConfidenceGraph`, `HistoricalComparator`, `RemediationPlaybook`) — reusable in structure, restyled with KeepHQ tokens rather than rebuilt.
- Topology graph logic (`@xyflow/react`/`dagre` usage) — library choice already aligned with KeepHQ.

---

## 5. Backend Integrations Required

AlertLens's backend needs **no changes** — it's an unauthenticated, prefix-free FastAPI app with wide-open CORS. Integration work is entirely on the new frontend side:

1. Replace KeepHQ's `ApiClient` Bearer-token injection with a no-op (no auth exists) — or bypass `ApiClient` entirely and keep AlertLens's flat fetch wrappers, adapted to SWR hook conventions for consistency with ported components.
2. Point KeepHQ's `getApiURL()`/`getApiUrlFromConfig.ts` base-URL resolution at AlertLens's FastAPI (`http://127.0.0.1:8000`, no `/api` prefix — note AlertLens's Vite dev proxy currently strips `/api`, so the new frontend must call the 18 endpoints listed below directly without that prefix).
3. Map the 18 AlertLens endpoints (`/ingest`, `/demo/load*`, `/pipeline`, `/alerts/{id}/ack|assign|dismiss|escalate`, `/forecast/{id}`, `/incidents/{id}/comparison|root_cause_confidence|playbook`, `/evaluation`, `/debug/summarizer-check`, `/assistant`, `/assistant/workspace`) into new SWR hooks under an `entities/` or `features/` layer, following KeepHQ's `useXxx.ts` convention.
4. Decide on NextAuth: either configure **NO_AUTH mode** (KeepHQ supports this natively) to match AlertLens's current no-login behavior, or drop NextAuth entirely and strip `middleware.ts`/`auth.ts` — recommended, since adding auth is out of scope and not requested.
5. No WebSocket/SSE integration needed — AlertLens's "real-time" behavior is client-side `setInterval` replay, not a push channel; KeepHQ's Pusher integration is unnecessary and should be omitted.

---

## 6. Potential Compatibility Issues

- **Framework mismatch (biggest risk)**: SPA → Next.js App Router is a rewrite, not a port. Client-only libraries in AlertLens (`framer-motion`, `@xyflow/react`) work fine under Next.js but every page needs `"use client"` boundaries decided deliberately, since KeepHQ mixes Server and Client Components.
- **Tailwind version conflict**: AlertLens uses Tailwind v4, KeepHQ uses v3 — config syntax differs; migration must standardize on v3 (KeepHQ's) or upgrade KeepHQ's config to v4 (larger, riskier scope).
- **Domain mismatch**: KeepHQ's data hooks (`useAlerts`, `useIncidents`, `useProviders`) assume Keep's own data shapes (fingerprint-based alerts, provider-based ingestion). AlertLens's alert/cluster/incident shapes are different — hooks need rewriting against new shapes, not just re-pointing at a new URL.
- **NextAuth with no backend session support**: KeepHQ's auth flows expect a backend that issues sessions/tokens for at least Credentials mode. AlertLens's backend has none. NO_AUTH mode avoids this but should be an explicit decision (§5.4), not a default left implicit.
- **Read-only-mode gating in `ApiClient`**: a KeepHQ-specific feature (env-flag-driven) with no AlertLens equivalent — either port it as a no-op passthrough or strip it.
- **Routing semantics**: `react-router-dom` dynamic segments (`:clusterId`) don't map 1:1 onto Next.js dynamic routes (`[clusterId]`) without adjusting every `Link`/`useParams`/`useNavigate` call site.
- **CopilotKit dependency**: KeepHQ's AI assistant integration (`app/api/copilotkit`) is a different architecture than AlertLens's own `AssistantChat`/`assistant.py` — do not attempt to adopt CopilotKit; keep AlertLens's assistant wiring under KeepHQ's visual chrome.

---

## 7. Dependency Differences

| Concern | AlertLens | KeepHQ | Action |
|---|---|---|---|
| Bundler | Vite | Next.js/Turbopack+webpack | Full switch |
| React | 19.2 | 19.0.1 | Compatible, minor version alignment |
| Router | react-router-dom v7 | Next.js App Router | Full switch, no coexistence |
| Tailwind | v4 | v3 | Standardize on v3 |
| Auth | none | next-auth v5 beta + multiple providers | Adopt NO_AUTH mode only, or omit |
| Data fetching | none (manual fetch) | swr + zustand | Adopt |
| Table | none (ad hoc) | @tanstack/react-table | Adopt |
| Graph/flow | @xyflow/react + dagre | @xyflow/react + dagre | **Already aligned** |
| Charts | recharts | chart.js/react-chartjs-2 + recharts (dashboard) + Tremor | Either keep recharts or adopt Tremor per-page |
| Code editor | none | Monaco (+monaco-yaml) | Only needed if Workflows page is built out |
| Error tracking | none | Sentry | Optional — adopt if desired, not required for functional parity |
| Testing | (verify — not surveyed) | Jest + RTL | Adopt if AlertLens frontend currently has no test setup |

---

## 8. Estimated Migration Complexity

**High.** Not because AlertLens's surface is large (it's small: 12 routes, ~4,300 LOC, 18 backend endpoints, no auth) — but because the target is a 90,600-LOC Next.js application with an architecture AlertLens has none of today (SSR, App Router, NextAuth, SWR data layer, FSD module structure). Concretely:

- **Low complexity**: Topology, Deduplication (near-direct KeepHQ matches), theme/token adoption, icon/button/card primitive swaps.
- **Medium complexity**: Feed, Incidents, Correlations (KeepHQ provides strong structural templates but data shapes differ).
- **High complexity**: Forecast, TimeMachine, Evaluation, Pipeline, Home (no KeepHQ template — net-new composition from primitives), plus the foundational framework switch itself (routing, auth decision, SWR hook layer for all 18 endpoints).
- **Unknown/needs a build spike**: whether Next.js SSR causes issues with AlertLens's client-side alert-replay simulation (`setInterval`-driven "storm" playback) — this logic assumes a persistent client-side timer across a SPA lifetime, which behaves differently under Next.js navigation/hydration.

---

## 9. Risks

1. **Scope creep from framework adoption.** "Replace the skin" reads as component-level, but the instructions (KeepHQ becomes "the complete frontend layer") imply adopting Next.js wholesale. This is materially riskier and slower than porting KeepHQ's component library into the existing Vite/React Router app. **This is the one decision I'd flag back to you before starting** — see the question below.
2. **Half-ported hybrid state.** Given 5 of 12 pages have no KeepHQ template, there's a real risk of ending up with KeepHQ chrome around AlertLens-shaped pages that don't feel native to either system — the "native KeepHQ-style product" goal is achievable for Feed/Incidents/Topology/Dedup, but Forecast/TimeMachine/Evaluation/Pipeline will always be original compositions, not migrations.
3. **NextAuth misconfiguration risk.** Wiring in an auth library where none is needed, even in NO_AUTH mode, adds a class of bugs (middleware redirects, session-provider errors) AlertLens doesn't have today.
4. **Losing working functionality during the cutover.** Deleting `frontend/src` wholesale before the replacement page is verified against every backend endpoint risks a period where features silently break (e.g., alert ack/assign/dismiss/escalate actions, forecast, playbook) — needs a page-by-page verification gate, not a big-bang delete.
5. **Tailwind v3/v4 conflict** if any AlertLens-specific components are retained and restyled rather than replaced outright.

---

## 10. Migration Order (recommended)

Sequenced to de-risk the framework question early and to build foundational pieces before dependent pages:

1. **Decision + spike** (see question below) — confirm framework approach before any deletion.
2. **Foundation**: bring in KeepHQ's Tailwind config, theme/dark-mode mechanism, root layout shell, Navbar (stripped of auth-only bits), design tokens. Get an empty shell rendering.
3. **Data layer**: build SWR hooks (or adapted fetch hooks) for all 18 AlertLens endpoints, following KeepHQ's `entities/*/model/useXxx.ts` convention. No auth/session wiring.
4. **Direct-match pages first** (lowest risk, validates the approach): Deduplication, Topology.
5. **Medium-fit pages**: Feed, Incidents (incl. cluster detail tabs), Correlations.
6. **Net-new composed pages**: Home, Forecast, TimeMachine, Evaluation, Pipeline — built from the now-proven component kit.
7. **Assistant/chat surface**: restyle `AssistantChat`/`GlobalAssistantChat` with KeepHQ visual chrome, keep AlertLens's own backend wiring.
8. **Cutover**: remove old `frontend/src` only after every page above is verified against its backend endpoint(s) end-to-end.
9. **Cleanup**: prune unused KeepHQ-specific dependencies you didn't end up needing (Monaco, CopilotKit route, provider/workflow-builder code if those stubs stay unbuilt).

---

## Open question before implementation starts

Given §0 and §9.1, there are two real paths and the instructions as written point at the heavier one — worth confirming which you want, since it changes complexity by roughly an order of magnitude and changes what "day one" work looks like:

- **(A) Full framework adoption** — migrate AlertLens to Next.js App Router, use KeepHQ's actual layout/page files as the working scaffold, wire SWR + a no-auth `ApiClient`. Slower, but literally becomes "a KeepHQ instance pointed at AlertLens's API," which best matches "native KeepHQ-style product."
- **(B) Component-library extraction** — keep AlertLens on Vite + React Router, but pull KeepHQ's design tokens, Tailwind config, and reusable components (Navbar, GenericTable, Drawer, EmptyState, chart wrappers, topology canvas) into the existing app and rebuild each page with them. Faster, lower-risk, same visual outcome, but the app remains a Vite SPA under the hood rather than "being" KeepHQ.

I'd lean toward (B) given AlertLens's small surface area and the fact that 5 of 12 pages have no KeepHQ page template to migrate onto anyway — the framework switch in (A) buys visual authenticity but not much else, since most pages are being composed from primitives either way. But this is your call to make, not mine.
