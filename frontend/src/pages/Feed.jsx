import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  TriangleAlert, ChartColumn, BellOff, BookmarkPlus, Check, CheckCheck, CircleCheckBig,
  Columns3, Flame, ChartLine, Link2, EllipsisVertical, Radar, Server, Share2, Zap,
} from "lucide-react";
import AlertDrawer from "../components/AlertDrawer";
import FacetSidebar from "../components/FacetSidebar";
import { AlertIcon, CheckRow, Dropdown, MenuItem, Pager, SeverityDot, StatCard, StatusBadge, SourceTag, timeAgo } from "../components/ui";
import { matchesCel } from "../lib/cel";

const SEV_BORDER = { critical: "var(--critical)", high: "var(--high)", info: "var(--info)" };

function ActionChips({ alert, onAck, onDismiss, acked, onOpen, copied, onCopy }) {
  const isAcked = acked.has(alert.id);
  const btn = "action-icon w-7 h-7 rounded-lg flex items-center justify-center cursor-pointer";
  return (
    <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
      <button title="Open history" onClick={onOpen} className={btn} style={{ color: "var(--muted)", "--hc": "var(--info)" }}><ChartLine size={14} strokeWidth={2} /></button>
      <button title={copied ? "Copied!" : "Copy link"} onClick={onCopy} className={btn} style={{ color: copied ? "var(--ok)" : "var(--muted)", "--hc": "var(--accent)" }}>
        {copied ? <Check size={14} strokeWidth={2.25} /> : <Link2 size={14} strokeWidth={2} />}
      </button>
      <button title="Suppress locally" onClick={() => onDismiss(alert.id)} className={btn} style={{ color: "var(--muted)", "--hc": "var(--critical)" }}><BellOff size={14} strokeWidth={2} /></button>
      <Dropdown
        chrome={false}
        align="right"
        width="w-40"
        label={<span className={btn} style={{ color: "var(--muted)" }}><EllipsisVertical size={14} strokeWidth={2} /></span>}
      >
        {(close) => (
          <div className="py-1">
            <MenuItem icon={isAcked ? <CheckCheck size={14} /> : <Check size={14} />} onClick={() => { onAck(alert.id); close(); }}>
              {isAcked ? "Unacknowledge" : "Acknowledge"}
            </MenuItem>
            <MenuItem icon={<BellOff size={14} />} onClick={() => { onDismiss(alert.id); close(); }}>Suppress</MenuItem>
            <MenuItem icon={<Link2 size={14} />} onClick={() => { onCopy(); close(); }}>Copy link</MenuItem>
          </div>
        )}
      </Dropdown>
    </div>
  );
}

