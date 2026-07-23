import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  BellOff, Check, CircleCheckBig, Clock, Dna, TrendingUp, User, Wrench, X, Zap,
} from "lucide-react";
import { AlertIcon, Info, MetricCard, RiskMeter, SeverityDot, StatusBadge, SourceTag, timeAgo } from "./ui";

const FACTOR_LABEL = {
  growth_rate: "Alert growth rate",
  severity_trend: "Severity trend",
  service_spread: "Service spread",
};
const RISK_COLOR = { high: "var(--critical)", medium: "var(--high)", low: "var(--ok)" };

export function FatigueMeter({ score }) {
  // score 0..1 → pointer position on a green→red gradient
  const pct = Math.round(Math.min(score, 1) * 100);
  return (
    <div>
      <div
        className="h-2.5 rounded-full relative"
        style={{ background: "linear-gradient(90deg, #40c057, #fab005, #f76707, #f0384e)" }}
      >
        <div
          className="absolute -top-1 w-1 h-4.5 rounded bg-white shadow"
          style={{ left: `calc(${pct}% - 2px)` }}
        />
      </div>
      <div className="flex justify-between text-[12px] mt-1" style={{ color: "var(--muted)" }}>
        <span>quiet</span>
        <span>fatiguing</span>
      </div>
    </div>
  );
}

function Sparkline({ buckets }) {
  const max = Math.max(...buckets.map((b) => b.count), 1);
  const w = 260;
  const h = 56;
  const step = buckets.length > 1 ? w / (buckets.length - 1) : w;
  const points = buckets.map((b, i) => `${i * step},${h - (b.count / max) * (h - 6) - 3}`).join(" ");
  const SEV = { critical: "#f0384e", high: "#f59f00", info: "#339af0" };

  return (
    <svg width={w} height={h + 8} className="block">
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      {buckets.map((b, i) => (
        <circle
          key={i}
          cx={i * step}
          cy={h - (b.count / max) * (h - 6) - 3}
          r="3"
          fill={SEV[b.topSeverity] || "var(--muted)"}
        />
      ))}
    </svg>
  );
}

function FactorBar({ label, value }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mb-2.5">
      <div className="flex items-center justify-between text-[13px] mb-1">
        <span style={{ color: "var(--text)" }}>{label}</span>
        <span style={{ color: "var(--muted)" }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--panel-2)" }}>
        <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

function ActionPill({ icon: Icon, label, activeLabel, active, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12.5px] font-medium cursor-pointer transition-all hover:-translate-y-px"
      style={{
        background: active ? `color-mix(in srgb, ${color} 16%, transparent)` : "var(--panel-2)",
        color: active ? color : "var(--muted)",
        border: `1px solid ${active ? `color-mix(in srgb, ${color} 35%, transparent)` : "var(--border)"}`,
      }}
    >
      <Icon size={13} strokeWidth={2.25} />
      {active && activeLabel ? activeLabel : label}
    </button>
  );
}

