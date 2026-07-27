import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheckBig, ChevronDown, ChevronRight, Compass, Dna, History, Inbox, Magnet, TrendingDown, Zap } from "lucide-react";
import ChaosOrder from "../components/ChaosOrder";
import { AlertIcon, Info, RiskMeter, SeverityDot, SeverityBadge, ServiceChip, SourceTag, StatCard } from "../components/ui";

const RISK_EDGE = { high: "var(--critical)", medium: "var(--high)", low: "var(--ok)" };

export function ClusterCard({ cluster }) {
  const [open, setOpen] = useState(false);
  const root = cluster.root_cause;
  const dna = cluster.dna_match;
  const navigate = useNavigate();
  const riskColor = RISK_EDGE[cluster.risk.level] || "var(--muted)";
  const services = [...new Set(cluster.alerts.map((a) => a.service))];

  return (
    <div
      className="rounded-xl border mb-4 overflow-hidden border-l-4"
      style={{
        borderTopColor: "var(--border)",
        borderRightColor: "var(--border)",
        borderBottomColor: "var(--border)",
        borderLeftColor: riskColor,
        background: "var(--panel)",
      }}
    >
      <div className="p-4">
        <div className="flex items-start gap-4">
          <AlertIcon alertname={root.alertname} severity={root.severity} service={root.service} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[13px] font-semibold px-2 py-0.5 rounded" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
                INCIDENT CLUSTER {cluster.cluster_id}
              </span>
              <span
                className="text-[13px] font-bold px-2 py-0.5 rounded uppercase"
                style={{ background: `color-mix(in srgb, ${riskColor} 18%, transparent)`, color: riskColor }}
              >
                {cluster.risk.level} risk
              </span>
              <span className="text-[13px]" style={{ color: "var(--muted)" }}>
                {cluster.raw_alert_count} raw alerts → {cluster.size} unique → 1 incident
              </span>
            </div>
            <div className="font-semibold text-[17px] flex items-center gap-2">
              <SeverityDot severity={root.severity} />
              {root.service} / {root.alertname}
            </div>
            <div className="text-[15px] mt-1" style={{ color: "var(--muted)" }}>{cluster.summary}</div>
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {services.slice(0, 5).map((s) => <ServiceChip key={s} name={s} />)}
              {services.length > 5 && <span className="text-[13px]" style={{ color: "var(--muted)" }}>+{services.length - 5}</span>}
            </div>
          </div>
          <div className="w-44 shrink-0 flex flex-col items-stretch gap-2">
            <RiskMeter risk={cluster.risk} />
            <div className="text-[13px] text-right" style={{ color: "var(--muted)" }}>
              {cluster.risk.services_affected} services affected
            </div>
            <button
              onClick={() => navigate(`/timemachine/${cluster.cluster_id}`)}
              className="mt-1 px-3 py-1 rounded-lg text-xs font-semibold cursor-pointer text-center flex items-center justify-center gap-1 border hover:brightness-125"
              style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              <History size={13} strokeWidth={2.25} /> Time Machine
            </button>
            <button
              onClick={() => navigate(`/forecast/${cluster.cluster_id}`)}
              className="px-3 py-1 rounded-lg text-xs font-semibold grad-btn cursor-pointer text-center flex items-center justify-center gap-1"
            >
              <Compass size={13} strokeWidth={2.25} /> Forecast →
            </button>
            <button
              onClick={() => navigate(`/incidents/${cluster.cluster_id}`)}
              className="px-3 py-1.5 rounded-lg border text-[13px] font-semibold cursor-pointer text-center hover:brightness-125"
              style={{ borderColor: "var(--border)", color: "var(--text)", background: "var(--panel-2)" }}
            >
              View details →
            </button>
          </div>
        </div>

        {dna ? (
          <div
            onClick={() => navigate(`/incidents/${cluster.cluster_id}`)}
            className="mt-3 rounded-lg border p-3 flex items-start gap-3 cursor-pointer hover:border-[var(--purple)] transition-colors group"
            style={{ borderColor: "color-mix(in srgb, var(--accent) 35%, var(--border))", background: "color-mix(in srgb, var(--accent) 7%, var(--panel-2))" }}
          >
            <span
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: "color-mix(in srgb, var(--purple) 20%, transparent)", color: "var(--purple)" }}
            >
              <Dna size={16} strokeWidth={2} />
            </span>
            <div className="text-[15px] flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <span className="font-semibold" style={{ color: "var(--purple)" }}>
                  Alert DNA · {dna.similarity_pct}% match to {dna.incident_id}
                  <Info tip="This incident's fingerprint compared against a library of past incidents. When something similar happened before, we surface what fixed it — institutional memory as an automatic assist." />
                </span>
                <span className="text-xs text-[var(--purple)] group-hover:underline font-semibold">
                  Compare Diff →
                </span>
              </div>
              <span style={{ color: "var(--muted)" }}> ({dna.title}, {dna.date})</span>
              <div className="mt-0.5" style={{ color: "var(--text)" }}>
                Last fix: {dna.resolution} <span style={{ color: "var(--ok)" }}>· resolved in {dna.resolution_minutes} min</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-md border p-3 text-[15px] flex items-center gap-2" style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--high)" }}>
            <Dna size={15} strokeWidth={2} /> Alert DNA: no match in incident library — novel incident pattern
          </div>
        )}

        <button
          onClick={() => setOpen(!open)}
          className="mt-3 flex items-center gap-1 text-[14px] cursor-pointer"
          style={{ color: "var(--accent)" }}
        >
          {open ? <ChevronDown size={14} strokeWidth={2.25} /> : <ChevronRight size={14} strokeWidth={2.25} />}
          {open ? "Hide" : "Show"} {cluster.size} correlated alerts
        </button>
      </div>

      {open && (
        <div className="border-t" style={{ borderColor: "var(--border)" }}>
          {cluster.alerts.map((a) => (
            <div key={a.id} className="flex items-center gap-3 px-4 py-2 border-t text-[15px]" style={{ borderColor: "var(--border)" }}>
              <span className="font-mono text-[13px] w-16 shrink-0" style={{ color: "var(--muted)" }}>
                {a.timestamp.slice(11, 19)}
              </span>
              <SeverityBadge severity={a.severity} />
              <span className="font-medium w-44 truncate">{a.service}</span>
              <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>{a.alertname}: {a.message}</span>
              <SourceTag source={a.source} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Correlations({ data, stormActive = false }) {
  const [view, setView] = useState("chaos");
  const clusters = data?.clusters ?? [];
  const stats = data?.dedup_stats;
  const noise = data?.noise ?? [];
  if (!stats) return null;

  const reduction = (100 * (1 - clusters.length / stats.raw_count)).toFixed(1);

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="flex items-center gap-4 mb-1">
        <h1 className="text-lg font-semibold">Correlations</h1>
        <div className="flex rounded-md border overflow-hidden text-[15px]" style={{ borderColor: "var(--border)" }}>
          {[
            ["chaos", "Chaos → Order", Zap],
            ["raw", "Raw stream", null],
            ["correlated", "Correlated", null],
          ].map(([v, label, Icon]) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className="flex items-center gap-1.5 px-4 py-1.5 cursor-pointer whitespace-nowrap"
              style={{
                background: view === v ? "var(--accent)" : "var(--panel)",
                color: view === v ? "#fff" : "var(--muted)",
                fontWeight: view === v ? 600 : 400,
              }}
            >
              {Icon && <Icon size={14} strokeWidth={2.25} fill={view === v ? "currentColor" : "none"} />}
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>
        The same alerts, grouped into actual incidents — related in meaning AND close in time.
      </p>

      <div className="grid grid-cols-2 min-[1280px]:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Inbox size={16} />} label="Raw Alerts" value={stats.raw_count} color="var(--accent)" delta="all incoming alerts" />
        <StatCard
          icon={<Magnet size={16} />}
          label="Incident Clusters"
          value={clusters.length}
          color="var(--high)"
          delta="unique incident groups"
          info="Groups of alerts that are symptoms of the same underlying failure — found by embedding each alert's text and clustering with a time-proximity constraint."
        />
        <StatCard icon={<TrendingDown size={16} />} label="Noise Reduction" value={`${reduction}%`} color="var(--info)" delta={`${stats.raw_count} alerts → ${clusters.length} incidents`} />
        <StatCard
          icon={<CircleCheckBig size={16} />}
          label="Uncorrelated Background"
          value={noise.length}
          color="var(--ok)"
          delta="kept out — not force-grouped"
          info="Alerts that genuinely relate to nothing (cert reminders, routine scans). Forcing them into clusters would corrupt the incidents — refusing to is a feature."
        />
      </div>

      {view === "chaos" ? (
        <ChaosOrder data={data} live={stormActive} />
      ) : view === "correlated" ? (
        clusters.map((c) => <ClusterCard key={c.cluster_id} cluster={c} />)
      ) : (
        <div className="rounded-lg border" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="px-4 py-3 text-[15px] border-b" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            This is what the on-call engineer sees without correlation — {stats.raw_count} undifferentiated alerts.
          </div>
          <div className="max-h-[520px] overflow-auto">
            {(data?.raw_alerts ?? []).map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-1.5 border-t text-[14px]" style={{ borderColor: "var(--border)" }}>
                <span className="font-mono text-[13px]" style={{ color: "var(--muted)" }}>{a.timestamp.slice(11, 19)}</span>
                <SeverityDot severity={a.severity} />
                <span className="font-medium w-44 truncate">{a.service}</span>
                <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>{a.alertname}: {a.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
