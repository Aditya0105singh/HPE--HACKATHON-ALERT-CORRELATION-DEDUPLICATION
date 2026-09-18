"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import clsx from "clsx";
import {
  HiOutlineArrowRight,
  HiOutlineBell,
  HiOutlineCheckCircle,
  HiOutlineChevronRight,
  HiOutlineDocumentText,
  HiOutlineExclamationTriangle,
  HiOutlineInbox,
  HiOutlineMinusCircle,
  HiOutlineShare,
  HiOutlineShieldCheck,
  HiOutlineSparkles,
} from "react-icons/hi2";
import { AiOutlineAlert } from "react-icons/ai";
import { EmptyStateCard, KeepLoader } from "@/shared/ui";
import { useEvaluation, usePipelineActions, usePipelineState, useSettingsStatus } from "@/entities/alertlens";
import type { Cluster } from "@/entities/alertlens";
import { DataSourceButtons } from "@/entities/alertlens/ui/DataSourceMenu";
import { StormMenu } from "@/entities/alertlens/ui/StormControls";
import { timeAgo } from "@/entities/alertlens/lib/format";
import { IncidentDrawer } from "./IncidentDrawer";

// ---------------------------------------------------------------------------
// Everything below is derived from the real pipeline / settings responses.
// ---------------------------------------------------------------------------

type IncidentStatus = "Open" | "Investigating" | "Resolved";

function deriveStatus(cluster: Cluster): IncidentStatus {
  const root = cluster.root_cause;
  if (root.dismissed) return "Resolved";
  if (root.escalated || (root.assignee && root.assignee !== "n/a")) return "Investigating";
  return "Open";
}

const STATUS_STYLE: Record<IncidentStatus, { pill: string; dot: string }> = {
  Open: { pill: "text-red-600 bg-red-50", dot: "bg-red-500" },
  Investigating: { pill: "text-orange-600 bg-orange-50", dot: "bg-orange-500" },
  Resolved: { pill: "text-blue-600 bg-blue-50", dot: "bg-blue-500" },
};

const SEVERITY_COLOR: Record<string, string> = {
  critical: "#ef4444",
  high: "#f97316",
  medium: "#eab308",
  low: "#22c55e",
  info: "#3b82f6",
};
const severityColor = (s: string) => SEVERITY_COLOR[s] ?? "#9ca3af";
const RISK_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f97316", low: "#3b82f6" };
const RISK_LEVELS = ["high", "medium", "low"];

function lastSeen(cluster: Cluster): string {
  const stamps = cluster.alerts.map((a) => a.timestamp).sort();
  return stamps[stamps.length - 1] ?? cluster.root_cause.timestamp;
}

