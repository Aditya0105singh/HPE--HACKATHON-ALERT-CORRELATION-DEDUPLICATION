import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight, BrainCircuit, CircleCheckBig, Clock, Dna, ListFilter, Inbox, Layers,
  Play, Sparkles, TrendingUp, X,
} from "lucide-react";

// ---- real algorithm parameters, pulled straight from the backend source --
// (backend/app/dedup.py, clustering.py, risk_score.py, alert_dna.py)
const DEDUP_WINDOW_SEC = 300;
const EMBED_METHOD = "TF-IDF (1-2 word n-grams)";
const DBSCAN_EPS = 1.00;
const DBSCAN_MIN_SAMPLES = 3;
const DNA_THRESHOLD = 25;

function useCountUp(target, active, duration = 700) {
  const [value, setValue] = useState(active ? 0 : target);
  const raf = useRef(null);
  useEffect(() => {
    if (!active) { setValue(target); return; }
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, active, duration]);
  return value;
}

function buildStages(data) {
  const stats = data.dedup_stats;
  const clusters = data.clusters ?? [];
  const noise = data.noise ?? [];
  const rawAlerts = data.raw_alerts ?? [];
  const sources = new Set(rawAlerts.map((a) => a.source)).size;
  const high = clusters.filter((c) => c.risk.level === "high").length;
  const medium = clusters.filter((c) => c.risk.level === "medium").length;
  const low = clusters.filter((c) => c.risk.level === "low").length;
  const matched = clusters.filter((c) => c.dna_match).length;
  const totalSaved = clusters.reduce((s, c) => s + (c.est_triage_minutes_saved || 0), 0);
  const dupCount = stats.raw_count - stats.unique_count;

  return [
    {
      id: "ingest", label: "Ingest", icon: Inbox, color: "var(--info)",
      metric: stats.raw_count, metricLabel: "alerts ingested",
      logLine: `Ingested ${stats.raw_count} alerts from ${sources} sources`,
      detail: {
        purpose: "Receive raw alerts from every monitoring source into one stream.",
        algorithm: "Webhook ingestion — a synthetic generator plays realistic incident cascades in this demo.",
        parameters: `${sources} active sources this window`,
        inputs: "Prometheus · Datadog · GCP Monitoring · Grafana · custom apps",
        outputs: `${stats.raw_count} raw alerts`,
      },
    },
    {
      id: "dedup", label: "Deduplication", icon: Layers, color: "var(--purple)",
      metric: stats.unique_count, metricLabel: "unique alerts",
      subMetric: `−${dupCount} duplicates`,
      logLine: `Removed ${dupCount} duplicates (${stats.reduction_pct}%) → ${stats.unique_count} unique alerts`,
      detail: {
        purpose: "Collapse repeated firings of the same underlying condition — a stuck check re-fires every evaluation interval.",
        algorithm: "Fingerprint match: service + alert name + time bucket, keeping the earliest of each group.",
        parameters: `Window: ${DEDUP_WINDOW_SEC / 60} minutes`,
        inputs: `${stats.raw_count} raw alerts`,
        outputs: `${stats.unique_count} unique alerts (${stats.reduction_pct}% reduction)`,
      },
    },
    {
      id: "embed", label: "Embedding", icon: BrainCircuit, color: "var(--accent)",
      metric: stats.unique_count, metricLabel: "vectors generated",
      logLine: `Vectorized ${stats.unique_count} alerts via ${EMBED_METHOD}`,
      detail: {
        purpose: "Convert each alert's text into a numeric vector so textual similarity can be measured.",
        algorithm: `scikit-learn TfidfVectorizer — ${EMBED_METHOD}`,
        parameters: "L2-normalized, vocabulary sized to this batch",
        inputs: `${stats.unique_count} unique alerts`,
        outputs: `${stats.unique_count} TF-IDF vectors`,
      },
    },
    {
      id: "cluster", label: "Correlation", icon: ListFilter, color: "var(--critical)",
      metric: clusters.length, metricLabel: "incidents formed",
      subMetric: `${noise.length} kept as noise`,
      logLine: `DBSCAN formed ${clusters.length} incident${clusters.length === 1 ? "" : "s"}, kept ${noise.length} alerts as background noise`,
      detail: {
        purpose: "Group alerts that are semantically related AND close in time into one incident — never force unrelated alerts together.",
        algorithm: "DBSCAN over a combined embedding-distance + time-proximity metric.",
        parameters: `eps = ${DBSCAN_EPS} · min_samples = ${DBSCAN_MIN_SAMPLES}`,
        inputs: `${stats.unique_count} embeddings`,
        outputs: `${clusters.length} incident clusters, ${noise.length} unclustered (background noise)`,
      },
    },
    {
      id: "risk", label: "Risk Scoring", icon: TrendingUp, color: "var(--high)",
      metric: high, metricLabel: "high-risk incidents",
      subMetric: `${medium} med · ${low} low`,
      logLine: `Scored escalation risk — ${high} high, ${medium} medium, ${low} low`,
      detail: {
        purpose: "Rank which incidents are about to get worse, not just how big they already are.",
        algorithm: "Weighted, fully explainable score — no black box.",
        parameters: "0.40 × growth rate + 0.35 × severity trend + 0.25 × service spread",
        inputs: `${clusters.length} incidents`,
        outputs: `${high} high · ${medium} medium · ${low} low risk`,
      },
    },
    {
      id: "dna", label: "Alert DNA", icon: Dna, color: "var(--purple)",
      metric: matched, metricLabel: `/ ${clusters.length} matched`,
      logLine: `Matched ${matched}/${clusters.length} incident${clusters.length === 1 ? "" : "s"} to the Alert DNA library`,
      detail: {
        purpose: "Check whether this incident resembles one we've already resolved.",
        algorithm: "Cosine similarity between this incident's centroid and a library of past incidents.",
        parameters: `Match threshold: ${DNA_THRESHOLD}%`,
        inputs: `${clusters.length} incident centroids`,
        outputs: `${matched} matched to a known runbook, ${clusters.length - matched} novel pattern${clusters.length - matched === 1 ? "" : "s"}`,
      },
    },
    {
      id: "incident", label: "Incident Creation", icon: CircleCheckBig, color: "var(--ok)",
      metric: clusters.length, metricLabel: "actionable incidents",
      subMetric: `${totalSaved} min saved (est.)`,
      logLine: `Created ${clusters.length} incident${clusters.length === 1 ? "" : "s"} — ~${totalSaved} min triage saved`,
      detail: {
        purpose: "Package each cluster into one incident an on-call engineer actually acts on.",
        algorithm: "Root cause = earliest / most severe alert in the cluster.",
        inputs: `${clusters.length} clusters`,
        outputs: `${clusters.length} incidents · ${stats.raw_count ? (100 * (1 - clusters.length / stats.raw_count)).toFixed(1) : 0}% noise reduction`,
      },
    },
  ];
}

