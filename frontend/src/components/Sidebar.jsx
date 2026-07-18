import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight, BellRing, Bookmark, ChartColumn, ChevronRight, Database,
  Flame, House, Layers, List, Network, OctagonAlert, Radar, Search, Star,
  Waypoints, Workflow, X, Zap,
} from "lucide-react";
import { matchesCel } from "../lib/cel";
import { Sparkline } from "./ui";

const NAV_ICON = {
  "/": House,
  "/incidents": Flame,
  "/feed": List,
  "/5xx": OctagonAlert,
  "/firing": BellRing,
  "/deduplication": Layers,
  "/correlations": Radar,
  "/pipeline": Waypoints,
  "/evaluation": ChartColumn,
  "/workflows": Workflow,
  "/topology": Network,
  "/providers": ArrowLeftRight,
};

const NAV_ITEMS = [
  { to: "/", label: "Home" },
  { to: "/incidents", label: "Active Incidents" },
  { to: "/feed", label: "Alerts Feed" },
  { to: "/5xx", label: "5xx Alerts" },
  { to: "/firing", label: "Firing Alerts" },
  { to: "/deduplication", label: "Deduplication" },
  { to: "/correlations", label: "Correlations" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/evaluation", label: "Evaluation" },
  { to: "/workflows", label: "Workflows" },
  { to: "/topology", label: "Service Topology" },
  { to: "/providers", label: "Providers" },
];

// Built-in saved-filter presets — counts are computed live against the batch.
const PRESET_FILTERS = [
  { name: "P1 Only", icon: Star, query: 'severity == "critical"' },
  { name: "Database", icon: Database, query: 'service.contains("postgres") || service.contains("redis") || service.contains("db")' },
  { name: "Firing Only", icon: Flame, query: 'status == "firing"' },
];

const TONE_COLOR = {
  critical: "var(--critical)",
  warning: "var(--high)",
  info: "var(--muted)",
  ai: "var(--purple)",
  ok: "var(--ok)",
};

export function readSavedViews() {
  try {
    return JSON.parse(localStorage.getItem("alertlens.savedViews") || "[]");
  } catch {
    return [];
  }
}

function Badge({ tone = "info", children }) {
  const c = TONE_COLOR[tone] || TONE_COLOR.info;
  return (
    <span
      className="px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums shrink-0"
      style={{ color: c, background: `color-mix(in srgb, ${c} 16%, transparent)` }}
    >
      {children}
    </span>
  );
}

function Section({ title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-5 mb-1 first:mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full px-5 mb-2 text-[11px] font-medium uppercase tracking-[0.09em] cursor-pointer transition-colors"
        style={{ color: "var(--muted)" }}
      >
        <ChevronRight
          size={11}
          strokeWidth={2.5}
          className="transition-transform duration-200 shrink-0"
          style={{ transform: open ? "rotate(90deg)" : "none" }}
        />
        {title}
      </button>
      <div className={`collapse-rows ${open ? "is-open" : ""}`}>
        <div>{children}</div>
      </div>
    </div>
  );
}

function Item({ to, label, count, tone, collapsed }) {
  const Icon = NAV_ICON[to] || List;
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `nav-link group flex items-center gap-3 py-2 rounded-xl mb-0.5 ${
          isActive ? "nav-link--active" : ""
        } ${collapsed ? "justify-center px-0 mx-2" : "px-3 mx-2"}`
      }
      style={{ color: "var(--text)" }}
    >
      {({ isActive }) => (
        <>
          <span
            className="nav-link__accent"
            style={{ height: "60%" }}
          />
          <span
            className="nav-link__icon flex items-center justify-center w-4 shrink-0"
            style={{ color: isActive ? "var(--accent)" : "var(--muted)" }}
          >
            <Icon size={16} strokeWidth={isActive ? 2.4 : 2} />
          </span>
          {!collapsed && (
            <span
              className="flex-1 truncate text-[14px]"
              style={{ color: isActive ? "var(--text)" : "var(--muted)", fontWeight: isActive ? 600 : 400 }}
            >
              {label}
            </span>
          )}
          {!collapsed && count != null && <Badge tone={tone}>{count}</Badge>}
        </>
      )}
    </NavLink>
  );
}

