import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChartColumn, BellOff, Check, CircleCheckBig, Columns3, Dna, Film, Flame, Layers,
  ChartLine, Link2, ListFilter, Magnet, EllipsisVertical, Users, X, Zap,
} from "lucide-react";
import AlertDrawer from "../components/AlertDrawer";
import { ClusterCard } from "./Correlations";
import {
  AlertIcon, CheckRow, Dropdown, MenuItem, Pager, PriorityBadge, ServiceChip,
  SeverityBadge, SeverityDot, Sparkline, StatCard, StatusBadge, SourceTag, timeAgo,
} from "../components/ui";

const RISK_EDGE = { high: "var(--critical)", medium: "var(--high)", low: "var(--ok)" };
const SEV_EDGE = { critical: "var(--critical)", high: "var(--high)", info: "var(--info)" };

function IncidentCard({ cluster }) {
  const navigate = useNavigate();
  const root = cluster.root_cause;
  const edge = RISK_EDGE[cluster.risk.level] || "var(--muted)";
  const services = [...new Set(cluster.alerts.map((a) => a.service))];
  const times = cluster.alerts.map((a) => a.timestamp).sort();
  const pct = Math.round(cluster.risk.score * 100);

  return (
    <div
      onClick={() => navigate(`/incidents/${cluster.cluster_id}`)}
      className="rounded-xl border p-4 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-xl min-w-0"
      style={{ borderColor: `color-mix(in srgb, ${edge} 45%, var(--border))`, background: "var(--panel)" }}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <PriorityBadge severity={root.severity} riskLevel={cluster.risk.level} />
        <span className="font-semibold text-[16px] truncate flex-1">{root.alertname}</span>
        <span className="text-[13px] shrink-0" style={{ color: "var(--muted)" }}>{cluster.raw_alert_count} alerts</span>
      </div>
      <div className="text-[13px] mb-3 truncate" style={{ color: "var(--muted)" }}>
        Affecting {services.slice(0, 2).join(" and ")}{services.length > 2 ? ` +${services.length - 2}` : ""} flow
      </div>

      <div className="text-[12px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>Root Cause</div>
      <div className="flex items-center gap-2.5 mb-1">
        <AlertIcon alertname={root.alertname} severity={root.severity} service={root.service} />
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-medium truncate">{root.service} — {root.alertname}</div>
          <div className="text-[13px]" style={{ color: edge }}>{pct}% risk score</div>
        </div>
      </div>
      <div className="h-1 rounded-full mb-3" style={{ background: "var(--panel-2)" }}>
        <div className="h-1 rounded-full transition-all" style={{ width: `${pct}%`, background: edge }} />
      </div>

      <div className="text-[12px] uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>Affected Services</div>
      <div className="flex gap-1.5 flex-wrap mb-3">
        {services.slice(0, 3).map((s) => <ServiceChip key={s} name={s} />)}
        {services.length > 3 && (
          <span className="px-1.5 py-0.5 rounded text-[13px] border" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
            +{services.length - 3}
          </span>
        )}
      </div>

      <div className="flex items-end justify-between gap-2">
        <div className="text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
          <div>Started<br /><b style={{ color: "var(--text)" }}>{timeAgo(times[0])}</b></div>
        </div>
        <div className="text-[12px] leading-relaxed" style={{ color: "var(--muted)" }}>
          <div>Last updated<br /><b style={{ color: "var(--text)" }}>{timeAgo(times[times.length - 1])}</b></div>
        </div>
        <Sparkline seed={`inc:${cluster.cluster_id}`} color={edge} w={84} h={24} />
      </div>
    </div>
  );
}

