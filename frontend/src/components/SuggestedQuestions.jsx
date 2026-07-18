export default function SuggestedQuestions({
  questions,
  onPick,
  disabled = false,
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {questions.map((q) => (
        <div
          key={q.label}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled}
          onClick={() => !disabled && onPick(q.prompt)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onPick(q.prompt);
            }
          }}
          className="rounded-lg border px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors"
          style={{
            background: "var(--panel)",
            borderColor: "var(--border)",
            color: "var(--text)",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
          }}
        >
          <div className="leading-snug">{q.label}</div>
        </div>
      ))}
    </div>
  );
}