function CommandSearch() {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return NAV_ITEMS;
    return NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(term));
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (!e.target.closest?.("[data-sidebar-search]")) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const select = (item) => {
    navigate(item.to);
    setQ("");
    setOpen(false);
  };

  return (
    <div className="px-4 pb-3 relative" data-sidebar-search>
      <div
        className="search-shell flex items-center gap-2.5 px-3 py-2.5 rounded-xl border"
        style={{ borderColor: "var(--border)", background: "color-mix(in srgb, var(--bg) 55%, transparent)" }}
      >
        <Search size={15} strokeWidth={2} style={{ color: "var(--muted)" }} className="shrink-0" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && matches.length > 0) select(matches[0]);
            else if (e.key === "Escape") setOpen(false);
          }}
          placeholder="Search or jump to…"
          className="flex-1 bg-transparent outline-none min-w-0 text-[13.5px] placeholder:text-[color-mix(in_srgb,var(--text)_45%,var(--muted))]"
          style={{ color: "var(--text)" }}
        />
        <span
          className="text-[10px] px-1.5 py-0.5 rounded-md border font-mono shrink-0"
          style={{ borderColor: "var(--border)", color: "var(--muted)", background: "var(--panel-2)" }}
        >
          ⌘K
        </span>
      </div>
      {open && (
        <div
          className="absolute left-4 right-4 top-full mt-1.5 rounded-xl border overflow-hidden max-h-64 overflow-y-auto z-20"
          style={{ borderColor: "var(--border)", background: "var(--panel)", boxShadow: "var(--shadow-pop)" }}
        >
          {matches.length === 0 ? (
            <div className="px-3 py-2.5 text-[13px]" style={{ color: "var(--muted)" }}>No pages match</div>
          ) : (
            matches.map((n) => (
              <button
                key={n.to}
                onClick={() => select(n)}
                className="block w-full text-left px-3 py-2 text-[13.5px] cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                style={{ color: "var(--text)" }}
              >
                {n.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function SavedFilters({ rawAlerts }) {
  const [userViews, setUserViews] = useState(readSavedViews);
  const navigate = useNavigate();

  useEffect(() => {
    const reload = () => setUserViews(readSavedViews());
    window.addEventListener("alertlens-views", reload);
    return () => window.removeEventListener("alertlens-views", reload);
  }, []);

  const removeView = (name) => {
    const next = readSavedViews().filter((v) => v.name !== name);
    localStorage.setItem("alertlens.savedViews", JSON.stringify(next));
    window.dispatchEvent(new Event("alertlens-views"));
  };

  const entries = [
    ...PRESET_FILTERS,
    ...userViews.map((v) => ({ ...v, icon: Bookmark, user: true })),
  ];

  return (
    <Section title="Saved Filters">
      {entries.map((f) => (
        <div
          key={f.name}
          className="group flex items-center gap-2.5 mx-2 px-3 py-1.5 rounded-xl text-[14px] cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
          style={{ color: "var(--muted)" }}
        >
          <button
            onClick={() => navigate(`/feed?q=${encodeURIComponent(f.query)}`)}
            className="flex items-center gap-2.5 flex-1 min-w-0 cursor-pointer text-left"
            style={{ color: "inherit" }}
          >
            <span className="flex items-center justify-center w-4 shrink-0"><f.icon size={15} strokeWidth={2} /></span>
            <span className="flex-1 truncate">{f.name}</span>
          </button>
          {f.user && (
            <button
              onClick={() => removeView(f.name)}
              title="Delete saved view"
              className="hidden group-hover:flex cursor-pointer"
              style={{ color: "var(--critical)" }}
            >
              <X size={13} strokeWidth={2.25} />
            </button>
          )}
          <Badge tone="info">{rawAlerts.filter((a) => matchesCel(a, f.query)).length}</Badge>
        </div>
      ))}
    </Section>
  );
}

function useTick(ms) {
  const [, setN] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setN((n) => n + 1), ms);
    return () => clearInterval(iv);
  }, [ms]);
}

export default function Sidebar({ data, collapsed, lastUpdated }) {
  const clusters = data?.clusters ?? [];
  const rawAlerts = data?.raw_alerts ?? [];
  const feedCount = rawAlerts.length;
  const firing = useMemo(() => rawAlerts.filter((a) => a.status === "firing").length, [rawAlerts]);
  const critical = useMemo(() => rawAlerts.filter((a) => a.severity === "critical").length, [rawAlerts]);
  useTick(5000);

  const syncLabel = lastUpdated ? `${Math.max(0, Math.round((Date.now() - lastUpdated) / 1000))}s ago` : "—";

  return (
    <aside
      className={`sidebar-surface ${collapsed ? "w-16" : "w-72"} shrink-0 h-full flex flex-col border-r overflow-y-auto overflow-x-hidden transition-all duration-200`}
      style={{ borderColor: "var(--border)" }}
    >
      <div className={`flex items-center gap-3 px-5 pt-5 pb-4 ${collapsed ? "justify-center px-0" : ""}`}>
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "var(--grad)", boxShadow: "0 4px 14px color-mix(in srgb, var(--accent) 45%, transparent)", color: "#fff" }}
        >
          <Zap size={19} strokeWidth={2.25} fill="currentColor" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <div className="font-extrabold text-[17px] leading-tight tracking-tight">AlertLens</div>
            <div className="text-[10.5px] font-semibold mt-0.5 uppercase tracking-wide" style={{ color: "var(--accent)" }}>
              AI Incident Intelligence
            </div>
          </div>
        )}
      </div>

      {!collapsed && <CommandSearch />}

      <nav className="flex-1 pt-1">
        {collapsed ? (
          <>
            {NAV_ITEMS.map((n) => (
              <Item key={n.to} to={n.to} collapsed label={n.label} />
            ))}
          </>
        ) : (
          <>
            <Section title="Overview">
              <Item to="/" label="Home" />
              <Item to="/incidents" label="Active Incidents" count={clusters.length} tone="critical" />
              <Item to="/feed" label="Alerts Feed" count={feedCount} tone="info" />
              <Item to="/5xx" label="5xx Alerts" count={critical} tone="critical" />
              <Item to="/firing" label="Firing Alerts" count={firing} tone="warning" />
            </Section>

            <Section title="Noise Reduction">
              <Item to="/deduplication" label="Deduplication" />
              <Item to="/correlations" label="Correlations" count={clusters.length} tone="ai" />
            </Section>

            <Section title="Platform">
              <Item to="/pipeline" label="Pipeline" />
              <Item to="/evaluation" label="Evaluation" />
              <Item to="/workflows" label="Workflows" />
              <Item to="/topology" label="Service Topology" />
              <Item to="/providers" label="Providers" />
            </Section>

            <SavedFilters rawAlerts={rawAlerts} />
          </>
        )}
      </nav>

      {!collapsed && data?.dedup_stats && (
        <div
          className="mx-3 mb-3 mt-3 rounded-xl border p-4 stat-card shrink-0"
          style={{ "--sc": "var(--ok)", borderColor: "var(--border)" }}
          title={`${rawAlerts.length} raw alerts collapsed into ${clusters.length} incidents this window`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[13px] font-semibold flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--ok)" }} />
              Noise Reduction
            </span>
            <span className="text-[19px] font-bold tabular-nums" style={{ color: "var(--ok)" }}>
              {rawAlerts.length
                ? `${(100 * (1 - clusters.length / rawAlerts.length)).toFixed(1)}%`
                : `${data.dedup_stats.reduction_pct}%`}
            </span>
          </div>
          <div className="text-[11.5px] mb-2" style={{ color: "var(--muted)" }}>
            {rawAlerts.length} raw alerts → {clusters.length} incidents
          </div>
          <Sparkline seed={`noise:${clusters.length}:${feedCount}`} color="var(--ok)" w={220} h={28} />
        </div>
      )}

      {!collapsed && (
        <div className="px-5 py-4 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
          <div className="text-[10px] font-semibold uppercase tracking-wider mb-2.5" style={{ color: "var(--muted)" }}>
            Workspace
          </div>
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold shrink-0"
              style={{ background: "var(--panel-2)", color: "var(--accent)" }}
            >
              S26
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium truncate">Team Synergy 2026</div>
              <div className="text-[10.5px] truncate" style={{ color: "var(--muted)" }}>HPE Problem Statement #10</div>
            </div>
          </div>
          <div className="flex items-center justify-between text-[10.5px]" style={{ color: "var(--muted)" }}>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: "var(--ok)" }} />
              Connected
            </span>
            <span>Last sync {syncLabel}</span>
          </div>
        </div>
      )}
    </aside>
  );
}
