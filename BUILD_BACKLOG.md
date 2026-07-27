# AlertLens — Build Backlog

Everything still to build, split into **(A) parity gaps** — things the previous AlertLens UI did that the new one doesn't — and **(B) new work** that neither version had.

Section A was produced by reading the old source at commit `b0d4442`, not from memory. Every item cites where it lived.

---

# A. Present in old AlertLens, missing here

## A1. Incident detail was tabbed, with playback — **highest impact**

### A1.1 Time Machine was an animated timeline, not a static comparison
`pages/TimeMachine.jsx:175-227` built discrete timeline events from a cluster and **played through them** — `stepIndex`, `isPlaying`, `speed`, a progress percentage, auto-advance every `2000/speed` ms.

Mine renders the comparison as one static page. The step-through is gone.

**Build:** `buildReplayTimeline(cluster)` → event list; transport (play/pause/speed/scrub) + progress; current-event panel.

### A1.2 Forecast had stage playback
`pages/Forecast.jsx:37-101` cycled `activeStage` through `[0, 5, 10, 15]` minutes with a play toggle, showing the projection *at* each horizon.

Mine lists all horizons at once, statically.

**Build:** stage selector + play toggle; render `steps.find(s => s.minutes === activeStage)`.

### A1.3 Incident detail tab set differs
Old tabs (`pages/Incidents.jsx:32`): `overview | playbook | rca | comparator`.
Mine: `Alerts | Root cause | Forecast | History | Playbook`.

Mine is arguably better (adds Alerts + Forecast), but has **no overview tab** — the at-a-glance summary. Worth adding back.

## A2. Home was a full workbench

`pages/Home.jsx:190-230, 398-504` had, and mine lacks:

| Feature | Old state |
|---|---|
| **Group incidents by** Root Cause / Service / Severity | `groupBy` |
| **Risk filter** (high/medium/low multi-select) | `riskFilter` Set |
| **Timeline view** toggle alongside the table | `tab === "timeline"` |
| **Column selection** | `cols` Set |
| **Sorting** | `sort {key, dir}` |
| **Per-column filters** with counts | `tblFilters` |
| **Pagination** | `page`, `perPage` |
| **Optimistic action state** | `ackedIds`, `assigneeMap`, `escalatedIds`, `mutedIds`, `resolvedIds` |
| **Copy alert link** | `copiedId` |

Mine shows 6 stat cards, top-4 incidents, a service breakdown and a 12-row recent list. It's a summary; the old one was a workbench.

**Note on optimistic state:** the old UI updated locally then refetched. Mine always refetches. Because alert actions replay the batch server-side and can change cluster membership, the refetch is *correct* — but there's a visible lag. The right fix is SWR optimistic UI (`mutate` with `optimisticData`), not local shadow state.

## A3. Alert feed power features

`pages/Feed.jsx:19-63`:
- **Sorting** (`sort`) and **column selection** (`cols`: desc/status/received/source)
- **Bulk selection** (`selected` Set) with multi-alert actions
- **Per-row quick actions** without opening the drawer: open history, copy link, suppress, ack (`Feed.jsx:19-40`)
- **Save / share a view** (`saveOpen`, `saveName`, `shareState`)
- **Add custom facets** (`extraFacets`) beyond the fixed five

Mine has faceted filtering, search, pagination and a detail drawer. Sorting/columns are native `@tanstack/react-table` features `GenericTable` already supports — mostly wiring.

## A4. Saved views in the sidebar
`components/Sidebar.jsx` had `userViews` — user-saved filtered views pinned to the nav. Pairs with A3's save/share.

## A5. Visual identity pieces

### A5.1 Real technology logos — **cheap, high visual payoff**
`components/techLogos.jsx` matched service names to real brand marks (Postgres elephant, Kafka, Redis, Prometheus, Grafana, Datadog, Kubernetes, GCP) with a generic concept-icon fallback. Used in feed rows, drawer, topology.

Mine renders plain text service names everywhere. `react-icons/si` is already installed.