function fmtBucket(ms: number, span: number): string {
  const d = new Date(ms);
  const p2 = (n: number) => String(n).padStart(2, "0");
  if (span <= 24 * 3600000) return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
  return `${p2(d.getMonth() + 1)}-${p2(d.getDate())} ${p2(d.getHours())}h`;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

// ---------------------------------------------------------------------------

export function HomeClient() {
  const { data: session } = useSession();
  const { state, isLoading, error } = usePipelineState();
  const { data: status } = useSettingsStatus();
  const { data: evaluation } = useEvaluation();
  const [riskFilter, setRiskFilter] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const { loadBgl } = usePipelineActions();
  const autoLoaded = useRef(false);

  // First visit with nothing loaded: load the BGL sample once instead of
  // leaving a blank page. Only when the backend truly reports no dataset.
  const nothingLoaded = !isLoading && !state.dedup_stats && status?.dataset === "none";
  useEffect(() => {
    if (!nothingLoaded || autoLoaded.current) return;
    autoLoaded.current = true;
    loadBgl().catch(() => {});
  }, [nothingLoaded, loadBgl]);

  const alerts = state.raw_alerts;
  const clusters = state.clusters;

  const summary = useMemo(() => {
    const raw = state.dedup_stats?.raw_count ?? alerts.length;
    const unique = state.dedup_stats?.unique_count ?? alerts.length;
    const noise = raw ? Math.round(1000 * (1 - clusters.length / raw)) / 10 : 0;
    return { raw, unique, noise };
  }, [state.dedup_stats, alerts.length, clusters.length]);

  // Arrival volume over the whole batch, split into alerts that ended up in an
  // incident (correlated) vs everything ingested. The bucket width adapts to
  // the batch's span (minutes for a short batch, hours for a multi-day one) and
  // empty buckets are kept so quiet stretches between bursts stay visible.
  const buckets = useMemo(() => {
    if (!alerts.length) return [] as { label: string; total: number; correlated: number }[];
    const clusteredIds = new Set(clusters.flatMap((c) => c.alerts.map((a) => a.id)));
    const points = alerts.map((a) => ({ t: new Date(a.timestamp).getTime(), corr: clusteredIds.has(a.id) }));
    const min = Math.min(...points.map((p) => p.t));
    const max = Math.max(...points.map((p) => p.t));
    const span = Math.max(max - min, 1);
    const widths = [1, 5, 15, 30, 60, 180, 360, 720, 1440].map((m) => m * 60000);
    const width = widths.find((w) => span / w <= 30) ?? widths[widths.length - 1];
    const start = Math.floor(min / width) * width;
    const count = Math.floor((max - start) / width) + 1;
    const out = Array.from({ length: count }, (_, i) => ({
      label: fmtBucket(start + i * width, span),
      total: 0,
      correlated: 0,
    }));
    for (const p of points) {
      const b = out[Math.floor((p.t - start) / width)];
      b.total += 1;
      if (p.corr) b.correlated += 1;
    }
    return out;
  }, [alerts, clusters]);

  const severityCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts) counts.set(a.severity, (counts.get(a.severity) ?? 0) + 1);
    const order = ["critical", "high", "medium", "low", "info"];
    const rank = (s: string) => (order.includes(s) ? order.indexOf(s) : order.length);
    return [...counts.entries()]
      .map(([severity, count]) => ({ severity, count }))
      .sort((a, b) => rank(a.severity) - rank(b.severity));
  }, [alerts]);

  const topServices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts) counts.set(a.service, (counts.get(a.service) ?? 0) + 1);
    return [...counts.entries()]
      .map(([service, count]) => ({ service, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [alerts]);

  const insights = useMemo(() => {
    const items: { icon: React.ElementType; tone: string; title: string; body: string; href: string }[] = [];
    const top = [...clusters].sort((a, b) => b.risk.score - a.risk.score)[0];
    if (top) {
      items.push({
        icon: HiOutlineExclamationTriangle,
        tone: "bg-orange-50 text-orange-600",
        title: `Highest risk: ${top.root_cause.alertname}`,
        body: `${Math.round(top.risk.score * 100)}% escalation risk on ${top.root_cause.service}`,
        href: `/incidents/${top.cluster_id}`,
      });
    }
    items.push({
      icon: HiOutlineShieldCheck,
      tone: "bg-green-50 text-green-600",
      title: `Noise reduced by ${summary.noise}%`,
      body: `${summary.raw} raw alerts became ${clusters.length} incident${clusters.length === 1 ? "" : "s"}`,
      href: "/correlations",
    });
    const matched = clusters.filter((c) => c.dna_match);
    if (matched.length) {
      const best = [...matched].sort(
        (a, b) => (b.dna_match?.similarity_pct ?? 0) - (a.dna_match?.similarity_pct ?? 0)
      )[0];
      items.push({
        icon: HiOutlineSparkles,
        tone: "bg-blue-50 text-blue-600",
        title: `${matched.length} incident${matched.length === 1 ? "" : "s"} match past ones`,
        body: `Best match ${best.dna_match?.incident_id} (${best.dna_match?.similarity_pct}% similar)`,
        href: `/timemachine/${best.cluster_id}`,
      });
    } else {
      items.push({
        icon: HiOutlineSparkles,
        tone: "bg-gray-100 text-gray-500",
        title: "No historical matches",
        body: "No incident resembles a past one yet",
        href: "/timemachine",
      });
    }
    return items;
  }, [clusters, summary]);

  const readiness = useMemo(() => {
    const loaded = !!status && status.dataset !== "none" && status.persisted_alert_count > 0;
    return {
      healthy: loaded,
      checks: [
        { label: `Data source (${status?.dataset ?? "none"})`, ok: loaded },
        { label: `Correlation engine (${clusters.length} active)`, ok: loaded },
        {
          label: status?.llm_configured ? `LLM service (${status.llm_provider})` : "LLM service (not configured)",
          ok: !!status?.llm_configured,
        },
        { label: `Notification providers (${status?.provider_count ?? 0})`, ok: (status?.provider_count ?? 0) > 0 },
        { label: `Workflow rules (${status?.workflow_rule_count ?? 0})`, ok: (status?.workflow_rule_count ?? 0) > 0 },
      ],
    };
  }, [status, clusters.length]);

  const triageSaved = useMemo(
    () => Math.round(clusters.reduce((n, c) => n + (c.est_triage_minutes_saved ?? 0), 0)),
    [clusters]
  );

  const visibleClusters = useMemo(
    () =>
      [...clusters]
        .filter((c) => !riskFilter || c.risk.level === riskFilter)
        .sort((a, b) => b.risk.score - a.risk.score),
    [clusters, riskFilter]
  );

  if (isLoading || (nothingLoaded && autoLoaded.current)) {
    return <KeepLoader loadingText={nothingLoaded ? "Loading demo data..." : "Loading overview..."} />;
  }

  if (error) {
    return (
      <div className="p-4">
        <EmptyStateCard icon={AiOutlineAlert} title="Could not load overview" description={String(error)} />
      </div>
    );
  }

  const firstName = session?.user?.name?.split(" ")[0];
  const heading = (
    <div>
      <h1 className="text-2xl font-bold text-gray-900">
        {greeting()}
        {firstName ? `, ${firstName}` : ""}
      </h1>
      <p className="text-sm text-gray-500 mt-1">Turning noisy alerts into clear, actionable incidents.</p>
    </div>
  );

  if (!state.dedup_stats) {
    return (
      <div className="flex flex-col gap-4">
        {heading}
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <EmptyStateCard noCard icon={HiOutlineInbox} title="No alert batch loaded" description="Load one of the datasets below to run the pipeline.">
            <DataSourceButtons />
          </EmptyStateCard>
        </div>
      </div>
    );
  }

  const totalSeverity = severityCounts.reduce((n, s) => n + s.count, 0) || 1;
  const maxBucket = Math.max(1, ...buckets.map((b) => b.total));
  const maxService = Math.max(1, ...topServices.map((s) => s.count));
  const labelEvery = Math.max(1, Math.ceil(buckets.length / 6));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        {heading}
        <div className="flex flex-col items-end gap-2">
          <div className="hidden xl:block rounded-xl border border-green-100 bg-green-50/60 px-4 py-2 text-xs text-green-800 italic">
            &ldquo;Less noise. Faster answers. Happier on-calls.&rdquo;
            <div className="not-italic font-semibold text-green-700 mt-0.5">— AlertLens</div>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <DataSourceButtons />
            <StormMenu />
          </div>
        </div>
      </div>

      {/* Pipeline flow */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr] gap-3 items-center">
        <FlowCard icon={HiOutlineBell} value={summary.raw} label="Raw alerts" spark={buckets.map((b) => b.total)} />
        <FlowArrow />
        <FlowCard icon={HiOutlineShare} value={summary.unique} label="Unique after dedup" spark={buckets.map((b) => b.correlated)} />
        <FlowArrow />
        <FlowCard icon={HiOutlineDocumentText} value={clusters.length} label="Actionable incidents" />
        <FlowArrow />
        <FlowCard icon={HiOutlineShieldCheck} value={`${summary.noise}%`} label="Noise reduction" accent />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_290px] gap-3 items-start">
        <div className="flex flex-col gap-3 min-w-0">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] gap-3">
            {/* Alerts by severity */}
            <Panel title="Alerts by severity">
              <div className="flex items-center gap-4">
                <Donut segments={severityCounts.map((s) => ({ color: severityColor(s.severity), value: s.count }))} total={totalSeverity} />
                <ul className="flex flex-col gap-1.5 text-xs min-w-0">
                  {severityCounts.map((s) => (
                    <li key={s.severity} className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: severityColor(s.severity) }} />
                      <span className="capitalize text-gray-600">{s.severity}</span>
                      <span className="ml-auto font-semibold text-gray-800">{s.count}</span>
                      <span className="text-gray-400 w-9 text-right">({Math.round((100 * s.count) / totalSeverity)}%)</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Panel>

            {/* Alerts over time */}
            <Panel
              title="Alerts over time"
              right={
                <div className="flex items-center gap-3 text-[11px] text-gray-500">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-200" />Ingested</span>
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm bg-green-600" />Correlated</span>
                </div>
              }
            >
              <div className="flex gap-2">
                <div className="flex flex-col justify-between h-32 text-[10px] text-gray-400 text-right pb-4">
                  <span>{maxBucket}</span>
                  <span>{Math.round(maxBucket / 2)}</span>
                  <span>0</span>
                </div>
                <div className="flex-1 relative">
                  <div className="absolute inset-x-0 top-0 h-28 flex flex-col justify-between pointer-events-none">
                    <div className="border-t border-dashed border-gray-100" />
                    <div className="border-t border-dashed border-gray-100" />
                    <div className="border-t border-gray-200" />
                  </div>
                  <div className="relative flex items-end gap-[3px] h-28">
                    {buckets.map((b) => (
                      <div
                        key={b.label}
                        className="flex-1 h-full relative min-w-0"
                        title={`${b.label} — ${b.total} ingested, ${b.correlated} correlated`}
                      >
                        <div className="absolute bottom-0 inset-x-0 rounded-t-sm bg-green-200" style={{ height: `${(b.total / maxBucket) * 100}%` }} />
                        <div className="absolute bottom-0 inset-x-0 rounded-t-sm bg-green-600" style={{ height: `${(b.correlated / maxBucket) * 100}%` }} />
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-[3px] mt-1 h-3">
                    {buckets.map((b, i) => (
                      <span key={b.label} className="flex-1 min-w-0 text-[9px] text-gray-400 whitespace-nowrap overflow-visible">
                        {i % labelEvery === 0 ? b.label : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>

            {/* Top affected services */}
            <Panel title="Top affected services">
              <ul className="flex flex-col gap-2.5">
                {topServices.map((s) => (
                  <li key={s.service} className="text-xs">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-gray-600 truncate">{s.service}</span>
                      <span className="font-semibold text-gray-800">{s.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-green-50 overflow-hidden">
                      <div className="h-full rounded-full bg-green-600" style={{ width: `${(s.count / maxService) * 100}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
              <Link href="/topology" className="inline-flex items-center gap-1 text-xs font-medium text-green-700 hover:underline mt-3">
                View all services <HiOutlineArrowRight size={12} />
              </Link>
            </Panel>
          </div>

          {/* Recent incidents */}
          <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
            <div className="flex items-center justify-between gap-2 flex-wrap p-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-gray-900 text-base mr-1">Recent incidents</span>
                <FilterPill active={riskFilter === null} onClick={() => setRiskFilter(null)}>
                  All {clusters.length}
                </FilterPill>
                {RISK_LEVELS.map((lvl) => (
                  <FilterPill key={lvl} active={riskFilter === lvl} onClick={() => setRiskFilter(riskFilter === lvl ? null : lvl)}>
                    <span className="capitalize">{lvl}</span> {clusters.filter((c) => c.risk.level === lvl).length}
                  </FilterPill>
                ))}
              </div>
              <Link href="/incidents" className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-green-300 hover:text-green-700">
                View all incidents <HiOutlineArrowRight size={12} />
              </Link>
            </div>

            {visibleClusters.length === 0 ? (
              <div className="p-6">
                <EmptyStateCard noCard icon={HiOutlineCheckCircle} title="No incidents match" description="Nothing correlated at this risk level." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] text-gray-400 border-b border-gray-100">
                      <th className="font-medium px-3.5 py-2 w-8">#</th>
                      <th className="font-medium px-3.5 py-2">Incident</th>
                      <th className="font-medium px-3.5 py-2 hidden lg:table-cell">Root cause (AI)</th>
                      <th className="font-medium px-3.5 py-2">Affected services</th>
                      <th className="font-medium px-3.5 py-2">Alerts</th>
                      <th className="font-medium px-3.5 py-2">Risk</th>
                      <th className="font-medium px-3.5 py-2">Status</th>
                      <th className="font-medium px-3.5 py-2 hidden xl:table-cell">Last updated</th>
                      <th className="w-6" />
                    </tr>
                  </thead>
                  <tbody>
                    {visibleClusters.map((c, i) => {
                      const st = deriveStatus(c);
                      const services = [...new Set([c.root_cause.service, ...c.alerts.map((a) => a.service)])];
                      const sev = severityColor(c.root_cause.severity);
                      return (
                        <tr
                          key={c.cluster_id}
                          onClick={() => setOpenId(c.cluster_id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setOpenId(c.cluster_id);
                            }
                          }}
                          tabIndex={0}
                          aria-label={`Open incident ${c.root_cause.alertname}`}
                          className="cursor-pointer border-b border-gray-50 last:border-0 hover:bg-green-50/40 focus:outline-none focus-visible:bg-green-50 transition-colors"
                        >
                          <td className="px-3.5 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex items-center gap-2.5">
                              <span
                                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                                style={{ background: `${sev}1a`, color: sev }}
                              >
                                <HiOutlineExclamationTriangle size={16} />
                              </span>
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate max-w-[170px]">{c.root_cause.alertname}</div>
                                <div className="text-[11px] text-gray-400">#{c.cluster_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 hidden lg:table-cell max-w-[220px]">
                            <div className="text-xs text-gray-500 line-clamp-2">{c.summary || `Root cause on ${c.root_cause.service}.`}</div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {services.slice(0, 2).map((s) => (
                                <span key={s} className="text-[11px] bg-gray-100 text-gray-600 rounded px-1.5 py-0.5">{s}</span>
                              ))}
                              {services.length > 2 && <span className="text-[11px] text-gray-400">+{services.length - 2}</span>}
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5 whitespace-nowrap">
                            <span className="font-semibold text-gray-800">{c.size}</span>
                            <div className="text-[11px] text-gray-400">({c.raw_alert_count} collapsed)</div>
                          </td>
                          <td className="px-3.5 py-2.5 w-32">
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${Math.round(c.risk.score * 100)}%`, background: RISK_COLOR[c.risk.level] ?? "#9ca3af" }} />
                              </div>
                              <span className="text-[11px] text-gray-500 w-8 text-right">{Math.round(c.risk.score * 100)}%</span>
                            </div>
                          </td>
                          <td className="px-3.5 py-2.5">
                            <span className={clsx("inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap", STATUS_STYLE[st].pill)}>
                              <span className={clsx("w-1.5 h-1.5 rounded-full", STATUS_STYLE[st].dot)} />
                              {st}
                            </span>
                          </td>
                          <td className="px-3.5 py-2.5 hidden xl:table-cell text-xs text-gray-400 whitespace-nowrap">{timeAgo(lastSeen(c))}</td>
                          <td className="pr-3 text-gray-300"><HiOutlineChevronRight size={14} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="flex flex-col gap-3">
          <Panel title="AI Insights" icon={<HiOutlineSparkles className="text-green-600" size={16} />}>
            <ul className="flex flex-col gap-2">
              {insights.map((it) => (
                <li key={it.title}>
                  <Link href={it.href} className="flex items-center gap-2.5 rounded-lg border border-gray-100 p-2.5 hover:border-green-200 hover:bg-green-50/40 transition-colors">
                    <span className={clsx("w-7 h-7 rounded-full flex items-center justify-center shrink-0", it.tone)}>
                      <it.icon size={14} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold text-gray-800 truncate">{it.title}</span>
                      <span className="block text-[11px] text-gray-400 line-clamp-2">{it.body}</span>
                    </span>
                    <HiOutlineChevronRight size={13} className="text-gray-300 shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          {evaluation && (
            <Panel
              title="Measured accuracy"
              right={
                <Link href="/evaluation" className="text-[11px] font-medium text-green-700 hover:underline">
                  Details
                </Link>
              }
            >
              <div className="grid grid-cols-2 gap-2">
                <Metric label="Incident detection" value={`${evaluation.incident_detection_pct}%`} />
                <Metric label="Cluster purity" value={`${evaluation.cluster_purity_pct}%`} />
                <Metric label="Noise excluded" value={`${evaluation.noise_excluded_pct}%`} />
                <Metric label="Triage saved" value={`~${triageSaved}m`} />
              </div>
              <p className="text-[11px] text-gray-400 mt-2.5">
                Scored against hidden ground truth over {evaluation.seeds_tested} seeds; the pipeline never reads it.
              </p>
            </Panel>
          )}

          <Panel title="On-call readiness">
            <div
              className={clsx(
                "rounded-lg px-3 py-2 mb-3 flex items-center gap-2 border",
                readiness.healthy ? "bg-green-50 border-green-100" : "bg-gray-50 border-gray-200"
              )}
            >
              {readiness.healthy ? (
                <HiOutlineCheckCircle className="text-green-600" size={18} />
              ) : (
                <HiOutlineMinusCircle className="text-gray-400" size={18} />
              )}
              <div>
                <div className={clsx("text-xs font-semibold", readiness.healthy ? "text-green-800" : "text-gray-600")}>
                  {readiness.healthy ? "System healthy" : "No data loaded"}
                </div>
                <div className="text-[11px] text-gray-500">
                  {readiness.healthy ? "Pipeline has processed alerts" : "Load a dataset to run the pipeline"}
                </div>
              </div>
            </div>
            <ul className="flex flex-col gap-2">
              {readiness.checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2 text-xs text-gray-600">
                  {c.ok ? (
                    <HiOutlineCheckCircle className="text-green-600 shrink-0" size={15} />
                  ) : (
                    <HiOutlineMinusCircle className="text-gray-300 shrink-0" size={15} />
                  )}
                  <span className={c.ok ? "" : "text-gray-400"}>{c.label}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      </div>
      <IncidentDrawer
        cluster={clusters.find((c) => c.cluster_id === openId) ?? null}
        status={(() => {
          const c = clusters.find((x) => x.cluster_id === openId);
          return c ? deriveStatus(c) : "";
        })()}
        onClose={() => setOpenId(null)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------

function Panel({
  title,
  right,
  icon,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm min-w-0">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-1.5 font-semibold text-gray-900 text-sm">
          {icon}
          {title}
        </div>
        {right}
      </div>
      {children}
    </div>
  );
}

function FilterPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors",
        active ? "bg-green-600 text-white" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
      )}
    >
      {children}
    </button>
  );
}

function FlowArrow() {
  return <HiOutlineArrowRight className="hidden lg:block text-green-500 mx-auto" size={18} />;
}

function FlowCard({
  icon: Icon,
  value,
  label,
  spark,
  accent,
}: {
  icon: React.ElementType;
  value: string | number;
  label: string;
  spark?: number[];
  accent?: boolean;
}) {
  const max = spark && spark.length ? Math.max(1, ...spark) : 1;
  return (
    <div className={clsx("rounded-xl border bg-white p-4 shadow-sm flex items-center gap-3 min-w-0", accent ? "border-green-200 bg-green-50/40" : "border-gray-200")}>
      <span className="w-11 h-11 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <div className="text-2xl font-bold text-gray-900 tabular-nums leading-none">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        <div className="text-xs text-gray-500 mt-1 truncate">{label}</div>
      </div>
      {spark && spark.length > 1 && (
        <div className="ml-auto flex items-end gap-[2px] h-9 w-16 shrink-0">
          {spark.slice(-10).map((v, i) => (
            <div key={i} className="flex-1 rounded-[1px] bg-green-300" style={{ height: `${Math.max(10, (v / max) * 100)}%` }} />
          ))}
        </div>
      )}
    </div>
  );
}

function Donut({ segments, total }: { segments: { color: string; value: number }[]; total: number }) {
  const r = 15.9155;
  let offset = 25;
  return (
    <div className="relative w-28 h-28 shrink-0">
      <svg viewBox="0 0 36 36" className="w-full h-full">
        <circle cx="18" cy="18" r={r} fill="none" stroke="#f3f4f6" strokeWidth="5" />
        {segments.map((s, i) => {
          const pct = (100 * s.value) / total;
          const el = (
            <circle
              key={i}
              cx="18"
              cy="18"
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth="5"
              strokeDasharray={`${pct} ${100 - pct}`}
              strokeDashoffset={offset}
            />
          );
          offset -= pct;
          return el;
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-gray-900 leading-none">{total}</span>
        <span className="text-[10px] text-gray-400 mt-0.5">Total alerts</span>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-green-50/60 border border-green-100 px-2.5 py-2">
      <div className="text-base font-bold text-green-800 leading-none">{value}</div>
      <div className="text-[10px] text-gray-500 mt-1">{label}</div>
    </div>
  );
}
