import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, LoaderCircle, RefreshCw, Send, X, Globe } from "lucide-react";
import { askIncidentAssistant, askWorkspaceAssistant } from "../api/assistant";
import AssistantMessage from "./AssistantMessage";

// ---------------------------------------------------------------------------
// Suggested questions — adapt based on current page
// ---------------------------------------------------------------------------
const PAGE_QUESTIONS = {
  home: [
    { label: "Top Risks", prompt: "What are the top risk incidents right now?" },
    { label: "State Summary", prompt: "Summarize the current alert and incident state." },
    { label: "Most Affected", prompt: "Which service is most affected right now?" },
    { label: "Noise Reduction", prompt: "How much noise has been removed this window?" },
  ],
  feed: [
    { label: "Firing Alerts", prompt: "How many alerts are currently firing?" },
    { label: "By Severity", prompt: "Break down current alerts by severity." },
    { label: "Top Services", prompt: "Which services have the most alerts?" },
    { label: "State Summary", prompt: "Give me a quick summary of the alert feed." },
  ],
  correlations: [
    { label: "How Correlation Works", prompt: "How does the correlation engine group alerts?" },
    { label: "Active Groups", prompt: "How many correlated groups are there?" },
    { label: "What is AlertLens?", prompt: "Explain what AlertLens does." },
    { label: "Noise Reduction", prompt: "How much noise has been filtered out?" },
  ],
  deduplication: [
    { label: "Dedup Stats", prompt: "How much noise was removed by deduplication?" },
    { label: "How Dedup Works", prompt: "Explain the deduplication approach." },
    { label: "Unique Alerts", prompt: "How many unique alerts remain after dedup?" },
    { label: "Duplicate Count", prompt: "How many duplicate alerts were collapsed?" },
  ],
  incidents: [
    { label: "High Risk", prompt: "List all high-risk incidents." },
    { label: "Top Priority", prompt: "Which incident needs attention first?" },
    { label: "Summary", prompt: "Give me a summary of all active incidents." },
    { label: "Services Affected", prompt: "Which services have active incidents?" },
  ],
  topology: [
    { label: "Affected Services", prompt: "Which services are currently impacted?" },
    { label: "Service Count", prompt: "How many services have active alerts?" },
    { label: "Top Risks", prompt: "What are the top risk incidents right now?" },
    { label: "Dependencies", prompt: "Explain how alert correlation maps service dependencies." },
  ],
  pipeline: [
    { label: "Pipeline Stages", prompt: "Explain the AlertLens pipeline stages." },
    { label: "Current Stats", prompt: "What are the current pipeline stats?" },
    { label: "Dedup + Cluster", prompt: "How does dedup feeding into clustering work?" },
    { label: "Alert DNA", prompt: "What is Alert DNA and how does it work?" },
  ],
  evaluation: [
    { label: "Metrics Explained", prompt: "Explain the evaluation metrics shown here." },
    { label: "Cluster Purity", prompt: "What does cluster purity mean?" },
    { label: "DNA Accuracy", prompt: "What is the Alert DNA accuracy metric?" },
    { label: "Detection Rate", prompt: "What is the incident detection rate?" },
  ],
};

const INCIDENT_QUESTIONS = [
  { label: "Explain Incident", prompt: "Explain this incident." },
  { label: "Why Risk?", prompt: "Why is the risk score so high?" },
  { label: "Alert DNA", prompt: "Explain the Alert DNA match." },
  { label: "Suggested Fix", prompt: "What should I fix first?" },
  { label: "Business Impact", prompt: "Explain the business impact." },
  { label: "Summarize", prompt: "Summarize this incident." },
];

const DEFAULT_QUESTIONS = PAGE_QUESTIONS.home;

function pageKeyFromPath(pathname) {
  if (!pathname) return "home";
  const clean = pathname.replace(/^\//, "").split("/")[0] || "home";
  const map = {
    "": "home",
    feed: "feed",
    firing: "feed",
    "5xx": "feed",
    deduplication: "deduplication",
    correlations: "correlations",
    incidents: "incidents",
    evaluation: "evaluation",
    pipeline: "pipeline",
    topology: "topology",
  };
  return map[clean] || "home";
}

function pageLabel(pathname) {
  const map = {
    home: "Home",
    feed: "Alert Feed",
    correlations: "Correlations",
    deduplication: "Deduplication",
    incidents: "Incidents",
    evaluation: "Evaluation",
    pipeline: "Pipeline",
    topology: "Topology",
    workflows: "Workflows",
    providers: "Providers",
  };
  return map[pageKeyFromPath(pathname)] || "Dashboard";
}

// ---------------------------------------------------------------------------
// UI sub-components
// ---------------------------------------------------------------------------
function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="rounded-[16px_16px_16px_4px] border px-4 py-3 shadow-md"
        style={{
          background: "color-mix(in srgb, var(--panel-2) 60%, transparent)",
          borderColor: "color-mix(in srgb, var(--border) 60%, transparent)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-1.5 opacity-75">
          <span className="w-2 h-2 rounded-full animate-bounce" style={{ background: "var(--accent)" }} />
          <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:150ms]" style={{ background: "var(--accent)" }} />
          <span className="w-2 h-2 rounded-full animate-bounce [animation-delay:300ms]" style={{ background: "var(--accent)" }} />
        </div>
      </div>
    </div>
  );
}

