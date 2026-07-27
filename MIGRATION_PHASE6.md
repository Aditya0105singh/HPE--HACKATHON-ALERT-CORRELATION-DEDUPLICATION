# Phase 4b + 6 Checkpoint — Final Features and Cutover

Status: **migration complete**. Backend, ML and business logic never modified.

## Phase 4b — the last two features

**Storm replay** (`entities/alertlens/model/useStormStore.ts`, `ui/StormControls.tsx`)
"Inject failure" on the overview loads a scenario batch and then *replays* it — alerts arrive progressively, clusters grow, and risk climbs toward its real value, so you watch correlation happen instead of seeing the finished result. All 5 scenarios ported (database failure, auth outage, disk full, network degradation, cache memory pressure) plus "surprise me" and "instant load". Pause/resume, 1×/2×/4× speed, and a progress transport.

It works by projecting the *real* engine output down to the alerts revealed so far — the engine's numbers are never invented or altered, only withheld until their moment. Because `usePipelineState` applies the projection centrally, every page animates with no page-level changes.

*Design note:* the first version advanced the clock by a fixed step per frame, which made replay speed depend on frame rate — on a slow frame it stalled. It now advances by **real elapsed time**, so dropped frames make it choppier rather than slower, and it self-corrects.

**Chaos → Order** (`entities/alertlens/ui/ChaosOrder.tsx`)
On the Correlations page: raw alerts land scattered, then collapse into their correlated incidents while uncorrelated noise drops to a line at the bottom. Positions are hash-derived so they're stable across renders. Verified rendering 106 dots with live cluster labels.

## Phase 6 — cutover

- `.claude/launch.json` — added `frontend-next-dev` (port 3001); the old Vite entry is kept as `frontend-dev-legacy`.
- `.gitignore` — ignores `frontend-next/.next`, `out`, `.env.local`.
- `frontend-next/.env.example` — documents every variable, including the deployed backend URL. **Production note:** the old `frontend/vercel.json` rewrote `/api/*` to the Render backend; the Next app instead calls `/backend/*` and its middleware rewrites to `API_URL`, so deployment just needs `API_URL` set — no rewrite rules.
- Legacy `frontend/` **removed**.

### How the removal was handled

`frontend/` had uncommitted edits (App.jsx, api.js, Sidebar.jsx, storm.jsx, ui.jsx, Home.jsx, index.css, package.json). Deleting outright would have destroyed work git could not restore, so the sequence was:

1. `b0d4442` — snapshot the legacy UI *with* those edits
2. `6573c43` — add the new frontend
3. `1d2137e` — remove the legacy UI

All on branch **`feat/keephq-frontend-migration`**. Anything from the old UI is recoverable via `git show b0d4442`.

Your in-progress **backend** changes (`main.py`, `root_cause_confidence.py`, `requirements.txt`, `db.py`) were deliberately left uncommitted and untouched.

One cosmetic leftover: the now-empty `frontend/` directory could not be deleted from disk because a running process holds a lock on it — most likely the old Vite dev server still listening on port 3000, which I left alone all session. Remove it manually once that process is stopped. Git already records the removal, so it's untracked and harmless.

## Final verification

- **Production build succeeds** (`next build`, exit 0).
- **Typecheck clean** across app code (remaining output is KeepHQ's own `__tests__`, pre-existing upstream).
- **All 25 routes respond.**
- Real backend data and demo data confirmed serving simultaneously.

## Two things needing a real browser

Both trace to the same limitation: the in-app preview pane does not composite frames, so `ResizeObserver` never fires and timers throttle heavily. Neither is an app defect — please confirm in Chrome/Edge:

1. **`/topology` edges** — nodes, dagre positions, handles and all 6 edges are correct in React Flow's state, but v12 won't route edges until it has measured nodes, which needs `ResizeObserver`.
2. **Storm replay smoothness** — it advances correctly in real time (observed 6.8s → 13.8s with alerts 93 → 109 and incidents 1 → 2), but only progresses when the pane gets CPU.

## Merging

```bash
git checkout main && git merge feat/keephq-frontend-migration
```

## Run it

```bash
cd "D:/1 placement/project/ALERT correlation/frontend-next" && npx next dev --turbopack -p 3001
```

Backend on `127.0.0.1:8000`. App on **http://localhost:3001** (3000 is occupied by an unrelated process).
