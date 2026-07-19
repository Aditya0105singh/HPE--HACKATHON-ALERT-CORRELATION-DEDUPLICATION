import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bot, LoaderCircle, RefreshCw, Send, X } from "lucide-react";
import { askIncidentAssistant } from "../api/assistant";
import AssistantMessage from "./AssistantMessage";

const DEFAULT_QUESTIONS = [
  { label: "Explain Incident", prompt: "Explain this incident." },
  { label: "Why Risk?", prompt: "Why is the risk score so high?" },
  { label: "Alert DNA", prompt: "Explain the Alert DNA match." },
  { label: "Suggested Fix", prompt: "What should I fix first?" },
  { label: "Business Impact", prompt: "Explain the business impact." },
  { label: "Summarize", prompt: "Summarize this incident." },
];

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="rounded-[16px_16px_16px_4px] border px-4 py-3 shadow-md"
        style={{ 
          background: "color-mix(in srgb, var(--panel-2) 60%, transparent)", 
          borderColor: "color-mix(in srgb, var(--border) 60%, transparent)",
          backdropFilter: "blur(12px)"
        }}
      >
        <div className="flex items-center gap-1.5 opacity-75">
          <span
            className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: "var(--accent)" }}
          />
          <span
            className="w-2 h-2 rounded-full animate-bounce [animation-delay:150ms]"
            style={{ background: "var(--accent)" }}
          />
          <span
            className="w-2 h-2 rounded-full animate-bounce [animation-delay:300ms]"
            style={{ background: "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}

function QuestionChips({ questions, onPick, disabled }) {
  return (
    <div className="flex flex-wrap gap-2">
      {questions.map((question) => (
        <button
          key={question.label}
          type="button"
          onClick={() => onPick(question.prompt)}
          disabled={disabled}
          className="rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors disabled:opacity-50"
          style={{
            background: "var(--panel-2)",
            borderColor: "var(--border)",
            color: "var(--text)",
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          {question.label}
        </button>
      ))}
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
  // Backend tries Cerebras then Groq at request time — don't hardcode a
  // provider label, reflect whichever one actually answered last.
  const [providerLabel, setProviderLabel] = useState("Cerebras / Groq · Llama 3.3 70B");

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
  }, [messages, loading]);

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

  const onSubmit = (e) => {
    e.preventDefault();
    sendPrompt(draft);
  };

  const retry = () => {
    if (!lastPrompt) return;
    setError(null);
    sendPrompt(lastPrompt, retryConversation);
  };

  const isConversationEmpty =
    messages.length === 0 && !loading && !error && !unavailable;

  return (
    <div className="w-[380px] h-[600px] max-h-[80vh] shrink-0 flex overflow-hidden">
      <div
        className="rounded-2xl border p-4 flex h-full w-full flex-col overflow-hidden shadow-2xl"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--panel) 90%, transparent)", backdropFilter: "blur(20px)" }}
      >
        <div className="flex items-start gap-2 shrink-0">
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center text-[14px] font-bold"
            style={{ background: "var(--grad)", color: "#fff" }}
          >
            <Bot size={14} strokeWidth={2.25} />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[16px] leading-tight">
                  AI Incident Copilot
                </div>
                <div
                  className="text-[12px] mt-0.5"
                  style={{ color: "var(--muted)" }}
                >
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
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-2)",
              }}
            >
              <div
                className="text-[13px] font-semibold leading-tight"
                style={{ color: "var(--text)" }}
              >
                {root.service} / {root.alertname}
              </div>
              <div
                className="mt-1 flex items-center gap-2 text-[12px] flex-wrap"
                style={{ color: "var(--muted)" }}
              >
                <span>{Math.round((risk.score || 0) * 100)}% risk</span>
                <span>·</span>
                <span>{cluster.raw_alert_count} alerts</span>
                <span>·</span>
                <span>{cluster.risk.services_affected} services</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className="text-[13px] font-semibold mb-2 shrink-0"
            style={{ color: "var(--text)" }}
          >
            Conversation
          </div>

          <div
            className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3"
            style={{
              scrollbarWidth: "thin",
              scrollbarColor: "var(--border) transparent",
            }}
          >
            {isConversationEmpty ? (
              <div
                className="rounded-lg border border-dashed p-3 text-[13px]"
                style={{ borderColor: "var(--border)", color: "var(--muted)" }}
              >
                Start with one of the suggested questions or type your own
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

          {isConversationEmpty && (
            <div className="mt-3 shrink-0">
              <div
                className="text-[12px] font-semibold mb-2"
                style={{ color: "var(--muted)" }}
              >
                Suggested Questions
              </div>
              <QuestionChips
                questions={activeQuestions}
                onPick={(prompt) => sendPrompt(prompt)}
                disabled={loading}
              />
            </div>
          )}

          {error && !unavailable && (
            <div
              className="mt-3 rounded-lg border px-3 py-2 text-[12.5px] flex items-start gap-2 shrink-0"
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
              style={{
                borderColor: "var(--border)",
                background: "var(--panel-2)",
                color: "var(--muted)",
              }}
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
                className="w-full resize-none border-0 bg-transparent p-0 text-[13px] outline-none disabled:opacity-60"
                style={{ color: "var(--text)" }}
              />

              <div className="mt-2 flex items-center justify-between gap-2">
                <div
                  className="text-[11.5px]"
                  style={{ color: "var(--muted)" }}
                >
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
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
