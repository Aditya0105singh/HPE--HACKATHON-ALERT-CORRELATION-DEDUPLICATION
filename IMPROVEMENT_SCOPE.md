# AlertLens — Improvement Scope

An audit of the migrated frontend against (a) what the previous AlertLens UI actually did, and (b) what the current build is missing on its own terms. Findings are evidence-based: parity gaps came from reading the old source at commit `b0d4442`, and current defects were reproduced in the running app.

Ordered by value-per-effort, not by size.

---

## ~~P0-1. Dark mode broken~~ — RETRACTED, not a defect

**This finding was wrong.** Recorded here because the reasoning is worth not repeating.

I counted 76 light-only Tailwind colour classes across my components, measured a table border computing to `rgb(243,244,246)` in dark mode, and concluded dark mode was broken. Both observations were real; the conclusion was not.

KeepHQ does **not** use Tailwind `dark:` variants. Its dark mode is a global CSS filter (`app/globals.css`):

```css
html.workaround-dark { filter: invert(100%) hue-rotate(180deg) contrast(80%); }
```

Verified in the running app: `htmlFilter = invert(1) hue-rotate(180deg) contrast(0.8)`.

Which means:

- **`getComputedStyle` reports pre-filter values.** That "near-white" border is rendered dark. I measured the input, not the output.
- **`invert` + `hue-rotate(180deg)` is deliberate** — invert alone flips lightness *and* hue; the 180° rotation puts hue back. Colours keep their identity and only lightness flips. So orange stays orange.
- **Light-only classes are therefore correct**, and adding `dark:` variants would be actively wrong: `darkMode: "class"` targets `.dark`, which nothing ever sets (verified: `tailwindDarkClassPresent = false`), so they'd be dead code — and live code if anyone later wired `.dark`, producing a double inversion.

Two follow-up risks were also checked and cleared:

- **Colour identity under inversion** — preserved by the hue-rotate, so severity reds and the orange mark survive.
- **`position: fixed` under a filtered ancestor** — a `filter` on an ancestor normally makes fixed children behave like `absolute`. Measured the floating assistant button at scroll 0 and 600 in both themes: `top: 1344` in all four cases. It holds, because the scroll container is `<main>`, not the document.

**Action: none.** KeepHQ's own components would have been the tell — `EmptyStateCard` carries `dark:` classes that never fire, left over from before the filter approach.

---

## P0 — Real defects

### 1. No auto-refresh

The old app polled `/pipeline` every 30s (`App.jsx:138-144`), pausing during storm replay. The new app only fetches on mount and after mutations, so a dashboard left open goes stale silently.

**Fix:** add `refreshInterval: 30000` to `usePipeline`, disabled while `useStormStore` is active. ~5 lines.

---

## P1 — Parity gaps worth closing

### 3. Alert feed is thinner than the old one

Old `Feed.jsx` had, and the new one lacks:

- **Column sorting** (`sort: {key, dir}`) and **column selection** (`cols` Set — desc/status/received/source)
- **Bulk selection** with multi-alert actions
- **Per-row quick actions**: copy link, open history, suppress — without opening the drawer
- **Saved views** ("Save"/"Share" preset)

Mine has faceted filtering + search + drawer, which the old one also had. The gap is table power-features.

**Fix:** sorting and column selection are native `@tanstack/react-table` features already used by `GenericTable` — mostly wiring, not new code.

### 4. Storm replay has no narration

The old replay pushed toasts as the storm unfolded (`App.jsx:280-302`):
- **"Correlating"** when a cluster reached half its alerts — *"3 alerts correlated — UpstreamTimeout"*
- **"Alert DNA"** when a cluster completed with a match — *"35.7% match to INC-0389 · Known fix: … (18 min last time)"*

This is what made the replay tell a story rather than just animate. Mine has the transport and projection but no narration.

