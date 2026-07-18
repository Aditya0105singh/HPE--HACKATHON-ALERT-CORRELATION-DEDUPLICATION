import { useEffect, useRef, useState } from "react";
import {
  Brain, Database, FastForward, HardDrive, Lock, Pause, Play, Shuffle,
  SkipForward, Wifi, X, Zap,
} from "lucide-react";

export const SCENARIOS = [
  { key: "db_connection_exhaustion", icon: Database, label: "Database failure" },
  { key: "auth_cascade_failure", icon: Lock, label: "Auth outage" },
  { key: "disk_full_logging", icon: HardDrive, label: "Disk full" },
  { key: "network_packet_loss", icon: Wifi, label: "Network degradation" },
  { key: "redis_memory_pressure", icon: Brain, label: "Cache memory pressure" },
];

export function StormMenu({ onStorm, onInstant, busy }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const pick = (fn, arg) => {
    setOpen(false);
    fn(arg);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[15px] font-semibold cursor-pointer disabled:opacity-50 grad-btn hero-glow"
      >
        <Zap size={15} strokeWidth={2.25} fill="currentColor" />
        {busy ? "Storm incoming…" : "Inject failure"}
        <ChevronCaret />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1.5 w-60 rounded-lg border overflow-hidden z-50 shadow-xl"
          style={{ background: "var(--panel)", borderColor: "var(--border)" }}
        >
          <div className="px-3 py-2 text-[13px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            Pick a failure to inject live
          </div>
          {SCENARIOS.map((s) => (
            <button
              key={s.key}
              onClick={() => pick(onStorm, s.key)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-[15px] cursor-pointer text-left hover:brightness-150"
              style={{ color: "var(--text)", background: "transparent" }}
            >
              <s.icon size={15} strokeWidth={2} style={{ color: "var(--muted)" }} /> {s.label}
            </button>
          ))}
          <button
            onClick={() => pick(onStorm, null)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[15px] cursor-pointer text-left hover:brightness-150"
            style={{ color: "var(--text)" }}
          >
            <Shuffle size={15} strokeWidth={2} style={{ color: "var(--muted)" }} /> Surprise me
          </button>
          <div className="border-t" style={{ borderColor: "var(--border)" }} />
          <button
            onClick={() => pick(onInstant)}
            className="flex items-center gap-2.5 w-full px-3 py-2 text-[14px] cursor-pointer text-left hover:brightness-150"
            style={{ color: "var(--muted)" }}
          >
            <FastForward size={14} strokeWidth={2} /> Instant load (no replay)
          </button>
        </div>
      )}
    </div>
  );
}

function ChevronCaret() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function StormToasts({ toasts, onDismiss, onView }) {
  return (
    <div className="fixed top-14 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="rounded-lg border p-3 shadow-xl animate-[fadein-plain_.3s_ease]"
          style={{ background: "var(--panel)", borderColor: t.color || "var(--border)" }}
        >
          <div className="flex items-start gap-2.5">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${t.color || "var(--accent)"} 18%, transparent)`, color: t.color || "var(--accent)" }}
            >
              {t.icon && <t.icon size={15} strokeWidth={2.25} />}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[15px] font-semibold" style={{ color: t.color || "var(--text)" }}>{t.title}</div>
              {t.body && <div className="text-[14px] mt-0.5" style={{ color: "var(--muted)" }}>{t.body}</div>}
              {t.sticky && (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => onView(t)}
                    className="px-2.5 py-1 rounded text-[14px] font-semibold cursor-pointer"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    View chaos → order
                  </button>
                  <button
                    onClick={() => onDismiss(t.id)}
                    className="px-2.5 py-1 rounded text-[14px] cursor-pointer border"
                    style={{ borderColor: "var(--border)", color: "var(--muted)" }}
                  >
                    Dismiss
                  </button>
                </div>
              )}
            </div>
            {!t.sticky && (
              <button onClick={() => onDismiss(t.id)} className="cursor-pointer" style={{ color: "var(--muted)" }}>
                <X size={14} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StormControls({ progress, speed, paused, onPause, onSpeed, onSkip }) {
  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-2.5 rounded-full border shadow-xl"
      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
    >
      <span className="flex items-center gap-1.5 text-[14px] font-semibold risk-pulse" style={{ color: "var(--accent)" }}>
        <Zap size={14} strokeWidth={2.25} fill="currentColor" /> LIVE STORM
      </span>
      <div className="w-40 h-1.5 rounded-full" style={{ background: "var(--panel-2)" }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${Math.min(progress * 100, 100)}%`, background: "var(--accent)" }} />
      </div>
      <button onClick={onPause} className="flex items-center justify-center cursor-pointer w-6" style={{ color: "var(--text)" }} title={paused ? "Resume" : "Pause"}>
        {paused ? <Play size={15} strokeWidth={2} fill="currentColor" /> : <Pause size={15} strokeWidth={2} fill="currentColor" />}
      </button>
      <button onClick={onSpeed} className="text-[14px] font-mono cursor-pointer w-8" style={{ color: "var(--text)" }} title="Playback speed">
        {speed}×
      </button>
      <button onClick={onSkip} className="flex items-center gap-1 cursor-pointer text-[14px]" style={{ color: "var(--muted)" }} title="Skip to end">
        <SkipForward size={14} strokeWidth={2} /> skip
      </button>
    </div>
  );
}
