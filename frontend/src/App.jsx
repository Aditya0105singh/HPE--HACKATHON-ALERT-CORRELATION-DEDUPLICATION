import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Bot, CircleCheckBig, CloudLightning, Dna, Sparkles, Zap } from "lucide-react";
import { fetchPipeline, loadAiopsBatch, loadDemoBatch, loadRealBatch } from "./api";
import Sidebar from "./components/Sidebar";
import TopBar from "./components/TopBar";
import { StormToasts, StormControls, SCENARIOS } from "./components/storm";
import GlobalAssistantChat from "./components/GlobalAssistantChat";
import Home from "./pages/Home";
import Feed from "./pages/Feed";
import Deduplication from "./pages/Deduplication";
import Correlations from "./pages/Correlations";
import Incidents from "./pages/Incidents";
import Evaluation from "./pages/Evaluation";
import Pipeline from "./pages/Pipeline";
import Topology from "./pages/Topology";
import Placeholder from "./pages/Placeholder";

const STORM_SECONDS = 25; // replay length at 1× speed
const TICK_MS = 120;

// Alerts older than this (relative to the newest alert) are pre-existing
// history: they appear instantly, only the fresh incident window replays.
const REPLAY_WINDOW_MIN = 50;

function buildSchedule(alerts) {
  const sorted = [...alerts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const newest = new Date(sorted[sorted.length - 1].timestamp).getTime();
  const cutoff = newest - REPLAY_WINDOW_MIN * 60 * 1000;

  const history = [];
  const recent = [];
  for (const a of sorted) {
    (new Date(a.timestamp).getTime() < cutoff ? history : recent).push(a);
  }

  const t0 = recent.length ? new Date(recent[0].timestamp).getTime() : newest;
  const span = Math.max(newest - t0, 1);
  const schedule = new Map();
  history.forEach((a) => schedule.set(a.id, 0));
  let prev = 0;
  recent.forEach((a) => {
    let rt = ((new Date(a.timestamp).getTime() - t0) / span) * (STORM_SECONDS - 1) + 0.5;
    rt = Math.max(rt, prev + 0.08); // keep a visible rhythm even in bursts
    prev = rt;
    schedule.set(a.id, Math.min(rt, STORM_SECONDS));
  });
  return schedule;
}

// Project the final pipeline state down to only-revealed alerts: partial
// clusters with risk climbing toward the real final score.
function projectStorm(full, revealed) {
  const clusters = [];
  for (const c of full.clusters) {
    const members = c.alerts.filter((a) => revealed.has(a.id));
    if (!members.length) continue;
    const frac = members.length / c.alerts.length;
    const score = Math.round(c.risk.score * Math.min(1, frac * 1.15) * 1000) / 1000;
    const level = score >= 0.66 ? "high" : score >= 0.33 ? "medium" : "low";
    clusters.push({
      ...c,
      alerts: members,
      size: members.length,
      raw_alert_count: members.reduce((s, m) => s + (m.duplicate_count || 1), 0),
      risk: { ...c.risk, score, level, services_affected: new Set(members.map((m) => m.service)).size },
      dna_match: frac === 1 ? c.dna_match : null,
    });
  }
  clusters.sort((a, b) => b.risk.score - a.risk.score);

  const raw = full.raw_alerts.filter((a) => revealed.has(a.id));
  const noise = full.noise.filter((a) => revealed.has(a.id));
  const uniqueCount = noise.length + clusters.reduce((s, c) => s + c.size, 0);
  return {
    ...full,
    raw_alerts: raw,
    noise,
    clusters,
    dedup_stats: {
      ...full.dedup_stats,
      raw_count: raw.length,
      unique_count: uniqueCount,
      reduction_pct: raw.length ? Math.round(1000 * (1 - uniqueCount / raw.length)) / 10 : 0,
    },
  };
}

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [dark, setDark] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unread, setUnread] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [dataSource, setDataSource] = useState("synthetic");

  // storm = { full, schedule, elapsed, speed, paused }
  const [storm, setStorm] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [aiOpen, setAiOpen] = useState(false);
  const firedRef = useRef({ formed: new Set(), dna: new Set(), summary: false });
  const toastId = useRef(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  const refresh = useCallback(async () => {
    try {
      const fresh = await fetchPipeline();
      setData(fresh);
      setError(null);
      setLastUpdated(Date.now());
      // Infer the badge from what's actually loaded rather than assuming —
      // the backend may already have a real dataset loaded from an earlier
      // session (e.g. a page reload mid-demo).
      const src = fresh.raw_alerts?.[0]?.source;
      if (src === "loghub-hdfs") setDataSource("loghub");
      else if (src === "aiops-challenge-2020") setDataSource("aiops");
      else if (fresh.raw_alerts?.length) setDataSource("synthetic");
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Auto-refresh: poll the pipeline every 30s while no storm replay is running.
  const stormOn = storm !== null;
  useEffect(() => {
    if (stormOn) return;
    const iv = setInterval(refresh, 30000);
    return () => clearInterval(iv);
  }, [refresh, stormOn]);

  const pushToast = useCallback((t, ttl = 6500) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-4), { ...t, id }]);
    setNotifications((prev) => [{ ...t, id, time: new Date().toISOString() }, ...prev].slice(0, 25));
    setUnread((n) => n + 1);
    if (!t.sticky) setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), ttl);
  }, []);

  const startStorm = async (scenario) => {
    setBusy(true);
    try {
      await loadDemoBatch({ scenario });
      const full = await fetchPipeline();
      setDataSource("synthetic");
      firedRef.current = { formed: new Set(), dna: new Set(), summary: false };
      setToasts([]);
      const label = SCENARIOS.find((s) => s.key === scenario)?.label || "Random failure mix";
      pushToast({ kind: "Injecting", icon: CloudLightning, title: label, body: "Raw alerts flooding into the feed…", color: "var(--accent)" });
      setStorm({ full, schedule: buildSchedule(full.raw_alerts), elapsed: 0, speed: 1, paused: false });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const instantLoad = async () => {
    setBusy(true);
    try {
      await loadDemoBatch({});
      await refresh();
      setDataSource("synthetic");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadRealData = async () => {
    setBusy(true);
    try {
      await loadRealBatch();
      const fresh = await fetchPipeline();
      setData(fresh);
      setError(null);
      setLastUpdated(Date.now());
      setDataSource("loghub");
      const anomaly = fresh.raw_alerts.filter((a) => a.ground_truth === "Anomaly").length;
      const normal = fresh.raw_alerts.length - anomaly;
      pushToast({
        kind: "Dataset loaded",
        icon: Sparkles,
        title: `${fresh.raw_alerts.length} real alerts from Loghub HDFS_v1`,
        body: `${anomaly} from Anomaly-labeled blocks · ${normal} from Normal-labeled blocks (real dataset ground truth)`,
        color: "var(--info)",
        sticky: true,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const loadAiopsData = async () => {
    setBusy(true);
    try {
      await loadAiopsBatch();
      const fresh = await fetchPipeline();
      setData(fresh);
      setError(null);
      setLastUpdated(Date.now());
      setDataSource("aiops");
      const byFault = {};
      for (const a of fresh.raw_alerts) byFault[a.ground_truth] = (byFault[a.ground_truth] || 0) + 1;
      const summary = Object.entries(byFault).map(([k, v]) => `${v} ${k}`).join(" · ");
      pushToast({
        kind: "Dataset loaded",
        icon: Sparkles,
        title: `${fresh.raw_alerts.length} real alerts from AIOps Challenge 2020`,
        body: `Real fault-injection log: ${summary}`,
        color: "var(--info)",
        sticky: true,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const switchDataSource = (key) => {
    if (key === "loghub") return loadRealData();
    if (key === "aiops") return loadAiopsData();
    return instantLoad();
  };

  const finishStorm = useCallback((s) => {
    setData(s.full);
    setStorm(null);
    if (!firedRef.current.summary) {
      firedRef.current.summary = true;
      const st = s.full.dedup_stats;
      const saved = s.full.clusters.reduce((sum, c) => sum + (c.est_triage_minutes_saved || 0), 0);
      pushToast({
        kind: "Complete",
        icon: CircleCheckBig,
        title: `${st.raw_count} alerts → ${s.full.clusters.length} incidents`,
        body: `${(100 * (1 - s.full.clusters.length / st.raw_count)).toFixed(1)}% noise removed · est. ${saved} min triage saved`,
        color: "var(--ok)",
        sticky: true,
      });
    }
  }, [pushToast]);

  // replay engine — reads current storm via ref so toast side effects stay
  // out of React state updaters (StrictMode-safe)
  const stormRef = useRef(null);
  useEffect(() => {
    stormRef.current = storm;
  }, [storm]);

  useEffect(() => {
    if (!storm) return;
    const iv = setInterval(() => {
      const s = stormRef.current;
      if (!s) {
        clearInterval(iv);
        return;
      }
      if (s.paused) return;
      const elapsed = s.elapsed + (TICK_MS / 1000) * s.speed;

      // incident-forming + DNA toasts
      const revealed = new Set([...s.schedule].filter(([, rt]) => rt <= elapsed).map(([id]) => id));
      for (const c of s.full.clusters) {
        const n = c.alerts.filter((a) => revealed.has(a.id)).length;
        if (!firedRef.current.formed.has(c.cluster_id) && n >= Math.max(2, Math.ceil(c.alerts.length / 2))) {
          firedRef.current.formed.add(c.cluster_id);
          pushToast({
            kind: "Correlating",
            icon: Zap,
            title: c.root_cause.service,
            body: `${n} alerts correlated — ${c.root_cause.alertname}`,
            color: c.risk.level === "high" ? "var(--critical)" : "var(--high)",
          });
        }
        if (!firedRef.current.dna.has(c.cluster_id) && n === c.alerts.length && c.dna_match) {
          firedRef.current.dna.add(c.cluster_id);
          pushToast({
            kind: "Alert DNA",
            icon: Dna,
            title: `${c.dna_match.similarity_pct}% match to ${c.dna_match.incident_id}`,
            body: `Known fix: ${c.dna_match.resolution.slice(0, 70)}… (${c.dna_match.resolution_minutes} min last time)`,
            color: "var(--purple)",
          });
        }
      }

      if (elapsed >= STORM_SECONDS + 0.5) {
        clearInterval(iv);
        finishStorm(s);
        return;
      }
      setStorm({ ...s, elapsed });
    }, TICK_MS);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storm !== null]);

  const viewData = useMemo(() => {
    if (!storm) return data;
    const revealed = new Set([...storm.schedule].filter(([, rt]) => rt <= storm.elapsed).map(([id]) => id));
    return projectStorm(storm.full, revealed);
  }, [storm, data]);

  const stormRate = storm
    ? Math.max(1, Math.round((storm.schedule.size / STORM_SECONDS) * storm.speed))
    : 0;

  // Derived straight from the URL rather than useParams(): App sits above
  // <Routes>, so useParams() here would never see route params — it only
  // works inside the element a route actually matched.
  const incidentId = useMemo(() => {
    const m = location.pathname.match(/^\/incidents\/([^/]+)/);
    return m ? m[1] : null;
  }, [location.pathname]);

  const incidentCluster = useMemo(() => {
    if (!incidentId || !viewData?.clusters) return null;
    return viewData.clusters.find((c) => String(c.cluster_id) === String(incidentId)) ?? null;
  }, [incidentId, viewData]);

  return (
    <div className="h-full flex">
      <Sidebar data={viewData} collapsed={collapsed} lastUpdated={lastUpdated} />

      <div className="flex-1 min-w-0 flex flex-col">
        <TopBar
          collapsed={collapsed}
          onToggleSidebar={() => setCollapsed((v) => !v)}
          error={error}
          lastUpdated={lastUpdated}
          dark={dark}
          onTheme={() => setDark((v) => !v)}
          notifications={notifications}
          unread={unread}
          onBellSeen={() => setUnread(0)}
          onStorm={startStorm}
          onInstant={instantLoad}
          dataSource={dataSource}
          onSwitchDataSource={switchDataSource}
          busy={busy}
          stormRate={stormRate}
        />

        <main className="flex-1 min-h-0 min-w-0 overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Home data={viewData} />} />
            <Route path="/feed" element={<Feed data={viewData} />} />
            <Route path="/firing" element={<Feed data={viewData} firingOnly stormRate={stormRate} />} />
            <Route path="/5xx" element={<Feed data={viewData} criticalOnly />} />
            <Route path="/deduplication" element={<Deduplication data={viewData} />} />
            <Route path="/correlations" element={<Correlations data={viewData} stormActive={!!storm} />} />
            <Route path="/incidents" element={<Incidents data={viewData} />} />
            <Route path="/incidents/:clusterId" element={<Incidents data={viewData} />} />
            <Route path="/evaluation" element={<Evaluation />} />
            <Route path="/pipeline" element={<Pipeline data={viewData} />} />
            <Route path="/workflows" element={<Placeholder title="Workflows" />} />
            <Route path="/topology" element={<Topology data={viewData} />} />
            <Route path="/providers" element={<Placeholder title="Providers" note="Synthetic sources today (prometheus · datadog · gcp-monitoring · grafana · custom-app); live integrations out of hackathon scope." />} />
          </Routes>

          {/* Global floating AI chat — persists across every route */}
          <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {aiOpen && (
              <div className="mb-4 origin-bottom-right animate-in fade-in zoom-in duration-200">
                <GlobalAssistantChat
                  data={viewData}
                  pathname={location.pathname}
                  incidentId={incidentId}
                  incidentCluster={incidentCluster}
                  onClose={() => setAiOpen(false)}
                />
              </div>
            )}
            {!aiOpen && (
              <button
                id="global-ai-chat-toggle"
                onClick={() => setAiOpen(true)}
                title="Open AI Assistant"
                className="flex h-14 w-14 items-center justify-center rounded-full shadow-2xl transition-transform hover:scale-110 active:scale-95 cursor-pointer"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                <Bot size={28} strokeWidth={2.25} />
              </button>
            )}
          </div>
        </main>
      </div>

      <StormToasts
        toasts={toasts}
        onDismiss={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))}
        onView={(t) => {
          setToasts((prev) => prev.filter((x) => x.id !== t.id));
          navigate("/correlations");
        }}
      />

      {storm && (
        <StormControls
          progress={storm.elapsed / STORM_SECONDS}
          speed={storm.speed}
          paused={storm.paused}
          onPause={() => setStorm((s) => ({ ...s, paused: !s.paused }))}
          onSpeed={() => setStorm((s) => ({ ...s, speed: s.speed === 1 ? 4 : s.speed === 4 ? 16 : 1 }))}
          onSkip={() => setStorm((s) => ({ ...s, elapsed: STORM_SECONDS + 0.6, paused: false }))}
        />
      )}
    </div>
  );
}
