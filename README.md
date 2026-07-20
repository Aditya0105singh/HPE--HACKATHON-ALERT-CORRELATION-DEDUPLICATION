<div align="center">
  <h1>🚨 Alert Correlation & Dedup Engine</h1>
  <p><strong>Synergy 2026 · HPE Problem Statement #10</strong></p>
  <p>Turning infrastructure noise into actionable, prioritized intelligence.</p>
</div>

<br />

## 🌩️ The Problem: Alert Storms

In modern microservice architectures, **one single infrastructure failure triggers hundreds of downstream alerts within minutes.**

Engineers spend the critical first 15 minutes of a major incident simply sifting through the noise, trying to figure out what actually broke. Existing systems rely on static rules that are hard to maintain and fail when novel incidents occur.

## 💡 The Solution: Intelligent Alert Correlation

This engine doesn't just silence alerts; it collapses the flood into a handful of **actionable incidents**. We go several steps further than traditional correlation tools:

1. 📈 **Escalation Risk Score:** A real-time, explainable signal identifying which incident cluster is trending toward a larger failure based on alert growth rate, severity trend, and service spread. Correlation tells you what broke; this tells you what to look at _first_.
2. 🧬 **Alert DNA:** Every new incident cluster is fingerprint-matched against a library of past incidents. If it resembles something seen before, the previous resolution is surfaced automatically: _"87% similar to INC-0412 — restarting the connection pool fixed it in 12 min."_
3. 🤖 **AI Copilot (Cerebras):** Each incident is automatically summarized in plain English by an LLM, and an interactive chat copilot allows engineers to query the incident graph directly.
4. 🔮 **Predictive Blast Radius Forecast:** Explains *"What is likely to happen NEXT if nobody intervenes?"* with 15-minute horizon step projections (+5m, +10m, +15m) for risk escalation, projected alert volume growth, and downstream service spread.
5. ⏳ **Incident Time Machine:** Enterprise forensic replay tool to step through the chronological formation of an incident from first raw alert to deduplication, DBSCAN clustering, risk escalation, and DNA match.
6. 🔍 **Historical Incident Comparator:** Pull-request style visual diff comparing the current cluster with historical institutional memory (similarity factor breakdown, side-by-side timeline alignment, property diffs, and resolution playbooks).
7. 🎯 **Root Cause Confidence Graph (XAI):** Explainable AI decision-transparency dashboard detailing *WHY* a root cause was selected and why alternative candidate services were ranked lower or rejected across 5 normalized heuristic signals.
8. 📋 **AI Remediation Playbook:** Step-by-step actionable SRE runbook detailing immediate recovery steps, duration, risk levels, post-fix health validation checklists, rollback contingency procedures, and interactive simulation mode.

> **TL;DR:** Correlation tells you what broke. We tell you what's about to break worse, how it was fixed last time, why the root cause was selected, and provide a step-by-step SRE runbook to resolve it.

---

## 🏗️ System Architecture

Our solution is built on a scalable, modern architecture decoupling data generation, stream processing, and frontend visualization.

