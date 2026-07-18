import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bell, ChevronRight, ChevronsLeft, ChevronsRight,
  CircleQuestionMark, Clock, Moon, Search, Sun,
} from "lucide-react";
import { StormMenu } from "./storm";
import { Dropdown, MenuItem, timeAgo, useClickOutside } from "./ui";

export const PAGES = [
  { to: "/", label: "Home", section: "Overview" },
  { to: "/incidents", label: "Active Incidents", section: "Overview" },
  { to: "/feed", label: "Alerts Feed", section: "Overview" },
  { to: "/5xx", label: "5xx Alerts", section: "Overview" },
  { to: "/firing", label: "Firing Alerts", section: "Overview" },
  { to: "/deduplication", label: "Deduplication", section: "Noise Reduction" },
  { to: "/correlations", label: "Correlations", section: "Noise Reduction" },
  { to: "/pipeline", label: "Pipeline", section: "Platform" },
  { to: "/evaluation", label: "Evaluation", section: "Platform" },
  { to: "/workflows", label: "Workflows", section: "Platform" },
  { to: "/topology", label: "Service Topology", section: "Platform" },
  { to: "/providers", label: "Providers", section: "Platform" },
];

const RECENT_KEY = "alertlens.recentSearches";
function readRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function pushRecent(term) {
  const next = [term, ...readRecent().filter((t) => t !== term)].slice(0, 5);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

function Breadcrumb() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const page =
    PAGES.find((p) => p.to === pathname) ||
    (pathname.startsWith("/incidents/") ? { label: "Incident Detail", section: "Overview" } : null) ||
    PAGES[0];

  return (
    <div className="flex items-center gap-1.5 min-w-0 shrink-0">
      <button
        onClick={() => navigate(-1)}
        className="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_7%,transparent)] shrink-0"
        style={{ color: "var(--muted)" }}
        title="Back"
      >
        <ArrowLeft size={16} strokeWidth={2} />
      </button>
      <div className="hidden md:flex items-center gap-1.5 text-[13px] min-w-0" style={{ color: "var(--muted)" }}>
        <span className="font-semibold" style={{ color: "var(--text)" }}>AlertLens</span>
        <ChevronRight size={13} strokeWidth={2} />
        <span>{page.section}</span>
        <ChevronRight size={13} strokeWidth={2} />
        <span className="font-medium truncate" style={{ color: "var(--text)" }}>{page.label}</span>
      </div>
    </div>
  );
}

function GlobalSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [recent, setRecent] = useState(readRecent);
  const navigate = useNavigate();
  const ref = useClickOutside(() => setOpen(false));

  const pages = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? PAGES.filter((p) => p.label.toLowerCase().includes(t)) : PAGES.slice(0, 6);
  }, [q]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ref.current?.querySelector("input")?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [ref]);

  const searchAlerts = (term) => {
    const t = (term ?? q).trim();
    if (!t) return;
    setRecent(pushRecent(t));
    navigate(`/feed?q=${encodeURIComponent(t)}`);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="search-shell-wrap relative flex-1 min-w-[220px] max-w-[560px]" ref={ref}>
      <div
        className="search-shell flex items-center gap-2.5 px-3.5 py-2.5 rounded-[14px] border"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 55%, transparent)" }}
      >
        <Search size={16} strokeWidth={2} style={{ color: "var(--muted)" }} className="shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") searchAlerts();
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search alerts, services, incidents…"
          className="flex-1 bg-transparent outline-none min-w-0 text-[13.5px]"
          style={{ color: "var(--text)" }}
        />
        <span
          className="text-[11px] px-1.5 py-0.5 rounded-md border font-mono shrink-0"
          style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--panel-2)" }}
        >
          ⌘K
        </span>
      </div>
      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-2 rounded-xl border overflow-hidden z-50"
          style={{ background: "var(--panel)", borderColor: "var(--border)", boxShadow: "var(--shadow-pop)" }}
        >
          {q.trim() && (
            <button
              onClick={() => searchAlerts()}
              className="flex items-center gap-2 w-full px-3.5 py-2.5 text-[13.5px] cursor-pointer text-left transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)] border-b"
              style={{ color: "var(--text)", borderColor: "var(--border)" }}
            >
              <Search size={13} strokeWidth={2} /> Filter alerts for “<span className="font-semibold">{q.trim()}</span>”
            </button>
          )}

          {!q.trim() && recent.length > 0 && (
            <>
              <div className="px-3.5 pt-2.5 pb-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Recent</div>
              {recent.map((term) => (
                <button
                  key={term}
                  onClick={() => searchAlerts(term)}
                  className="flex items-center gap-2 w-full text-left px-3.5 py-1.5 text-[13.5px] cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                  style={{ color: "var(--text)" }}
                >
                  <Clock size={12} strokeWidth={2} style={{ color: "var(--muted)" }} />
                  {term}
                </button>
              ))}
            </>
          )}

          <div className="px-3.5 pt-2.5 pb-1 text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Pages</div>
          {pages.length === 0 ? (
            <div className="px-3.5 pb-2.5 text-[13.5px]" style={{ color: "var(--muted)" }}>No matching pages</div>
          ) : (
            pages.map((p) => (
              <button
                key={p.to}
                onClick={() => { navigate(p.to); setQ(""); setOpen(false); }}
                className="block w-full text-left px-3.5 py-1.5 text-[13.5px] cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                style={{ color: "var(--text)" }}
              >
                {p.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function AutoRefreshBadge() {
  return (
    <span
      className="hidden min-[1050px]:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-medium shrink-0"
      style={{ background: "color-mix(in srgb, var(--ok) 14%, transparent)", color: "var(--ok)" }}
    >
      <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: "var(--ok)" }} />
      Auto-refresh · Live
    </span>
  );
}

function LastUpdated({ ts }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(iv);
  }, []);
  if (!ts) return null;
  const sec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  const label = sec < 60 ? `${sec}s ago` : timeAgo(new Date(ts).toISOString());
  return (
    <span className="hidden min-[1250px]:inline text-[12px] whitespace-nowrap shrink-0" style={{ color: "var(--muted)" }}>
      Updated {label}
    </span>
  );
}

export default function TopBar({
  collapsed, onToggleSidebar, error, lastUpdated, dark, onTheme,
  notifications, unread, onBellSeen, onStorm, onInstant, busy, stormRate,
}) {
  const iconBtn = "w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer hover:bg-[color-mix(in_srgb,var(--text)_7%,transparent)] transition-colors relative shrink-0";

  return (
    <header
      className="header-surface flex items-center gap-3 px-4 shrink-0 z-30"
      style={{ height: "66px" }}
    >
      <button
        onClick={onToggleSidebar}
        className={iconBtn}
        style={{ color: "var(--muted)" }}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? <ChevronsRight size={16} strokeWidth={2} /> : <ChevronsLeft size={16} strokeWidth={2} />}
      </button>

      <Breadcrumb />

      <GlobalSearch />

      {error && (
        <span className="hidden min-[900px]:inline text-[12px] truncate shrink-0" style={{ color: "var(--critical)" }}>
          backend unreachable: {error}
        </span>
      )}
      {stormRate > 0 && (
        <span className="flex items-center gap-1.5 text-[12px] whitespace-nowrap shrink-0" style={{ color: "var(--ok)" }}>
          <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: "var(--ok)" }} />
          LIVE · {stormRate} events/sec
        </span>
      )}

      <div className="ml-auto flex items-center gap-2 shrink-0">
        <AutoRefreshBadge />
        <LastUpdated ts={lastUpdated} />

        <Dropdown
          chrome={false}
          align="right"
          width="w-80"
          title="Notifications"
          label={
            <span className={iconBtn} style={{ color: "var(--muted)" }} onClick={onBellSeen}>
              <Bell size={16} strokeWidth={2} />
              {unread > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 rounded-full text-[11px] font-bold flex items-center justify-center"
                  style={{ background: "var(--critical)", color: "#fff" }}
                >
                  {unread}
                </span>
              )}
            </span>
          }
        >
          <div className="px-3 py-2 text-[14px] font-semibold border-b" style={{ borderColor: "var(--border)" }}>Notifications</div>
          <div className="max-h-80 overflow-auto">
            {notifications.length === 0 ? (
              <div className="px-3 py-6 text-center text-[14px]" style={{ color: "var(--muted)" }}>
                No notifications yet — inject a failure to watch the pipeline react.
              </div>
            ) : (
              notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 px-3 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: `color-mix(in srgb, ${n.color || "var(--accent)"} 18%, transparent)`, color: n.color || "var(--accent)" }}
                  >
                    {n.icon && <n.icon size={14} strokeWidth={2.25} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-medium truncate" style={{ color: n.color || "var(--text)" }}>{n.title}</div>
                    {n.body && <div className="text-[12.5px] mt-0.5" style={{ color: "var(--muted)" }}>{n.body}</div>}
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--muted)" }}>{timeAgo(n.time)}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </Dropdown>

        <Dropdown
          chrome={false}
          align="right"
          width="w-72"
          title="Help"
          label={<span className={iconBtn} style={{ color: "var(--muted)" }}><CircleQuestionMark size={16} strokeWidth={2} /></span>}
        >
          <div className="px-3 py-2 text-[14px] font-semibold border-b" style={{ borderColor: "var(--border)" }}>Help &amp; shortcuts</div>
          <div className="px-3 py-2 text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
            <div className="mb-1.5"><b style={{ color: "var(--text)" }}>⌘K / Ctrl+K</b> — global search</div>
            <div className="mb-1.5"><b style={{ color: "var(--text)" }}>Esc</b> — close drawers &amp; menus</div>
            <div className="mb-1.5"><b style={{ color: "var(--text)" }}>CEL bar</b> — <code>severity == "critical" &amp;&amp; source.contains("gcp")</code></div>
            <div className="mb-1.5"><b style={{ color: "var(--text)" }}>Inject failure</b> — replay a live alert storm through the real pipeline</div>
            <div>Pipeline: dedup → embed → cluster → risk → Alert DNA. See the <b style={{ color: "var(--text)" }}>Pipeline</b> and <b style={{ color: "var(--text)" }}>Evaluation</b> pages for how each stage is measured.</div>
          </div>
        </Dropdown>

        <button onClick={onTheme} className={iconBtn} style={{ color: "var(--muted)" }} title={dark ? "Switch to light theme" : "Switch to dark theme"}>
          {dark ? <Moon size={16} strokeWidth={2} /> : <Sun size={16} strokeWidth={2} />}
        </button>

        <StormMenu onStorm={onStorm} onInstant={onInstant} busy={busy} />

        <Dropdown
          chrome={false}
          align="right"
          width="w-60"
          label={
            <div className="flex items-center gap-2 pl-2 ml-1 border-l cursor-pointer" style={{ borderColor: "var(--border)" }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: "var(--grad)", color: "#fff" }}>
                A
              </div>
              <div className="leading-tight hidden lg:block text-left">
                <div className="text-[13.5px] font-semibold">Aditya</div>
                <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>SRE Team</div>
              </div>
            </div>
          }
        >
          <div className="p-3.5 border-b" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-center gap-2.5 mb-2">
              <div className="w-9 h-9 rounded-full flex items-center justify-center text-[15px] font-bold shrink-0" style={{ background: "var(--grad)", color: "#fff" }}>A</div>
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold truncate">Aditya</div>
                <div className="text-[11.5px] truncate" style={{ color: "var(--muted)" }}>SRE Team</div>
              </div>
            </div>
            <div className="text-[11px]" style={{ color: "var(--muted)" }}>Team Synergy 2026 · HPE Problem Statement #10</div>
          </div>
          <div className="py-1">
            <MenuItem icon={dark ? <Moon size={14} /> : <Sun size={14} />} onClick={onTheme}>
              {dark ? "Dark theme" : "Light theme"} — toggle
            </MenuItem>
          </div>
        </Dropdown>
      </div>
    </header>
  );
}
