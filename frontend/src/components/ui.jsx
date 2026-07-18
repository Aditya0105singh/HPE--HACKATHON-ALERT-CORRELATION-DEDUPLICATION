import { useEffect, useRef, useState } from "react";
import {
  Activity, Bell, ChevronDown, ChevronLeft, ChevronRight,
  Clock, Cpu, Database, FileBadge, FileText, Flame, Globe, HardDrive,
  Info as InfoIcon, Layers, Lock, Package, Plug,
  Puzzle, ShieldCheck, TrendingDown, TrendingUp, User,
} from "lucide-react";
import { SOURCE_LOGO, techLogoFor } from "./techLogos";

const SEV_COLOR = { critical: "var(--critical)", high: "var(--high)", info: "var(--info)" };

export function useClickOutside(onClose) {
  const ref = useRef(null);
  useEffect(() => {
    const h = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [onClose]);
  return ref;
}

// Generic dropdown trigger + panel. `label` renders inside the trigger button.
export function Dropdown({ label, badge, children, width = "w-52", align = "left", chrome = true, title }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));
  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        title={title}
        className={
          chrome
            ? "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[14px] cursor-pointer hover:brightness-125 transition-all"
            : "flex items-center cursor-pointer"
        }
        style={chrome ? { borderColor: "var(--border)", background: "var(--panel)", color: "var(--text)" } : {}}
      >
        {label}
        {badge > 0 && (
          <span className="min-w-4 h-4 px-1 rounded-full text-[12px] font-bold flex items-center justify-center" style={{ background: "var(--accent)", color: "#fff" }}>
            {badge}
          </span>
        )}
        {chrome && <ChevronDown size={13} strokeWidth={2.25} style={{ color: "var(--muted)" }} />}
      </button>
      {open && (
        <div
          className={`absolute top-full mt-1.5 ${width} rounded-xl border shadow-2xl z-50 overflow-hidden ${align === "right" ? "right-0" : "left-0"}`}
          style={{ background: "var(--panel)", borderColor: "var(--border)", animation: "fadein-plain .15s ease" }}
          onClick={(e) => e.stopPropagation()}
        >
          {typeof children === "function" ? children(() => setOpen(false)) : children}
        </div>
      )}
    </div>
  );
}

export function CheckRow({ checked, onChange, label, count, icon }) {
  return (
    <label className="flex items-center gap-2 px-3 py-1.5 cursor-pointer text-[14px] hover:brightness-125" style={{ color: "var(--text)", background: "var(--panel)" }}>
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-violet-500" />
      {icon}
      <span className="flex-1 capitalize">{label}</span>
      {count != null && <span style={{ color: "var(--muted)" }}>{count}</span>}
    </label>
  );
}

export function MenuItem({ onClick, icon, children, danger }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full px-3 py-1.5 text-[14px] cursor-pointer text-left hover:brightness-125"
      style={{ color: danger ? "var(--critical)" : "var(--text)", background: "var(--panel)" }}
    >
      {icon && <span className="w-4 text-center">{icon}</span>}
      {children}
    </button>
  );
}

export function SeverityDot({ severity }) {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full shrink-0"
      style={{ background: SEV_COLOR[severity] || "var(--muted)" }}
      title={severity}
    />
  );
}

export function SeverityBadge({ severity }) {
  const c = SEV_COLOR[severity] || "var(--muted)";
  return (
    <span
      className="px-2 py-0.5 rounded text-xs font-medium capitalize"
      style={{ color: c, background: `color-mix(in srgb, ${c} 14%, transparent)` }}
    >
      {severity}
    </span>
  );
}

const STATUS_STYLE = {
  firing: { color: "var(--critical)" },
  suppressed: { color: "var(--muted)" },
  resolved: { color: "var(--ok)" },
};

export function StatusBadge({ status }) {
  const s = STATUS_STYLE[status] || { color: "var(--muted)" };
  return (
    <span
      className="px-2 py-0.5 rounded-md text-xs font-medium capitalize"
      style={{
        color: s.color,
        background: `color-mix(in srgb, ${s.color} 14%, transparent)`,
        border: `1px solid color-mix(in srgb, ${s.color} 30%, transparent)`,
      }}
    >
      {status}
    </span>
  );
}

