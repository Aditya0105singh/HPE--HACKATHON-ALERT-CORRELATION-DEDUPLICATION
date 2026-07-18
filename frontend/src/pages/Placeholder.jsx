import { Construction } from "lucide-react";

export default function Placeholder({ title, note }) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="text-center max-w-sm">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-3"
          style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--accent)" }}
        >
          <Construction size={22} strokeWidth={2} />
        </div>
        <div className="font-semibold mb-1">{title}</div>
        <div className="text-[15px]" style={{ color: "var(--muted)" }}>
          {note || "Planned for a future iteration — out of scope for the current build."}
        </div>
      </div>
    </div>
  );
}
