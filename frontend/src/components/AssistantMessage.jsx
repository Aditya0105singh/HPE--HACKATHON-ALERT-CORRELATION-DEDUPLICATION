import ReactMarkdown from "react-markdown";

function MarkdownCode({ inline, className, children, ...props }) {
  const text = String(children).replace(/\n$/, "");
  if (inline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded text-[12px]"
        style={{ background: "var(--panel-2)", color: "var(--accent)" }}
        {...props}
      >
        {text}
      </code>
    );
  }

  return (
    <pre
      className="mt-2 overflow-x-auto rounded-lg border p-3 text-[12.5px] leading-relaxed"
      style={{ background: "var(--bg)", borderColor: "var(--border)" }}
      {...props}
    >
      <code className={className} style={{ color: "var(--text)" }}>
        {text}
      </code>
    </pre>
  );
}

export default function AssistantMessage({ role, content }) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className="max-w-[92%] rounded-xl border px-3 py-2.5 text-[13.5px] leading-relaxed shadow-sm"
        style={{
          background: isUser ? "var(--accent)" : "var(--panel)",
          borderColor: isUser
            ? "color-mix(in srgb, var(--accent) 60%, transparent)"
            : "var(--border)",
          color: isUser ? "#fff" : "var(--text)",
        }}
      >
        {isUser ? (
          <div className="whitespace-pre-wrap">{content}</div>
        ) : (
          <ReactMarkdown
            components={{
              p: ({ children }) => <p style={{ margin: 0 }}>{children}</p>,
              ul: ({ children }) => (
                <ul className="my-2 list-disc pl-4 space-y-1">{children}</ul>
              ),
              ol: ({ children }) => (
                <ol className="my-2 list-decimal pl-4 space-y-1">{children}</ol>
              ),
              li: ({ children }) => <li className="pl-1">{children}</li>,
              blockquote: ({ children }) => (
                <blockquote
                  className="my-2 border-l-2 pl-3"
                  style={{
                    borderColor: "var(--border)",
                    color: "var(--muted)",
                  }}
                >
                  {children}
                </blockquote>
              ),
              code: MarkdownCode,
              a: ({ children, href }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "var(--purple)" }}
                >
                  {children}
                </a>
              ),
            }}
          >
            {content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
