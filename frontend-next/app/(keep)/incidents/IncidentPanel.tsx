"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  HiCheckCircle,
  HiOutlineArrowTopRightOnSquare,
  HiOutlineBolt,
  HiOutlineCircleStack,
  HiOutlineClipboard,
  HiOutlineExclamationTriangle,
  HiOutlineMinusCircle,
  HiOutlineServerStack,
  HiOutlineSparkles,
} from "react-icons/hi2";
import {
  useCorrelationExplanation,
  usePlaybook,
  useRootCauseConfidence,
} from "@/entities/alertlens";
import type { Alert, Cluster } from "@/entities/alertlens";
import { AlertDetailDrawer } from "@/entities/alertlens/ui/AlertDetailDrawer";
import { formatTimestamp, timeAgo } from "@/entities/alertlens/lib/format";

type Tab = "overview" | "correlation" | "evidence" | "timeline" | "severity" | "playbook";

const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["correlation", "Correlation"],
  ["evidence", "Evidence"],
  ["timeline", "Timeline"],
  ["severity", "Severity"],
  ["playbook", "Playbook"],
];

const SEVERITY_PILL: Record<string, string> = {
  critical: "bg-red-50 text-red-600 ring-red-100",
  high: "bg-orange-50 text-orange-600 ring-orange-100",
  medium: "bg-yellow-50 text-yellow-700 ring-yellow-100",
  low: "bg-green-50 text-green-700 ring-green-100",
  info: "bg-blue-50 text-blue-600 ring-blue-100",
};
const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-yellow-500",
  low: "bg-green-500",
  info: "bg-blue-500",
};
const SEVERITY_ORDER = ["critical", "high", "medium", "low", "info"];
const RISK_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f97316", low: "#3b82f6" };
const SIGNAL_CAP = 6;

const clockOf = (ts: string) => ts.slice(11, 19) || formatTimestamp(ts);

const offsetLabel = (sec: number) => {
  if (sec <= 0) return "same second";
  if (sec < 60) return `+${Math.round(sec)}s`;
  if (sec < 3600) return `+${Math.floor(sec / 60)}m`;
  return `+${Math.floor(sec / 3600)}h`;
};