function SectionCard({ title, icon: Icon, iconColor, children, className = "" }) {
  return (
    <div className={`rounded-xl border p-4 mb-4 ${className}`} style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center gap-2 text-[14px] font-semibold mb-3">
        {Icon && (
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
            style={{ background: `color-mix(in srgb, ${iconColor} 18%, transparent)`, color: iconColor }}
          >
            <Icon size={13} strokeWidth={2.25} />
          </span>
        )}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function AlertDrawer({
  alert, data, onClose,
  isAcked, onAck, status, onSuppress, onResolve, isEscalated, onEscalate, assignee, onAssign,
}) {
  const navigate = useNavigate();

  useEffect(() => {
    const esc = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const info = useMemo(() => {
    if (!alert || !data) return null;
    const same = (a) => a.service === alert.service && a.alertname === alert.alertname;

    const firings = (data.raw_alerts ?? []).filter(same).sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    // which cluster (if any) this alert definition was correlated into
    const cluster = (data.clusters ?? []).find((c) => c.alerts.some(same)) || null;
    const isNoise = !cluster && (data.noise ?? []).some(same);
    const related = cluster ? cluster.alerts.filter((a) => !same(a)).slice(0, 8) : [];

    // status distribution
    const statusCounts = {};
    for (const f of firings) statusCounts[f.status] = (statusCounts[f.status] || 0) + 1;
    const topStatus = Object.entries(statusCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

    // hourly buckets for the sparkline (over the span of this alert's firings)
    const times = firings.map((f) => new Date(f.timestamp).getTime());
    const t0 = Math.min(...times);
    const t1 = Math.max(...times);
    const N = 12;
    const span = Math.max(t1 - t0, 1);
    const buckets = Array.from({ length: N }, () => ({ count: 0, sev: {} }));
    const sevRank = { critical: 3, high: 2, info: 1 };
    for (const f of firings) {
      const i = Math.min(Math.floor(((new Date(f.timestamp).getTime() - t0) / span) * N), N - 1);
      buckets[i].count += 1;
      buckets[i].sev[f.severity] = (buckets[i].sev[f.severity] || 0) + 1;
    }
    const sparkBuckets = buckets.map((b) => ({
      count: b.count,
      topSeverity: Object.entries(b.sev).sort((x, y) => sevRank[y[0]] - sevRank[x[0]] || y[1] - x[1])[0]?.[0],
    }));

    // fatigue: firings per hour of active span (min 1h so short bursts don't
    // instantly peg the meter), saturating at 6 firings/hour
    const hours = Math.max(span / 3600000, 1);
    const fatigue = Math.min(firings.length / hours / 6, 1);

    return { firings, cluster, isNoise, related, topStatus, sparkBuckets, fatigue };
  }, [alert, data]);

  if (!alert || !info) return null;
  const { cluster } = info;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-[520px] max-w-full border-l overflow-y-auto animate-[slidein_.25s_ease]"
        style={{ background: "var(--panel)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-3 p-5 border-b sticky top-0 z-10" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <AlertIcon alertname={alert.alertname} severity={alert.severity} service={alert.service} />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[17px] flex items-center gap-2 flex-wrap">
              {alert.alertname}
              <StatusBadge status={status} />
              {isEscalated && (
                <span className="px-1.5 py-0.5 rounded text-[11px] font-bold" style={{ background: "color-mix(in srgb, var(--critical) 20%, transparent)", color: "var(--critical)" }}>
                  ESCALATED
                </span>
              )}
            </div>
            <div className="text-[14px] mt-0.5 flex items-center gap-1.5" style={{ color: "var(--muted)" }}>
              <SeverityDot severity={alert.severity} /> {alert.service} · <SourceTag source={alert.source} />
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer px-1" style={{ color: "var(--muted)" }}><X size={17} strokeWidth={2} /></button>
        </div>

        <div className="p-5">
          {/* action bar */}
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <ActionPill icon={Check} label="Acknowledge" activeLabel="Acknowledged" active={isAcked} color="var(--ok)" onClick={onAck} />
            <ActionPill icon={User} label="Assign to me" activeLabel={`Assigned: ${assignee}`} active={!!assignee} color="var(--info)" onClick={onAssign} />
            <ActionPill icon={CircleCheckBig} label="Resolve" activeLabel="Resolved" active={status === "resolved"} color="var(--ok)" onClick={onResolve} />
            <ActionPill icon={TrendingUp} label="Escalate" activeLabel="Escalated" active={isEscalated} color="var(--critical)" onClick={onEscalate} />
            <ActionPill icon={BellOff} label="Suppress" activeLabel="Suppressed" active={status === "suppressed"} color="var(--muted)" onClick={onSuppress} />
          </div>

          {/* AI root-cause / correlation status */}
          {cluster ? (
            <SectionCard title="AI Root Cause Analysis" icon={Zap} iconColor="var(--accent)">
              <button
                onClick={() => navigate(`/incidents/${cluster.cluster_id}`)}
                className="w-full text-left cursor-pointer mb-3 group"
              >
                <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: "var(--text)" }}>{cluster.summary}</p>
                <div className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                  View full incident #{cluster.cluster_id} <span className="transition-transform group-hover:translate-x-0.5">→</span>
                </div>
              </button>
              <RiskMeter risk={cluster.risk} />
              <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
                <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--muted)" }}>
                  Why this is <span style={{ color: RISK_COLOR[cluster.risk.level] }}>{cluster.risk.level.toUpperCase()}</span> risk
                </div>
                {Object.entries(cluster.risk.factors).map(([key, value]) => (
                  <FactorBar key={key} label={FACTOR_LABEL[key] || key} value={value} />
                ))}
              </div>
            </SectionCard>
          ) : (
            <div className="rounded-xl border p-4 mb-4 text-[14px]" style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--muted)" }}>
              {info.isNoise
                ? "◌ Background noise — this alert correlates with no incident. Safe to deprioritize."
                : "◌ Not currently part of any incident cluster."}
            </div>
          )}

          {/* Alert DNA — matched past incident + runbook */}
          {cluster?.dna_match ? (
            <SectionCard title={`Alert DNA · ${cluster.dna_match.similarity_pct}% match`} icon={Dna} iconColor="var(--purple)">
              <div className="text-[13.5px] font-medium mb-1">{cluster.dna_match.title}</div>
              <div className="text-[12px] mb-3" style={{ color: "var(--muted)" }}>{cluster.dna_match.incident_id} · {cluster.dna_match.date}</div>
              <div className="flex items-start gap-2 text-[13px] mb-2">
                <Wrench size={14} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: "var(--muted)" }} />
                <div>
                  <span style={{ color: "var(--muted)" }}>Runbook / suggested fix: </span>
                  <span style={{ color: "var(--text)" }}>{cluster.dna_match.resolution}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-[13px]" style={{ color: "var(--ok)" }}>
                <Clock size={14} strokeWidth={2} />
                Estimated recovery: {cluster.dna_match.resolution_minutes} min (last time)
              </div>
            </SectionCard>
          ) : cluster && (
            <SectionCard title="Alert DNA" icon={Dna} iconColor="var(--high)">
              <span className="text-[13.5px]" style={{ color: "var(--high)" }}>No match in the incident library — novel pattern, no prior playbook.</span>
            </SectionCard>
          )}

          {/* related alerts in the same incident */}
          {info.related.length > 0 && (
            <SectionCard title={`Related Alerts (${cluster.alerts.length - 1})`} icon={Zap} iconColor="var(--high)">
              <div className="-mx-4 -mb-4 border-t" style={{ borderColor: "var(--border)" }}>
                {info.related.map((a) => (
                  <div key={a.id} className="flex items-center gap-2.5 px-4 py-2 border-t first:border-t-0 text-[13px]" style={{ borderColor: "var(--border)" }}>
                    <SeverityDot severity={a.severity} />
                    <span className="font-medium w-32 truncate">{a.service}</span>
                    <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>{a.alertname}</span>
                    <span style={{ color: "var(--muted)" }}>{timeAgo(a.timestamp)}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          {/* metrics: fatigue + trend */}
          <div className="rounded-xl border p-4 mb-4" style={{ borderColor: "var(--border)" }}>
            <div className="text-[14px] font-semibold mb-2.5">
              Metrics
              <Info tip="How often this alert fires relative to how long it's been active. A constantly-firing alert trains engineers to ignore it — which is exactly how real outages get missed." />
            </div>
            <FatigueMeter score={info.fatigue} />
            <div className="text-[13px] mt-2 mb-3" style={{ color: "var(--muted)" }}>
              ×{info.firings.length} firings in this window — how loudly this alert competes for on-call attention.
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <MetricCard label="Total firings" value={info.firings.length} sub="this window" />
              <MetricCard label="Most common status" value={info.topStatus} accent="var(--accent)" />
            </div>
            <Sparkline buckets={info.sparkBuckets} />
            <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>dots colored by dominant severity per bucket</div>
          </div>

          {/* timeline */}
          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-2.5 text-[14px] font-semibold border-b" style={{ borderColor: "var(--border)" }}>
              Timeline
            </div>
            {info.firings.slice(0, 30).map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 px-4 py-2 border-t text-[14px]" style={{ borderColor: "var(--border)" }}>
                <SeverityDot severity={f.severity} />
                <StatusBadge status={f.status} />
                <span className="flex-1" />
                <SourceTag source={f.source} />
                <span className="w-20 text-right" style={{ color: "var(--muted)" }}>{timeAgo(f.timestamp)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
