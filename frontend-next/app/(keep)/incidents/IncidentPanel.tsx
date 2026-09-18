"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineCheckCircle,
  HiOutlineClipboard,
  HiOutlineExclamationTriangle,
  HiOutlineMinusCircle,
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

// ISO local timestamp -> HH:MM:SS.
const clockOf = (ts: string) => ts.slice(11, 19) || formatTimestamp(ts);

const offsetLabel = (sec: number) => {
  if (sec <= 0) return "T0";
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
      if (!cur) {
        byService.set(a.service, { first: at, count: 1, worst: a.severity });
      } else {
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
    <div className="rounded-xl border border-gray-200 bg-white flex flex-col min-w-0">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-400">#{id}</span>
          <span className={clsx("text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 capitalize", SEVERITY_PILL[sev] ?? "bg-gray-50 text-gray-600 ring-gray-100")}>
            {sev}
          </span>
          <Link
            href={`/incidents/${id}`}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 transition-colors"
          >
            Open full incident <HiOutlineArrowTopRightOnSquare size={13} />
          </Link>
        </div>

        <div className="flex items-start gap-3 mt-2.5">
          <span
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{
              background: `${RISK_COLOR[cluster.risk.level] ?? "#9ca3af"}1a`,
              color: RISK_COLOR[cluster.risk.level] ?? "#9ca3af",
            }}
          >
            <HiOutlineExclamationTriangle size={20} />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-gray-900 break-words leading-snug">
              {cluster.root_cause.alertname}
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {cluster.root_cause.service}
              {downstream.length > 0 && <> causing issues across {downstream.length} downstream service(s)</>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          {playbook?.priority && <Chip tone="amber">{playbook.priority}</Chip>}
          <Chip tone="red">Risk {risk}%</Chip>
          {correlation && <Chip tone="green">Confidence {correlation.confidence_pct}%</Chip>}
          <Chip>{cascade.length} services</Chip>
          <Chip>
            {cluster.size} signals <span className="text-gray-400">({cluster.raw_alert_count} raw)</span>
          </Chip>
          <Chip tone="gray">
            <span className={clsx("inline-block w-1.5 h-1.5 rounded-full mr-1", status === "Open" ? "bg-red-500" : status === "Investigating" ? "bg-orange-500" : "bg-blue-500")} />
            {status}
          </Chip>
        </div>

        <div className="flex gap-1 mt-3 -mb-4 overflow-x-auto">
          {TABS.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={clsx(
                "text-xs px-3 py-2 border-b-2 -mb-px font-medium whitespace-nowrap transition-colors",
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

      <div className="p-4 pt-5 flex flex-col gap-3">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              <Section title="Root cause (AI)">
                <div className="flex items-start gap-2.5">
                  <span className="w-8 h-8 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                    <HiOutlineExclamationTriangle size={16} />
                  </span>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-gray-900 break-words">
                      {cluster.root_cause.service}
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 break-words line-clamp-3">
                      {cluster.root_cause.message || cluster.root_cause.alertname}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] text-gray-600">
                  Earliest of {cluster.size} signals · {clockOf(cluster.root_cause.timestamp)}
                </div>
              </Section>

              <Section title="Why this incident?" tone="green">
                {correlation ? (
                  <ul className="flex flex-col gap-1.5">
                    {correlation.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-700">
                        {r.ok ? (
                          <HiOutlineCheckCircle className="text-green-600 shrink-0 mt-px" size={13} />
                        ) : (
                          <HiOutlineMinusCircle className="text-gray-300 shrink-0 mt-px" size={13} />
                        )}
                        <span className="break-words">{r.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Loading />
                )}
              </Section>

              <Section title="Correlation confidence">
                {correlation ? (
                  <>
                    <div className="text-2xl font-bold text-gray-900 leading-none">
                      {correlation.confidence_pct}%
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-2 mb-2.5">
                      <div className="h-full rounded-full bg-green-600" style={{ width: `${correlation.confidence_pct}%` }} />
                    </div>
                    <dl className="flex flex-col gap-1">
                      {correlation.factors.map((f) => (
                        <div key={f.key} className="flex items-center justify-between gap-2 text-[11px]">
                          <dt className="text-gray-500 truncate" title={f.detail}>{f.label}</dt>
                          <dd className="font-semibold text-gray-800 tabular-nums">{f.score.toFixed(2)}</dd>
                        </div>
                      ))}
                    </dl>
                  </>
                ) : (
                  <Loading />
                )}
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Section title="Service impact">
                {rootNode ? (
                  <div className="flex flex-col items-center gap-0">
                    <ServiceNode
                      name={rootNode.service}
                      role="Root cause"
                      count={rootNode.count}
                      severity={rootNode.worst}
                      primary
                    />
                    {downstream.length > 0 && (
                      <>
                        <span className="w-px h-4 bg-gray-200" />
                        <span className="text-[10px] text-gray-400 mb-1">
                          then, in order of first alert
                        </span>
                        <div className="flex flex-wrap justify-center gap-2 w-full">
                          {downstream.map((d) => (
                            <ServiceNode
                              key={d.service}
                              name={d.service}
                              role={offsetLabel(d.offset)}
                              count={d.count}
                              severity={d.worst}
                            />
                          ))}
                        </div>
                      </>
                    )}
                    <p className="text-[10px] text-gray-400 mt-3 text-center">
                      Ordering is the real first-alert time per service in this incident.
                    </p>
                  </div>
                ) : (
                  <Loading />
                )}
              </Section>

              <Section
                title={`Related signals (${cluster.size})`}
                right={
                  cluster.size > SIGNAL_CAP ? (
                    <button onClick={() => setTab("timeline")} className="text-[11px] font-medium text-green-700 hover:underline">
                      View all →
                    </button>
                  ) : undefined
                }
              >
                <ul className="flex flex-col gap-0.5">
                  {sorted.slice(0, SIGNAL_CAP).map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => setAlert(a)}
                        className="w-full text-left flex items-center gap-2 text-[11px] py-1 px-1 rounded hover:bg-green-50/60"
                      >
                        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", SEVERITY_DOT[a.severity] ?? "bg-gray-300")} />
                        <span className="font-mono text-gray-400 shrink-0">{clockOf(a.timestamp)}</span>
                        <span className="text-gray-700 truncate flex-1">{a.alertname}</span>
                        <span className="text-gray-400 shrink-0 truncate max-w-[80px]">{a.service}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {correlation && correlation.excluded.length > 0 ? (
                <Section title={`Considered & excluded (${correlation.excluded.length})`}>
                  <div className="flex flex-col gap-2">
                    {correlation.excluded.map((e) => (
                      <div key={e.id} className="rounded-lg border border-gray-100 p-2.5">
                        <div className="flex items-start gap-2">
                          <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0 mt-1.5", SEVERITY_DOT[e.severity] ?? "bg-gray-300")} />
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-medium text-gray-700 break-words">{e.alertname}</div>
                            <ul className="mt-1 flex flex-col gap-0.5">
                              {e.reasons.map((r, i) => (
                                <li key={i} className="text-[10px] text-gray-500 break-words">· {r}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1.5">
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            Excluded
                          </span>
                          <span className="text-[10px] text-gray-400">distance {e.distance.toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              ) : (
                <Section title="Considered & excluded">
                  <p className="text-[11px] text-gray-400">
                    No near-miss alerts: everything else in the batch sat well outside this
                    incident&apos;s boundary.
                  </p>
                </Section>
              )}

              <div className="flex flex-col gap-3">
                <Section
                  title="Incident summary"
                  right={
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                      <HiOutlineSparkles size={11} /> From verified facts
                    </span>
                  }
                >
                  <p className="text-[11px] text-gray-700 leading-relaxed break-words">{cluster.summary}</p>
                  {cluster.dna_match && (
                    <div className="rounded-lg bg-blue-50 border border-blue-100 p-2 mt-2">
                      <div className="text-[10px] font-semibold text-blue-700">
                        Resembles {cluster.dna_match.incident_id} ({cluster.dna_match.similarity_pct}% similar)
                      </div>
                      {cluster.dna_match.resolution && (
                        <div className="text-[10px] text-blue-800 mt-0.5">
                          Previous fix: {cluster.dna_match.resolution}
                        </div>
                      )}
                    </div>
                  )}
                </Section>

                <Section
                  title="Suggested next steps"
                  right={
                    playbook?.steps?.length ? (
                      <button
                        onClick={copySteps}
                        className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 hover:text-green-700 border border-gray-200 rounded px-1.5 py-0.5"
                      >
                        <HiOutlineClipboard size={11} /> {copied ? "Copied" : "Copy"}
                      </button>
                    ) : undefined
                  }
                >
                  {playbook ? (
                    <ol className="flex flex-col gap-1.5">
                      {playbook.steps.slice(0, 3).map((s, i) => (
                        <li key={s.step_number} className="flex items-start gap-2 text-[11px]">
                          <span className="text-gray-400 shrink-0">{i + 1}.</span>
                          <span className="text-gray-700 break-words">{s.title}</span>
                        </li>
                      ))}
                      {playbook.steps.length > 3 && (
                        <li>
                          <button onClick={() => setTab("playbook")} className="text-[11px] font-medium text-green-700 hover:underline">
                            All {playbook.steps.length} steps →
                          </button>
                        </li>
                      )}
                    </ol>
                  ) : (
                    <Loading />
                  )}
                </Section>
              </div>
            </div>
          </>
        )}

        {tab === "correlation" && (
          <Section title="How this group was formed">
            {correlation ? (
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {correlation.factors.map((f) => (
                    <div key={f.key} className="rounded-lg bg-green-50/60 border border-green-100 px-2.5 py-2">
                      <div className="text-base font-bold text-green-800 leading-none">{f.score.toFixed(2)}</div>
                      <div className="text-[10px] text-gray-500 mt-1">{f.label}</div>
                    </div>
                  ))}
                </div>
                <ul className="flex flex-col gap-1.5">
                  {correlation.factors.map((f) => (
                    <li key={f.key} className="text-xs text-gray-600">
                      <span className="font-medium text-gray-800">{f.label}:</span> {f.detail}
                    </li>
                  ))}
                </ul>
                <div className="rounded-lg border border-gray-100 p-3 text-xs text-gray-600">
                  <div className="font-medium text-gray-800 mb-1">Engine parameters</div>
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
          </Section>
        )}

        {tab === "evidence" && (
          <Section title="Root-cause candidates">
            {confidence ? (
              <div className="flex flex-col gap-2">
                {confidence.candidates.map((c) => (
                  <div
                    key={c.service}
                    className={clsx(
                      "rounded-lg border p-3",
                      c.is_selected ? "border-green-200 bg-green-50/50" : "border-gray-100"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-900 break-words">{c.service}</span>
                      <span className={clsx("text-xs font-bold", c.is_selected ? "text-green-700" : "text-gray-400")}>
                        {c.confidence}%
                      </span>
                    </div>
                    <ul className="mt-1.5 flex flex-col gap-0.5">
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
          </Section>
        )}

        {tab === "timeline" && (
          <Section title={`All signals (${cluster.size})`}>
            <ol className="flex flex-col">
              {sorted.map((a, i) => (
                <li key={a.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center pt-1.5">
                    <span className={clsx("w-2 h-2 rounded-full shrink-0", SEVERITY_DOT[a.severity] ?? "bg-gray-300")} />
                    {i < sorted.length - 1 && <span className="w-px flex-1 bg-gray-200 min-h-[18px]" />}
                  </div>
                  <button onClick={() => setAlert(a)} className="text-left pb-3 min-w-0 flex-1 group">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[11px] text-gray-400">{clockOf(a.timestamp)}</span>
                      <span className={clsx("text-[10px] px-1.5 rounded-full capitalize", SEVERITY_PILL[a.severity] ?? "bg-gray-100 text-gray-600")}>
                        {a.severity}
                      </span>
                    </div>
                    <div className="text-xs text-gray-800 group-hover:text-green-700 break-words">{a.alertname}</div>
                    <div className="text-[11px] text-gray-400">{a.service} · {timeAgo(a.timestamp)}</div>
                  </button>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {tab === "severity" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Section title="Severity mix">
              <ul className="flex flex-col gap-2">
                {severityCounts.map((s) => (
                  <li key={s.severity}>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className={clsx("w-2 h-2 rounded-full", SEVERITY_DOT[s.severity])} />
                        <span className="capitalize text-gray-600">{s.severity}</span>
                      </span>
                      <span className="text-gray-800 font-medium">
                        {s.count}{" "}
                        <span className="text-gray-400">({Math.round((100 * s.count) / cluster.size)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                      <div
                        className={clsx("h-full rounded-full", SEVERITY_DOT[s.severity])}
                        style={{ width: `${(100 * s.count) / cluster.size}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </Section>
            <Section title="Risk breakdown">
              <div className="text-2xl font-bold text-gray-900 leading-none">{risk}%</div>
              <div className="text-[11px] text-gray-400 mt-1 capitalize">{cluster.risk.level} risk of escalation</div>
              <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-2">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${risk}%`, background: RISK_COLOR[cluster.risk.level] ?? "#9ca3af" }}
                />
              </div>
              <dl className="flex flex-col gap-1 mt-3 text-[11px]">
                <Row label="Signals" value={`${cluster.size} (${cluster.raw_alert_count} raw)`} />
                <Row label="Services" value={String(cascade.length)} />
                <Row label="Triage time saved" value={`~${cluster.est_triage_minutes_saved}m`} />
              </dl>
            </Section>
          </div>
        )}

        {tab === "playbook" && (
          <Section
            title="Suggested next steps"
            right={
              playbook?.steps?.length ? (
                <button
                  onClick={copySteps}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-green-700 border border-gray-200 rounded-lg px-2 py-1"
                >
                  <HiOutlineClipboard size={12} /> {copied ? "Copied" : "Copy"}
                </button>
              ) : undefined
            }
          >
            {playbook ? (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Chip tone="amber">{playbook.priority}</Chip>
                  <span>Est. {playbook.estimated_resolution}</span>
                </div>
                <ol className="flex flex-col gap-2">
                  {playbook.steps.map((s) => (
                    <li key={s.step_number} className="rounded-lg border border-gray-100 p-3">
                      <div className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-green-100 text-green-700 text-[11px] font-semibold flex items-center justify-center shrink-0">
                          {s.step_number}
                        </span>
                        <div className="min-w-0">
                          <div className="text-xs font-semibold text-gray-900 break-words">{s.title}</div>
                          <div className="text-[11px] text-gray-600 mt-0.5 break-words">{s.description}</div>
                          {s.estimated_duration && (
                            <div className="text-[11px] text-gray-400 mt-1">~{s.estimated_duration}</div>
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
          </Section>
        )}
      </div>

      <AlertDetailDrawer alert={alert} onClose={() => setAlert(null)} />
    </div>
  );
}

function Section({
  title,
  right,
  tone,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  tone?: "green";
  children: React.ReactNode;
}) {
  return (
    <div
      className={clsx(
        "rounded-xl border p-3.5 min-w-0",
        tone === "green" ? "border-green-100 bg-green-50/40" : "border-gray-100 bg-white"
      )}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {right}
      </div>
      {children}
    </div>
  );
}

function ServiceNode({
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
        "rounded-lg border px-3 py-2 min-w-[140px] max-w-full",
        primary ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
      )}
    >
      <div className="flex items-center gap-1.5">
        <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", SEVERITY_DOT[severity] ?? "bg-gray-300")} />
        <span className="text-xs font-semibold text-gray-900 truncate">{name}</span>
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">
        {role} · {count} alert{count === 1 ? "" : "s"}
      </div>
    </div>
  );
}

function Chip({ children, tone = "slate" }: { children: React.ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-gray-50 text-gray-600 ring-gray-200",
    green: "bg-green-50 text-green-700 ring-green-200",
    red: "bg-red-50 text-red-600 ring-red-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    gray: "bg-gray-100 text-gray-600 ring-gray-200",
  };
  return (
    <span className={clsx("text-[11px] font-medium px-2 py-0.5 rounded-full ring-1 whitespace-nowrap", tones[tone] ?? tones.slate)}>
      {children}
    </span>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-gray-700 font-medium">{value}</dd>
    </div>
  );
}

function Loading() {
  return <div className="text-xs text-gray-400">Loading…</div>;
}
