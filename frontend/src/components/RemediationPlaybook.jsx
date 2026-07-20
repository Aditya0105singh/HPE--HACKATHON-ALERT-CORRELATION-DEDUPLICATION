import { useEffect, useState } from "react";
import {
  AlertTriangle, ArrowRight, CheckCircle2, CheckSquare, ChevronRight, Clock, Dna,
  DollarSign, FastForward, HelpCircle, Info as InfoIcon, MessageSquare, Play,
  RefreshCw, RotateCcw, Shield, ShieldAlert, Sparkles, Square, Wrench, Zap
} from "lucide-react";
import { fetchPlaybook } from "../api";
import { Info, PriorityBadge, RiskMeter, ServiceChip, SeverityBadge, SeverityDot } from "./ui";

const PRIORITY_COLOR = {
  Critical: "var(--critical)",
  "Critical P1": "var(--critical)",
  High: "var(--high)",
  "High P2": "var(--high)",
  Medium: "var(--ok)",
};

export default function RemediationPlaybook({ cluster, onAskCopilot }) {
  const [playbook, setPlaybook] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completedSteps, setCompletedSteps] = useState({});
  const [isSimulating, setIsSimulating] = useState(false);
  const [simStepIndex, setSimStepIndex] = useState(-1);

  useEffect(() => {
    if (!cluster) return;
    let isMounted = true;
    setLoading(true);

    fetchPlaybook(cluster.cluster_id)
      .then((res) => {
        if (isMounted) {
          setPlaybook(res);
          setCompletedSteps({});
          setIsSimulating(false);
          setSimStepIndex(-1);
        }
      })
      .catch((err) => {
        console.error("Playbook fetch error:", err);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [cluster]);

  // Run Simulation timer (Bonus feature)
  useEffect(() => {
    if (!isSimulating || !playbook?.steps?.length) return;

    const timer = setInterval(() => {
      setSimStepIndex((prev) => {
        const next = prev + 1;
        if (next < playbook.steps.length) {
          setCompletedSteps((c) => ({ ...c, [playbook.steps[next].step_number]: true }));
          return next;
        } else {
          setIsSimulating(false);
          return prev;
        }
      });
    }, 1800);

    return () => clearInterval(timer);
  }, [isSimulating, playbook?.steps?.length]);

  const toggleStep = (num) => {
    setCompletedSteps((prev) => ({ ...prev, [num]: !prev[num] }));
  };

  const startSimulation = () => {
    setCompletedSteps({});
    setSimStepIndex(0);
    setCompletedSteps({ [playbook.steps[0].step_number]: true });
    setIsSimulating(true);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs" style={{ color: "var(--muted)" }}>
        <Wrench size={32} className="mx-auto mb-2 animate-spin text-[var(--ok)]" />
        <div>Generating Enterprise AI Remediation Playbook...</div>
      </div>
    );
  }

  if (!playbook) return null;

  const steps = playbook.steps || [];
  const completedCount = Object.values(completedSteps).filter(Boolean).length;
  const isAllDone = completedCount === steps.length && steps.length > 0;
  const progressPct = steps.length ? Math.round((completedCount / steps.length) * 100) : 0;
  const impact = playbook.business_impact || {};

  return (
    <div className="flex flex-col gap-6">
      {/* Top Banner & Runbook Header */}
      <div
        className="rounded-xl border p-5 relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 15%, var(--panel)), var(--panel))",
          borderColor: "var(--accent)",
          boxShadow: "0 4px 20px color-mix(in srgb, var(--accent) 12%, transparent)",
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider grad-btn flex items-center gap-1">
                <Wrench size={12} strokeWidth={2.5} /> Enterprise SRE Runbook
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full font-mono font-bold" style={{ background: "var(--panel-2)", color: PRIORITY_COLOR[playbook.priority] }}>
                Priority: {playbook.priority}
              </span>
            </div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {playbook.title}
            </h2>
            <p className="text-xs mt-1 leading-relaxed" style={{ color: "var(--muted)" }}>
              Est. Resolution Recovery Time: <b style={{ color: "var(--ok)" }}>{playbook.estimated_resolution}</b> · Derived from pipeline state & verified Alert DNA playbooks.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {/* Run Simulation Button */}
            <button
              onClick={startSimulation}
              disabled={isSimulating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold grad-btn cursor-pointer transition-all shadow-md hover:brightness-110 disabled:opacity-50"
            >
              <Play size={14} className={isSimulating ? "animate-spin" : ""} />
              {isSimulating ? `Simulating Step ${simStepIndex + 1}...` : "Run Simulation"}
            </button>

            <div
              className="px-4 py-2.5 rounded-xl border text-center font-mono"
              style={{
                background: "color-mix(in srgb, var(--accent) 18%, var(--panel-2))",
                borderColor: "var(--accent)",
              }}
            >
              <div className="text-[10px] uppercase tracking-wider font-bold" style={{ color: "var(--accent)" }}>
                Runbook Confidence
              </div>
              <div className="text-2xl font-extrabold" style={{ color: "var(--accent)" }}>
                {playbook.confidence}%
              </div>
            </div>
          </div>
        </div>

        {/* Playbook Progress Bar */}
        <div className="mt-4 pt-3 border-t flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
          <div className="text-xs font-mono font-semibold" style={{ color: "var(--muted)" }}>
            Progress: <b style={{ color: isAllDone ? "var(--ok)" : "var(--text)" }}>{completedCount}/{steps.length} Steps Completed</b> ({progressPct}%)
          </div>
          <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--panel-2)" }}>
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, background: isAllDone ? "var(--ok)" : "var(--accent)" }}
            />
          </div>
          {isAllDone && (
            <span className="text-xs font-bold px-2 py-0.5 rounded uppercase flex items-center gap-1" style={{ background: "var(--ok)", color: "#fff" }}>
              <CheckCircle2 size={12} /> Incident Resolved!
            </span>
          )}
        </div>
      </div>

      {/* Main Grid: Step-by-Step Response Plan & Business Impact / Rollback */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Step-by-Step Response Plan */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Zap size={16} style={{ color: "var(--accent)" }} />
              Immediate Actionable Response Plan
            </h3>
            <span className="text-xs" style={{ color: "var(--muted)" }}>
              Interactive Checklist
            </span>
          </div>

          <div className="space-y-3">
            {steps.map((step) => {
              const isDone = !!completedSteps[step.step_number];
              const isCurrentSim = isSimulating && simStepIndex + 1 === step.step_number;

              return (
                <div
                  key={step.step_number}
                  onClick={() => toggleStep(step.step_number)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isCurrentSim ? "ring-2 ring-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_12%,var(--panel-2))]" : isDone ? "opacity-75 bg-[color-mix(in_srgb,var(--ok)_8%,var(--panel))]" : ""
                  }`}
                  style={{
                    borderColor: isCurrentSim ? "var(--accent)" : isDone ? "var(--ok)" : "var(--border)",
                    background: isCurrentSim ? undefined : isDone ? undefined : "var(--panel)",
                  }}
                >
                  <div className="flex items-start gap-3.5">
                    {/* Checkbox */}
                    <button className="mt-0.5 shrink-0 cursor-pointer text-[var(--accent)]">
                      {isDone ? <CheckSquare size={18} style={{ color: "var(--ok)" }} /> : <Square size={18} style={{ color: "var(--muted)" }} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold px-1.5 py-0.2 rounded" style={{ background: "var(--panel-2)", color: "var(--accent)" }}>
                            Step {step.step_number}
                          </span>
                          <span className={`font-bold text-sm ${isDone ? "line-through text-[var(--muted)]" : ""}`}>
                            {step.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="px-2 py-0.5 rounded font-semibold" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
                            ⏱ {step.estimated_duration}
                          </span>
                          <span className="px-2 py-0.5 rounded font-bold uppercase" style={{ background: `color-mix(in srgb, ${PRIORITY_COLOR[step.priority] || "var(--muted)"} 20%, transparent)`, color: PRIORITY_COLOR[step.priority] || "var(--muted)" }}>
                            {step.priority}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs leading-relaxed" style={{ color: "var(--muted)" }}>
                        {step.description}
                      </p>

                      <div className="flex items-center gap-3 mt-2 text-[10px] font-mono" style={{ color: "var(--muted)" }}>
                        <span>Risk: <b style={{ color: "var(--text)" }}>{step.risk}</b></span>
                        <span>•</span>
                        <span>Dependency: <b style={{ color: "var(--text)" }}>{step.dependency}</b></span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Col: Validation, Rollback, & Business Impact */}
        <div className="space-y-6">
          {/* Post-Remediation Validation Checklist */}
          <div className="rounded-xl border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <CheckCircle2 size={16} style={{ color: "var(--ok)" }} />
              Post-Remediation Health Validation
            </h3>
            <div className="space-y-2">
              {(playbook.validation || []).map((val, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs p-2 rounded border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                  <CheckCircle2 size={14} style={{ color: "var(--ok)" }} className="mt-0.5 shrink-0" />
                  <span style={{ color: "var(--text)" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rollback Contingency Procedure */}
          <div className="rounded-xl border p-4" style={{ background: "color-mix(in srgb, var(--critical) 8%, var(--panel))", borderColor: "var(--critical)" }}>
            <h3 className="text-sm font-bold text-[var(--critical)] mb-2 flex items-center gap-2">
              <ShieldAlert size={16} /> Rollback Contingency Procedure
            </h3>
            <p className="text-[11px] mb-3" style={{ color: "var(--muted)" }}>
              If remediation fails or metrics deteriorate, execute immediate rollback:
            </p>
            <div className="space-y-2 text-xs">
              {(playbook.rollback || []).map((rb, idx) => (
                <div key={idx} className="flex items-start gap-2 p-2 rounded border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                  <span className="font-bold text-[var(--critical)]">{idx + 1}.</span>
                  <span>{rb}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Business Impact Summary */}
          <div className="rounded-xl border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <DollarSign size={16} style={{ color: "var(--high)" }} />
              Business Impact & Risk
            </h3>
            <div className="text-xs space-y-2">
              <div className="p-2.5 rounded border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                <div className="font-bold mb-0.5">Current Service Impact</div>
                <div style={{ color: "var(--muted)" }}>{impact.current}</div>
              </div>
              <div className="p-2.5 rounded border" style={{ background: "var(--panel-2)", borderColor: "var(--border)" }}>
                <div className="font-bold text-[var(--critical)] mb-0.5">Estimated Impact If Unresolved</div>
                <div style={{ color: "var(--muted)" }}>{impact.estimated_if_unresolved}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* AI Copilot Prompt Shortcuts */}
      <div className="rounded-xl border p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 shrink-0" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2 text-xs font-semibold">
          <MessageSquare size={16} style={{ color: "var(--accent)" }} />
          <span>Ask AI Copilot about this playbook:</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            "Why is this the recommended fix?",
            "What if this remediation fails?",
            "Why is step 1 prioritized first?",
            "Can I skip step 2 safely?",
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