**Fix:** the projection already computes revealed counts per cluster each tick; add a fired-set ref and emit via KeepHQ's existing `showSuccessToast`. Moderate, high demo value.

### 5. Notification centre

Old `TopBar` had a bell with an unread counter and a notification list. Not ported.

### 6. Global search is shallow

Old `TopBar.GlobalSearch` searched alerts/services/incidents with **recent-search history** persisted to `localStorage` (`alertlens.recentSearches`). The current navbar search is KeepHQ's, which navigates routes but does not search your alert data.

---

## P2 — Build-quality issues

### 7. Storm replay re-renders the entire tree every frame

Measured in dev: ~1 frame/second. `usePipelineState` rebuilds the whole projected state on every tick, and every subscribed component re-renders. The wall-clock fix means it stays *correct*, but it's choppy.

**Fix:** memoise the revealed `Set` incrementally instead of rebuilding it per tick, and let pages subscribe to narrower slices. Also worth confirming real-browser cost before optimising — dev mode exaggerates this.

### 8. Dead KeepHQ weight

Several routes ship 500–940 kB first-load JS. The tree still carries the full workflow builder, Monaco editors, CopilotKit route, provider OAuth flows, and Keep's alert-table stack — much of it unreachable from the AlertLens nav.

**Fix:** prune unused routes/deps once the demo surface is settled. Do this *after* deciding the Phase-5 demo pages' fate (below) — pruning first would undo them.

### 9. Zero tests

KeepHQ ships Jest + RTL and I added no tests. The highest-value targets are pure and easy to test:
- `buildTopology` / `layoutTopology`
- `projectStorm` / `buildSchedule`
- `applyFacets` and facet counting
- `resolveMock` routing — **specifically the assertion that no AlertLens endpoint is shadowed**, which I verified once by hand and which would silently regress

### 10. Keep's alert pages are hollow

`alerts/query` returns an empty envelope, so Keep's alert-centric views render empty shells. Either wire them to real `/pipeline` data (they'd need shape adaptation — Keep's alerts use `source: string[]`) or remove those routes from the build.

---

## P3 — Product opportunities beyond parity

These go past what either version did.

- **Real-time push.** Both versions poll. The backend could expose SSE on pipeline change; KeepHQ's frontend already has a Pusher-shaped socket layer to model it on.
- **Incident triage workflow.** You have risk scores, forecasts, playbooks and DNA matches, but no way to *act*: assign an incident (not just an alert), track state, record what the fix was — which would in turn grow the Alert DNA library from real outcomes.
- **Assistant streaming + persistence.** Currently one-shot per message and lost on reload. Streaming tokens and persisting the thread per incident would make it feel native.
- **Evaluation is slow and silent.** First load runs 8 seeds server-side with only a spinner. Stream per-seed results as they complete, or cache with a visible "recompute".
- **Deep links.** No shareable URL state for filters/facets — the old UI had share/save; the new one has neither. `nuqs` or plain searchParams would fix it.
- **Accessibility.** Never audited. My custom components (facets, drawer actions, storm transport) need keyboard and screen-reader passes.

---

## Two things still unverified

Both are environmental, not defects, and need a real browser:

1. **`/topology` edges** — node data, dagre positions, handles and all 6 edges are correct in React Flow's state; v12 won't route edges until nodes are measured, and the preview pane's `ResizeObserver` never fires.
2. **Storm smoothness** — advances correctly in real time; only progresses when the pane gets CPU.

---

## Suggested order

1. **Auto-refresh** (P0-1) — ~5 lines, stops the dashboard going stale
2. **Storm narration** (P1-4) — best demo value per hour
3. **Feed sorting + columns** (P1-3) — mostly wiring existing table features
4. **Tests for the pure logic + mock-shadowing guard** (P2-9)
5. Then decide demo-page fate → prune bundle (P2-8, P2-10)

With dark mode retracted, the top of the list is now auto-refresh and storm
narration — together a modest amount of work with visible payoff.