function QuestionChips({ questions, onPick, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((q) => (
        <button
          key={q.label}
          type="button"
          onClick={() => onPick(q.prompt)}
          disabled={disabled}
          className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50"
          style={{
            background: "var(--panel-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function GlobalAssistantChat({ data, pathname, incidentId, incidentCluster, onClose }) {
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [retryConversation, setRetryConversation] = useState([]);
  const [providerLabel, setProviderLabel] = useState("Cerebras / Groq · Llama 3.3 70B");

  const isIncidentMode = Boolean(incidentId);
  const pageKey = pageKeyFromPath(pathname);
  const questions = isIncidentMode
    ? INCIDENT_QUESTIONS
    : PAGE_QUESTIONS[pageKey] || DEFAULT_QUESTIONS;

  const resetKey = isIncidentMode ? incidentId : pathname;
  useEffect(() => {
    setMessages([]);
    setDraft("");
    setLoading(false);
    setError(null);
    setUnavailable(false);
    setAvailabilityError(null);
    setLastPrompt("");
    setRetryConversation([]);
  }, [resetKey]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const workspaceContext = useMemo(() => {
    if (!data) return { page: pageLabel(pathname) };
    const clusters = data.clusters ?? [];
    const alerts = data.raw_alerts ?? [];
    const noise = data.noise ?? [];
    const dedup = data.dedup_stats ?? {};
    return {
      page: pageLabel(pathname),
      active_incidents: clusters.length,
      firing_alerts: alerts.filter((a) => a.status === "firing").length,
      total_alerts: alerts.length,
      noise_alerts: noise.length,
      noise_reduction_pct: dedup.reduction_pct ?? null,
      top_risks: clusters.slice(0, 3).map((c) => ({
        incident_id: c.cluster_id,
        service: c.root_cause?.service,
        alertname: c.root_cause?.alertname,
        risk_level: c.risk?.level,
        risk_score: c.risk?.score,
        alert_count: c.raw_alert_count,
      })),
    };
  }, [data, pathname]);

  const sendPrompt = async (question, conversationSnapshot = messages) => {
    const trimmed = question.trim();
    if (!trimmed || loading || unavailable) return;

    const nextConversation = [...conversationSnapshot, { role: "user", content: trimmed }];
    setMessages(nextConversation);
    setLoading(true);
    setError(null);
    setLastPrompt(trimmed);
    setRetryConversation(conversationSnapshot);

    try {
      let response;
      if (isIncidentMode) {
        response = await askIncidentAssistant({
          incident_id: String(incidentId),
          question: trimmed,
          conversation: conversationSnapshot,
        });
      } else {
        response = await askWorkspaceAssistant({
          question: trimmed,
          conversation: conversationSnapshot,
          workspace_context: workspaceContext,
        });
      }

      if (response.status === "unavailable") {
        setUnavailable(true);
        setAvailabilityError(response.error || "AI Assistant unavailable.");
        setMessages((prev) => [...prev, { role: "assistant", content: response.error || "AI Assistant unavailable." }]);
        return;
      }

      if (response.status !== "ok") {
        setError(response.error || "AI Assistant temporarily unavailable.");
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: response.answer }]);
      if (response.provider && response.model) {
        setProviderLabel(`${response.provider} · ${response.model}`);
      }
    } catch (err) {
      setError(err.message || "AI Assistant temporarily unavailable.");
    } finally {
      setLoading(false);
      setDraft("");
    }
  };

  const onSubmit = (e) => { e.preventDefault(); sendPrompt(draft); };
  const retry = () => { if (!lastPrompt) return; setError(null); sendPrompt(lastPrompt, retryConversation); };

  const isConversationEmpty = messages.length === 0 && !loading && !error && !unavailable;
  const root = incidentCluster?.root_cause;
  const risk = incidentCluster?.risk;

  return (
    <div className="w-[380px] max-w-[92vw] h-[600px] max-h-[80vh] shrink-0 flex overflow-hidden">
      <div
        className="rounded-2xl border p-4 flex h-full w-full flex-col overflow-hidden shadow-2xl"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--panel) 90%, transparent)",
          backdropFilter: "blur(20px)",
        }}
      >
        <div className="flex items-start gap-2 shrink-0">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center text-[14px] font-bold shrink-0"
            style={{ background: "var(--grad)", color: "#fff" }}
          >
            <Bot size={14} strokeWidth={2.25} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[16px] leading-tight">
                  AI {isIncidentMode ? "Incident Copilot" : "Workspace Assistant"}
                </div>
                <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                  {providerLabel}
                </div>
              </div>
              <button
                onClick={onClose}
                className="cursor-pointer shrink-0"
                style={{ color: "var(--muted)" }}
                title="Close panel"
              >
                <X size={15} strokeWidth={2} />
              </button>
            </div>

            <div
              className="mt-3 rounded-lg border px-3 py-2"
              style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}
            >
              {isIncidentMode && root && risk ? (
                <>
                  <div className="text-[13px] font-semibold leading-tight" style={{ color: "var(--text)" }}>
                    {root.service} / {root.alertname}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-[12px] flex-wrap" style={{ color: "var(--muted)" }}>
                    <span>{Math.round((risk.score || 0) * 100)}% risk</span>
                    <span>·</span>
                    <span>{incidentCluster.raw_alert_count} alerts</span>
                    <span>·</span>
                    <span>{risk.services_affected} services</span>
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Globe size={13} strokeWidth={2} style={{ color: "var(--accent)", flexShrink: 0 }} />
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold leading-tight" style={{ color: "var(--text)" }}>
                      {pageLabel(pathname)}
                    </div>
                    <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
                      {data
                        ? `${(data.clusters ?? []).length} incidents · ${(data.raw_alerts ?? []).length} alerts`
                        : "Workspace context — ask anything"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div className="text-[13px] font-semibold mb-2 shrink-0" style={{ color: "var(--text)" }}>
            Conversation
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3"
            style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
          >
            {isConversationEmpty && (
              <div
                className="rounded-lg border border-dashed p-3 text-[13px]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                {isIncidentMode
                  ? "Start with one of the suggested questions or type your own."
                  : `Ask me anything about the current ${pageLabel(pathname)} view, the pipeline state, or the AlertLens project.`}
              </div>
            )}

            {messages.map((msg, idx) => (
              <AssistantMessage key={`${msg.role}-${idx}`} role={msg.role} content={msg.content} />
            ))}

            {loading && <TypingIndicator />}
            <div ref={bottomRef} />
          </div>

          {isConversationEmpty && (
            <div className="mt-3 shrink-0">
              <div className="text-[12px] font-semibold mb-2" style={{ color: "var(--muted)" }}>
                Suggested Questions
              </div>
              <QuestionChips questions={questions} onPick={(p) => sendPrompt(p)} disabled={loading} />
            </div>
          )}

          {error && !unavailable && (
            <div
              className="mt-3 rounded-lg border px-3 py-2 text-[12.5px] flex items-start gap-2 shrink-0"
              style={{
                borderColor: "var(--critical)",
                background: "color-mix(in srgb, var(--critical) 8%, var(--panel))",
                color: "var(--text)",
              }}
            >
              <div className="min-w-0 flex-1">{error}</div>
              <button
                onClick={retry}
                className="inline-flex items-center gap-1 cursor-pointer font-semibold shrink-0"
                style={{ color: "var(--critical)" }}
              >
                <RefreshCw size={12} strokeWidth={2} /> Retry
              </button>
            </div>
          )}

          {unavailable && (
            <div
              className="mt-3 rounded-lg border px-3 py-2 text-[12.5px] shrink-0"
              style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--muted)" }}
            >
              {availabilityError || "AI Assistant unavailable."}
            </div>
          )}

          <form onSubmit={onSubmit} className="mt-3 shrink-0">
            <div
              className="rounded-lg border p-2"
              style={{ borderColor: "var(--border)", background: "var(--bg)" }}
            >
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSubmit(e); }
                }}
                disabled={loading || unavailable}
                placeholder={unavailable ? "AI Assistant unavailable." : "Ask anything..."}
                rows={3}
                className="w-full resize-none border-0 bg-transparent p-0 text-[13px] outline-none disabled:opacity-60"
                style={{ color: "var(--text)" }}
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                  Enter to send · Shift+Enter for new line
                </div>
                <button
                  type="submit"
                  disabled={loading || unavailable || !draft.trim()}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-semibold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
                  style={{ background: "var(--accent)", color: "#fff" }}
                >
                  {loading ? (
                    <LoaderCircle size={13} className="animate-spin" strokeWidth={2.5} />
                  ) : (
                    <Send size={13} strokeWidth={2.5} />
                  )}
                  Send
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
