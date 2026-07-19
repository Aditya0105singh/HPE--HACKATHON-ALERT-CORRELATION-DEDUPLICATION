import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

function MarkdownCode({ inline, className, children, ...props }) {
  const text = String(children).replace(/\n$/, "");
  if (inline) {
    return (
      <code
        className="px-1.5 py-0.5 rounded text-[12px]"
        style={{ background: "var(--bg)", color: "var(--accent)" }}
        {...props}
      >
        {text}
      </code>
    );
  }

  return (
    <pre
      className="mt-2 overflow-x-auto rounded-lg border p-3 text-[12.5px] leading-relaxed shadow-inner"
      style={{ background: "color-mix(in srgb, var(--bg) 50%, transparent)", borderColor: "var(--border)" }}
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
    <motion.div 
      initial={{ opacity: 0, y: 15, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className="max-w-[92%] border px-4 py-3 text-[13.5px] leading-relaxed shadow-md"
        style={{
          background: isUser ? "var(--accent)" : "color-mix(in srgb, var(--panel-2) 60%, transparent)",
          borderColor: isUser
            ? "color-mix(in srgb, var(--accent) 60%, transparent)"
            : "color-mix(in srgb, var(--border) 60%, transparent)",
          color: isUser ? "#fff" : "var(--text)",
          backdropFilter: "blur(12px)",
          borderRadius: isUser ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
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
                  className="my-2 border-l-2 pl-3 italic"
                  style={{
                    borderColor: "var(--accent)",
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
                  className="hover:underline transition-all"
                  style={{ color: "var(--purple)", fontWeight: 500 }}
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
    </motion.div>
  );
}
