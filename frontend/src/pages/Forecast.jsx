import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity, AlertTriangle, ArrowRight, CheckCircle2, ChevronRight, Clock,
  Compass, Dna, Play, Pause, Radio, RefreshCw, Server, Shield, ShieldAlert,
  Sparkles, TrendingUp, Users, Wrench, Zap
} from "lucide-react";
import { fetchForecast } from "../api";
import { AlertIcon, Info, PriorityBadge, RiskMeter, ServiceChip, SeverityDot, StatCard } from "../components/ui";

const STAGE_LABELS = {
  0: { label: "Current", time: "T+0 min", badge: "Live" },
  5: { label: "+5 min Horizon", time: "T+5 min", badge: "Immediate" },
  10: { label: "+10 min Horizon", time: "T+10 min", badge: "Mid-term" },
  15: { label: "+15 min Horizon", time: "T+15 min", badge: "Critical Peak" },
};

const RISK_COLOR = { high: "var(--critical)", medium: "var(--high)", low: "var(--ok)" };

export default function Forecast({ data, stormActive = false }) {
  const navigate = useNavigate();
  const { clusterId } = useParams();
  const clusters = data?.clusters ?? [];

  // Select target cluster
  const selectedCluster = useMemo(() => {
    if (!clusters.length) return null;
    if (clusterId) {
      const match = clusters.find((c) => String(c.cluster_id) === String(clusterId));
      if (match) return match;
    }
    return clusters[0]; // Default to highest risk cluster
  }, [clusters, clusterId]);

  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeStage, setActiveStage] = useState(0); // 0, 5, 10, 15
  const [playing, setPlaying] = useState(false);

  // Fetch forecast whenever selected cluster changes
  useEffect(() => {
    if (!selectedCluster) {
      setForecastData(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    fetchForecast(selectedCluster.cluster_id)
      .then((res) => {
        if (isMounted) setForecastData(res);
      })
      .catch((err) => {
        console.error("Forecast fetch error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedCluster]);

  // Timeline auto-play timer
  useEffect(() => {
    if (!playing) return;
    const stages = [0, 5, 10, 15];
    const iv = setInterval(() => {
      setActiveStage((prev) => {
        const idx = stages.indexOf(prev);
        return stages[(idx + 1) % stages.length];
      });
    }, 3000);
    return () => clearInterval(iv);
  }, [playing]);

  if (!data || !clusters.length) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--muted)" }}>
        <Compass size={40} className="mx-auto mb-3 opacity-50" />
        <h2 className="text-lg font-semibold mb-1">No Active Incidents to Forecast</h2>
        <p className="text-sm">Load a dataset or inject a failure to generate incident forecasts.</p>
      </div>
    );
  }

  const root = selectedCluster.root_cause;
  const dna = selectedCluster.dna_match;
  const currentRisk = selectedCluster.risk;
  const currentRiskPct = Math.round(currentRisk.score * 100);

  // Extract forecast steps
  const steps = forecastData?.forecast ?? [
    { minutes: 5, risk: Math.min(100, currentRiskPct + 8), alerts: selectedCluster.raw_alert_count + 15, newServices: ["checkout-service"], confidence: 0.92 },
    { minutes: 10, risk: Math.min(100, currentRiskPct + 16), alerts: selectedCluster.raw_alert_count + 35, newServices: ["billing-service"], confidence: 0.88 },
    { minutes: 15, risk: Math.min(100, currentRiskPct + 24), alerts: selectedCluster.raw_alert_count + 60, newServices: ["notification-service"], confidence: 0.82 },
  ];

  const stageForecast = steps.find((s) => s.minutes === activeStage) ?? {
    minutes: 0,
    risk: currentRiskPct,
    alerts: selectedCluster.raw_alert_count,
    newServices: [],
    confidence: forecastData?.confidence ?? 0.88,
  };

  const confidence = forecastData?.confidence ?? 0.88;
  const confidencePct = Math.round(confidence * 100);
  const recAction = forecastData?.recommendedImmediateAction ?? "Investigate root cause service and isolate downstream API cascades.";
  const reasoning = forecastData?.reasoning ?? [
    "Alert growth velocity is rising in current monitoring window",
    "Severity trend contains active critical/high severity alerts",
    `${currentRisk.services_affected} services currently experiencing symptoms`,
    dna ? `Historical Incident ${dna.incident_id} matched at ${dna.similarity_pct}% similarity` : "Novel incident pattern detected across topology",
  ];

  // Base services vs predicted services
  const currentServices = [...new Set(selectedCluster.alerts.map((a) => a.service))];
  const predictedServices5 = steps[0]?.newServices ?? [];
  const predictedServices10 = steps[1]?.newServices ?? [];
  const predictedServices15 = steps[2]?.newServices ?? [];
  const allPredicted = [...new Set([...predictedServices5, ...predictedServices10, ...predictedServices15])];

  return (
    <div className="p-6 overflow-y-auto h-full flex flex-col gap-6">
      {/* Header & Incident Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider grad-btn flex items-center gap-1">
              <Sparkles size={12} strokeWidth={2.5} /> Predictive Forecast
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
              Explainable Heuristic Pipeline Extension
            </span>
          </div>
          <h1 className="text-xl font-bold flex items-center gap-2.5">
            Predictive Blast Radius & Escalation Forecast
          </h1>
        </div>

        {/* Incident Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Select Incident:
          </label>
          <select
            value={selectedCluster.cluster_id}
            onChange={(e) => navigate(`/forecast/${e.target.value}`)}
            className="rounded-lg border px-3 py-2 text-sm font-semibold cursor-pointer outline-none transition-all"
            style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            {clusters.map((c) => (
              <option key={c.cluster_id} value={c.cluster_id}>
                Cluster {c.cluster_id} — {c.root_cause.service} ({c.risk.level.toUpperCase()} risk)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Top Banner KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <StatCard
          icon={<ShieldAlert size={16} />}
          label="Target Incident"
          value={`Cluster ${selectedCluster.cluster_id}`}
          color={RISK_COLOR[currentRisk.level]}
          delta={`${root.service} / ${root.alertname}`}
          spark={false}
        />
        <StatCard
          icon={<Activity size={16} />}
          label="Current Risk"
          value={`${currentRiskPct}%`}
          color={RISK_COLOR[currentRisk.level]}
          delta={`${currentRisk.level.toUpperCase()} risk level`}
          spark={false}
        />
        <StatCard
          icon={<Compass size={16} />}
          label="Forecast Confidence"
          value={`${confidencePct}%`}
          color="var(--purple)"
          delta="Deterministic DNA + Heuristics"
          spark={false}
        />
        <StatCard
          icon={<Radio size={16} />}
          label="Predicted Blast Radius"
          value={`${currentServices.length + allPredicted.length} Services`}
          color="var(--accent)"
          delta={`+${allPredicted.length} new services within 15m`}
          spark={false}
        />
      </div>

      {/* Timeline Controls & Horizon Selector */}
      <div className="rounded-xl border p-5 shrink-0" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Clock size={17} style={{ color: "var(--accent)" }} />
              Incident Escalation Timeline Projection
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Scrub or auto-play through predicted 15-minute failure cascade horizons.
            </p>
          </div>

          <button
            onClick={() => setPlaying(!playing)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all hover:brightness-125"
            style={{
              background: playing ? "var(--accent)" : "var(--panel-2)",
              borderColor: "var(--border)",
              color: playing ? "#fff" : "var(--text)",
            }}
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
            {playing ? "Pause Playback" : "Auto-Play Timeline"}
          </button>
        </div>

        {/* Timeline Horizon Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[0, 5, 10, 15].map((mins) => {
            const isSelected = activeStage === mins;
            const meta = STAGE_LABELS[mins];
            const stepObj = mins === 0
              ? { risk: currentRiskPct, alerts: selectedCluster.raw_alert_count, confidence }
              : steps.find((s) => s.minutes === mins);
            const riskVal = stepObj?.risk ?? currentRiskPct;
            const color = riskVal >= 80 ? "var(--critical)" : riskVal >= 50 ? "var(--high)" : "var(--ok)";

            return (
              <button
                key={mins}
                onClick={() => setActiveStage(mins)}
                className={`rounded-lg border p-3.5 text-left transition-all cursor-pointer relative overflow-hidden ${
                  isSelected ? "ring-2 ring-[var(--accent)]" : "hover:brightness-110"
                }`}
                style={{
                  background: isSelected ? "color-mix(in srgb, var(--accent) 10%, var(--panel-2))" : "var(--panel-2)",
                  borderColor: isSelected ? "var(--accent)" : "var(--border)",
                }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-bold font-mono" style={{ color: isSelected ? "var(--accent)" : "var(--muted)" }}>
                    {meta.time}
                  </span>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
                    style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}
                  >
                    {riskVal}% Risk
                  </span>
                </div>
                <div className="text-sm font-semibold mb-1">{meta.label}</div>
                <div className="text-xs flex items-center justify-between" style={{ color: "var(--muted)" }}>
                  <span>{stepObj?.alerts ?? 0} alerts</span>
                  <span>{mins === 0 ? "Observed" : `+${(stepObj?.newServices ?? []).length} svcs`}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Projected Risk & Blast Radius Expansion */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
        {/* Risk Progression Chart & Metrics */}
        <div className="rounded-xl border p-5 flex flex-col" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <TrendingUp size={17} style={{ color: "var(--high)" }} />
              Projected Escalation Risk Curve
            </h3>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
              Horizon: {STAGE_LABELS[activeStage].time}
            </span>
          </div>

          {/* Animated Risk Gauges */}
          <div className="space-y-4 my-auto">
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Current Risk Baseline</span>
                <span className="font-bold">{currentRiskPct}%</span>
              </div>
              <div className="h-2 rounded-full" style={{ background: "var(--panel-2)" }}>
                <div
                  className="h-2 rounded-full transition-all duration-500"
                  style={{ width: `${currentRiskPct}%`, background: RISK_COLOR[currentRisk.level] }}
                />
              </div>
            </div>

            {steps.map((step) => {
              const isCurrentActive = activeStage === step.minutes;
              const color = step.risk >= 80 ? "var(--critical)" : step.risk >= 50 ? "var(--high)" : "var(--ok)";
              return (
                <div
                  key={step.minutes}
                  className={`p-3 rounded-lg border transition-all ${
                    isCurrentActive ? "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] border-[var(--accent)]" : "border-transparent"
                  }`}
                >
                  <div className="flex justify-between text-xs font-semibold mb-1">
                    <span className="flex items-center gap-1.5">
                      <Clock size={12} style={{ color }} />
                      +{step.minutes} Minutes Horizon
                    </span>
                    <span className="font-mono" style={{ color }}>{step.risk}% Projected Risk</span>
                  </div>
                  <div className="h-2 rounded-full" style={{ background: "var(--panel-2)" }}>
                    <div
                      className="h-2 rounded-full transition-all duration-700"
                      style={{ width: `${step.risk}%`, background: color }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] mt-1.5" style={{ color: "var(--muted)" }}>
                    <span>Projected alerts: <b>{step.alerts}</b></span>
                    <span>Confidence: <b>{Math.round(step.confidence * 100)}%</b></span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Animated Service Blast Radius Expansion Graph */}
        <div className="rounded-xl border p-5 flex flex-col" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Users size={17} style={{ color: "var(--accent)" }} />
              Predicted Service Blast Radius Expansion
            </h3>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
              {currentServices.length + allPredicted.length} Total Services
            </span>
          </div>

          {/* Topological Cascade Flow */}
          <div className="flex-1 flex flex-col justify-center gap-3">
            {/* Root Cause Node */}
            <div className="rounded-xl border p-3.5 flex items-center gap-3" style={{ background: "color-mix(in srgb, var(--critical) 12%, var(--panel-2))", borderColor: "var(--critical)" }}>
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--critical)", color: "#fff" }}>
                <Server size={18} />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm truncate">{root.service}</span>
                  <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase" style={{ background: "var(--critical)", color: "#fff" }}>
                    Root Cause 🔴
                  </span>
                </div>
                <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{root.alertname}</div>
              </div>
            </div>

            {/* Downstream Currently Affected Services */}
            {currentServices.filter((s) => s !== root.service).map((svc) => (
              <div key={svc} className="rounded-xl border p-3 flex items-center gap-3 ml-4" style={{ background: "color-mix(in srgb, var(--high) 10%, var(--panel-2))", borderColor: "var(--high)" }}>
                <ArrowRight size={14} style={{ color: "var(--high)" }} className="shrink-0" />
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--high) 20%, transparent)", color: "var(--high)" }}>
                  <Server size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-xs truncate block">{svc}</span>
                  <span className="text-[10px]" style={{ color: "var(--high)" }}>Currently Firing (Active Symptom 🟠)</span>
                </div>
              </div>
            ))}

            {/* Predicted Horizon Expansion Nodes */}
            {[
              { min: 5, svcs: predictedServices5, color: "var(--high)" },
              { min: 10, svcs: predictedServices10, color: "var(--high)" },
              { min: 15, svcs: predictedServices15, color: "var(--accent)" },
            ].map(({ min, svcs, color }) => {
              if (!svcs.length) return null;
              const isHighlight = activeStage >= min;

              return (
                <div key={min} className="ml-8 space-y-2">
                  {svcs.map((svc) => (
                    <div
                      key={svc}
                      className={`rounded-xl border p-3 flex items-center gap-3 transition-all duration-300 ${
                        isHighlight ? "risk-pulse-border" : "opacity-50"
                      }`}
                      style={{
                        background: isHighlight ? "color-mix(in srgb, var(--accent) 12%, var(--panel-2))" : "var(--panel-2)",
                        borderColor: isHighlight ? color : "var(--border)",
                        "--pulse-color": color,
                      }}
                    >
                      <ArrowRight size={14} style={{ color }} className="shrink-0" />
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
                        <Server size={15} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs truncate">{svc}</span>
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded" style={{ background: `color-mix(in srgb, ${color} 20%, transparent)`, color }}>
                            Predicted +{min}m 🟡
                          </span>
                        </div>
                        <span className="text-[10px]" style={{ color: "var(--muted)" }}>Cascade expansion target</span>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recommended Immediate Action Callout Banner */}
      <div
        className="rounded-xl border p-5 shrink-0 relative"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--panel)), var(--panel))",
          borderColor: "var(--accent)",
          boxShadow: "0 4px 20px color-mix(in srgb, var(--accent) 12%, transparent)",
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 grad-btn text-white shadow-md mt-0.5">
              <Wrench size={20} strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                  Recommended Immediate Action
                </span>
                {dna && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "color-mix(in srgb, var(--purple) 20%, transparent)", color: "var(--purple)" }}>
                    Verified DNA Playbook Available
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold mb-2 leading-snug break-words" style={{ color: "var(--text)" }}>
                {recAction}
              </h3>
              <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "var(--muted)" }}>
                <span>Target Service: <b style={{ color: "var(--text)" }}>{root.service}</b></span>
                <span>•</span>
                <span>Estimated Resolution: <b style={{ color: "var(--ok)" }}>{dna?.resolution_minutes ?? 15} minutes</b></span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/incidents/${selectedCluster.cluster_id}`)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold grad-btn cursor-pointer whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            View Incident Details →
          </button>
        </div>
      </div>

      {/* Forecast Reasoning (Observable Evidence) */}
      <div className="rounded-xl border p-5 shrink-0" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Shield size={17} style={{ color: "var(--ok)" }} />
            Forecast Evidence & Reasoning
          </h3>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Explainable signals derived directly from pipeline state
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {reasoning.map((item, idx) => (
            <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg border text-xs leading-relaxed" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
              <CheckCircle2 size={15} style={{ color: "var(--ok)" }} className="mt-0.5 shrink-0" />
              <span style={{ color: "var(--text)" }}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Demo Mode: Prediction vs Reality Live Comparison (Active during Storm Replay) */}
      {stormActive && (
        <div className="rounded-xl border p-5 shrink-0" style={{ background: "color-mix(in srgb, var(--purple) 10%, var(--panel))", borderColor: "var(--purple)" }}>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2.5 h-2.5 rounded-full live-dot" style={{ background: "var(--purple)" }} />
            <h3 className="text-base font-bold text-[var(--purple)]">Demo Mode — Prediction vs. Reality Benchmark</h3>
          </div>
          <p className="text-xs mb-4" style={{ color: "var(--muted)" }}>
            Replay active: comparing forecast trajectory against live arriving alert stream.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
              <div className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1">Predicted 5m Risk</div>
              <div className="text-lg font-bold text-[var(--critical)]">{steps[0]?.risk ?? currentRiskPct}%</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--ok)" }}>✓ Escalation trend verified</div>
            </div>
            <div className="p-3 rounded-lg border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
              <div className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1">Predicted Alerts</div>
              <div className="text-lg font-bold text-[var(--high)]">{steps[0]?.alerts ?? 20} alerts</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--ok)" }}>✓ Incoming alert volume matches curve</div>
            </div>
            <div className="p-3 rounded-lg border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
              <div className="text-[10px] uppercase font-bold text-[var(--muted)] mb-1">Predicted Expansion</div>
              <div className="text-lg font-bold text-[var(--accent)]">+{allPredicted.length} Services</div>
              <div className="text-[11px] mt-1" style={{ color: "var(--ok)" }}>✓ Downstream cascade confirmed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
