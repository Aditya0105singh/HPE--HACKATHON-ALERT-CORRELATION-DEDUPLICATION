import { useEffect, useRef, useState } from "react";
import { CircleCheckBig as CheckIcon, Database, FlaskConical, Sparkles } from "lucide-react";

export const DATA_SOURCES = [
  { key: "loghub", label: "Loghub HDFS_v1", sub: "Real dataset — PS10 source", icon: Sparkles },
  { key: "aiops", label: "AIOps Challenge 2020", sub: "Real dataset — PS10 source", icon: FlaskConical },
  { key: "synthetic", label: "Synthetic Demo", sub: "Scripted incident scenarios (optional)", icon: Database },
];

export function DataSourceMenu({ current, onSelect, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const active = DATA_SOURCES.find((d) => d.key === current) || DATA_SOURCES[2];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        className="flex items-center gap-2 pl-2.5 pr-3 py-1.5 rounded-lg text-[13.5px] font-medium cursor-pointer border disabled:opacity-50 transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
        title="Switch data source"
      >
        <span className="w-1.5 h-1.5 rounded-full live-dot shrink-0" style={{ background: "var(--ok)" }} />
        <span className="hidden min-[1150px]:inline" style={{ color: "var(--muted)" }}>Dataset:</span>
        <span className="font-semibold whitespace-nowrap">{active.label}</span>
        <ChevronCaret />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 w-64 rounded-lg border overflow-hidden z-50 shadow-xl"
          style={{ background: "var(--panel)", borderColor: "var(--border)" }}
        >
          <div className="px-3 py-2 text-[13px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Switch data source
          </div>
          {DATA_SOURCES.map((d) => (
            <button
              key={d.key}
              onClick={() => { setOpen(false); onSelect(d.key); }}
              className="flex items-center gap-2.5 w-full px-3 py-2.5 text-left cursor-pointer hover:brightness-150"
              style={{ background: "transparent" }}
            >
              <d.icon size={15} strokeWidth={2} style={{ color: "var(--accent)" }} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-medium" style={{ color: "var(--text)" }}>{d.label}</div>
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>{d.sub}</div>
              </div>
              {current === d.key && <CheckIcon size={15} strokeWidth={2} style={{ color: "var(--ok)" }} className="shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ChevronCaret() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}
