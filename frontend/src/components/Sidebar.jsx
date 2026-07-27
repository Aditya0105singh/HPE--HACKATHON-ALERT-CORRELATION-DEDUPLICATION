import { useEffect, useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  ArrowLeftRight, Bell, BellRing, Bookmark, ChevronDown, Compass, Database,
  Flame, GitMerge, History, Network, OctagonAlert, Radar, Search,
  Star, Waypoints, Workflow, X, Zap,
} from "lucide-react";
import { matchesCel } from "../lib/cel";
import { Sparkline } from "./ui";
import AlertLensMark from "./AlertLensMark";

// Icon + label choices below deliberately mirror Keep's actual left-nav
// (components/navbar/*Links.tsx): same section names (INCIDENTS / ALERTS /
// NOISE REDUCTION), same per-item icon families (a flash icon for Incidents,
// a swap icon for Feed, a merge icon for Deduplication), same Beta-badge
// convention on Topology/Dashboards. The AI/forecast pages have no Keep
// equivalent, so they get their own "INTELLIGENCE" section instead of being
// forced into one of Keep's groups.
const NAV_ICON = {
  "/incidents": Zap,
  "/feed": ArrowLeftRight,
  "/5xx": OctagonAlert,
  "/firing": BellRing,
  "/deduplication": GitMerge,
  "/correlations": Radar,
  "/workflows": Workflow,
  "/topology": Network,
  "/providers": ArrowLeftRight,
  "/forecast": Compass,
  "/timemachine": History,
  "/pipeline": Waypoints,
  "/evaluation": Database,
};

const NAV_ITEMS = [
  { to: "/incidents", label: "Incidents" },
  { to: "/feed", label: "Feed" },
  { to: "/5xx", label: "5xx Alerts" },
  { to: "/firing", label: "Firing Alerts" },
  { to: "/deduplication", label: "Deduplication" },
  { to: "/correlations", label: "Correlations" },
  { to: "/workflows", label: "Workflows" },
  { to: "/topology", label: "Service Topology" },
  { to: "/providers", label: "Providers" },
  { to: "/forecast", label: "Predictive Forecast" },
  { to: "/timemachine", label: "Time Machine" },
  { to: "/pipeline", label: "Pipeline" },
  { to: "/evaluation", label: "Evaluation" },
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

// Section header mirrors Keep's Disclosure pattern in components/navbar/
// *Links.tsx exactly: uppercase text-xs label, chevron that rotates 180deg
// when open, optional "Beta" pill next to the chevron (Keep uses this same
// pill on Dashboards/Topology).
function Section({ title, children, defaultOpen = true, beta = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-1 first:mt-1">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full px-4 py-1.5 cursor-pointer"
      >
        <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
          {title}
        </span>
        <span className="flex items-center gap-1.5">
          {beta && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 16%, transparent)" }}
            >
              Beta
            </span>
          )}
          <ChevronDown
            size={13}
            strokeWidth={2.25}
            className="transition-transform duration-200 shrink-0"
            style={{ color: "var(--muted)", transform: open ? "rotate(180deg)" : "none" }}
          />
        </span>
      </button>
      <div className={`collapse-rows ${open ? "is-open" : ""}`}>
        <div className="px-2">{children}</div>
      </div>
    </div>
  );
}

