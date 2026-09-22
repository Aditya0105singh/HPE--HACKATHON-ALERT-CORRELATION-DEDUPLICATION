# Deploying AlertLens

Two processes: the FastAPI backend (holds the engine) and the Next.js frontend.
The frontend cannot run the engine on its own. A Vercel deployment without a
reachable backend only shows the mock/demo data paths, not Inject failure.

## Backend (any host that runs Python, e.g. Render, Railway, Fly, a VM)

```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

### Render (one-click via `render.yaml`)

The repo root has a `render.yaml` (Blueprint) that builds `backend/` as a Python web
service, health-checks `/pipeline`, and attaches a 1GB persistent disk at the backend's
working directory so `alertlens.db` — and with it the engine's event log — survives
restarts and deploys. In the Render dashboard: **New > Blueprint**, point it at this repo,
and it reads `render.yaml` automatically. Free-tier services sleep after inactivity; the
first request after a sleep takes a few seconds to wake up.

- Needs the repo's `data/` folder next to `backend/` (the synthetic generator and BGL loader import from it).
- State: the dataset pipeline and the engine event log persist to `backend/alertlens.db`
  (SQLite). On a host with an ephemeral disk the engine run is rebuilt from the log only if
  the file survives a restart; otherwise just click Inject failure again (it is deterministic).
- CORS is open (`allow_origins=["*"]`). Tighten it before exposing real data.
- Optional environment variables: an LLM key for grounded narratives (see `backend/app/summarizer.py`
  for the provider variables). Without one, drafts use the deterministic template.

## Frontend (Vercel or `next start`)

Set these environment variables:

| Variable | Value |
|---|---|
| `API_URL` | the backend's public URL, e.g. `https://alertlens-api.onrender.com` |
| `AUTH_TYPE` | `NO_AUTH` |
| `NEXTAUTH_SECRET` | any long random string |
| `PUSHER_DISABLED`, `POSTHOG_DISABLED`, `SENTRY_DISABLED` | `true` |

Then `npm run build` (Vercel does this) and start.

## Before showing it

1. Open the frontend, click **Inject failure**. If it errors, `API_URL` is wrong or the backend is asleep (free tiers sleep; hit it once first).
2. `GET <backend>/engine/queue` should list one incident after the click.
3. Keep the Jira transport on the mock until you have real credentials (see the README's Mock vs real table).
