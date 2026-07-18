import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, LoaderCircle, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { askIncidentAssistant } from "../api/assistant";
import AssistantMessage from "./AssistantMessage";
import SuggestedQuestions from "./SuggestedQuestions";

const DEFAULT_QUESTIONS = [
  { label: "Explain Incident", prompt: "Explain this incident." },
  { label: "Why Risk High?", prompt: "Why is the risk score so high?" },
  { label: "Explain Alert DNA", prompt: "Explain the Alert DNA match." },
  { label: "Suggested Fix", prompt: "What should I fix first?" },
  { label: "Business Impact", prompt: "Explain the business impact." },
  { label: "Summarize", prompt: "Summarize this incident." },
];

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="rounded-xl border px-3 py-2.5"
        style={{ background: "var(--panel)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: "var(--accent)" }}
          />
          <span
            className="w-2 h-2 rounded-full animate-pulse [animation-delay:120ms]"
            style={{ background: "var(--accent)" }}
          />
          <span
            className="w-2 h-2 rounded-full animate-pulse [animation-delay:240ms]"
            style={{ background: "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}

export default function AssistantChat({ cluster, onClose }) {
  const navigate = useNavigate();
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(null);
  const [lastPrompt, setLastPrompt] = useState("");
  const [retryConversation, setRetryConversation] = useState([]);

  const root = cluster?.root_cause;
  const risk = cluster?.risk;
  const activeQuestions = useMemo(() => DEFAULT_QUESTIONS, []);

  useEffect(() => {
    setMessages([]);
    setDraft("");
    setLoading(false);
    setError(null);
    setUnavailable(false);
    setAvailabilityError(null);
    setLastPrompt("");
    setRetryConversation([]);
  }, [cluster?.cluster_id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, error, unavailable]);

  if (!cluster || !root || !risk) return null;

  const sendPrompt = async (question, conversationSnapshot = messages) => {
    const trimmed = question.trim();
    if (!trimmed || loading || unavailable) return;

    const nextConversation = [
      ...conversationSnapshot,
      { role: "user", content: trimmed },
    ];
    setMessages(nextConversation);
    setLoading(true);
    setError(null);
    setLastPrompt(trimmed);
    setRetryConversation(conversationSnapshot);

    try {
      const response = await askIncidentAssistant({
        incident_id: String(cluster.cluster_id),
        question: trimmed,
        conversation: conversationSnapshot,
      });

      if (response.status === "unavailable") {
        setUnavailable(true);
        setAvailabilityError(response.error || "AI Assistant unavailable.");
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: response.error || "AI Assistant unavailable.",
          },
        ]);
        return;
      }

      if (response.status !== "ok") {
        setError(response.error || "AI Assistant temporarily unavailable.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.answer },
      ]);
    } catch (err) {
      setError(err.message || "AI Assistant temporarily unavailable.");
    } finally {
      setLoading(false);
      setDraft("");
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    sendPrompt(draft);
  };

  const retry = () => {
    if (!lastPrompt) return;
    setError(null);
    sendPrompt(lastPrompt, retryConversation);
  };

  return (
    <div className="w-75 h-full shrink-0 hidden min-[1360px]:flex flex-col gap-4 overflow-hidden">
      <div
        className="rounded-xl border p-4 shrink-0"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
      >
        <div className="flex items-start gap-2 mb-3">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center text-[14px] font-bold"
            style={{ background: "var(--grad)", color: "#fff" }}
          >
            <Bot size={14} strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <div className="font-semibold text-[16px] leading-tight">
              AI Incident Copilot
            </div>
            <div
              className="text-[12px] mt-0.5"
              style={{ color: "var(--muted)" }}
            >
              Groq · llama-3.3-70b-versatile
            </div>
          </div>
          <button
            onClick={onClose}
            className="ml-auto cursor-pointer"
            style={{ color: "var(--muted)" }}
            title="Close panel"
          >
            <X size={15} strokeWidth={2} />
          </button>
        </div>

        <div
          className="rounded-lg border p-3 mb-3"
          style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}
        >
          <div
            className="text-[13px] font-semibold"
            style={{ color: "var(--text)" }}
          >
            {root.service} / {root.alertname}
          </div>
          <div className="text-[12px] mt-0.5" style={{ color: "var(--muted)" }}>
            {Math.round((risk.score || 0) * 100)}% risk ·{" "}
            {cluster.raw_alert_count} alerts · {cluster.risk.services_affected}{" "}
            services
          </div>
        </div>

        {unavailable ? (
          <div
            className="rounded-lg border p-3 mb-3 text-[13px]"
            style={{
              borderColor: "var(--border)",
              background: "var(--panel-2)",
              color: "var(--muted)",
            }}
          >
            {availabilityError || "AI Assistant unavailable."}
          </div>
        ) : (
          <>
            <div
              className="text-[13px] font-semibold mb-2 flex items-center gap-1.5"
              style={{ color: "var(--text)" }}
            >
              <Sparkles size={13} strokeWidth={2} /> Suggested Questions
            </div>
            <SuggestedQuestions
              questions={activeQuestions}
              onPick={(prompt) => sendPrompt(prompt)}
              disabled={loading}
            />
          </>
        )}
      </div>

      <div
        className="rounded-xl border p-4 flex-1 min-h-0 flex flex-col overflow-hidden"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
      >
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-semibold text-[15px]">Conversation</div>
            <div
              className="text-[12px] mt-0.5"
              style={{ color: "var(--muted)" }}
            >
              Ask a question about the selected incident.
            </div>
          </div>
          {cluster?.cluster_id != null && (
            <button
              onClick={() => navigate(`/incidents/${cluster.cluster_id}`)}
              className="px-2.5 py-1 rounded-lg border text-[12px] font-semibold cursor-pointer"
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-2)",
                color: "var(--text)",
              }}
            >
              Open incident
            </button>
          )}
        </div>

        <div
          className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3"
          style={{ scrollbarWidth: "thin", scrollbarColor: "var(--border) transparent" }}
        >
          {messages.length === 0 && !loading && !error && !unavailable ? (
            <div
              className="rounded-lg border border-dashed p-3 text-[13px]"
              style={{ borderColor: "var(--border)", color: "var(--muted)" }}
            >
              Start with one of the suggested questions, or type your own
              explanation request below.
            </div>
          ) : null}

          {messages.map((message, index) => (
            <AssistantMessage
              key={`${message.role}-${index}`}
              role={message.role}
              content={message.content}
            />
          ))}

          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {error && !unavailable && (
          <div
            className="mt-3 rounded-lg border px-3 py-2 text-[12.5px] flex items-start gap-2"
            style={{
              borderColor: "var(--critical)",
              background:
                "color-mix(in srgb, var(--critical) 8%, var(--panel))",
              color: "var(--text)",
            }}
          >
            <div className="min-w-0 flex-1">{error}</div>
            <button
              onClick={retry}
              className="inline-flex items-center gap-1 cursor-pointer font-semibold"
              style={{ color: "var(--critical)" }}
            >
              <RefreshCw size={12} strokeWidth={2} /> Retry
            </button>
          </div>
        )}

        <form onSubmit={onSubmit} className="mt-3 shrink-0">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSubmit(e);
              }
            }}
            disabled={loading || unavailable}
            placeholder={
              unavailable ? "AI Assistant unavailable." : "Ask anything..."
            }
            rows={3}
            className="w-full rounded-lg border px-3 py-2 text-[13px] resize-none outline-none disabled:opacity-60"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>
              Enter to send · Shift+Enter for a new line
            </div>
            <button
              type="submit"
              disabled={loading || unavailable || !draft.trim()}
              className="px-3 py-1.5 rounded-lg text-[13px] font-semibold cursor-pointer inline-flex items-center gap-1.5 disabled:opacity-50"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              {loading ? (
                <LoaderCircle
                  size={13}
                  className="animate-spin"
                  strokeWidth={2.5}
                />
              ) : (
                <Send size={13} strokeWidth={2.5} />
              )}
              Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
