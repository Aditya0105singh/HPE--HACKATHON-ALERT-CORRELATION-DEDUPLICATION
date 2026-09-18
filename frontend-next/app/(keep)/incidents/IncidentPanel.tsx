"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  HiOutlineArrowTopRightOnSquare,
  HiOutlineCheckCircle,
  HiOutlineClipboard,
  HiOutlineMinusCircle,
  HiOutlineSparkles,
  HiOutlineXCircle,
} from "react-icons/hi2";
import {
  useCorrelationExplanation,
  usePlaybook,
  useRootCauseConfidence,
} from "@/entities/alertlens";
import type { Alert, Cluster } from "@/entities/alertlens";
import { AlertDetailDrawer } from "@/entities/alertlens/ui/AlertDetailDrawer";
import { formatTimestamp, timeAgo } from "@/entities/alertlens/lib/format";

type Tab = "overview" | "correlation" | "evidence" | "timeline" | "playbook";

const TABS: [Tab, string][] = [
  ["overview", "Overview"],
  ["correlation", "Correlation"],
  ["evidence", "Evidence"],
  ["timeline", "Timeline"],
  ["playbook", "Playbook"],
];

const SEVERITY_PILL: Record<string, string> = {
  critical: "bg-red-50 text-red-600 ring-red-100",
  high: "bg-orange-50 text-orange-600 ring-orange-100",
  medium: "bg-yellow-50 text-yellow-700 ring-yellow-100",
  low: "bg-green-50 text-green-700 ring-green-100",
  info: "bg-blue-50 text-blue-600 ring-blue-100",
};
const RISK_COLOR: Record<string, string> = {
  high: "#ef4444",
  medium: "#f97316",
  low: "#3b82f6",
};
const SIGNAL_CAP = 8;