export function IncidentPanel({ cluster, status }: { cluster: Cluster; status: string }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [alert, setAlert] = useState<Alert | null>(null);
  const [copied, setCopied] = useState(false);
  const id = cluster.cluster_id;

  const { data: correlation } = useCorrelationExplanation(id);
  const { data: confidence } = useRootCauseConfidence(id);
  const { data: playbook } = usePlaybook(id);

  const sorted = useMemo(
    () => [...cluster.alerts].sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    [cluster.alerts]
  );

  /** Each service with when it first fired and how many alerts it contributed -
   * a real propagation order, not an assumed dependency chain. */
  const cascade = useMemo(() => {
    const t0 = new Date(sorted[0]?.timestamp ?? cluster.root_cause.timestamp).getTime();
    const byService = new Map<string, { first: number; count: number; worst: string }>();
    for (const a of sorted) {
      const cur = byService.get(a.service);
      const at = new Date(a.timestamp).getTime();
      if (!cur) byService.set(a.service, { first: at, count: 1, worst: a.severity });
      else {
        cur.count += 1;
        if (SEVERITY_ORDER.indexOf(a.severity) < SEVERITY_ORDER.indexOf(cur.worst)) cur.worst = a.severity;
      }
    }
    return [...byService.entries()]
      .map(([service, v]) => ({ service, ...v, offset: (v.first - t0) / 1000 }))
      .sort((a, b) => a.first - b.first);
  }, [sorted, cluster.root_cause.timestamp]);

  const rootNode = cascade.find((c) => c.service === cluster.root_cause.service) ?? cascade[0];
  const downstream = cascade.filter((c) => c.service !== rootNode?.service);

  const severityCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of cluster.alerts) m.set(a.severity, (m.get(a.severity) ?? 0) + 1);
    return SEVERITY_ORDER.filter((s) => m.get(s)).map((s) => ({ severity: s, count: m.get(s)! }));
  }, [cluster.alerts]);

  const risk = Math.round(cluster.risk.score * 100);
  const sev = cluster.root_cause.severity;

  const copySteps = async () => {
    const steps = (playbook?.steps ?? []).map((s, i) => `${i + 1}. ${s.title} — ${s.description}`);
    if (!steps.length) return;
    try {
      await navigator.clipboard.writeText(steps.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-gray-50/60 flex flex-col min-w-0 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="p-5 bg-white border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-gray-500 tracking-wide">#{id}</span>
          <span className={clsx("text-[11px] font-semibold px-2 py-0.5 rounded-md ring-1 capitalize", SEVERITY_PILL[sev] ?? "bg-gray-50 text-gray-600 ring-gray-100")}>
            {sev}
          </span>
          <Link
            href={`/incidents/${id}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold px-3.5 py-2 shadow-sm transition-colors"
          >
            Open full incident <HiOutlineArrowTopRightOnSquare size={13} />
          </Link>
        </div>

        <div className="flex items-start gap-3 mt-3">
          <span className="w-11 h-11 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <HiOutlineExclamationTriangle size={22} />
          </span>
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-gray-900 break-words leading-tight">
              {cluster.root_cause.alertname}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              {cluster.root_cause.service}
              {downstream.length > 0 && <> causing issues across {downstream.length} downstream service(s)</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap mt-4">
          {playbook?.priority && <Chip tone="amber">{playbook.priority}</Chip>}
          <Chip tone="red">
            Risk <b className="font-bold">{risk}%</b>
          </Chip>
          {correlation && (
            <Chip tone="green">
              Confidence <b className="font-bold">{correlation.confidence_pct}%</b>
            </Chip>
          )}
          <Chip>{cascade.length} Services</Chip>
          <Chip>
            {cluster.size} Signals <span className="text-gray-400 font-normal">({cluster.raw_alert_count} collapsed)</span>
          </Chip>
          <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] font-semibold text-red-600">
            <span className={clsx("w-1.5 h-1.5 rounded-full", status === "Open" ? "bg-red-500" : status === "Investigating" ? "bg-orange-500" : "bg-blue-500")} />
            {status}
          </span>
        </div>

        <div className="flex gap-4 mt-4 -mb-5 overflow-x-auto">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                "text-[13px] pb-2.5 border-b-2 -mb-px font-medium whitespace-nowrap transition-colors",
                tab === key
                  ? "border-green-600 text-green-700"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4 flex flex-col gap-4">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <Card title="Root Cause (AI)">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                    <HiOutlineCircleStack size={19} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-gray-900 break-words">
                      {cluster.root_cause.service}
                    </div>
                    <div className="text-xs text-gray-500 mt-1 break-words line-clamp-3">
                      {cluster.root_cause.message || cluster.root_cause.alertname}
                    </div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-gray-50 border border-gray-100 px-3 py-2 text-xs font-medium text-gray-700">
                  {cluster.size} of {cluster.raw_alert_count} signals · first at {clockOf(cluster.root_cause.timestamp)}
                </div>
              </Card>

              <Card title="Why this incident?" tint="green">
                {correlation ? (
                  <ul className="flex flex-col gap-2">
                    {correlation.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                        {r.ok ? (
                          <HiCheckCircle className="text-green-500 shrink-0 mt-px" size={15} />
                        ) : (
                          <HiOutlineMinusCircle className="text-gray-300 shrink-0 mt-px" size={15} />
                        )}
                        <span className="break-words leading-snug">{r.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Loading />
                )}
              </Card>

              <Card title="Correlation confidence">
                {correlation ? (
                  <>
                    <div className="text-3xl font-bold text-gray-900 leading-none">
                      {correlation.confidence_pct}%
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3 mb-3.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-green-400 to-green-600"
                        style={{ width: `${correlation.confidence_pct}%` }}
                      />
                    </div>
                    <dl className="flex flex-col gap-1.5">
                      {correlation.factors.map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-2 text-xs">
                          <dt className="text-gray-500 truncate" title={f.detail}>{f.label}</dt>
                          <dd className="font-bold text-gray-900 tabular-nums">{f.score.toFixed(2)}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <Loading />
                )}
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card title="Service Impact Graph">
                {rootNode ? (
                  <>
                    <div className="flex flex-col items-center pt-1">
                      <GraphNode
                        name={rootNode.service}
                        role="Root cause"
                        count={rootNode.count}
                        severity={rootNode.worst}
                        primary
                      />
                      {downstream.length > 0 && (
                        <>
                          <Connector />
                          <div className="flex justify-center w-full">
                            {downstream.map((d, i) => (
                              <div
                                key={d.service}
                                className="relative flex justify-center px-1.5 pt-5 min-w-0"
                              >
                                {/* horizontal bus across siblings */}
                                {downstream.length > 1 && (
                                  <span
                                    className={clsx(
                                      "absolute top-0 h-px bg-gray-300",
                                      i === 0
                                        ? "left-1/2 right-0"
                                        : i === downstream.length - 1
                                          ? "left-0 right-1/2"
                                          : "left-0 right-0"
                                    )}
                                  />
                                )}
                                {/* drop line + arrowhead */}
                                <span className="absolute top-0 left-1/2 w-px h-4 bg-gray-300" />
                                <span className="absolute top-[15px] left-1/2 -translate-x-1/2 w-0 h-0 border-x-[3.5px] border-x-transparent border-t-[5px] border-t-gray-300" />
                                <GraphNode
                                  name={d.service}
                                  role={offsetLabel(d.offset)}
                                  count={d.count}
                                  severity={d.worst}
                                />
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-4 text-center">
                      Branches are ordered by each service&apos;s real first-alert time in this incident.
                    </p>
                  </>
                ) : (
                  <Loading />
                )}
              </Card>

              <Card
                title={`Related Signals (${cluster.size})`}
                action={
                  cluster.size > SIGNAL_CAP ? (
                    <button onClick={() => setTab("timeline")} className="text-xs font-semibold text-green-700 hover:underline">
                      View all →
                    </button>
                  ) : undefined
                }
              >
                <ul className="flex flex-col">
                  {sorted.slice(0, SIGNAL_CAP).map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => setAlert(a)}
                        className="w-full text-left flex items-center gap-2.5 text-xs py-1.5 px-1.5 rounded-lg hover:bg-green-50/70 transition-colors"
                      >
                        <span className={clsx("w-2 h-2 rounded-full shrink-0", SEVERITY_DOT[a.severity] ?? "bg-gray-300")} />
                        <span className="font-mono text-[11px] text-gray-400 shrink-0">{clockOf(a.timestamp)}</span>
                        <span className="text-gray-700 truncate flex-1">{a.alertname}</span>
                        <span className="text-[11px] text-gray-400 shrink-0 truncate max-w-[90px]">{a.service}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card
                title={
                  correlation?.excluded.length
                    ? `Considered & Excluded (${correlation.excluded.length})`
                    : "Considered & Excluded"
                }
              >
                {correlation && correlation.excluded.length > 0 ? (
                  <div className="flex flex-col gap-2.5">
                    {correlation.excluded.map((e) => (
                      <div key={e.id} className="rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                        <div className="flex items-start gap-2.5">
                          <span className="w-9 h-9 rounded-lg bg-white border border-gray-200 text-gray-400 flex items-center justify-center shrink-0">
                            <HiOutlineServerStack size={16} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-semibold text-gray-800 break-words">{e.alertname}</div>
                            <ul className="mt-1.5 flex flex-col gap-1">
                              {e.reasons.map((r, i) => (
                                <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-500">
                                  <span className="w-1 h-1 rounded-full bg-gray-300 shrink-0 mt-1.5" />
                                  <span className="break-words">{r}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2.5">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-gray-200/70 text-gray-600">
                            Excluded
                          </span>
                          <span className="text-[10px] text-gray-400">distance {e.distance.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-400">
                    No near-miss alerts: everything else sat well outside this incident&apos;s boundary.
                  </p>
                )}
              </Card>

              <div className="flex flex-col gap-4">
                <Card
                  title="Incident Summary (AI)"
                  action={
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-green-700 bg-green-50 ring-1 ring-green-100 rounded-full px-2 py-0.5">
                      <HiOutlineSparkles size={11} /> Generated from verified facts
                    </span>
                  }
                >
                  <p className="text-xs text-gray-600 leading-relaxed break-words">{cluster.summary}</p>
                  {cluster.dna_match && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 mt-2.5">
                      <div className="text-[11px] font-semibold text-blue-700">
                        Resembles {cluster.dna_match.incident_id} ({cluster.dna_match.similarity_pct}% similar)
                      </div>
                      {cluster.dna_match.resolution && (
                        <div className="text-[11px] text-blue-800 mt-0.5">
                          Previous fix: {cluster.dna_match.resolution}
                        </div>
                      )}
                    </div>
                  )}
                </Card>

                <Card title="Suggested Next Steps">
                  {playbook ? (
                    <>
                      <ol className="flex flex-col gap-2">
                        {playbook.steps.slice(0, 3).map((s, i) => (
                          <li key={s.step_number} className="flex items-start gap-2.5 text-xs">
                            <span className="text-gray-400 font-medium shrink-0">{i + 1}.</span>
                            <span className="text-gray-700 break-words leading-snug">{s.title}</span>
                          </li>
                        ))}
                      </ol>
                      <div className="flex items-center justify-between gap-2 mt-3">
                        {playbook.steps.length > 3 ? (
                          <button onClick={() => setTab("playbook")} className="text-xs font-semibold text-green-700 hover:underline">
                            All {playbook.steps.length} steps →
                          </button>
                        ) : (
                          <span />
                        )}
                        <button
                          onClick={copySteps}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 hover:text-green-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm transition-colors"
                        >
                          <HiOutlineClipboard size={12} /> {copied ? "Copied" : "Copy"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <Loading />
                  )}
                </Card>
              </div>
            </div>
          </>
        )}

        {tab === "correlation" && (
          <Card title="How this group was formed">
            {correlation ? (
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {correlation.factors.map((f) => (
                    <div key={f.key} className="rounded-xl bg-green-50 border border-green-100 px-3 py-2.5">
                      <div className="text-lg font-bold text-green-800 leading-none">{f.score.toFixed(2)}</div>
                      <div className="text-[10px] text-gray-500 mt-1.5">{f.label}</div>
                    </div>
                  ))}
                </div>
                <ul className="flex flex-col gap-2">
                  {correlation.factors.map((f) => (
                    <li key={f.key} className="text-xs text-gray-600">
                      <span className="font-semibold text-gray-800">{f.label}:</span> {f.detail}
                    </li>
                  ))}
                </ul>
                <div className="rounded-xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-600">
                  <div className="font-semibold text-gray-800 mb-1 flex items-center gap-1.5">
                    <HiOutlineBolt size={13} className="text-gray-400" /> Engine parameters
                  </div>
                  eps {correlation.params.eps.toFixed(2)} · min_samples {correlation.params.min_samples} · time scale{" "}
                  {correlation.params.time_scale_min} min · time penalty {correlation.params.time_penalty ?? "-"}
                  <div className="text-[11px] text-gray-400 mt-1">
                    Grid-searched against ground truth; see the Rules page.
                  </div>
                </div>
              </div>
            ) : (
              <Loading />
            )}
          </Card>
        )}

        {tab === "evidence" && (
          <Card title="Root-cause candidates">
            {confidence ? (
              <div className="flex flex-col gap-2.5">
                {confidence.candidates.map((c) => (
                  <div
                    key={c.service}
                    className={clsx(
                      "rounded-xl border p-3.5",
                      c.is_selected ? "border-green-200 bg-green-50/60" : "border-gray-100 bg-gray-50/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-bold text-gray-900 break-words">{c.service}</span>
                      <span className={clsx("text-sm font-bold", c.is_selected ? "text-green-700" : "text-gray-400")}>
                        {c.confidence}%
                      </span>
                    </div>
                    <ul className="mt-2 flex flex-col gap-1">
                      {c.explanation.map((e, i) => (
                        <li key={i} className="text-[11px] text-gray-600 break-words">{e}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <Loading />
            )}
          </Card>
        )}

        {tab === "timeline" && (
          <Card title={`All signals (${cluster.size})`}>
            <ol className="flex flex-col">
              {sorted.map((a, i) => (
                <li key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center pt-1.5">
                    <span className={clsx("w-2.5 h-2.5 rounded-full shrink-0 ring-4 ring-white", SEVERITY_DOT[a.severity] ?? "bg-gray-300")} />
                    {i < sorted.length - 1 && <span className="w-px flex-1 bg-gray-200 min-h-[18px]" />}
                  </div>
                  <button onClick={() => setAlert(a)} className="text-left pb-3.5 min-w-0 flex-1 group">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-gray-400">{clockOf(a.timestamp)}</span>
                      <span className={clsx("text-[10px] px-1.5 rounded-md capitalize font-medium", SEVERITY_PILL[a.severity] ?? "bg-gray-100 text-gray-600")}>
                        {a.severity}
                      </span>
                    </div>
                    <div className="text-xs text-gray-800 group-hover:text-green-700 break-words mt-0.5">{a.alertname}</div>
                    <div className="text-[11px] text-gray-400">{a.service} · {timeAgo(a.timestamp)}</div>
                  </button>
                </li>
              ))}
            </ol>
          </Card>
        )}

        {tab === "severity" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card title="Severity mix">
              <ul className="flex flex-col gap-3">
                {severityCounts.map((s) => (
                  <li key={s.severity}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-2">
                        <span className={clsx("w-2 h-2 rounded-full", SEVERITY_DOT[s.severity])} />
                        <span className="capitalize text-gray-600">{s.severity}</span>
                      </span>
                      <span className="text-gray-900 font-bold">
                        {s.count}{" "}
                        <span className="text-gray-400 font-normal">({Math.round((100 * s.count) / cluster.size)}%)</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-1.5">
                      <div
                        className={clsx("h-full rounded-full", SEVERITY_DOT[s.severity])}
                        style={{ width: `${(100 * s.count) / cluster.size}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
            <Card title="Risk breakdown">
              <div className="text-3xl font-bold text-gray-900 leading-none">{risk}%</div>
              <div className="text-xs text-gray-400 mt-1.5 capitalize">{cluster.risk.level} risk of escalation</div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${risk}%`, background: RISK_COLOR[cluster.risk.level] ?? "#9ca3af" }}
                />
              </div>
              <dl className="flex flex-col gap-2 mt-4 text-xs">
                <Row label="Signals" value={`${cluster.size} (${cluster.raw_alert_count} raw)`} />
                <Row label="Services" value={String(cascade.length)} />
                <Row label="Triage time saved" value={`~${cluster.est_triage_minutes_saved}m`} />
              </dl>
            </Card>
          </div>
        )}

        {tab === "playbook" && (
          <Card
            title="Suggested next steps"
            action={
              playbook?.steps?.length ? (
                <button
                  onClick={copySteps}
                  className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-gray-600 hover:text-green-700 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 shadow-sm"
                >
                  <HiOutlineClipboard size={12} /> {copied ? "Copied" : "Copy"}
                </button>
              ) : undefined
            }
          >
            {playbook ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Chip tone="amber">{playbook.priority}</Chip>
                  <span>Est. {playbook.estimated_resolution}</span>
                </div>
                <ol className="flex flex-col gap-2.5">
                  {playbook.steps.map((s) => (
                    <li key={s.step_number} className="rounded-xl border border-gray-100 bg-gray-50/40 p-3.5">
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-green-100 text-green-700 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {s.step_number}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-gray-900 break-words">{s.title}</div>
                          <div className="text-[11px] text-gray-600 mt-1 break-words leading-relaxed">{s.description}</div>
                          {s.estimated_duration && (
                            <div className="text-[11px] text-gray-400 mt-1.5">~{s.estimated_duration}</div>
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <Loading />
            )}
          </Card>
        )}
      </div>

      <AlertDetailDrawer alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}

function Card({
  title,
  action,
  tint,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  tint?: "green";
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl border p-4 min-w-0 shadow-sm",
        tint === "green" ? "border-green-100 bg-green-50/50" : "border-gray-200 bg-white"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex flex-col items-center">
      <span className="w-px h-5 bg-gray-300" />
    </div>
  );
}

function GraphNode({
  name,
  role,
  count,
  severity,
  primary,
}: {
  name: string;
  role: string;
  count: number;
  severity: string;
  primary?: boolean;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border px-3 py-2.5 min-w-[130px] max-w-full shadow-sm",
        primary ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "w-6 h-6 rounded-lg flex items-center justify-center shrink-0",
            primary ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
          )}
        >
          {primary ? <HiOutlineCircleStack size={13} /> : <HiOutlineExclamationTriangle size={13} />}
        </span>
        <span className="text-xs font-bold text-gray-900 truncate">{name}</span>
      </div>
      <div className={clsx("text-[10px] mt-1.5 font-medium", primary ? "text-red-600" : "text-amber-700")}>
        {role}
      </div>
      <div className="text-[10px] text-gray-400 flex items-center gap-1 mt-0.5">
        <span className={clsx("w-1.5 h-1.5 rounded-full", SEVERITY_DOT[severity] ?? "bg-gray-300")} />
        {count} alert{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function Chip({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-white text-gray-600 ring-gray-200",
    green: "bg-green-50 text-green-700 ring-green-200",
    red: "bg-red-50 text-red-600 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    gray: "bg-gray-100 text-gray-600 ring-gray-200",
  };
  return (
    <span className={clsx("text-[11px] font-medium px-2.5 py-1 rounded-lg ring-1 whitespace-nowrap", tones[tone] ?? tones.slate)}>
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-gray-800 font-semibold">{value}</dd>
    </div>
  );
}

function Loading() {
  return <div className="text-xs text-gray-400">Loading…</div>;
}