### A5.2 Shared primitives never ported
From `components/ui.jsx`: `Sparkline`, `RiskMeter`, `PriorityBadge`, `ServiceChip`, `AlertIcon`, `SourceTag`, `StatusBadge`, `MetricCard`.

Most map onto Tremor equivalents, but **`Sparkline`** (inline trend on stat cards) and **`RiskMeter`** have no counterpart in what I built.

## A6. Correlations view modes
`pages/Correlations.jsx:148-173` toggled three views: **Chaos → Order** / **Raw stream** / **Correlated**.

Mine shows ChaosOrder *and* the cluster list stacked, with no toggle and no raw-stream view.

## A7. Topology interactions
`pages/Topology.jsx` had `hover`, `hoverPos`, `selected` — hover tooltips with service detail and node selection.

Mine renders nodes and edges with click-through to the incident, but no hover detail or selection.

## A8. App-level features

| Feature | Old location | Status |
|---|---|---|
| **Notification centre** — bell, unread count, list | `TopBar.jsx:207-256` | Missing |
| **Global search over alert data** with `localStorage` recent-search history (`alertlens.recentSearches`) | `TopBar.jsx:65-145` | Missing — the navbar search is KeepHQ's route search |
| **Per-page error boundary** | `App.jsx:364` `PageErrorBoundary` | Partly — Keep has route-level `error.ts`, not verified per page |
| ~~Auto-refresh~~ | `App.jsx:138-144` | **Done** |
| ~~Storm narration toasts~~ | `App.jsx:280-302` | **Done** |

---

# B. New work (neither version had it)

## B1. Correctness / safety
1. **Tests.** Zero exist. Highest value, all pure functions:
   - `resolveMock` — assert **no AlertLens endpoint is shadowed**. I verified this by hand once; it would regress silently and would swap real engine data for demo data.
   - `projectStorm`, `buildSchedule`, `buildTopology`, `applyFacets`.
2. **Optimistic alert actions** (see A2 note) — removes the post-action lag.

## B2. Product
3. **Real-time push.** Both versions poll. Backend could emit SSE on pipeline change.
4. **Incident lifecycle.** You have risk, forecasts, playbooks, DNA matches — but no way to *act*: assign an incident (not just an alert), track state, record the fix. Recording outcomes would grow the Alert DNA library from real data.
5. **Assistant streaming + persistence.** Currently one-shot, lost on reload.
6. **Deep links.** No shareable URL state for filters/facets.

## B3. Housekeeping
7. **Keep's alert pages are hollow** — `alerts/query` returns empty. Wire to `/pipeline` (needs shape adaptation: Keep uses `source: string[]`) or drop the routes.
8. **Bundle size** — routes ship 500–940 kB; the workflow builder, Monaco and CopilotKit are dead weight. Prune *after* deciding the demo pages' fate.
9. **Storm perf** — ~1 frame/s in dev; rebuild the revealed `Set` incrementally instead of per tick.
10. **Evaluation UX** — 8 seeds server-side behind a bare spinner; stream per-seed results.
11. **Accessibility** — never audited; facets, drawer actions and storm transport need keyboard/SR passes.

---

# Recommended order

**Round 1 — visible wins, low risk**
1. `techLogos` (A5.1) — cheapest visual upgrade available
2. Feed sorting + column selection (A3) — wiring existing table features
3. Correlations view toggle (A6)

**Round 2 — restore the story**
4. Time Machine timeline playback (A1.1)
5. Forecast stage playback (A1.2)
6. Incident overview tab (A1.3)

**Round 3 — the workbench**
7. Home grouping / risk filter / sorting / timeline view (A2)
8. Optimistic alert actions (B1.2)
9. Saved views + save/share (A3, A4)

**Round 4 — hardening**
10. Tests, starting with the mock-shadowing guard (B1.1)
11. Notification centre + alert-data search (A8)
12. Bundle prune (B3.8)

**Round 1 is the best value** — three items, all mechanical, all immediately visible.

---

## Still unverified (needs a real browser, not defects)
- `/topology` edges — correct in React Flow's state; v12 needs measured nodes and this pane's `ResizeObserver` never fires
- Storm replay smoothness — advances correctly in real time; only progresses when the pane gets CPU