export function SourceTag({ source }) {
  const logo = SOURCE_LOGO[source];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs" style={{ color: "var(--muted)" }}>
      {logo ? <logo.Icon size={12} color={logo.color} /> : <Puzzle size={12} strokeWidth={2} />}
      {source}
    </span>
  );
}

const RISK_COLOR = { high: "var(--critical)", medium: "var(--high)", low: "var(--ok)" };

export function Info({ tip }) {
  return (
    <span className="relative group/tip inline-flex items-center ml-1 align-middle">
      <span
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center cursor-help"
        style={{ background: "var(--panel-2)", color: "var(--muted)" }}
      >
        <InfoIcon size={10} strokeWidth={2.5} />
      </span>
      <span
        className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 hidden group-hover/tip:block w-60 p-2.5 rounded-md border text-[13px] leading-relaxed z-50 normal-case tracking-normal font-normal text-left shadow-xl"
        style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}
      >
        {tip}
      </span>
    </span>
  );
}

const RISK_TIP =
  "How likely this incident is to get worse — based on how fast alerts are joining, whether they are getting more severe, and how many services are affected. An explainable score, not a black box.";

export function RiskMeter({ risk, compact = false }) {
  const color = RISK_COLOR[risk.level] || "var(--muted)";
  const pct = Math.round(risk.score * 100);
  return (
    <div className={compact ? "w-28" : "w-full"}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-xs font-semibold uppercase tracking-wide ${risk.level === "high" ? "risk-pulse" : ""}`} style={{ color }}>
          {risk.level} risk
          <Info tip={RISK_TIP} />
        </span>
        <span className="text-xs" style={{ color: "var(--muted)" }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: "var(--panel-2)" }}>
        <div className="h-1.5 rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

export function MetricCard({ label, value, sub, accent, info }) {
  return (
    <div className="rounded-lg border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
      <div className="text-xs uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>
        {label}
        {info && <Info tip={info} />}
      </div>
      <div className="text-2xl font-semibold" style={{ color: accent || "var(--text)" }}>{value}</div>
      {sub && <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}

// Deterministic pseudo-random series from a seed string — stable across
// renders so sparklines don't jitter, but varies per card.
function seedSeries(seed, n = 12) {
  let h = 2166136261;
  for (const ch of String(seed)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const out = [];
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995);
    out.push(30 + ((h >>> 8) % 1000) / 14.3);
  }
  return out;
}

export function Sparkline({ seed, color = "var(--accent)", w = 96, h = 28, up = true }) {
  const pts = seedSeries(seed);
  if (up) pts.sort(() => 0); // keep raw shape; trend conveyed by color
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = max - min || 1;
  const step = w / (pts.length - 1);
  const path = pts.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - 3 - ((v - min) / span) * (h - 6)).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" opacity="0.9" />
    </svg>
  );
}

export function StatCard({ icon, label, value, delta, deltaDir, color = "var(--accent)", sub, spark = true, info }) {
  return (
    <div className="stat-card p-4 min-w-0" style={{ "--sc": color }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2 mb-2">
            <span
              className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: `color-mix(in srgb, ${color} 18%, transparent)`, color }}
            >
              {icon}
            </span>
            <span className="text-[12px] font-semibold uppercase tracking-wide leading-snug pt-0.5" style={{ color: "var(--muted)" }}>
              {label}
              {info && <Info tip={info} />}
            </span>
          </div>
          <div className="text-[26px] font-bold leading-tight" style={{ color: "var(--text)" }}>{value}</div>
          {(delta || sub) && (
            <div className="text-[13px] mt-1 flex items-center gap-1" style={{ color: deltaDir === "down" ? "var(--ok)" : deltaDir === "up" ? "var(--critical)" : "var(--muted)" }}>
              {deltaDir === "up" && <TrendingUp size={12} strokeWidth={2.25} />}
              {deltaDir === "down" && <TrendingDown size={12} strokeWidth={2.25} />}
              {delta || sub}
            </div>
          )}
        </div>
        {spark && (
          <div className="shrink-0 self-end opacity-80 hidden min-[1280px]:block">
            <Sparkline seed={`${label}:${value}`} color={color} />
          </div>
        )}
      </div>
    </div>
  );
}

export function PriorityBadge({ severity, riskLevel }) {
  const p = riskLevel === "high" || severity === "critical" ? "P1" : riskLevel === "medium" || severity === "high" ? "P2" : "P3";
  const c = p === "P1" ? "var(--critical)" : p === "P2" ? "var(--high)" : "var(--info)";
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[13px] font-bold shrink-0"
      style={{ background: `color-mix(in srgb, ${c} 20%, transparent)`, color: c }}
    >
      {p}
    </span>
  );
}

export function ServiceChip({ name }) {
  return (
    <span
      className="px-1.5 py-0.5 rounded text-[13px] font-mono border"
      style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--muted)" }}
    >
      {name}
    </span>
  );
}

const ICON_RULES = [
  ["Queue", Layers], ["Latency", Activity], ["Timeout", Clock], ["Connection", Plug],
  ["ErrorRate", Flame], ["Login", User], ["Token", ShieldCheck], ["Auth", Lock],
  ["Memory", Cpu], ["Disk", HardDrive], ["CPU", Cpu], ["Pod", Package], ["DNS", Globe],
  ["Log", FileText], ["Session", Clock], ["Cert", FileBadge], ["DB", Database],
];

export function AlertIcon({ alertname, severity, service }) {
  const tech = techLogoFor(service);
  const c = SEV_COLOR[severity] || "var(--muted)";
  if (tech) {
    return (
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
        style={{ background: "color-mix(in srgb, #ffffff 6%, var(--panel-2))", borderColor: `color-mix(in srgb, ${tech.color} 35%, var(--border))` }}
        title={service}
      >
        <tech.Icon size={16} color={tech.color} />
      </span>
    );
  }
  const Icon = (ICON_RULES.find(([k]) => alertname?.includes(k)) || [null, Bell])[1];
  return (
    <span
      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
      style={{ background: `color-mix(in srgb, ${c} 12%, var(--panel-2))`, borderColor: `color-mix(in srgb, ${c} 25%, var(--border))`, color: c }}
    >
      <Icon size={16} strokeWidth={2} />
    </span>
  );
}

export function Pager({ page, setPage, total, perPage, setPerPage }) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  const cur = Math.min(page, pages);
  const nums = [];
  for (let i = 1; i <= pages; i++) {
    if (i === 1 || i === pages || Math.abs(i - cur) <= 2) nums.push(i);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const btn = "min-w-7 h-7 px-1.5 rounded-md text-[14px] cursor-pointer flex items-center justify-center";
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t text-[14px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
      <span>
        Showing {total === 0 ? 0 : (cur - 1) * perPage + 1}–{Math.min(cur * perPage, total)} of {total}
      </span>
      <div className="ml-auto flex items-center gap-1">
        <button className={btn} disabled={cur === 1} onClick={() => setPage(cur - 1)} style={{ color: cur === 1 ? "var(--border)" : "var(--muted)" }}><ChevronLeft size={15} /></button>
        {nums.map((n, i) =>
          n === "…" ? (
            <span key={`e${i}`} className="px-1">…</span>
          ) : (
            <button
              key={n}
              className={btn}
              onClick={() => setPage(n)}
              style={n === cur ? { background: "var(--accent)", color: "#fff", fontWeight: 600 } : { color: "var(--muted)" }}
            >
              {n}
            </button>
          )
        )}
        <button className={btn} disabled={cur === pages} onClick={() => setPage(cur + 1)} style={{ color: cur === pages ? "var(--border)" : "var(--muted)" }}><ChevronRight size={15} /></button>
      </div>
      {setPerPage && (
        <label className="flex items-center gap-1.5">
          Rows per page
          <select
            value={perPage}
            onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
            className="rounded-md border px-1.5 py-0.5 cursor-pointer outline-none"
            style={{ borderColor: "var(--border)", background: "var(--panel-2)", color: "var(--text)" }}
          >
            {[10, 20, 50].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

export function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.round(min / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