// ISO local timestamp -> HH:MM:SS. Slicing the formatted string instead ate
// the hour ("01:00:43 PM" -> "00:43 PM").
const clockOf = (ts: string) => ts.slice(11, 19) || formatTimestamp(ts);

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
  const servicesList = useMemo(
    () => [...new Set([cluster.root_cause.service, ...cluster.alerts.map((a) => a.service)])],
    [cluster]
  );
  // Downstream = every service except the root's, which is where the cascade started.
  const downstream = servicesList.filter((s) => s !== cluster.root_cause.service);
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

        <h2 className="text-lg font-bold text-gray-900 mt-2 break-words">
          {cluster.root_cause.alertname}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Root cause on {cluster.root_cause.service}
          {downstream.length > 0 && <> · affecting {downstream.length} downstream service(s)</>}
        </p>

        <div className="flex items-center gap-1.5 flex-wrap mt-3">
          {playbook?.priority && <Chip tone="amber">{playbook.priority}</Chip>}
          <Chip tone="red">Risk {risk}%</Chip>
          {correlation && <Chip tone="green">Confidence {correlation.confidence_pct}%</Chip>}
          <Chip>{servicesList.length} services</Chip>
          <Chip>
            {cluster.size} signals <span className="text-gray-400">({cluster.raw_alert_count} raw)</span>
          </Chip>
          <Chip tone="gray">{status}</Chip>
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

      <div className="p-4 pt-5 flex flex-col gap-4">
        {tab === "overview" && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Section title="Root cause (AI)">
                <div className="rounded-lg border border-gray-100 p-3">
                  <div className="text-sm font-semibold text-gray-900 break-words">
                    {cluster.root_cause.service}
                  </div>
                  <div className="text-xs text-gray-600 mt-1 break-words">
                    {cluster.root_cause.message || cluster.root_cause.alertname}
                  </div>
                  <div className="text-[11px] text-gray-400 mt-2">
                    Earliest alert in the group · {formatTimestamp(cluster.root_cause.timestamp)}
                  </div>
                </div>
              </Section>

              <Section title="Why this incident?">
                {correlation ? (
                  <ul className="flex flex-col gap-1.5">
                    {correlation.reasons.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                        {r.ok ? (
                          <HiOutlineCheckCircle className="text-green-600 shrink-0 mt-px" size={14} />
                        ) : (
                          <HiOutlineMinusCircle className="text-gray-300 shrink-0 mt-px" size={14} />
                        )}
                        <span className="break-words">{r.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <Loading />
                )}
              </Section>
            </div>

            <Section
              title="Correlation confidence"
              right={
                correlation && (
                  <span className="text-sm font-bold text-green-700">{correlation.confidence_pct}%</span>
                )
              }
            >
              {correlation ? (
                <div className="flex flex-col gap-2">
                  {correlation.factors.map((f) => (
                    <div key={f.key}>
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-gray-600">{f.label}</span>
                        <span className="font-medium text-gray-800 tabular-nums">{f.score.toFixed(2)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                        <div className="h-full rounded-full bg-green-600" style={{ width: `${Math.round(f.score * 100)}%` }} />
                      </div>
                      <div className="text-[11px] text-gray-400 mt-0.5 break-words">{f.detail}</div>
                    </div>
                  ))}
                  <p className="text-[11px] text-gray-400 mt-1">
                    Measured on the same distance the clusterer used (eps {correlation.params.eps.toFixed(2)},
                    min_samples {correlation.params.min_samples}, {correlation.params.time_scale_min}-minute
                    time scale).
                  </p>
                </div>
              ) : (
                <Loading />
              )}
            </Section>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <Section title="Affected services">
                <div className="flex flex-col gap-1.5">
                  <ServiceRow name={cluster.root_cause.service} role="Root cause" tone="red" />
                  {downstream.map((s) => (
                    <ServiceRow key={s} name={s} role="Downstream" tone="amber" />
                  ))}
                </div>
              </Section>

              <Section title={`Related signals (${cluster.size})`}>
                <ul className="flex flex-col gap-1">
                  {sorted.slice(0, SIGNAL_CAP).map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => setAlert(a)}
                        className="w-full text-left flex items-start gap-2 text-xs py-1 px-1.5 rounded hover:bg-green-50/60"
                      >
                        <span className="font-mono text-[11px] text-gray-400 shrink-0">{clockOf(a.timestamp)}</span>
                        <span className="text-gray-700 truncate flex-1">{a.alertname}</span>
                        <span className="text-[11px] text-gray-400 shrink-0">{a.service}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {cluster.size > SIGNAL_CAP && (
                  <button
                    onClick={() => setTab("timeline")}
                    className="text-xs font-medium text-green-700 hover:underline mt-2"
                  >
                    View all {cluster.size} signals →
                  </button>
                )}
              </Section>
            </div>

            {correlation && correlation.excluded.length > 0 && (
              <Section title={`Considered & excluded (${correlation.excluded.length})`}>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {correlation.excluded.map((e) => (
                    <div key={e.id} className="rounded-lg border border-gray-100 p-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-medium text-gray-700 break-words min-w-0">{e.alertname}</span>
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 shrink-0">
                          d={e.distance.toFixed(2)}
                        </span>
                      </div>
                      <ul className="mt-1.5 flex flex-col gap-0.5">
                        {e.reasons.map((r, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-[11px] text-gray-500">
                            <HiOutlineXCircle className="text-gray-300 shrink-0 mt-px" size={12} />
                            <span className="break-words">{r}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-2">
                  Nearby alerts the clusterer left out, with the distance it measured.
                </p>
              </Section>
            )}

            <Section
              title="Incident summary"
              right={
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 rounded-full px-2 py-0.5">
                  <HiOutlineSparkles size={11} /> From verified facts
                </span>
              }
            >
              <p className="text-xs text-gray-700 leading-relaxed break-words">{cluster.summary}</p>
              {cluster.dna_match && (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-2.5 mt-2">
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
            </Section>
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
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
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
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-3.5 min-w-0">
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{title}</h3>
        {right}
      </div>
      {children}
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

function ServiceRow({ name, role, tone }: { name: string; role: string; tone: "red" | "amber" }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-gray-100 px-2.5 py-1.5">
      <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", tone === "red" ? "bg-red-500" : "bg-amber-500")} />
      <span className="text-xs text-gray-800 truncate flex-1">{name}</span>
      <span className="text-[10px] text-gray-400 shrink-0">{role}</span>
    </div>
  );
}

function Loading() {
  return <div className="text-xs text-gray-400">Loading…</div>;
}