export default function Feed({ data, firingOnly = false, criticalOnly = false, stormRate = 0 }) {
  const [facets, setFacets] = useState({
    severity: new Set(),
    status: new Set(),
    source: new Set(),
    assignee: new Set(),
    dismissed: new Set(),
  });
  const [extraFacets, setExtraFacets] = useState([]);
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(new Set());
  const [acked, setAcked] = useState(new Set());
  const [dismissedLocal, setDismissedLocal] = useState(new Map()); // id -> overridden status
  const [escalated, setEscalated] = useState(new Set());
  const [assignee, setAssignee] = useState(new Map());
  const [drawerAlert, setDrawerAlert] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [shareState, setShareState] = useState("Share");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [cols, setCols] = useState(new Set(["desc", "status", "received", "source"]));
  const [sort, setSort] = useState({ key: "received", dir: "desc" });
  const [searchParams] = useSearchParams();

  // ?q= from global search / saved filters → applied CEL query
  useEffect(() => {
    const q = searchParams.get("q");
    if (q != null) {
      setDraft(q);
      setQuery(q.trim());
    }
  }, [searchParams]);

  const base = useMemo(() => {
    let a = data?.raw_alerts ?? [];
    if (firingOnly) a = a.filter((x) => x.status === "firing");
    if (criticalOnly) a = a.filter((x) => x.severity === "critical");
    return a;
  }, [data, firingOnly, criticalOnly]);

  const visible = useMemo(() => {
    const rows = base.filter((a) => {
      for (const key of Object.keys(facets)) {
        if (facets[key].size && !facets[key].has(a[key])) return false;
      }
      if (query && !matchesCel(a, query)) return false;
      return true;
    });
    const val = (a) =>
      sort.key === "received" ? a.timestamp : sort.key === "name" ? a.alertname : String(a[sort.key] ?? "");
    rows.sort((a, b) => {
      const cmp = String(val(a)).localeCompare(String(val(b)));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [base, facets, query, sort]);

  const copyLink = (a) => {
    navigator.clipboard?.writeText(`${location.origin}/feed?q=${encodeURIComponent(`id == "${a.id}"`)}`);
    setCopiedId(a.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const share = () => {
    const url = query
      ? `${location.origin}/feed?q=${encodeURIComponent(query)}`
      : location.origin + location.pathname;
    navigator.clipboard?.writeText(url);
    setShareState("Copied ✓");
    setTimeout(() => setShareState("Share"), 1500);
  };

  const saveView = () => {
    const name = saveName.trim();
    if (!name || !query) return;
    const views = (() => {
      try { return JSON.parse(localStorage.getItem("alertlens.savedViews") || "[]"); } catch { return []; }
    })().filter((v) => v.name !== name);
    views.push({ name, query });
    localStorage.setItem("alertlens.savedViews", JSON.stringify(views));
    window.dispatchEvent(new Event("alertlens-views"));
    setSaveOpen(false);
    setSaveName("");
  };

  const sortBy = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const applyQuery = () => setQuery(draft.trim());
  const isDirty = draft.trim() !== query;

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  useEffect(() => setPage(1), [facets, query, firingOnly, criticalOnly]);
  const pageRows = useMemo(
    () => visible.slice((page - 1) * perPage, page * perPage),
    [visible, page, perPage]
  );

  const stats = useMemo(() => {
    const all = data?.raw_alerts ?? [];
    const clusters = data?.clusters ?? [];
    const firing = all.filter((a) => a.status === "firing").length;
    const suppressed = all.filter((a) => a.status === "suppressed").length;
    const critical = all.filter((a) => a.severity === "critical").length;
    const services = new Set(base.map((a) => a.service)).size;
    const sources = new Set(base.map((a) => a.source)).size;
    const noisePct = all.length ? (100 * (1 - clusters.length / all.length)).toFixed(0) : 0;
    return { all: all.length, clusters: clusters.length, firing, suppressed, critical, services, sources, noisePct };
  }, [data, base]);

  const toggleOne = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAll = () =>
    setSelected((prev) =>
      prev.size === visible.length ? new Set() : new Set(visible.map((a) => a.id))
    );

  const toggleAck = (id) =>
    setAcked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const dismissOne = (id) =>
    setDismissedLocal((prev) => new Map(prev).set(id, "suppressed"));

  const resolveOne = (id) =>
    setDismissedLocal((prev) => new Map(prev).set(id, "resolved"));

  const toggleEscalate = (id) =>
    setEscalated((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const toggleAssign = (id) =>
    setAssignee((prev) => {
      const next = new Map(prev);
      next.get(id) === "Aditya" ? next.delete(id) : next.set(id, "Aditya");
      return next;
    });

  const ackSelected = () =>
    setAcked((prev) => {
      const next = new Set(prev);
      selected.forEach((id) => next.add(id));
      return next;
    });

  const dismissSelected = () =>
    setDismissedLocal((prev) => {
      const next = new Map(prev);
      selected.forEach((id) => next.set(id, "suppressed"));
      return next;
    });

  return (
    <div className="flex h-full min-h-0">
      <FacetSidebar
        alerts={base}
        facets={facets}
        setFacets={setFacets}
        extraFacets={extraFacets}
        setExtraFacets={setExtraFacets}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b" style={{ borderColor: "var(--border)" }}>
          <div>
            <h1 className="text-lg font-semibold mb-1">{criticalOnly ? "5xx Alerts" : firingOnly ? "Firing Alerts" : "Feed"}</h1>
            <div className="text-[13px]" style={{ color: "var(--muted)" }}>
              {criticalOnly
                ? "Only critical-severity alerts — the ones that page someone."
                : firingOnly
                ? "Alerts currently firing — active conditions right now."
                : "Every raw alert, as an on-call engineer would see it — before any intelligence. Click a row for its history."}
            </div>
          </div>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
            {visible.length} alerts
          </span>
          {firingOnly && stormRate > 0 && (
            <span className="flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: "var(--ok)" }}>
              <span className="w-1.5 h-1.5 rounded-full live-dot" style={{ background: "var(--ok)" }} />
              LIVE Streaming · {stormRate} events/sec
            </span>
          )}
          {selected.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "color-mix(in srgb, var(--accent) 20%, transparent)", color: "var(--accent)" }}>
                {selected.size} selected
              </span>
              <button
                onClick={ackSelected}
                className="text-xs px-2 py-0.5 rounded-full cursor-pointer"
                style={{ background: "var(--panel-2)", color: "var(--text)" }}
              >
                Acknowledge
              </button>
              <button
                onClick={dismissSelected}
                className="text-xs px-2 py-0.5 rounded-full cursor-pointer"
                style={{ background: "var(--panel-2)", color: "var(--text)" }}
              >
                Dismiss
              </button>
              <button
                onClick={() => setSelected(new Set())}
                className="text-xs px-2 py-0.5 rounded-full cursor-pointer"
                style={{ background: "var(--panel-2)", color: "var(--muted)" }}
              >
                Clear
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 min-[1280px]:grid-cols-5 gap-3 px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
          {criticalOnly ? (
            <>
              <StatCard icon={<TriangleAlert size={16} />} label="Critical Alerts" value={stats.critical} color="var(--critical)" delta="the ones that page" />
              <StatCard icon={<Flame size={16} />} label="Firing" value={base.filter((a) => a.status === "firing").length} color="var(--high)" delta="active now" />
              <StatCard icon={<BellOff size={16} />} label="Suppressed" value={base.filter((a) => a.status === "suppressed").length} color="var(--info)" delta="held back" />
              <StatCard icon={<Server size={16} />} label="Affected Services" value={stats.services} color="var(--accent)" delta="in this view" />
              <StatCard icon={<CircleCheckBig size={16} />} label="Noise Reduced" value={`${stats.noisePct}%`} color="var(--ok)" delta="raw → incidents" />
            </>
          ) : firingOnly ? (
            <>
              <StatCard icon={<Zap size={16} />} label="Firing Alerts" value={base.length} color="var(--critical)" delta="active conditions" />
              <StatCard icon={<TriangleAlert size={16} />} label="High Severity" value={base.filter((a) => a.severity !== "info").length} color="var(--high)" delta="need eyes" />
              <StatCard icon={<Server size={16} />} label="Affected Services" value={stats.services} color="var(--info)" delta="in this view" />
              <StatCard icon={<Radar size={16} />} label="Sources" value={stats.sources} color="var(--accent)" delta="monitoring tools" />
              <StatCard icon={<CircleCheckBig size={16} />} label="Noise Reduced" value={`${stats.noisePct}%`} color="var(--ok)" delta="raw → incidents" />
            </>
          ) : (
            <>
              <StatCard icon={<Flame size={16} />} label="Active Incidents" value={stats.clusters} color="var(--critical)" delta="correlated groups" />
              <StatCard icon={<Zap size={16} />} label="Firing Alerts" value={stats.firing} color="var(--high)" delta="active now" />
              <StatCard icon={<BellOff size={16} />} label="Suppressed" value={stats.suppressed} color="var(--info)" delta="held back" />
              <StatCard icon={<CircleCheckBig size={16} />} label="Noise Reduction" value={`${stats.noisePct}%`} color="var(--ok)" delta="raw → incidents" />
              <StatCard icon={<ChartColumn size={16} />} label="Total Alerts (Raw)" value={stats.all} color="var(--accent)" delta="this window" />
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-5 py-2.5 border-b" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <span
            className="px-2 py-1 rounded text-[13px] font-bold shrink-0"
            style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)" }}
          >
            CEL
          </span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyQuery()}
            placeholder={'e.g. severity == "critical" && source.contains("gcp")'}
            className="flex-1 px-2 py-1 text-[15px] font-mono outline-none bg-transparent"
            style={{ color: "var(--text)" }}
          />
          {isDirty && (
            <button
              onClick={applyQuery}
              className="px-2.5 py-1 rounded text-[13px] font-semibold cursor-pointer shrink-0"
              style={{ background: "var(--accent)", color: "#fff" }}
            >
              Enter to apply
            </button>
          )}

          <div className="relative shrink-0">
            <button
              onClick={() => setSaveOpen((v) => !v)}
              disabled={!query}
              title={query ? "Save the current CEL filter as a view" : "Apply a CEL filter first"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[14px] cursor-pointer hover:brightness-125 disabled:opacity-40"
              style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }}
            >
              <BookmarkPlus size={14} strokeWidth={2} /> Save View
            </button>
            {saveOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 w-60 rounded-xl border shadow-2xl z-50 p-3"
                style={{ background: "var(--panel)", borderColor: "var(--border)" }}
              >
                <div className="text-[13px] font-semibold mb-1.5">Save current filter as</div>
                <input
                  autoFocus
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveView()}
                  placeholder="View name…"
                  className="w-full px-2 py-1.5 rounded-lg border text-[14px] outline-none mb-2"
                  style={{ borderColor: "var(--border)", background: "var(--bg)", color: "var(--text)" }}
                />
                <button onClick={saveView} className="w-full py-1.5 rounded-lg text-[14px] font-semibold cursor-pointer grad-btn">
                  Save to sidebar
                </button>
              </div>
            )}
          </div>

          <button
            onClick={share}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[14px] cursor-pointer hover:brightness-125 shrink-0"
            style={{ borderColor: "var(--border)", background: "var(--bg)", color: shareState === "Share" ? "var(--text)" : "var(--ok)" }}
          >
            <Share2 size={14} strokeWidth={2} /> {shareState}
          </button>

          <Dropdown label={<span className="flex items-center gap-1.5"><Columns3 size={14} strokeWidth={2} /> Columns</span>} align="right" width="w-48">
            <div className="py-1">
              {[["desc", "Description"], ["status", "Status"], ["received", "Last Received"], ["source", "Source"]].map(([k, label]) => (
                <CheckRow
                  key={k}
                  label={label}
                  checked={cols.has(k)}
                  onChange={() => setCols((prev) => {
                    const next = new Set(prev);
                    next.has(k) ? next.delete(k) : next.add(k);
                    return next;
                  })}
                />
              ))}
            </div>
          </Dropdown>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="w-full text-[15px]">
            <thead>
              <tr
                className="text-left text-[13px] uppercase tracking-wider sticky top-0"
                style={{ color: "var(--muted)", background: "var(--bg)" }}
              >
                <th className="pl-5 pr-2 py-2.5 font-medium w-9">
                  <input
                    type="checkbox"
                    className="accent-orange-500"
                    checked={selected.size > 0 && selected.size === visible.length}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-2 py-2.5 font-medium cursor-pointer select-none" onClick={() => sortBy("name")}>
                  Name {sort.key === "name" ? (sort.dir === "desc" ? "↓" : "↑") : ""}
                </th>
                {cols.has("desc") && <th className="px-2 py-2.5 font-medium">Description</th>}
                {cols.has("status") && (
                  <th className="px-2 py-2.5 font-medium cursor-pointer select-none" onClick={() => sortBy("status")}>
                    Status {sort.key === "status" ? (sort.dir === "desc" ? "↓" : "↑") : ""}
                  </th>
                )}
                {cols.has("received") && (
                  <th className="px-2 py-2.5 font-medium whitespace-nowrap cursor-pointer select-none" onClick={() => sortBy("received")}>
                    Last Received {sort.key === "received" ? (sort.dir === "desc" ? "↓" : "↑") : ""}
                  </th>
                )}
                {cols.has("source") && (
                  <th className="px-2 py-2.5 font-medium cursor-pointer select-none" onClick={() => sortBy("source")}>
                    Source {sort.key === "source" ? (sort.dir === "desc" ? "↓" : "↑") : ""}
                  </th>
                )}
                <th className="px-2 py-2.5 font-medium text-right pr-4 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((a) => {
                const status = dismissedLocal.get(a.id) || a.status;
                return (
                  <tr
                    key={a.id}
                    onClick={() => setDrawerAlert(a)}
                    className="row-hover border-t border-l-[3px] cursor-pointer"
                    style={{ borderColor: "var(--border)", borderLeftColor: SEV_BORDER[a.severity] || "transparent" }}
                  >
                    <td className="pl-5 pr-2 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="accent-orange-500"
                        checked={selected.has(a.id)}
                        onChange={() => toggleOne(a.id)}
                      />
                    </td>
                    <td className="px-2 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <AlertIcon alertname={a.alertname} severity={a.severity} service={a.service} />
                        <div className="min-w-0">
                          <div className="font-medium flex items-center gap-1.5" style={{ color: "var(--text)" }}>
                            <SeverityDot severity={a.severity} />
                            {a.alertname}
                          </div>
                          <div className="text-[13px]" style={{ color: "var(--muted)" }}>{a.service}</div>
                        </div>
                      </div>
                    </td>
                    {cols.has("desc") && (
                      <td className="px-2 py-3.5 max-w-md truncate" style={{ color: "var(--muted)" }} title={a.message}>
                        {a.message}
                      </td>
                    )}
                    {cols.has("status") && <td className="px-2 py-3.5"><StatusBadge status={status} /></td>}
                    {cols.has("received") && (
                      <td className="px-2 py-3.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>
                        {timeAgo(a.timestamp)}
                      </td>
                    )}
                    {cols.has("source") && <td className="px-2 py-3.5"><SourceTag source={a.source} /></td>}
                    <td className="px-2 py-3.5 text-right pr-3">
                      <ActionChips
                        alert={a}
                        onAck={toggleAck}
                        onDismiss={dismissOne}
                        acked={acked}
                        onOpen={() => setDrawerAlert(a)}
                        copied={copiedId === a.id}
                        onCopy={() => copyLink(a)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && (
            <div className="p-10 text-center" style={{ color: "var(--muted)" }}>No alerts match the current filters.</div>
          )}
        </div>

        <Pager page={page} setPage={setPage} total={visible.length} perPage={perPage} setPerPage={setPerPage} />
      </div>

      {drawerAlert && (
        <AlertDrawer
          alert={drawerAlert}
          data={data}
          onClose={() => setDrawerAlert(null)}
          isAcked={acked.has(drawerAlert.id)}
          onAck={() => toggleAck(drawerAlert.id)}
          status={dismissedLocal.get(drawerAlert.id) || drawerAlert.status}
          onSuppress={() => dismissOne(drawerAlert.id)}
          onResolve={() => resolveOne(drawerAlert.id)}
          isEscalated={escalated.has(drawerAlert.id)}
          onEscalate={() => toggleEscalate(drawerAlert.id)}
          assignee={assignee.get(drawerAlert.id)}
          onAssign={() => toggleAssign(drawerAlert.id)}
        />
      )}
    </div>
  );
}
