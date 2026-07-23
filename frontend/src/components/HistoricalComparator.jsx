import { useEffect, useState } from "react";
import {
  ArrowRight, CheckCircle2, ChevronRight, Clock, Dna, GitCompare,
  HelpCircle, Info as InfoIcon, MessageSquare, Shield, Sparkles, Wrench, Zap
} from "lucide-react";
import { fetchIncidentComparison } from "../api";
import { Info, PriorityBadge, RiskMeter, ServiceChip, SeverityBadge, SeverityDot } from "./ui";

const DIFF_COLOR = {
  match: "var(--ok)",
  partial: "var(--high)",
  different: "var(--critical)",
};

const DIFF_LABEL = {
  match: "Match 🟢",
  partial: "Partial 🟡",
  different: "Divergent 🔴",
};

export default function HistoricalComparator({ cluster, onAskCopilot }) {
  const [compData, setCompData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cluster) return;
    let isMounted = true;
    setLoading(true);

    fetchIncidentComparison(cluster.cluster_id)
      .then((res) => {
        if (isMounted) setCompData(res);
      })
      .catch((err) => {
        console.error("Comparison fetch error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cluster]);

  const dna = cluster?.dna_match;
  const root = cluster?.root_cause;

  if (loading) {
    return (
      <div className="p-8 text-center text-xs" style={{ color: "var(--muted)" }}>
        <Dna size={32} className="mx-auto mb-2 animate-spin text-[var(--purple)]" />
        <div>Comparing Incident #{cluster.cluster_id} against historical incident library memory...</div>
      </div>
    );
  }

  if (!dna && !compData?.has_match) {
    return (
      <div className="p-6 rounded-xl border" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 mb-2" style={{ color: "var(--high)" }}>
          <Dna size={18} />
          <h3 className="text-base font-bold">Novel Incident Pattern (No Prior Playbook)</h3>
        </div>
        <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
          Alert DNA matched no known historical incidents above the similarity threshold (25%). This incident represents a novel failure pattern with no prior historical resolution.
        </p>
      </div>
    );
  }

  const simPct = compData?.similarity ?? dna?.similarity_pct ?? 85;
  const breakdown = compData?.similarity_breakdown ?? {
    root_cause: 100,
    affected_services: 95,
    timeline_pattern: 88,
    alert_pattern: 93,
    severity_trend: 91,
  };

  const metrics = compData?.comparison_metrics ?? [];
  const timelineComp = compData?.timeline_comparison ?? { current: [], historical: [] };
  const resPlaybook = compData?.historical_resolution ?? dna?.resolution ?? "Restart service connection pool.";
  const resTime = compData?.resolution_minutes ?? dna?.resolution_minutes ?? 12;
  const histId = dna?.incident_id ?? "INC-0389";

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner Header & Match Badge */}
      <div
        className="rounded-xl border p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--purple) 15%, var(--panel)), var(--panel))",
          borderColor: "var(--purple)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider grad-btn flex items-center gap-1">
                <GitCompare size={12} strokeWidth={2.5} /> Pull Request Style Incident Visual Diff
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold" style={{ background: "var(--panel-2)", color: "var(--purple)" }}>
                Institutional Memory Retrieval
              </span>
            </div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              Current Incident #{cluster.cluster_id} vs Historical Incident {histId}
            </h2>
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
              {dna?.title || "Historical Failure Pattern Match"} ({dna?.date || "Past Resolution Memory"})
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className="px-4 py-2.5 rounded-xl border text-center font-mono"
              style={{
                background: "color-mix(in srgb, var(--purple) 18%, var(--panel-2))",
                borderColor: "var(--purple)",
              }}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--purple)" }}>
                Alert DNA Similarity
              </div>
              <div className="text-2xl font-extrabold" style={{ color: "var(--purple)" }}>
                {simPct}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Similarity Breakdown Progress Bars */}
      <div className="rounded-xl border p-5" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Dna size={16} style={{ color: "var(--purple)" }} />
            Explainable Similarity Breakdown
          </h3>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            Vector Space Centroid Feature Alignment
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {[
            { label: "Root Cause Match", val: breakdown.root_cause, color: "var(--critical)" },
            { label: "Affected Services", val: breakdown.affected_services, color: "var(--accent)" },
            { label: "Timeline Pattern", val: breakdown.timeline_pattern, color: "var(--high)" },
            { label: "Alert Pattern", val: breakdown.alert_pattern, color: "var(--purple)" },
            { label: "Severity Trend", val: breakdown.severity_trend, color: "var(--ok)" },
          ].map((item) => (
            <div key={item.label} className="p-3 rounded-lg border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="truncate">{item.label}</span>
                <span style={{ color: item.color }}>{item.val}%</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: "var(--panel)" }}>
                <div
                  className="h-1.5 rounded-full transition-all duration-700"
                  style={{ width: `${item.val}%`, background: item.color }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Side-by-Side Visual Diff Table */}
      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="px-5 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border)" }}>
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <GitCompare size={16} style={{ color: "var(--accent)" }} />
            Side-by-Side Property Comparison
          </h3>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--ok)" }} /> Match</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--high)" }} /> Partial</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: "var(--critical)" }} /> Divergent</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left uppercase font-mono tracking-wider border-b" style={{ color: "var(--muted)", background: "var(--panel-2)" }}>
                <th className="px-4 py-3 font-semibold">Attribute</th>
                <th className="px-4 py-3 font-semibold text-[var(--accent)]">Current Incident #{cluster.cluster_id}</th>
                <th className="px-4 py-3 font-semibold text-[var(--purple)]">Historical Incident {histId}</th>
                <th className="px-4 py-3 font-semibold">Diff Status</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => {
                const color = DIFF_COLOR[m.status] || "var(--muted)";
                return (
                  <tr key={m.field} className="border-t hover:bg-[color-mix(in_srgb,var(--text)_4%,transparent)] transition-colors" style={{ borderColor: "var(--border)" }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: "var(--text)" }}>{m.field}</td>
                    <td className="px-4 py-3 font-mono font-medium">{m.current}</td>
                    <td className="px-4 py-3 font-mono font-medium" style={{ color: "var(--muted)" }}>{m.historical}</td>
                    <td className="px-4 py-3">
                      <span
                        className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                        style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
                      >
                        {DIFF_LABEL[m.status]}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Aligned Symptom Timelines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Current Incident Timeline */}
        <div className="rounded-xl border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3 text-[var(--accent)] flex items-center gap-2">
            <Clock size={14} /> Current Incident Symptoms (#{cluster.cluster_id})
          </div>
          <div className="space-y-2">
            {timelineComp.current.map((t, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border text-xs" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                <span className="font-mono text-[11px] text-[var(--muted)]">{t.time}</span>
                <span className="font-semibold">{t.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Historical Incident Timeline */}
        <div className="rounded-xl border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="text-xs font-bold uppercase tracking-wider mb-3 text-[var(--purple)] flex items-center gap-2">
            <Clock size={14} /> Historical Incident Symptoms ({histId})
          </div>
          <div className="space-y-2">
            {timelineComp.historical.map((t, i) => (
              <div key={i} className="flex items-center gap-2 p-2 rounded border text-xs" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                <span className="font-mono text-[11px] text-[var(--purple)]">{t.time}</span>
                <span className="font-semibold" style={{ color: "var(--muted)" }}>{t.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Resolution Playbook Panel */}
      <div
        className="rounded-xl border p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--ok) 14%, var(--panel)), var(--panel))",
          borderColor: "var(--ok)",
        }}
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5 min-w-0 flex-1">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md mt-0.5" style={{ background: "var(--ok)" }}>
              <Wrench size={20} strokeWidth={2.25} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold uppercase tracking-wider text-[var(--ok)]">
                  Last Successful Historical Resolution
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: "color-mix(in srgb, var(--ok) 20%, transparent)", color: "var(--ok)" }}>
                  Resolved in {resTime} minutes
                </span>
              </div>
              <h3 className="text-sm sm:text-base font-bold mb-2 leading-snug break-words" style={{ color: "var(--text)" }}>
                {resPlaybook}
              </h3>
              <div className="text-xs space-y-1" style={{ color: "var(--muted)" }}>
                {compData?.suggested_actions?.map((act, i) => (
                  <div key={i} className="flex items-center gap-1.5">
                    <CheckCircle2 size={13} style={{ color: "var(--ok)" }} />
                    <span>{act}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Copilot Query Shortcuts */}
      <div className="rounded-xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <MessageSquare size={16} style={{ color: "var(--accent)" }} />
          <span>Ask AI Copilot about this comparison:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            "Why are these incidents similar?",
            "What changed between these incidents?",
            "Would the previous resolution work for Incident #" + cluster.cluster_id + "?",
          ].map((q) => (
            <button
              key={q}
              onClick={() => onAskCopilot && onAskCopilot(q)}
              className="px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all hover:brightness-125"
              style={{ background: "var(--panel-2)", borderColor: "var(--border)", color: "var(--text)" }}
            >
              "{q}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