function Connector({ active, color }) {
  return (
    <div className="relative flex-1 h-[2px] mx-1 rounded-full overflow-hidden shrink-0 hidden min-[1180px]:block" style={{ background: "var(--border)", minWidth: 24 }}>
      <AnimatePresence>
        {active && (
          <motion.span
            className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
            style={{ background: color, boxShadow: `0 0 8px ${color}` }}
            initial={{ left: "-5%", opacity: 0 }}
            animate={{ left: "100%", opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function StageCard({ stage, isActive, isDone, onClick, countUpActive }) {
  const Icon = stage.icon;
  const displayMetric = useCountUp(stage.metric, countUpActive);
  return (
    <motion.button
      onClick={() => onClick(stage)}
      className="rounded-xl border p-3.5 text-left cursor-pointer shrink-0 w-[152px]"
      style={{
        background: "var(--panel)",
        borderColor: isActive ? stage.color : "var(--border)",
        boxShadow: isActive ? `0 0 0 1px ${stage.color}, 0 0 16px color-mix(in srgb, ${stage.color} 35%, transparent)` : "var(--shadow-card)",
      }}
      animate={isActive ? { scale: [1, 1.04, 1] } : { scale: 1 }}
      transition={{ duration: 0.5 }}
    >
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${stage.color} 18%, transparent)`, color: stage.color }}
        >
          <Icon size={13} strokeWidth={2.25} />
        </span>
        {isDone && <CircleCheckBig size={12} strokeWidth={2.5} style={{ color: "var(--ok)" }} />}
      </div>
      <div className="text-[10.5px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--muted)" }}>{stage.label}</div>
      <div className="text-[22px] font-bold leading-none tabular-nums" style={{ color: "var(--text)" }}>{displayMetric}</div>
      <div className="text-[10.5px] mt-1 truncate" style={{ color: "var(--muted)" }}>{stage.metricLabel}</div>
      {stage.subMetric && <div className="text-[10.5px] mt-0.5 truncate" style={{ color: stage.color }}>{stage.subMetric}</div>}
    </motion.button>
  );
}

function StageDrawer({ stage, onClose }) {
  return (
    <AnimatePresence>
      {stage && (
        <>
          <motion.div
            className="fixed inset-0 z-40"
            style={{ background: "rgba(0,0,0,.45)" }}
            onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          />
          <motion.div
            className="fixed right-0 top-0 bottom-0 z-50 w-[420px] max-w-full border-l overflow-y-auto"
            style={{ background: "var(--panel)", borderColor: "var(--border)" }}
            initial={{ x: 40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="flex items-start gap-3 p-5 border-b sticky top-0 z-10" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
              <span
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                style={{ background: `color-mix(in srgb, ${stage.color} 18%, transparent)`, color: stage.color }}
              >
                <stage.icon size={17} strokeWidth={2.25} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[17px]">{stage.label}</div>
                <div className="text-[13px] mt-0.5 tabular-nums" style={{ color: stage.color }}>{stage.metric} {stage.metricLabel}</div>
              </div>
              <button onClick={onClose} className="cursor-pointer px-1" style={{ color: "var(--muted)" }}><X size={17} strokeWidth={2} /></button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <div className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--muted)" }}>Purpose</div>
                <p className="text-[14px] leading-relaxed">{stage.detail.purpose}</p>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--muted)" }}>Algorithm</div>
                <p className="text-[14px] leading-relaxed">{stage.detail.algorithm}</p>
              </div>
              {stage.detail.parameters && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide font-semibold mb-1" style={{ color: "var(--muted)" }}>Parameters</div>
                  <p className="text-[13.5px] font-mono px-2.5 py-1.5 rounded-md inline-block" style={{ background: "var(--panel-2)", color: stage.color }}>{stage.detail.parameters}</p>
                </div>
              )}
              <div className="rounded-xl border p-3.5" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2 text-[13px] mb-2">
                  <span style={{ color: "var(--muted)" }}>Inputs</span>
                  <ArrowRight size={13} style={{ color: "var(--muted)" }} />
                  <span style={{ color: stage.color }}>Outputs</span>
                </div>
                <div className="text-[13.5px] mb-1">{stage.detail.inputs}</div>
                <div className="text-[13px]" style={{ color: "var(--muted)" }}>→</div>
                <div className="text-[13.5px] font-medium" style={{ color: stage.color }}>{stage.detail.outputs}</div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default function Pipeline({ data }) {
  const [openStage, setOpenStage] = useState(null);
  const [runToken, setRunToken] = useState(0);
  const [runningIdx, setRunningIdx] = useState(null);
  const [logVisible, setLogVisible] = useState(Infinity);
  const timers = useRef([]);

  const stats = data?.dedup_stats;
  const clusters = data?.clusters ?? [];
  const noise = data?.noise ?? [];
  const stages = useMemo(() => (stats ? buildStages(data) : []), [data, stats]);
  const log = useMemo(() => stages.map((s) => s.logLine), [stages]);

  const runPipeline = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setRunningIdx(-1);
    setLogVisible(0);
    setRunToken((t) => t + 1);
    stages.forEach((_, i) => {
      timers.current.push(setTimeout(() => {
        setRunningIdx(i);
        setLogVisible(i + 1);
      }, i * 550));
    });
    timers.current.push(setTimeout(() => setRunningIdx(null), stages.length * 550 + 400));
  };

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  if (!stats) return null;

  const totalSaved = clusters.reduce((s, c) => s + (c.est_triage_minutes_saved || 0), 0);
  const noisePct = stats.raw_count ? (100 * (1 - clusters.length / stats.raw_count)).toFixed(1) : 0;
  const isReplaying = runningIdx !== null;

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-lg font-semibold">Pipeline</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>live from current batch</span>
        <button
          onClick={runPipeline}
          disabled={isReplaying}
          className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[13px] font-semibold cursor-pointer grad-btn disabled:opacity-60"
        >
          <Play size={13} strokeWidth={2.25} fill="currentColor" /> {isReplaying ? "Running…" : "Run Pipeline"}
        </button>
      </div>
      <p className="text-[14px] mb-6" style={{ color: "var(--muted)" }}>
        Every number below is the current batch flowing through the real pipeline — dedup → embed → cluster → risk → Alert DNA. Click a stage for exactly how it works, or replay the run.
      </p>

      <div className="flex items-stretch mb-8 overflow-x-auto pb-2" key={runToken}>
        {stages.map((stage, i) => (
          <div key={stage.id} className="flex items-center">
            <StageCard
              stage={stage}
              isActive={runningIdx === i}
              isDone={runningIdx !== null && runningIdx > i}
              onClick={setOpenStage}
              countUpActive={isReplaying}
            />
            {i < stages.length - 1 && <Connector active={runningIdx === i} color={stage.color} />}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 min-[1000px]:grid-cols-[1.3fr_1fr] gap-4">
        <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles size={15} strokeWidth={2.25} style={{ color: "var(--accent)" }} />
            <span className="text-[14px] font-semibold">Final Result</span>
          </div>
          <div className="flex items-center flex-wrap gap-3 text-center">
            <BigNumber value={stats.raw_count} label="raw alerts" active={isReplaying} />
            <ArrowRight size={18} style={{ color: "var(--muted)" }} />
            <BigNumber value={stats.unique_count} label="unique" active={isReplaying} color="var(--purple)" />
            <ArrowRight size={18} style={{ color: "var(--muted)" }} />
            <BigNumber value={clusters.length} label="incidents" active={isReplaying} color="var(--accent)" />
            <ArrowRight size={18} style={{ color: "var(--muted)" }} />
            <BigNumber value={Number(noisePct)} suffix="%" label="noise reduced" active={isReplaying} color="var(--ok)" />
          </div>
          <div className="mt-4 pt-4 border-t flex items-center gap-2 text-[13.5px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            <Clock size={14} strokeWidth={2} style={{ color: "var(--ok)" }} />
            Est. <b style={{ color: "var(--ok)" }}>{totalSaved} min</b> of manual triage saved this window, risk-ranked with known fixes attached where history matches.
          </div>
        </div>

        <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="text-[14px] font-semibold mb-3">Pipeline Timeline</div>
          <div className="space-y-0">
            {log.map((line, i) => (
              <AnimatePresence key={i}>
                {i < logVisible && (
                  <motion.div
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    className="flex items-start gap-2.5 py-1.5"
                  >
                    <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ background: stages[i].color }} />
                    <span className="text-[12.5px] leading-relaxed" style={{ color: "var(--text)" }}>{line}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            ))}
          </div>
        </div>
      </div>

      <StageDrawer stage={openStage} onClose={() => setOpenStage(null)} />
    </div>
  );
}

function BigNumber({ value, suffix = "", label, active, color = "var(--text)" }) {
  const display = useCountUp(value, active, 900);
  return (
    <div className="px-2">
      <div className="text-[30px] font-extrabold leading-none tabular-nums" style={{ color }}>{display}{suffix}</div>
      <div className="text-[11px] mt-1" style={{ color: "var(--muted)" }}>{label}</div>
    </div>
  );
}