// Nav link chrome mirrors Keep's LinkWithIcon.tsx: flat rounded-lg row, a
// single neutral hover/active tint (Keep's bg-stone-200/50) rather than a
// gradient/accent-bar treatment, icon+label switching to the brand color
// when active (Keep's text-orange-400 / dark:text-blue-400).
function Item({ to, label, count, isBeta, collapsed }) {
  const Icon = NAV_ICON[to] || Bell;
  return (
    <NavLink
      to={to}
      end={to === "/"}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        `nav-link group flex items-center gap-2.5 py-1.5 rounded-lg mb-0.5 ${
          collapsed ? "justify-center px-0 mx-2" : "px-2 mx-2"
        } ${isActive ? "nav-link--active" : ""}`
      }
      style={({ isActive }) => ({
        background: isActive ? "color-mix(in srgb, var(--text) 8%, transparent)" : "transparent",
      })}
    >
      {({ isActive }) => (
        <>
          <span className="flex items-center justify-center w-4 shrink-0" style={{ color: isActive ? "var(--accent)" : "var(--text)" }}>
            <Icon size={15} strokeWidth={2} />
          </span>
          {!collapsed && (
            <span className="flex-1 truncate text-[13.5px] font-medium" style={{ color: isActive ? "var(--accent)" : "var(--text)" }}>
              {label}
            </span>
          )}
          {!collapsed && count != null && (
            <span
              className="px-1.5 min-w-5 text-center rounded-full text-[11px] font-semibold shrink-0"
              style={{ color: "#fff", background: "var(--accent)" }}
            >
              {count}
            </span>
          )}
          {!collapsed && isBeta && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold shrink-0"
              style={{ color: "var(--accent)", background: "color-mix(in srgb, var(--accent) 16%, transparent)" }}
            >
              Beta
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

function CommandSearch({ clusters = [] }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  // The palette used to only jump between pages — every page you could
  // already reach by clicking the sidebar. Its actual value is jumping to a
  // specific *thing*, the way it works in real tools, so it also surfaces
  // live actions built from the current batch, not just static routes.
  const topRisk = useMemo(
    () => (clusters.length ? [...clusters].sort((a, b) => b.risk.score - a.risk.score)[0] : null),
    [clusters]
  );
  const actions = useMemo(() => {
    if (!topRisk) return [];
    return [{
      to: `/incidents/${topRisk.cluster_id}`,
      label: `Jump to highest-risk incident — ${topRisk.root_cause.service} (${Math.round(topRisk.risk.score * 100)}%)`,
      isAction: true,
    }];
  }, [topRisk]);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [...actions, ...NAV_ITEMS];
    const actionMatches = actions.filter((a) => a.label.toLowerCase().includes(term) || "risk incident highest".includes(term));
    const pageMatches = NAV_ITEMS.filter((n) => n.label.toLowerCase().includes(term));
    return [...actionMatches, ...pageMatches];
  }, [q, actions]);

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
    <div className="flex-1 min-w-0 relative" data-sidebar-search>
      <div
        className="search-shell flex items-center gap-2 px-2.5 py-1.5 rounded-lg border"
        style={{ borderColor: "var(--border)", background: "var(--panel)" }}
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
            <div className="px-3 py-2.5 text-[13px]" style={{ color: "var(--muted)" }}>No matches</div>
          ) : (
            matches.map((n) => (
              <button
                key={n.to}
                onClick={() => select(n)}
                className="flex items-center gap-2 w-full text-left px-3 py-2 text-[13.5px] cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                style={{ color: n.isAction ? "var(--accent)" : "var(--text)" }}
              >
                {n.isAction && (
                  <span className="text-[9.5px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0" style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)" }}>
                    Action
                  </span>
                )}
                <span className="truncate">{n.label}</span>
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
    <>
      {entries.map((f) => (
        <div
          key={f.name}
          className="group flex items-center gap-2.5 mx-2 px-2 py-1.5 rounded-lg text-[13.5px] font-medium cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_8%,transparent)]"
          style={{ color: "var(--text)" }}
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
    </>
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

  return (
    <aside
      className={`${collapsed ? "w-16" : "w-72"} shrink-0 h-full flex flex-col border-r overflow-y-auto overflow-x-hidden transition-all duration-200`}
      style={{ borderColor: "var(--border)", background: "var(--panel-2)" }}
    >
      {/* Header row mirrors Keep's components/navbar/Search.tsx exactly:
          logo + search combined in one flex row with a bottom border,
          rather than two stacked blocks. */}
      <div className={`flex items-center w-full py-3 px-2.5 border-b gap-3 ${collapsed ? "justify-center" : ""}`} style={{ borderColor: "var(--border)" }}>
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: "var(--grad)", color: "#fff" }}
          title="AlertLens"
        >
          <AlertLensMark size={16} />
        </div>
        {!collapsed && <CommandSearch clusters={clusters} />}
      </div>

      <nav className="flex-1 pt-3">
        {collapsed ? (
          <>
            {NAV_ITEMS.map((n) => (
              <Item key={n.to} to={n.to} collapsed label={n.label} />
            ))}
          </>
        ) : (
          <>
            <Section title="Incidents">
              <Item to="/incidents" label="Incidents" count={clusters.length} />
            </Section>

            <Section title="Alerts">
              <Item to="/feed" label="Feed" count={feedCount} />
              <Item to="/firing" label="Firing Alerts" count={firing} />
              <Item to="/5xx" label="5xx Alerts" count={critical} />
              <SavedFilters rawAlerts={rawAlerts} />
            </Section>

            <Section title="Noise Reduction">
              <Item to="/deduplication" label="Deduplication" />
              <Item to="/correlations" label="Correlations" count={clusters.length} />
              <Item to="/workflows" label="Workflows" />
              <Item to="/topology" label="Service Topology" isBeta />
              <Item to="/providers" label="Providers" />
            </Section>

            <Section title="Intelligence" beta>
              <Item to="/forecast" label="Predictive Forecast" />
              <Item to="/timemachine" label="Time Machine" />
              <Item to="/pipeline" label="Pipeline" />
              <Item to="/evaluation" label="Evaluation" />
            </Section>
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
    </aside>
  );
}