function AiPanel({ cluster, onClose }) {
  const navigate = useNavigate();
  if (!cluster) return null;
  const root = cluster.root_cause;
  const edge = RISK_EDGE[cluster.risk.level] || "var(--muted)";
  const pct = Math.round(cluster.risk.score * 100);
  const services = [...new Set(cluster.alerts.map((a) => a.service))];
  const actions = cluster.dna_match
    ? cluster.dna_match.resolution.split(/,\s*/).slice(0, 3)
    : ["Page the owning team for " + root.service, "Check recent deploys & config changes", "Correlate with upstream dependencies"];
  const timeline = [...cluster.alerts].sort((a, b) => a.timestamp.localeCompare(b.timestamp)).slice(0, 5);

  return (
    <div className="w-[300px] shrink-0 hidden min-[1360px]:flex flex-col gap-4 overflow-y-auto">
      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-6 h-6 rounded-md flex items-center justify-center text-[14px] font-bold" style={{ background: "var(--grad)", color: "#fff" }}>AI</span>
          <span className="font-semibold text-[16px]">Assistant</span>
          <span className="px-1.5 py-0.5 rounded text-[12px] font-semibold" style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--purple)" }}>Beta</span>
          <button onClick={onClose} className="ml-auto cursor-pointer" style={{ color: "var(--muted)" }} title="Close panel"><X size={15} strokeWidth={2} /></button>
        </div>

        <div className="text-[13px] font-semibold mb-1">Incident Summary</div>
        <p className="text-[13px] leading-relaxed mb-3" style={{ color: "var(--muted)" }}>{cluster.summary}</p>

        <div className="text-[13px] font-semibold mb-1">Likely Root Cause</div>
        <div className="flex items-center gap-2 mb-1">
          <AlertIcon alertname={root.alertname} severity={root.severity} service={root.service} />
          <div className="min-w-0">
            <div className="text-[14px] font-medium truncate">{root.service}</div>
            <div className="text-[12px]" style={{ color: edge }}>{pct}% risk score</div>
          </div>
        </div>
        <div className="h-1 rounded-full mb-3" style={{ background: "var(--panel-2)" }}>
          <div className="h-1 rounded-full" style={{ width: `${pct}%`, background: edge }} />
        </div>

        <div className="text-[13px] font-semibold mb-1.5">Impact</div>
        <div className="text-[13px] mb-0.5 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Users size={13} strokeWidth={2} /> {services.length} services affected</div>
        <div className="text-[13px] mb-3 flex items-center gap-1.5" style={{ color: "var(--muted)" }}><Layers size={13} strokeWidth={2} /> {cluster.raw_alert_count} alerts correlated</div>

        <div className="text-[13px] font-semibold mb-1.5">Recommended Actions</div>
        <ol className="text-[13px] leading-relaxed mb-3 pl-4 list-decimal" style={{ color: "var(--muted)" }}>
          {actions.map((a, i) => <li key={i}>{a}</li>)}
        </ol>

        <button
          onClick={() => navigate(`/incidents/${cluster.cluster_id}`)}
          className="w-full py-2 rounded-lg text-[14px] font-semibold cursor-pointer grad-btn"
        >
          View Full Analysis
        </button>
        <div className="text-[12px] mt-2 text-center" style={{ color: "var(--muted)" }}>AI analysis may be inaccurate</div>
      </div>

      <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="font-semibold text-[15px] mb-3">Timeline Preview</div>
        {timeline.map((a, i) => (
          <div key={a.id} className="flex items-start gap-2.5 relative">
            <div className="flex flex-col items-center">
              <span className="w-2 h-2 rounded-full mt-1 shrink-0" style={{ background: i === 0 ? "var(--accent)" : "var(--panel-2)", border: "1px solid var(--border)" }} />
              {i < timeline.length - 1 && <span className="w-px flex-1 min-h-4" style={{ background: "var(--border)" }} />}
            </div>
            <div className="pb-2.5 min-w-0">
              <span className="text-[12px] font-mono mr-1.5" style={{ color: "var(--muted)" }}>{a.timestamp.slice(11, 16)}</span>
              <span className="text-[13px]">{a.alertname}</span>
            </div>
          </div>
        ))}
        <button
          onClick={() => navigate(`/incidents/${cluster.cluster_id}`)}
          className="text-[14px] cursor-pointer mt-1"
          style={{ color: "var(--purple)" }}
        >
          View full timeline →
        </button>
      </div>
    </div>
  );
}

const COLS = [
  ["severity", "Severity"], ["status", "Status"], ["rootcause", "Root Cause"],
  ["service", "Affected Service"], ["source", "Source"], ["started", "Started"], ["updated", "Updated"],
];

