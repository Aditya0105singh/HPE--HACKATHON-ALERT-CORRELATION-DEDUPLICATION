import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity, ArrowRight, CheckCircle2, ChevronRight, Clock,
  FastForward, Film, History, Layers, Magnet, Pause, Play,
  RotateCcw, Server, Shield, ShieldAlert, Sparkles, TrendingUp, Zap
} from "lucide-react";
import { AlertIcon, Info, PriorityBadge, RiskMeter, ServiceChip, SeverityBadge, SeverityDot, StatCard } from "../components/ui";

const SPEED_OPTIONS = [1, 2, 4];
const RISK_COLOR = { high: "var(--critical)", medium: "var(--high)", low: "var(--ok)" };

// Build discrete timeline events from a cluster object
function buildReplayTimeline(cluster) {
  if (!cluster || !cluster.alerts || !cluster.alerts.length) return [];

  const sortedAlerts = [...cluster.alerts].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const root = cluster.root_cause;
  const dna = cluster.dna_match;

  const events = [];
  const seenServices = new Set();
  let accumulatedDups = 0;
  let hasFlaggedRoot = false;
  let hasCreatedCluster = false;
  let hasMatchedDna = false;

  sortedAlerts.forEach((a, idx) => {
    const isRoot = a.id === root.id || (a.service === root.service && a.alertname === root.alertname && !hasFlaggedRoot);
    const dups = a.duplicate_count || 1;
    accumulatedDups += (dups - 1);
    const isNewService = !seenServices.has(a.service);
    seenServices.add(a.service);

    // 1. Alert Arrived Event
    events.push({
      id: `evt-arr-${a.id}`,
      time: a.timestamp.slice(11, 19),
      rawTimestamp: a.timestamp,
      title: `${a.service} / ${a.alertname}`,
      category: "alert",
      service: a.service,
      severity: a.severity,
      alertname: a.alertname,
      duplicateCount: accumulatedDups,
      alert: a,
      algorithm: "Prometheus / Datadog Monitoring Stream Ingestion",
      whatHappened: `Raw alert fired on ${a.service}: "${a.alertname}" (${a.severity.toUpperCase()} severity).`,
      whyItHappened: `Threshold breached on ${a.service}. Ingested into live pipeline buffer.`,
    });

    // 2. Deduplication Event (if duplicates exist)
    if (dups > 1) {
      events.push({
        id: `evt-dedup-${a.id}`,
        time: a.timestamp.slice(11, 19),
        rawTimestamp: a.timestamp,
        title: `${dups - 1} duplicate alert${dups - 1 > 1 ? "s" : ""} collapsed`,
        category: "dedup",
        service: a.service,
        severity: "info",
        duplicateCount: accumulatedDups,
        algorithm: "MD5 Fingerprint Hash + 60s Sliding Window",
        whatHappened: `Deduplication engine collapsed ${dups} repeat alert fires for ${a.service}/${a.alertname} into 1 unique card.`,
        whyItHappened: `Repeat fires occurred within the 60-second sliding window. Eliminates noise without losing count metadata.`,
      });
    }

    // 3. Root Cause Identification Event
    if (isRoot && !hasFlaggedRoot) {
      hasFlaggedRoot = true;
      events.push({
        id: `evt-root-${a.id}`,
        time: a.timestamp.slice(11, 19),
        rawTimestamp: a.timestamp,
        title: `Root Cause Identified: ${a.service}`,
        category: "root",
        service: a.service,
        severity: a.severity,
        duplicateCount: accumulatedDups,
        algorithm: "Earliest Timestamp + Highest Severity Ranking",
        whatHappened: `Pipeline identified ${a.service} (${a.alertname}) as the primary root cause of this cascade.`,
        whyItHappened: `Earliest timestamp in cluster combined with highest initial severity. Failures propagate forward in time.`,
      });
    }

    // 4. Cluster Formation Event
    if (idx >= 1 && !hasCreatedCluster) {
      hasCreatedCluster = true;
      events.push({
        id: `evt-cluster-${a.id}`,
        time: a.timestamp.slice(11, 19),
        rawTimestamp: a.timestamp,
        title: `Incident #${cluster.cluster_id} Formed`,
        category: "cluster",
        service: a.service,
        severity: "high",
        duplicateCount: accumulatedDups,
        algorithm: "TF-IDF Embeddings + Time-Windowed DBSCAN (eps=1.00)",
        whatHappened: `Correlated ${idx + 1} symptoms across ${seenServices.size} services into Incident #${cluster.cluster_id}.`,
        whyItHappened: `Alerts share high textual vocabulary similarity and fired within the active 6-minute cascade window.`,
      });
    }

    // 5. Cascade Service Spread Event
    if (isNewService && idx > 0) {
      events.push({
        id: `evt-[spread]-${a.id}`,
        time: a.timestamp.slice(11, 19),
        rawTimestamp: a.timestamp,
        title: `Cascade Spread to ${a.service}`,
        category: "spread",
        service: a.service,
        severity: a.severity,
        duplicateCount: accumulatedDups,
        algorithm: "Service Dependency Graph Topology Traversal",
        whatHappened: `Failure cascaded downstream to ${a.service}. ${seenServices.size} total services now impacted.`,
        whyItHappened: `Upstream dependency failure on ${root.service} starved resources or caused connection timeouts on ${a.service}.`,
      });
    }
  });

  // 6. Alert DNA Match Event
  if (dna && !hasMatchedDna) {
    hasMatchedDna = true;
    const lastTime = sortedAlerts[sortedAlerts.length - 1].timestamp;
    events.push({
      id: "evt-dna-match",
      time: lastTime.slice(11, 19),
      rawTimestamp: lastTime,
      title: `Alert DNA Match: ${dna.similarity_pct}% to ${dna.incident_id}`,
      category: "dna",
      service: root.service,
      severity: "critical",
      duplicateCount: accumulatedDups,
      algorithm: "TF-IDF Centroid Vector Space Similarity (Threshold >= 0.25)",
      whatHappened: `Matched cluster fingerprint at ${dna.similarity_pct}% similarity to historical incident ${dna.incident_id}.`,
      whyItHappened: `Symptom vocabulary matches institutional memory. Surfaced verified playbook: "${dna.resolution}".`,
    });
  }

  // 7. Final Incident Promotion Event
  const finalTime = sortedAlerts[sortedAlerts.length - 1].timestamp;
  events.push({
    id: "evt-final-promotion",
    time: finalTime.slice(11, 19),
    rawTimestamp: finalTime,
    title: `Incident #${cluster.cluster_id} Promoted to ${cluster.risk.level.toUpperCase()} Risk P1`,
    category: "final",
    service: root.service,
    severity: cluster.risk.level === "high" ? "critical" : "high",
    duplicateCount: accumulatedDups,
    algorithm: "Escalation Risk Matrix (0.40·growth + 0.35·severity + 0.25·spread)",
    whatHappened: `Incident cluster completed formation with score ${Math.round(cluster.risk.score * 100)}% (${cluster.risk.level.toUpperCase()} risk).`,
    whyItHappened: `All cascade symptoms correlated. Ready for SRE triage (Est. ${cluster.est_triage_minutes_saved || 15} min manual work saved).`,
  });

  return events;
}

