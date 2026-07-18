import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Dna, X, Zap } from "lucide-react";
import { Info, MetricCard, SeverityDot, StatusBadge, SourceTag, timeAgo } from "./ui";

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

export default function AlertDrawer({ alert, data, onClose }) {
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

    return { firings, cluster, isNoise, topStatus, sparkBuckets, fatigue };
  }, [alert, data]);

  if (!alert || !info) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,.45)" }} onClick={onClose} />
      <div
        className="fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-full border-l overflow-y-auto animate-[slidein_.25s_ease]"
        style={{ background: "var(--panel)", borderColor: "var(--border)" }}
      >
        <div className="flex items-start gap-3 p-5 border-b sticky top-0 z-10" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-[17px] flex items-center gap-2">
              <SeverityDot severity={alert.severity} />
              {alert.alertname}
            </div>
            <div className="text-[14px] mt-0.5" style={{ color: "var(--muted)" }}>
              {alert.service} · <SourceTag source={alert.source} />
            </div>
          </div>
          <button onClick={onClose} className="cursor-pointer px-1" style={{ color: "var(--muted)" }}><X size={17} strokeWidth={2} /></button>
        </div>

        <div className="p-5">
          {/* differentiator layer: correlation status */}
          {info.cluster ? (
            <button
              onClick={() => navigate(`/incidents/${info.cluster.cluster_id}`)}
              className="w-full rounded-md border p-3 mb-4 text-left cursor-pointer"
              style={{
                borderColor: info.cluster.risk.level === "high" ? "var(--critical)" : "var(--high)",
                background: "var(--panel-2)",
              }}
            >
              <div className="flex items-center gap-1.5 text-[15px] font-semibold" style={{ color: info.cluster.risk.level === "high" ? "var(--critical)" : "var(--high)" }}>
                <Zap size={14} strokeWidth={2.25} fill="currentColor" /> Correlated into INCIDENT CLUSTER {info.cluster.cluster_id} — {info.cluster.risk.level.toUpperCase()} risk
              </div>
              <div className="text-[14px] mt-1" style={{ color: "var(--muted)" }}>
                Root cause: {info.cluster.root_cause.service} / {info.cluster.root_cause.alertname} · click to open incident →
              </div>
              {info.cluster.dna_match && (
                <div className="flex items-center gap-1.5 text-[14px] mt-1.5" style={{ color: "var(--accent)" }}>
                  <Dna size={13} strokeWidth={2} /> Historically resolved by: {info.cluster.dna_match.resolution.slice(0, 80)}… ({info.cluster.dna_match.resolution_minutes} min)
                </div>
              )}
            </button>
          ) : (
            <div className="rounded-md border p-3 mb-4 text-[15px]" style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--muted)" }}>
              {info.isNoise
                ? "◌ Background noise — this alert correlates with no incident. Safe to deprioritize."
                : "◌ Not currently part of any incident cluster."}
            </div>
          )}

          {/* fatigue */}
          <div className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--border)" }}>
            <div className="text-[14px] font-semibold mb-2.5">
              Fatigue meter
              <Info tip="How often this alert fires relative to how long it's been active. A constantly-firing alert trains engineers to ignore it — which is exactly how real outages get missed." />
            </div>
            <FatigueMeter score={info.fatigue} />
            <div className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
              ×{info.firings.length} firings in this window — how loudly this alert competes for on-call attention.
            </div>
          </div>

          {/* stat cards */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <MetricCard label="Total firings" value={info.firings.length} sub="this window" />
            <MetricCard label="Most common status" value={info.topStatus} accent="var(--accent)" />
          </div>

          {/* sparkline */}
          <div className="rounded-lg border p-4 mb-4" style={{ borderColor: "var(--border)" }}>
            <div className="text-[14px] font-semibold mb-2">Firing trend</div>
            <Sparkline buckets={info.sparkBuckets} />
            <div className="text-[12px] mt-1" style={{ color: "var(--muted)" }}>dots colored by dominant severity per bucket</div>
          </div>

          {/* history */}
          <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
            <div className="px-4 py-2.5 text-[14px] font-semibold border-b" style={{ borderColor: "var(--border)" }}>
              Firing history
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
