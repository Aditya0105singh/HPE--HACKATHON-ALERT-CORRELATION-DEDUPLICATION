"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Button, Card, Text, Textarea, Title } from "@tremor/react";
import { HiOutlineSparkles, HiOutlineXMark } from "react-icons/hi2";
import { LuRefreshCw, LuSend } from "react-icons/lu";
import { MarkdownHTML } from "@/shared/ui/MarkdownHTML/MarkdownHTML";
import { useAssistant } from "@/entities/alertlens";
import type { AssistantMessage } from "@/entities/alertlens";

type Suggestion = { label: string; prompt: string };

// Suggested questions per page, carried over from the original AlertLens
// assistant so the prompts stay tuned to what's on screen.
const PAGE_QUESTIONS: Record<string, Suggestion[]> = {
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

const INCIDENT_QUESTIONS: Suggestion[] = [
  { label: "Root Cause", prompt: "What is the likely root cause of this incident?" },
  { label: "Blast Radius", prompt: "How far could this incident spread?" },
  { label: "Past Fix", prompt: "How was a similar incident resolved before?" },
  { label: "Next Step", prompt: "What should I do first to mitigate this?" },
];

/** Maps the current route to a suggestion set and an optional incident id. */
function usePageContext(pathname: string | null) {
  return useMemo(() => {
    const p = pathname ?? "/";
    const incidentMatch = p.match(
      /^\/(?:incidents|forecast|timemachine)\/([^/]+)/
    );
    if (incidentMatch) {
      return {
        key: "incident",
        incidentId: incidentMatch[1],
        suggestions: INCIDENT_QUESTIONS,
      };
    }
    const seg = p.split("/")[1] || "home";
    const key =
      seg === "" || seg === "home"
        ? "home"
        : seg === "firing" || seg === "5xx"
          ? "feed"
          : seg;
    return {
      key,
      incidentId: null as string | null,
      suggestions: PAGE_QUESTIONS[key] ?? PAGE_QUESTIONS.home,
    };
  }, [pathname]);
}

export function AssistantChat() {
  const pathname = usePathname();
  const { key, incidentId, suggestions } = usePageContext(pathname);
  const { askWorkspaceAssistant, isAsking } = useAssistant();

  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [errorText, setErrorText] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isAsking]);

  const send = async (question: string) => {
    const q = question.trim();
    if (!q || isAsking) return;

    setErrorText(null);
    const conversation = messages;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");

    try {
      const res = await askWorkspaceAssistant({
        question: q,
        conversation,
        ...(incidentId ? { incident_id: incidentId } : {}),
      });
      const answer =
        (typeof res?.answer === "string" && res.answer) ||
        "No answer returned.";
      setMessages((m) => [...m, { role: "assistant", content: answer }]);
    } catch (e) {
      setErrorText(e instanceof Error ? e.message : String(e));
    }
  };

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open AlertLens assistant"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-orange-500 px-4 py-3 text-white shadow-lg hover:bg-orange-600 transition-colors"
      >
        <HiOutlineSparkles className="w-5 h-5" />
        <span className="text-sm font-medium">Ask AlertLens</span>
      </button>
    );
  }

  return (
    <Card className="fixed bottom-5 right-5 z-40 w-[min(28rem,calc(100vw-2.5rem))] max-h-[min(38rem,calc(100vh-6rem))] p-0 flex flex-col shadow-2xl">
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center gap-2 min-w-0">
          <HiOutlineSparkles className="w-5 h-5 text-orange-500 shrink-0" />
          <div className="min-w-0">
            <Title className="text-sm truncate">AlertLens Assistant</Title>
            <Text className="text-xs text-gray-500 truncate">
              {incidentId ? `Incident ${incidentId}` : `Workspace · ${key}`}
            </Text>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              aria-label="Clear conversation"
              onClick={() => {
                setMessages([]);
                setErrorText(null);
              }}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
            >
              <LuRefreshCw className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            aria-label="Close assistant"
            onClick={() => setIsOpen(false)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
          >
            <HiOutlineXMark className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-32">
        {messages.length === 0 && (
          <Text className="text-sm text-gray-500">
            Ask about the current alerts, incidents or how the pipeline works.
          </Text>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={
              m.role === "user"
                ? "self-end max-w-[85%] rounded-lg bg-orange-500 text-white px-3 py-2 text-sm"
                : "self-start max-w-[95%] rounded-lg bg-gray-100 px-3 py-2 text-sm"
            }
          >
            {m.role === "user" ? (
              m.content
            ) : (
              <MarkdownHTML>{m.content}</MarkdownHTML>
            )}
          </div>
        ))}

        {isAsking && (
          <div className="self-start rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-500">
            Thinking…
          </div>
        )}

        {errorText && (
          <div className="self-start max-w-[95%] rounded-lg bg-red-50 text-red-600 px-3 py-2 text-sm">
            {errorText}
          </div>
        )}

        <div ref={endRef} />
      </div>

      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {suggestions.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => send(s.prompt)}
              className="text-xs rounded-full border border-gray-200 px-2.5 py-1 hover:border-orange-400 hover:text-orange-600"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 py-3 border-t border-gray-200 flex items-end gap-2">
        <Textarea
          rows={1}
          className="flex-1 resize-none"
          placeholder="Ask a question..."
          value={input}
          onValueChange={setInput}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <Button
          size="xs"
          color="orange"
          icon={LuSend}
          loading={isAsking}
          disabled={!input.trim()}
          onClick={() => send(input)}
        >
          Send
        </Button>
      </div>
    </Card>
  );
}