```mermaid
graph TD
    %% Hollow Neon Styling Definitions
    classDef frontend fill:none,stroke:#f97316,stroke-width:2px,color:#f97316,rx:5,ry:5
    classDef backend fill:none,stroke:#10b981,stroke-width:2px,color:#10b981,rx:5,ry:5
    classDef ml fill:none,stroke:#c084fc,stroke-width:2px,color:#c084fc,rx:5,ry:5
    classDef ai fill:none,stroke:#f87171,stroke-width:2px,color:#f87171,rx:5,ry:5
    classDef external fill:#f3f4f6,stroke:none,color:#111827,rx:5,ry:5

    subgraph Data [External Data Ecosystem]
        Loghub[Loghub HDFS_v1<br>Real Dataset]:::external
        AIOps[AIOps Challenge 2020<br>Real Dataset]:::external
        Prometheus[Prometheus & Datadog<br>Live Streams]:::external
        Gen[Synthetic Alert<br>Generator]:::external
    end

    subgraph Backend [FastAPI Alert Engine]
        Dedup[Deduplication Layer]:::backend
        Embed[TF-IDF Vectorization]:::ml
        Cluster[Time-Windowed DBSCAN]:::ml
        RootCause[Root Cause Identifier]:::backend

        Dedup --> Embed
        Embed --> Cluster
        Cluster --> RootCause
    end

    subgraph Intelligence [AI & ML Pipeline]
        RiskScore[Escalation Risk Score<br>Heuristics]:::ml
        DNA[Alert DNA Matching<br>Cosine Similarity]:::ml
        Forecast[Predictive Forecast<br>15m Horizon Engine]:::ml
        RCAConfidence[Root Cause Confidence<br>XAI Decision Model]:::ml
        Playbook[AI Remediation Playbook<br>SRE Runbook Engine]:::ml
        Summarizer[LLM Summarizer & Copilot<br>Cerebras / Groq Llama 3]:::ai
    end

    subgraph Frontend [Frontend Client]
        Dashboard[React / Vite Dashboard<br>Vercel Edge Network]:::frontend
    end

    Loghub --> Dedup
    AIOps --> Dedup
    Prometheus --> Dedup
    Gen --> Dedup

    RootCause --> RiskScore
    RootCause --> DNA
    RootCause --> Forecast
    RootCause --> RCAConfidence
    RootCause --> Playbook
    RootCause --> Summarizer

    RiskScore --> Dashboard
    DNA --> Dashboard
    Forecast --> Dashboard
    RCAConfidence --> Dashboard
    Playbook --> Dashboard
    Summarizer --> Dashboard

    %% Subgraph Styling
    style Data fill:none,stroke:#6b7280,stroke-width:1px,stroke-dasharray: 5 5
    style Backend fill:none,stroke:#6b7280,stroke-width:1px,stroke-dasharray: 5 5
    style Intelligence fill:none,stroke:#6b7280,stroke-width:1px,stroke-dasharray: 5 5
    style Frontend fill:none,stroke:#6b7280,stroke-width:1px,stroke-dasharray: 5 5
```

### ⚙️ Core Pipeline Stages

| Stage | Implementation Details | Location |
|---|---|---|
| **1. Ingestion & Generation** | Three switchable sources feed the same pipeline: (a) **Loghub HDFS_v1** — real alerts built from actual log lines whose block-level Normal/Anomaly label is the dataset's own human annotation; (b) **AIOps Challenge 2020** — real alerts built from the dataset's fault-injection log; (c) a multi-source synthetic alert generator simulating cascading incident scenarios + background noise. Switch between them via the **Dataset** dropdown in the TopBar. | `data/loghub_hdfs_loader.py`, `data/aiops_challenge_loader.py`, `backend/app/real_data.py`, `backend/app/real_data_aiops.py`, `data/synthetic_alert_generator.py` |
| **2. Deduplication** | Fingerprint hashing of `(service, alertname, 5-min window)` to filter redundant spikes (Alertmanager-style). | `backend/app/dedup.py` |
| **3. Embedding & Correlation** | Utilizes **TF-IDF vectorization + cosine similarity** for semantic matching. Clustered via DBSCAN (parameters grid-searched against ground truth). This lightweight approach replaces heavy transformer models, ensuring blazingly fast execution and low memory footprint. | `backend/app/clustering.py` |
| **4. Root Cause Analysis** | Identifies the earliest alert in a cluster, operating on the principle that failures propagate forward in time. | `backend/app/clustering.py` |
| **5. Escalation Risk Score** | Heuristic formula: `0.40·growth + 0.35·severity + 0.25·spread`. Fully normalized (0-1) and explainable. | `backend/app/risk_score.py` |
| **6. Alert DNA Matching** | Computes cosine similarity between cluster centroids and past incident TF-IDF vectors to surface resolutions for novel-but-similar issues. | `backend/app/alert_dna.py` |
| **7. LLM Summarization** | Translates complex, multi-service clusters into plain English incident summaries and powers the interactive AI Copilot (using **Cerebras / Llama-3.3-70b**). | `backend/app/summarizer.py`, `backend/app/assistant.py` |
| **8. Predictive Blast Radius Forecast** | Heuristic engine generating 15-minute horizon step forecasts (+5m, +10m, +15m) for risk escalation, projected alert volume growth, and downstream service spread. | `backend/app/forecast.py`, `frontend/src/pages/Forecast.jsx` |
| **9. Incident Time Machine** | Client-side forensic replay engine reconstructing incident formation keyframes from raw alert arrival to deduplication, DBSCAN clustering, risk escalation, and DNA match. | `frontend/src/pages/TimeMachine.jsx` |
| **10. Historical Incident Comparator** | PR-style visual diff engine comparing current clusters with past institutional memory (similarity factor breakdown, side-by-side timeline alignment, property diffs, and playbook resolutions). | `backend/app/main.py`, `frontend/src/components/HistoricalComparator.jsx` |
| **11. Root Cause Confidence Graph (XAI)** | Explainable AI decision-transparency dashboard ranking candidate services with normalized confidence scores (0-100%) and candidate rejection explanations. | `backend/app/root_cause_confidence.py`, `frontend/src/components/RootCauseConfidenceGraph.jsx` |
| **12. AI Remediation Playbook** | Actionable SRE runbook generator with step-by-step response plans, duration/risk badges, post-fix health validation checklists, rollback procedures, and interactive simulation mode. | `backend/app/playbook.py`, `frontend/src/components/RemediationPlaybook.jsx` |