export default function TimeMachine({ data }) {
  const navigate = useNavigate();
  const { clusterId } = useParams();
  const clusters = data?.clusters ?? [];

  const selectedCluster = useMemo(() => {
    if (!clusters.length) return null;
    if (clusterId) {
      const match = clusters.find((c) => String(c.cluster_id) === String(clusterId));
      if (match) return match;
    }
    return clusters[0];
  }, [clusters, clusterId]);

  const timelineEvents = useMemo(() => buildReplayTimeline(selectedCluster), [selectedCluster]);

  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const eventListRef = useRef(null);

  // Reset step when cluster changes
  useEffect(() => {
    setStepIndex(0);
    setIsPlaying(false);
  }, [selectedCluster]);

  // Replay animation timer
  useEffect(() => {
    if (!isPlaying) return;
    const intervalMs = 2000 / speed;

    const timer = setInterval(() => {
      setStepIndex((prev) => {
        if (prev >= timelineEvents.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [isPlaying, speed, timelineEvents.length]);

  // Auto-scroll active event into view in the event log
  useEffect(() => {
    if (eventListRef.current) {
      const activeEl = eventListRef.current.querySelector("[data-active-event='true']");
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  }, [stepIndex]);

  if (!data || !clusters.length || !selectedCluster) {
    return (
      <div className="p-8 text-center" style={{ color: "var(--muted)" }}>
        <History size={40} className="mx-auto mb-3 opacity-50" />
        <h2 className="text-lg font-semibold mb-1">No Active Incidents for Time Machine Replay</h2>
        <p className="text-sm">Load a dataset to step through incident formation history.</p>
      </div>
    );
  }

  const currentEvent = timelineEvents[stepIndex] || timelineEvents[0];
  const progressPct = timelineEvents.length > 1 ? Math.round((stepIndex / (timelineEvents.length - 1)) * 100) : 100;

  // Compute live metrics at current stepIndex
  const eventsSoFar = timelineEvents.slice(0, stepIndex + 1);
  const alertsRevealed = eventsSoFar.filter((e) => e.category === "alert").map((e) => e.alert);
  const rawAlertsCount = alertsRevealed.reduce((s, a) => s + (a?.duplicate_count || 1), 0);
  const uniqueAlertsCount = alertsRevealed.length;
  const duplicateCount = currentEvent.duplicateCount || Math.max(0, rawAlertsCount - uniqueAlertsCount);

  const servicesSoFar = [...new Set(eventsSoFar.map((e) => e.service))];
  const hasRoot = eventsSoFar.some((e) => e.category === "root");
  const hasCluster = eventsSoFar.some((e) => e.category === "cluster");
  const hasDna = eventsSoFar.some((e) => e.category === "dna");

  const finalScore = selectedCluster.risk.score;
  const currentRiskScore = hasCluster
    ? Math.round((0.35 + (finalScore - 0.35) * (stepIndex / (timelineEvents.length - 1))) * 100)
    : 20;

  const currentRiskLevel = currentRiskScore >= 66 ? "high" : currentRiskScore >= 33 ? "medium" : "low";

  const root = selectedCluster.root_cause;
  const dna = selectedCluster.dna_match;

  return (
    <div className="p-6 overflow-y-auto h-full flex flex-col gap-6">
      {/* Header & Incident Selector */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider grad-btn flex items-center gap-1">
              <Film size={12} strokeWidth={2.5} /> Incident Time Machine
            </span>
          </div>
          <h1 className="text-xl font-bold flex items-center gap-2.5">
            Incident #{selectedCluster.cluster_id} — replay from first alert to resolution
          </h1>
        </div>

        {/* Incident Selector Dropdown */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Select Incident:
          </label>
          <select
            value={selectedCluster.cluster_id}
            onChange={(e) => navigate(`/timemachine/${e.target.value}`)}
            className="rounded-lg border px-3 py-2 text-sm font-semibold cursor-pointer outline-none transition-all"
            style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}
          >
            {clusters.map((c) => (
              <option key={c.cluster_id} value={c.cluster_id}>
                Incident #{c.cluster_id} — {c.root_cause.service} ({c.risk.level.toUpperCase()} risk)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Replay Controls Bar */}
      <div className="rounded-xl border p-5 shrink-0" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            {/* Play / Pause Button */}
            <button
              onClick={() => {
                if (stepIndex >= timelineEvents.length - 1) setStepIndex(0);
                setIsPlaying(!isPlaying);
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold grad-btn cursor-pointer transition-all shadow-md"
            >
              {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              {isPlaying ? "Pause Replay" : stepIndex >= timelineEvents.length - 1 ? "Replay From Start" : "Play Timeline"}
            </button>

            {/* Restart Button */}
            <button
              onClick={() => {
                setStepIndex(0);
                setIsPlaying(false);
              }}
              title="Restart timeline"
              className="p-2 rounded-xl border cursor-pointer hover:brightness-125 transition-all text-xs"
              style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              <RotateCcw size={15} />
            </button>

            {/* Skip to End Button */}
            <button
              onClick={() => {
                setStepIndex(timelineEvents.length - 1);
                setIsPlaying(false);
              }}
              title="Skip to end of incident formation"
              className="p-2 rounded-xl border cursor-pointer hover:brightness-125 transition-all text-xs"
              style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              <FastForward size={15} />
            </button>

            {/* Speed Multipliers */}
            <div className="flex rounded-lg border p-0.5 text-xs font-semibold ml-2" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
              {SPEED_OPTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className="px-2.5 py-1 rounded-md cursor-pointer transition-colors"
                  style={{
                    background: speed === s ? "var(--accent)" : "transparent",
                    color: speed === s ? "#fff" : "var(--muted)",
                  }}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono" style={{ color: "var(--muted)" }}>
            <span>Step <b>{stepIndex + 1}</b> / {timelineEvents.length}</span>
            <span>•</span>
            <span>Time: <b style={{ color: "var(--text)" }}>{currentEvent.time}</b></span>
            <span>•</span>
            <span style={{ color: "var(--accent)" }}><b>{progressPct}%</b> Complete</span>
          </div>
        </div>

        {/* Timeline Interactive Scrubber Slider */}
        <div className="relative">
          <input
            type="range"
            min={0}
            max={timelineEvents.length - 1}
            value={stepIndex}
            onChange={(e) => {
              setStepIndex(Number(e.target.value));
              setIsPlaying(false);
            }}
            className="w-full h-2 rounded-lg appearance-none cursor-pointer accent-[var(--accent)]"
            style={{ background: "var(--panel-2)" }}
          />
          <div className="flex justify-between text-[11px] font-mono mt-1" style={{ color: "var(--muted)" }}>
            <span>T0: {timelineEvents[0]?.time}</span>
            <span className="font-semibold" style={{ color: "var(--accent)" }}>{currentEvent.title}</span>
            <span>TF: {timelineEvents[timelineEvents.length - 1]?.time}</span>
          </div>
        </div>
      </div>

      {/* Live Replay Metrics Bar — Affected Services and Alert DNA Match are
          dropped here since the topology panel just below already shows
          both (root cause node, cascade services, DNA match line) — no
          reason to state the same two facts twice, once as a number and
          once as the real thing. */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 shrink-0">
        <StatCard
          icon={<ShieldAlert size={16} />}
          label="Raw Alerts Revealed"
          value={rawAlertsCount}
          color="var(--accent)"
          delta={`Step ${stepIndex + 1} of ${timelineEvents.length}`}
          spark={false}
        />
        <StatCard
          icon={<Layers size={16} />}
          label="Duplicates Merged"
          value={duplicateCount}
          color="var(--info)"
          delta={`${rawAlertsCount - duplicateCount} unique cards`}
          spark={false}
        />
        <StatCard
          icon={<Activity size={16} />}
          label="Replay Risk Score"
          value={`${currentRiskScore}%`}
          color={RISK_COLOR[currentRiskLevel]}
          delta={`${currentRiskLevel.toUpperCase()} escalation level`}
          spark={false}
        />
      </div>

      {/* Main Grid: Topology Replay Visualizer & Chronological Event Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 shrink-0">
        {/* Current State Visualization (Service Topology Cascade) */}
        <div className="rounded-xl border p-5 flex flex-col" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Zap size={17} style={{ color: "var(--accent)" }} />
              Live Incident Formation & Topology Cascade
            </h3>
            <span className="text-xs px-2 py-0.5 rounded font-mono" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
              {servicesSoFar.length} active node{servicesSoFar.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex-1 flex flex-col justify-center gap-3">
            {/* Root Cause Node (if reached) */}
            {hasRoot ? (
              <div className="rounded-xl border p-3.5 flex items-center gap-3 risk-pulse-border" style={{ background: "color-mix(in srgb, var(--critical) 14%, var(--panel-2))", borderColor: "var(--critical)", "--pulse-color": "var(--critical)" }}>
                <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: "var(--critical)", color: "#fff" }}>
                  <Server size={18} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm truncate">{root.service}</span>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold rounded uppercase" style={{ background: "var(--critical)", color: "#fff" }}>
                      Root Cause Identified
                    </span>
                  </div>
                  <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{root.alertname}</div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border p-3.5 text-center text-xs" style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--muted)" }}>
                Awaiting root cause symptom arrival…
              </div>
            )}

            {/* Cascade Spread Nodes */}
            {servicesSoFar.filter((s) => s !== root.service).map((svc) => (
              <div key={svc} className="rounded-xl border p-3 flex items-center gap-3 ml-4 transition-all duration-300" style={{ background: "color-mix(in srgb, var(--high) 10%, var(--panel-2))", borderColor: "var(--high)" }}>
                <ArrowRight size={14} style={{ color: "var(--high)" }} className="shrink-0" />
                <span className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: "color-mix(in srgb, var(--high) 20%, transparent)", color: "var(--high)" }}>
                  <Server size={15} />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="font-semibold text-xs truncate block">{svc}</span>
                  <span className="text-[10px]" style={{ color: "var(--high)" }}>Cascade symptom — active</span>
                </div>
              </div>
            ))}

            {hasCluster && (
              <div className="mt-2 p-3 rounded-lg border text-xs flex items-center justify-between" style={{ background: "color-mix(in srgb, var(--accent) 12%, var(--panel-2))", borderColor: "var(--accent)" }}>
                <span className="font-semibold flex items-center gap-1.5 text-[var(--accent)]">
                  <Magnet size={14} /> Incident #{selectedCluster.cluster_id} Active
                </span>
                <span className="font-mono text-[11px]" style={{ color: "var(--muted)" }}>
                  {uniqueAlertsCount} unique alerts correlated
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Chronological Event Log */}
        <div className="rounded-xl border p-5 flex flex-col" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <Clock size={17} style={{ color: "var(--high)" }} />
              Chronological Audit Event Stream
            </h3>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              {timelineEvents.length} Lifecycle Milestones
            </span>
          </div>

          <div ref={eventListRef} className="flex-1 max-h-[360px] overflow-y-auto space-y-2 pr-1">
            {timelineEvents.map((evt, idx) => {
              const isActive = idx === stepIndex;
              const isPast = idx < stepIndex;

              const categoryColor = evt.category === "root" ? "var(--critical)"
                : evt.category === "dna" ? "var(--purple)"
                : evt.category === "cluster" ? "var(--accent)"
                : evt.category === "dedup" ? "var(--info)"
                : "var(--high)";

              return (
                <div
                  key={evt.id}
                  data-active-event={isActive}
                  onClick={() => {
                    setStepIndex(idx);
                    setIsPlaying(false);
                  }}
                  className={`p-3 rounded-lg border transition-all cursor-pointer flex items-start gap-3 ${
                    isActive ? "ring-2 ring-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel-2))]" : isPast ? "opacity-90" : "opacity-45"
                  }`}
                  style={{
                    borderColor: isActive ? "var(--accent)" : "var(--border)",
                    background: isActive ? undefined : "var(--panel-2)",
                  }}
                >
                  <span className="font-mono text-[11px] font-bold shrink-0 pt-0.5" style={{ color: isActive ? "var(--accent)" : "var(--muted)" }}>
                    {evt.time}
                  </span>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs truncate">{evt.title}</span>
                      <span className="px-1.5 py-0.2 text-[9px] font-bold rounded uppercase shrink-0" style={{ background: `color-mix(in srgb, ${categoryColor} 20%, transparent)`, color: categoryColor }}>
                        {evt.category}
                      </span>
                    </div>
                    <div className="text-[11px] truncate mt-0.5" style={{ color: "var(--muted)" }}>{evt.whatHappened}</div>
                  </div>

                  {isActive && (
                    <span className="w-2 h-2 rounded-full live-dot shrink-0 mt-1.5" style={{ background: "var(--accent)" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Forensic Algorithm Explanation Panel */}
      <div
        className="rounded-xl border p-5 shrink-0 relative"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 18%, var(--panel)), var(--panel))",
          borderColor: "var(--accent)",
          boxShadow: "0 4px 20px color-mix(in srgb, var(--accent) 12%, transparent)",
        }}
      >
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 grad-btn text-white shadow-md mt-0.5">
            <Shield size={20} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--accent)]">
                Forensic Pipeline Step Explanation
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
                Algorithm: {currentEvent.algorithm}
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-bold mb-1 leading-snug break-words" style={{ color: "var(--text)" }}>
              {currentEvent.whatHappened}
            </h3>

            <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--muted)" }}>
              <b>Engineering Rationale:</b> {currentEvent.whyItHappened}
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs pt-2 border-t" style={{ borderColor: "var(--border)" }}>
              <div><b>Current Risk:</b> <span style={{ color: RISK_COLOR[currentRiskLevel] }}>{currentRiskScore}% ({currentRiskLevel.toUpperCase()})</span></div>
              <div><b>Root Cause:</b> <span style={{ color: "var(--text)" }}>{hasRoot ? `${root.service} / ${root.alertname}` : "Evaluating..."}</span></div>
              <div><b>Alert DNA:</b> <span style={{ color: "var(--purple)" }}>{hasDna ? `${dna.similarity_pct}% match (${dna.incident_id})` : "Novel Pattern"}</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
