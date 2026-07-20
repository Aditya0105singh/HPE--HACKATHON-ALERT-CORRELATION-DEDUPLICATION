import { useEffect, useState } from "react";
import {
  ArrowDown, ArrowRight, CheckCircle2, ChevronRight, Dna, HelpCircle,
  Info as InfoIcon, MessageSquare, Network, Server, Shield, ShieldAlert, Sparkles, XCircle, Zap
} from "lucide-react";
import { fetchRootCauseConfidence } from "../api";
import { Info, PriorityBadge, RiskMeter, ServiceChip, SeverityBadge, SeverityDot } from "./ui";

const BAR_COLOR = (pct, isSelected) => {
  if (isSelected) return "var(--ok)";
  if (pct >= 60) return "var(--high)";
  return "var(--muted)";
};

export default function RootCauseConfidenceGraph({ cluster, onAskCopilot }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!cluster) return;
    let isMounted = true;
    setLoading(true);

    fetchRootCauseConfidence(cluster.cluster_id)
      .then((res) => {
        if (isMounted) setData(res);
      })
      .catch((err) => {
        console.error("Root cause confidence fetch error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cluster]);

  if (loading) {
    return (
      <div className="p-8 text-center text-xs" style={{ color: "var(--muted)" }}>
        <Zap size={32} className="mx-auto mb-2 animate-spin text-[var(--accent)]" />
        <div>Calculating Explainable Root Cause Confidence Graph...</div>
      </div>
    );
  }

  if (!data) return null;

  const selected = data.selected_root_cause;
  const candidates = data.candidates || [];
  const evidence = data.evidence || [];
  const decisionTree = data.decision_tree || {};

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Selected Root Cause Glow Card */}
      <div
        className="rounded-xl border p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--ok) 16%, var(--panel)), var(--panel))",
          borderColor: "var(--ok)",
          boxShadow: "0 4px 20px color-mix(in srgb, var(--ok) 12%, transparent)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <span
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md mt-0.5"
              style={{ background: "var(--ok)" }}
            >
              <Server size={22} />
            </span>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider grad-btn flex items-center gap-1">
                  <Shield size={12} strokeWidth={2.5} /> Explainable AI (XAI) Decision Model
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold" style={{ background: "var(--panel-2)", color: "var(--ok)" }}>
                  Primary Root Cause Identified 🔴
                </span>
              </div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                {selected.service} / {selected.alertname}
              </h2>
              <p className="text-xs mt-1 leading-relaxed max-w-2xl" style={{ color: "var(--muted)" }}>
                {data.reasoning}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div
              className="px-4 py-2.5 rounded-xl border text-center font-mono"
              style={{
                background: "color-mix(in srgb, var(--ok) 18%, var(--panel-2))",
                borderColor: "var(--ok)",
              }}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--ok)" }}>
                Root Cause Confidence
              </div>
              <div className="text-2xl font-extrabold" style={{ color: "var(--ok)" }}>
                {selected.confidence}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Horizontal Confidence Ranking & Why Selected vs Rejected */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Horizontal Confidence Ranking Bars */}
        <div className="rounded-xl border p-5 flex flex-col" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap size={16} style={{ color: "var(--accent)" }} />
              Candidate Root Cause Confidence Ranking
            </h3>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Normalized Score (0-100%)
            </span>
          </div>

          <div className="space-y-4 my-auto">
            {candidates.map((c) => {
              const color = BAR_COLOR(c.confidence, c.is_selected);
              return (
                <div key={c.service} className="space-y-1.5">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="flex items-center gap-2">
                      <SeverityDot severity={c.severity} />
                      <span style={{ color: c.is_selected ? "var(--text)" : "var(--muted)" }}>
                        {c.service}
                      </span>
                      {c.is_selected && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded font-bold uppercase" style={{ background: "var(--ok)", color: "#fff" }}>
                          SELECTED WINNER
                        </span>
                      )}
                    </span>
                    <span className="font-mono font-bold" style={{ color }}>
                      {c.confidence}%
                    </span>
                  </div>

                  <div className="h-3 rounded-full overflow-hidden p-0.5 border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${c.is_selected ? "shadow-md" : ""}`}
                      style={{
                        width: `${c.confidence}%`,
                        background: color,
                        boxShadow: c.is_selected ? "0 0 10px var(--ok)" : undefined,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Why Selected vs Why Rejected Breakdown */}
        <div className="rounded-xl border p-5 flex flex-col" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <ShieldAlert size={16} style={{ color: "var(--high)" }} />
              Decision Evidence & Rejection Explanations
            </h3>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Explainable Signals
            </span>
          </div>

          <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
            {candidates.map((c) => (
              <div
                key={c.service}
                className="p-3 rounded-lg border text-xs"
                style={{
                  background: c.is_selected ? "color-mix(in srgb, var(--ok) 8%, var(--panel-2))" : "var(--panel-2)",
                  borderColor: c.is_selected ? "var(--ok)" : "var(--border)",
                }}
              >
                <div className="font-bold flex items-center justify-between mb-1.5">
                  <span className="flex items-center gap-1.5" style={{ color: c.is_selected ? "var(--ok)" : "var(--text)" }}>
                    {c.service} ({c.confidence}% Confidence)
                  </span>
                  <span className="text-[10px] font-mono" style={{ color: "var(--muted)" }}>
                    {c.is_selected ? "Selected Primary Origin" : "Rejected Candidate"}
                  </span>
                </div>

                <div className="space-y-1 pl-1">
                  {c.explanation.map((item, idx) => {
                    const isPass = item.startsWith("✔");
                    return (
                      <div key={idx} className="flex items-start gap-1.5 text-[11px] leading-relaxed">
                        <span style={{ color: isPass ? "var(--ok)" : "var(--critical)" }} className="font-bold">
                          {isPass ? "✓" : "✗"}
                        </span>
                        <span style={{ color: isPass ? "var(--text)" : "var(--muted)" }}>
                          {item.slice(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Decision Tree & Factors Matrix */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Visual Cascade Decision Tree */}
        <div className="rounded-xl border p-5 flex flex-col" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Network size={16} style={{ color: "var(--purple)" }} />
              Dependency Cascade Decision Flowchart
            </h3>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Time-Windowed Order of Failure
            </span>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-2">
            {/* Root Cause Node */}
            <div className="w-full rounded-xl border p-3 flex items-center justify-between" style={{ background: "color-mix(in srgb, var(--ok) 15%, var(--panel-2))", borderColor: "var(--ok)" }}>
              <div className="flex items-center gap-2.5">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs" style={{ background: "var(--ok)", color: "#fff" }}>
                  1
                </span>
                <div>
                  <div className="font-bold text-xs">{decisionTree.root?.service}</div>
                  <div className="text-[10px]" style={{ color: "var(--ok)" }}>Primary Failure Origin (Root Cause)</div>
                </div>
              </div>
              <span className="font-mono text-xs font-bold text-[var(--ok)]">{decisionTree.root?.confidence}%</span>
            </div>

            <ArrowDown size={16} style={{ color: "var(--muted)" }} />

            {/* Tier 1 Symptoms */}
            <div className="w-full grid grid-cols-2 gap-3">
              {(decisionTree.downstream_tier_1 || []).map((s) => (
                <div key={s} className="rounded-lg border p-2.5 text-xs text-center" style={{ background: "var(--panel-2)", borderColor: "var(--high)" }}>
                  <div className="font-semibold">{s}</div>
                  <div className="text-[10px]" style={{ color: "var(--high)" }}>Tier-1 Direct Cascade 🟠</div>
                </div>
              ))}
            </div>

            {decisionTree.downstream_tier_2 && decisionTree.downstream_tier_2.length > 0 && (
              <>
                <ArrowDown size={14} style={{ color: "var(--muted)" }} />
                <div className="w-full grid grid-cols-2 gap-3">
                  {decisionTree.downstream_tier_2.map((s) => (
                    <div key={s} className="rounded-lg border p-2.5 text-xs text-center" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                      <div className="font-semibold" style={{ color: "var(--muted)" }}>{s}</div>
                      <div className="text-[10px]" style={{ color: "var(--muted)" }}>Tier-2 Downstream Consumer 🟡</div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Normalized Evidence Factors Matrix */}
        <div className="rounded-xl border p-5" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: "var(--ok)" }} />
              Normalized Heuristic Evidence Factors
            </h3>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Weight Matrix
            </span>
          </div>

          <div className="space-y-2.5">
            {evidence.map((ev) => (
              <div key={ev.factor} className="p-3 rounded-lg border text-xs flex items-center justify-between gap-3" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <CheckCircle2 size={15} style={{ color: "var(--ok)" }} className="shrink-0" />
                  <div className="min-w-0">
                    <div className="font-semibold text-xs truncate">{ev.factor}</div>
                    <div className="text-[11px] truncate" style={{ color: "var(--muted)" }}>{ev.description}</div>
                  </div>
                </div>

                <span className="px-2 py-0.5 rounded font-mono text-[11px] font-bold shrink-0" style={{ background: "var(--panel)", color: "var(--accent)" }}>
                  {ev.weight}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Copilot Prompt Shortcuts */}
      <div className="rounded-xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <MessageSquare size={16} style={{ color: "var(--accent)" }} />
          <span>Ask AI Copilot about this confidence graph:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            `Why was ${selected.service} selected as the root cause?`,
            `Why wasn't candidate #2 selected?`,
            `Why is confidence exactly ${selected.confidence}%?`,
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