---

## 🛠️ Technology Stack

**Backend & Data Science**

- **Python 3 & FastAPI:** High-performance async API server.
- **Scikit-Learn:** TF-IDF Vectorization and DBSCAN clustering algorithm.
- **Pandas & NumPy:** Fast vector operations and data manipulation.
- **Cerebras API:** Blazing fast Llama-3.3-70b inference for the AI Copilot and Incident Summarizer.

**Frontend UI**

- **React 19 & Vite:** Blazing fast modern frontend framework.
- **TailwindCSS 4:** Utility-first styling for a sleek, dark-mode focused UI.
- **React Flow / Dagre:** Interactive, dynamic Service Topology incident graphs.
- **Framer Motion:** Micro-animations and layout transitions.

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9+
- Node.js 18+ & npm/pnpm
- Cerebras API Key (optional, for AI features)

### 1. Backend Setup

```bash
# Install backend dependencies
pip install -r backend/requirements.txt

# Create a .env file and add your Cerebras API key (Optional but recommended)
echo "CEREBRAS_API_KEY=your_key_here" > .env

# One-time: build the real Loghub HDFS_v1 alert batch (downloads + caches
# HDFS_v1.zip from Zenodo, ~187MB, then writes data/loghub_hdfs_alerts.json)
python data/loghub_hdfs_loader.py

# One-time: build the real AIOps Challenge 2020 alert batch (reads only the
# real fault-injection CSV out of a 2.9GB archive via HTTP range requests)
python data/aiops_challenge_loader.py

# Start the FastAPI server
uvicorn app.main:app --app-dir backend --reload
```

_API will be available at http://localhost:8000_

### 2. Frontend Setup

```bash
# Navigate to the frontend directory
cd frontend

# Install dependencies
npm install

# Start the Vite development server
npm run dev
```

_Dashboard will be available at http://localhost:5180_

### 3. Production Deployment

The application is architected for zero-cost deployment on modern PaaS platforms:

- **Frontend (Vercel):** Connect the GitHub repository and deploy the `frontend/` directory using the Vite preset. API requests are automatically proxied to the backend via `vercel.json` rewrites to avoid CORS issues.
- **Backend (Render):** Deploy the repository as a Python Web Service on Render's Free Tier. The pipeline's use of TF-IDF (instead of heavy neural networks) ensures the entire backend runs comfortably within Render's 512MB memory limit. Set the `CEREBRAS_API_KEY` environment variable in Render's dashboard.

---

## 🗺️ Roadmap & Future Scope

- [x] Synthetic multi-source alert generator with ground-truth labels
- [x] Fingerprint deduplication layer
- [x] Embedding + time-windowed DBSCAN correlation (TF-IDF tuned)
- [x] Escalation Risk Score (explainable heuristic)
- [x] Alert DNA past-incident matching
- [x] FastAPI ingestion & pipeline endpoints
- [x] **Frontend:** Full integration of the React Dashboard (Feed, Deduplication, Correlations, Incidents, Service Topology)
- [x] **LLM Integration:** AI Copilot and Incident Summaries powered by Cerebras (Llama-3.3-70b).
- [x] **Real AIOps Datasets:** Both of PS10's named data sources wired end-to-end through the same pipeline, switchable live via the top-bar Dataset selector.
- [x] **Predictive Blast Radius Forecast:** 15-min horizon escalation & downstream blast radius prediction
- [x] **Incident Time Machine:** Interactive forensic timeline replay
- [x] **Historical Incident Comparator:** PR-style side-by-side visual diff for past incidents
- [x] **Root Cause Confidence Graph (XAI):** Decision transparency ranking candidate services
- [x] **AI Remediation Playbook:** Step-by-step SRE runbooks, validation, rollback, and simulation mode
- [x] **MTTR & Triage Time Saved:** Real-time calculation of triage minutes saved per resolved incident

<br/>
<div align="center">
  <i>Built for Synergy 2026</i>
</div>