export default function Home({ data }) {
  const navigate = useNavigate();
  const clusters = data?.clusters ?? [];
  const alerts = data?.raw_alerts ?? [];

  const [tab, setTab] = useState("feed");
  const [groupBy, setGroupBy] = useState("Root Cause");
  const [riskFilter, setRiskFilter] = useState(new Set());
  const [aiOpen, setAiOpen] = useState(true);
  const [tblFilters, setTblFilters] = useState({ severity: new Set(), status: new Set(), source: new Set(), service: new Set(), dismissed: new Set() });
  const [sort, setSort] = useState({ key: "started", dir: "desc" });
  const [cols, setCols] = useState(new Set(COLS.map(([k]) => k)));
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [drawerAlert, setDrawerAlert] = useState(null);
  const [copiedId, setCopiedId] = useState(null);
  const [ackedIds, setAckedIds] = useState(new Set());
  const [mutedIds, setMutedIds] = useState(new Set());

  // alert id -> owning cluster (for the Root Cause column)
  const clusterOf = useMemo(() => {
    const m = new Map();
    for (const c of clusters) for (const a of c.alerts) m.set(a.id, c);
    return m;
  }, [clusters]);

  const cards = useMemo(() => {
    let list = clusters.filter((c) => !riskFilter.size || riskFilter.has(c.risk.level));
    const bySort = {
      "Root Cause": (a, b) => b.risk.score - a.risk.score,
      "Service": (a, b) => a.root_cause.service.localeCompare(b.root_cause.service),
      "Severity": (a, b) => a.root_cause.severity.localeCompare(b.root_cause.severity),
    };
    return [...list].sort(bySort[groupBy] || bySort["Root Cause"]);
  }, [clusters, groupBy, riskFilter]);

  const optionsFor = (key) => [...new Set(alerts.map((a) => String(a[key])))].sort();

  const tblRows = useMemo(() => {
    let rows = alerts.filter((a) => {
      for (const k of Object.keys(tblFilters)) {
        if (tblFilters[k].size && !tblFilters[k].has(String(a[k]))) return false;
      }
      return true;
    });
    const val = (a) => {
      if (sort.key === "rootcause") return clusterOf.get(a.id)?.risk.score ?? -1;
      if (sort.key === "started" || sort.key === "updated") return a.timestamp;
      if (sort.key === "service") return a.service;
      return String(a[sort.key] ?? "");
    };
    rows.sort((a, b) => {
      const x = val(a), y = val(b);
      const cmp = typeof x === "number" ? x - y : String(x).localeCompare(String(y));
      return sort.dir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [alerts, tblFilters, sort, clusterOf]);

  const pageRows = tblRows.slice((page - 1) * perPage, page * perPage);
  const activeFilterCount = Object.values(tblFilters).reduce((s, set) => s + (set.size ? 1 : 0), 0);

  const toggleFilter = (key, value) => {
    setPage(1);
    setTblFilters((prev) => {
      const next = new Set(prev[key]);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...prev, [key]: next };
    });
  };

  const sortBy = (key) =>
    setSort((s) => ({ key, dir: s.key === key && s.dir === "desc" ? "asc" : "desc" }));

  const copyLink = (a) => {
    navigator.clipboard?.writeText(`${location.origin}/feed?q=${encodeURIComponent(`id == "${a.id}"`)}`);
    setCopiedId(a.id);
    setTimeout(() => setCopiedId(null), 1200);
  };

  const stats = useMemo(() => {
    const firing = alerts.filter((a) => a.status === "firing").length;
    const suppressed = alerts.filter((a) => a.status === "suppressed").length;
    // fingerprint groups that actually collapsed duplicates (dedup output)
    const deduped = [...clusters.flatMap((c) => c.alerts), ...(data?.noise ?? [])];
    const groups = deduped.filter((a) => (a.duplicate_count ?? 1) > 1).length;
    const noise = alerts.length ? (100 * (1 - clusters.length / alerts.length)).toFixed(0) : 0;
    return { firing, suppressed, noise, groups };
  }, [alerts, clusters, data]);

  const filterDrop = (label, key) => (
    <Dropdown label={<span>{label}: {tblFilters[key].size ? `${tblFilters[key].size}` : "All"}</span>} width="w-56">
      <div className="max-h-64 overflow-auto py-1">
        {optionsFor(key).map((v) => (
          <CheckRow
            key={v}
            label={v}
            checked={tblFilters[key].has(v)}
            onChange={() => toggleFilter(key, v)}
            count={alerts.filter((a) => String(a[key]) === v).length}
          />
        ))}
      </div>
    </Dropdown>
  );

  const thBtn = (key, label) =>
    cols.has(key) && (
      <th key={key} className="px-2 py-2.5 font-medium whitespace-nowrap cursor-pointer select-none" onClick={() => sortBy(key)}>
        {label} {sort.key === key ? (sort.dir === "desc" ? "↓" : "↑") : ""}
      </th>
    );

  return (
    <div className="h-full flex min-h-0">
      <div className="flex-1 min-w-0 overflow-y-auto p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 min-[1280px]:grid-cols-6 gap-3 mb-5">
          <StatCard icon={<Flame size={16} />} label="Active Incidents" value={clusters.length} color="var(--critical)" delta="correlated now" spark />
          <StatCard icon={<Zap size={16} />} label="Firing Alerts" value={stats.firing} color="var(--high)" delta="active now" spark />
          <StatCard icon={<Magnet size={16} />} label="Correlated Groups" value={stats.groups} color="var(--purple)" delta="fingerprints" spark />
          <StatCard icon={<BellOff size={16} />} label="Suppressed Alerts" value={stats.suppressed} color="var(--info)" delta="held back" spark />
          <StatCard icon={<CircleCheckBig size={16} />} label="Noise Reduction" value={`${stats.noise}%`} color="var(--ok)" delta="raw → incidents" spark />
          <StatCard icon={<ChartColumn size={16} />} label="Total Alerts (Raw)" value={alerts.length} color="var(--accent)" delta="last 24 hours" spark />
        </div>

        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-[21px] font-bold">Active Incidents ({cards.length})</h1>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setTab("timeline")}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[14px] cursor-pointer hover:brightness-125"
              style={{ borderColor: "var(--border)", background: "var(--panel)", color: "var(--text)" }}
            >
              <Film size={14} strokeWidth={2} /> View Timeline
            </button>
            <Dropdown label={<span>Group by: {groupBy}</span>} width="w-44">
              {(close) => ["Root Cause", "Service", "Severity"].map((g) => (
                <MenuItem key={g} onClick={() => { setGroupBy(g); close(); }} icon={groupBy === g ? <Check size={14} /> : null}>{g}</MenuItem>
              ))}
            </Dropdown>
            <Dropdown label={<span className="flex items-center gap-1.5"><ListFilter size={14} strokeWidth={2} /> Filters</span>} badge={riskFilter.size} width="w-44">
              <div className="py-1">
                {["high", "medium", "low"].map((lvl) => (
                  <CheckRow
                    key={lvl}
                    label={`${lvl} risk`}
                    checked={riskFilter.has(lvl)}
                    onChange={() => setRiskFilter((prev) => {
                      const next = new Set(prev);
                      next.has(lvl) ? next.delete(lvl) : next.add(lvl);
                      return next;
                    })}
                    count={clusters.filter((c) => c.risk.level === lvl).length}
                  />
                ))}
              </div>
            </Dropdown>
          </div>
        </div>
        <div className="text-[14px] mb-3" style={{ color: "var(--muted)" }}>
          Intelligent correlation groups with highest impact
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 min-[1500px]:grid-cols-4 gap-3 mb-6">
          {cards.map((c) => <IncidentCard key={c.cluster_id} cluster={c} />)}
          {cards.length === 0 && (
            <div className="col-span-full p-8 text-center text-[15px] rounded-xl border" style={{ color: "var(--muted)", borderColor: "var(--border)" }}>
              No incidents match the current risk filter.
            </div>
          )}
        </div>

        <div className="flex items-center gap-5 border-b mb-3" style={{ borderColor: "var(--border)" }}>
          {[["feed", "Alerts Feed"], ["groups", "Correlated Groups"], ["timeline", "Timeline View"], ["insights", "AI Insights"]].map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="pb-2 text-[15px] cursor-pointer border-b-2 -mb-px transition-colors"
              style={{
                borderColor: tab === k ? "var(--accent)" : "transparent",
                color: tab === k ? "var(--text)" : "var(--muted)",
                fontWeight: tab === k ? 600 : 400,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "feed" && (
          <>
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              {filterDrop("Severity", "severity")}
              {filterDrop("Status", "status")}
              {filterDrop("Source", "source")}
              {filterDrop("Service", "service")}
              <Dropdown label={<span>More Filters</span>} width="w-52">
                <div className="px-3 pt-2 pb-1 text-[12px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>Dismissed</div>
                {optionsFor("dismissed").map((v) => (
                  <CheckRow key={v} label={v} checked={tblFilters.dismissed.has(v)} onChange={() => toggleFilter("dismissed", v)} />
                ))}
              </Dropdown>
              {activeFilterCount > 0 && (
                <button
                  onClick={() => { setTblFilters({ severity: new Set(), status: new Set(), source: new Set(), service: new Set(), dismissed: new Set() }); setPage(1); }}
                  className="text-[14px] cursor-pointer"
                  style={{ color: "var(--muted)" }}
                >
                  Clear all
                </button>
              )}
              <span className="ml-auto text-[14px]" style={{ color: "var(--muted)" }}>{tblRows.length} alerts</span>
              <Dropdown label={<span className="flex items-center gap-1.5"><Columns3 size={14} strokeWidth={2} /> Columns</span>} align="right" width="w-48">
                <div className="py-1">
                  {COLS.map(([k, label]) => (
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

            <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
              <div className="overflow-x-auto">
                <table className="w-full text-[15px]">
                  <thead>
                    <tr className="text-left text-[13px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
                      <th className="pl-4 pr-2 py-2.5 font-medium">Alert</th>
                      {thBtn("severity", "Severity")}
                      {thBtn("status", "Status")}
                      {thBtn("rootcause", "Root Cause")}
                      {thBtn("service", "Affected Service")}
                      {thBtn("source", "Source")}
                      {thBtn("started", "Started")}
                      {thBtn("updated", "Updated")}
                      <th className="px-2 py-2.5 font-medium text-right pr-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((a) => {
                      const c = clusterOf.get(a.id);
                      const status = mutedIds.has(a.id) ? "suppressed" : a.status;
                      return (
                        <tr
                          key={a.id}
                          onClick={() => setDrawerAlert(a)}
                          className="row-hover border-t border-l-[3px] cursor-pointer"
                          style={{ borderColor: "var(--border)", borderLeftColor: SEV_EDGE[a.severity] || "transparent", opacity: ackedIds.has(a.id) ? 0.6 : 1 }}
                        >
                          <td className="pl-4 pr-2 py-2.5">
                            <div className="flex items-center gap-2">
                              <SeverityDot severity={a.severity} />
                              <div className="min-w-0">
                                <div className="font-medium truncate">{a.alertname}</div>
                                <div className="text-[13px] truncate" style={{ color: "var(--muted)" }}>{a.message}</div>
                              </div>
                            </div>
                          </td>
                          {cols.has("severity") && <td className="px-2 py-2.5"><SeverityBadge severity={a.severity} /></td>}
                          {cols.has("status") && <td className="px-2 py-2.5"><StatusBadge status={status} /></td>}
                          {cols.has("rootcause") && (
                            <td className="px-2 py-2.5">
                              {c ? (
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 text-[14px] truncate">
                                    <AlertIcon alertname={c.root_cause.alertname} severity={c.root_cause.severity} service={c.root_cause.service} />
                                    <span className="truncate">{c.root_cause.service}<br />
                                      <span style={{ color: RISK_EDGE[c.risk.level] }}>{Math.round(c.risk.score * 100)}%</span>
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-[13px]" style={{ color: "var(--muted)" }}>uncorrelated</span>
                              )}
                            </td>
                          )}
                          {cols.has("service") && <td className="px-2 py-2.5" style={{ color: "var(--muted)" }}>{a.service}</td>}
                          {cols.has("source") && <td className="px-2 py-2.5"><SourceTag source={a.source} /></td>}
                          {cols.has("started") && <td className="px-2 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>{timeAgo(a.timestamp)}</td>}
                          {cols.has("updated") && <td className="px-2 py-2.5 whitespace-nowrap" style={{ color: "var(--muted)" }}>{timeAgo(a.timestamp)}</td>}
                          <td className="px-2 py-2.5 text-right pr-3" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-0.5 justify-end">
                              <button title="Open history" onClick={() => setDrawerAlert(a)} className="action-icon w-7 h-7 rounded-lg cursor-pointer flex items-center justify-center" style={{ color: "var(--muted)", "--hc": "var(--info)" }}><ChartLine size={14} strokeWidth={2} /></button>
                              <button title={copiedId === a.id ? "Copied!" : "Copy link"} onClick={() => copyLink(a)} className="action-icon w-7 h-7 rounded-lg cursor-pointer flex items-center justify-center" style={{ color: copiedId === a.id ? "var(--ok)" : "var(--muted)", "--hc": "var(--accent)" }}>
                                {copiedId === a.id ? <Check size={14} strokeWidth={2.25} /> : <Link2 size={14} strokeWidth={2} />}
                              </button>
                              <button title="Suppress" onClick={() => setMutedIds((p) => new Set(p).add(a.id))} className="action-icon w-7 h-7 rounded-lg cursor-pointer flex items-center justify-center" style={{ color: "var(--muted)", "--hc": "var(--critical)" }}><BellOff size={14} strokeWidth={2} /></button>
                              <Dropdown chrome={false} align="right" width="w-44" label={<span className="action-icon w-7 h-7 rounded-lg cursor-pointer flex items-center justify-center" style={{ color: "var(--muted)" }}><EllipsisVertical size={14} strokeWidth={2} /></span>}>
                                {(close) => (
                                  <div className="py-1">
                                    <MenuItem icon={<Check size={14} />} onClick={() => { setAckedIds((p) => new Set(p).add(a.id)); close(); }}>Acknowledge</MenuItem>
                                    <MenuItem icon={<BellOff size={14} />} onClick={() => { setMutedIds((p) => new Set(p).add(a.id)); close(); }}>Suppress</MenuItem>
                                    <MenuItem icon={<Link2 size={14} />} onClick={() => { copyLink(a); close(); }}>Copy link</MenuItem>
                                    {c && <MenuItem icon={<Flame size={14} />} onClick={() => { navigate(`/incidents/${c.cluster_id}`); close(); }}>Open incident</MenuItem>}
                                  </div>
                                )}
                              </Dropdown>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pager page={page} setPage={setPage} total={tblRows.length} perPage={perPage} setPerPage={setPerPage} />
            </div>
          </>
        )}

        {tab === "groups" && clusters.map((c) => <ClusterCard key={c.cluster_id} cluster={c} />)}

        {tab === "timeline" && (
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
            {[...alerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 40).map((a) => (
              <div key={a.id} className="flex items-center gap-3 py-1.5 border-b text-[14px]" style={{ borderColor: "var(--border)" }}>
                <span className="font-mono text-[13px] w-14 shrink-0" style={{ color: "var(--muted)" }}>{a.timestamp.slice(11, 16)}</span>
                <SeverityDot severity={a.severity} />
                <span className="font-medium w-44 truncate">{a.service}</span>
                <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>{a.alertname}: {a.message}</span>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}

        {tab === "insights" && (
          <div className="grid md:grid-cols-2 gap-3">
            {clusters.map((c) => (
              <div key={c.cluster_id} className="rounded-xl border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-md flex items-center justify-center text-[13px] font-bold" style={{ background: "var(--grad)", color: "#fff" }}>AI</span>
                  <span className="font-semibold text-[15px]">{c.root_cause.service} / {c.root_cause.alertname}</span>
                  <PriorityBadge severity={c.root_cause.severity} riskLevel={c.risk.level} />
                </div>
                <p className="text-[14px] leading-relaxed mb-2" style={{ color: "var(--muted)" }}>{c.summary}</p>
                {c.dna_match ? (
                  <p className="text-[14px] flex items-start gap-1.5" style={{ color: "var(--muted)" }}>
                    <Dna size={14} strokeWidth={2} className="mt-0.5 shrink-0" style={{ color: "var(--purple)" }} />
                    <span><b style={{ color: "var(--purple)" }}>{c.dna_match.similarity_pct}% match</b> to {c.dna_match.incident_id} — last fix: {c.dna_match.resolution}
                    <span style={{ color: "var(--ok)" }}> ({c.dna_match.resolution_minutes} min)</span></span>
                  </p>
                ) : (
                  <p className="text-[14px] flex items-center gap-1.5" style={{ color: "var(--high)" }}><Dna size={14} strokeWidth={2} /> Novel pattern — no match in the incident library.</p>
                )}
                <button onClick={() => navigate(`/incidents/${c.cluster_id}`)} className="mt-2 text-[14px] cursor-pointer" style={{ color: "var(--purple)" }}>
                  View full analysis →
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {aiOpen ? (
        <div className="p-5 pl-0 h-full overflow-hidden hidden min-[1360px]:block">
          <AiPanel cluster={cards[0] || clusters[0]} onClose={() => setAiOpen(false)} />
        </div>
      ) : (
        <button
          onClick={() => setAiOpen(true)}
          title="Open AI Assistant"
          className="fixed right-0 top-1/2 -translate-y-1/2 px-1.5 py-3 rounded-l-lg border cursor-pointer text-[15px] hidden min-[1360px]:block"
          style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--muted)" }}
        >
          ‹
        </button>
      )}

      {drawerAlert && <AlertDrawer alert={drawerAlert} data={data} onClose={() => setDrawerAlert(null)} />}
    </div>
  );
}
