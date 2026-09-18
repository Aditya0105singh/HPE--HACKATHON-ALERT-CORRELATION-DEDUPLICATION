"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  HiOutlineArrowRight,
  HiOutlineSparkles,
  HiOutlineXMark,
} from "react-icons/hi2";
import type { Alert, Cluster } from "@/entities/alertlens";
import { AlertDetailDrawer } from "@/entities/alertlens/ui/AlertDetailDrawer";
import { timeAgo } from "@/entities/alertlens/lib/format";

type Tab = "overview" | "alerts" | "correlation" | "timeline";

const SEVERITY_PILL: Record<string, string> = {
  critical: "bg-red-50 text-red-600",
  high: "bg-orange-50 text-orange-600",
  medium: "bg-yellow-50 text-yellow-700",
  low: "bg-green-50 text-green-700",
  info: "bg-blue-50 text-blue-600",
};
const RISK_COLOR: Record<string, string> = { high: "#ef4444", medium: "#f97316", low: "#3b82f6" };
const LIST_CAP = 60;

function services(c: Cluster): string[] {
  return [...new Set([c.root_cause.service, ...c.alerts.map((a) => a.service)])];
}

/** Up to 4 distinct, real alert messages from the incident - the actual
 * signals it is made of, not generated "evidence" copy. */
function keyEvidence(c: Cluster): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const a of [c.root_cause, ...c.alerts]) {
    const line = a.message?.trim();
    if (!line || seen.has(line)) continue;
    seen.add(line);
    out.push(line);
    if (out.length >= 4) break;
  }
  return out;
}

export function IncidentDrawer({
  cluster,
  status,
  onClose,
}: {
  cluster: Cluster | null;
  status: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>("overview");
  const [alert, setAlert] = useState<Alert | null>(null);

  useEffect(() => setTab("overview"), [cluster?.cluster_id]);

  useEffect(() => {
    if (!cluster) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !alert) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cluster, alert, onClose]);

  const sorted = useMemo(
    () => (cluster ? [...cluster.alerts].sort((a, b) => a.timestamp.localeCompare(b.timestamp)) : []),
    [cluster]
  );

  if (!cluster) return null;

  const first = sorted[0]?.timestamp ?? cluster.root_cause.timestamp;
  const last = sorted[sorted.length - 1]?.timestamp ?? cluster.root_cause.timestamp;
  const evidence = keyEvidence(cluster);
  const risk = Math.round(cluster.risk.score * 100);
  const sev = cluster.root_cause.severity;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/25" onClick={onClose} aria-hidden />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Incident ${cluster.root_cause.alertname}`}
        className="fixed right-0 top-0 z-50 h-full w-full max-w-[440px] bg-white shadow-2xl border-l border-gray-200 flex flex-col animate-drawerSlideLeftAndFade"
      >
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-gray-900 break-words">{cluster.root_cause.alertname}</h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className="text-xs text-gray-400">#{cluster.cluster_id}</span>
                <span className={clsx("text-[11px] font-medium px-2 py-0.5 rounded-full capitalize", SEVERITY_PILL[sev] ?? "bg-gray-100 text-gray-600")}>
                  {sev}
                </span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{status}</span>
              </div>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 shrink-0"
            >
              <HiOutlineXMark size={18} />
            </button>
          </div>

          <div className="flex gap-1 mt-3 -mb-4">
            {(
              [
                ["overview", "Overview"],
                ["alerts", `Alerts (${cluster.size})`],
                ["correlation", "Correlation"],
                ["timeline", "Timeline"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={clsx(
                  "text-xs px-2.5 py-2 border-b-2 -mb-px font-medium transition-colors",
                  tab === key ? "border-green-600 text-green-700" : "border-transparent text-gray-400 hover:text-gray-600"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 pt-5 flex flex-col gap-4">
          {tab === "overview" && (
            <>
              <div className="rounded-lg bg-green-50 border border-green-100 p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <HiOutlineSparkles className="text-green-600" size={14} />
                  <span className="text-[11px] font-semibold text-green-700 uppercase tracking-wide">AI summary</span>
                </div>
                <p className="text-xs text-green-900 leading-relaxed">{cluster.summary}</p>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                <Fact label="Root cause" value={`${cluster.root_cause.alertname} on ${cluster.root_cause.service}`} full />
                <Fact label="Services" value={services(cluster).join(", ")} full />
                <Fact label="Related alerts" value={`${cluster.size} (${cluster.raw_alert_count} collapsed)`} />
                <div>
                  <div className="text-gray-400">Risk of escalation</div>
                  <div className="text-gray-800 font-medium">{risk}%</div>
                  <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
                    <div className="h-full rounded-full" style={{ width: `${risk}%`, background: RISK_COLOR[cluster.risk.level] ?? "#9ca3af" }} />
                  </div>
                </div>
                <Fact label="First seen" value={timeAgo(first)} />
                <Fact label="Last seen" value={timeAgo(last)} />
                <Fact label="Triage time saved" value={`~${cluster.est_triage_minutes_saved}m`} full />
              </div>

              {evidence.length > 0 && (
                <div>
                  <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Key evidence</div>
                  <ul className="flex flex-col gap-1.5">
                    {evidence.map((line, i) => (
                      <li key={i} className="text-xs text-gray-600 flex gap-1.5">
                        <span className="text-green-500">•</span>
                        <span className="break-words min-w-0">{line}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {tab === "alerts" && (
            <ul className="flex flex-col gap-1.5">
              {sorted.slice(0, LIST_CAP).map((a) => (
                <li key={a.id}>
                  <button
                    onClick={() => setAlert(a)}
                    className="w-full text-left p-2.5 rounded-lg border border-gray-100 hover:border-green-200 hover:bg-green-50/40 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-gray-800 truncate">{a.alertname}</span>
                      <span className={clsx("text-[10px] font-medium px-1.5 py-0.5 rounded-full capitalize shrink-0", SEVERITY_PILL[a.severity] ?? "bg-gray-100 text-gray-600")}>
                        {a.severity}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {a.service} · {timeAgo(a.timestamp)}
                    </div>
                  </button>
                </li>
              ))}
              {sorted.length > LIST_CAP && (
                <li className="text-[11px] text-gray-400 text-center pt-1">
                  Showing {LIST_CAP} of {sorted.length} - open the full incident for the rest.
                </li>
              )}
            </ul>
          )}

          {tab === "correlation" && (
            <div className="flex flex-col gap-3 text-xs">
              <Fact label="Signals correlated" value={`${cluster.size} unique (${cluster.raw_alert_count} raw)`} full />
              <Fact label="Services involved" value={String(services(cluster).length)} full />
              {cluster.dna_match ? (
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-3">
                  <div className="text-[11px] font-semibold text-blue-700 uppercase tracking-wide mb-1">
                    Resembles a past incident - {cluster.dna_match.similarity_pct}% similar
                  </div>
                  <div className="text-xs text-blue-900">
                    {cluster.dna_match.incident_id}: {cluster.dna_match.title}
                  </div>
                  {cluster.dna_match.resolution && (
                    <div className="text-xs text-blue-800 mt-1.5">
                      Previous fix: {cluster.dna_match.resolution}
                      {cluster.dna_match.resolution_minutes ? ` (${cluster.dna_match.resolution_minutes} min)` : ""}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-400">No historical match found for this pattern.</div>
              )}
            </div>
          )}

          {tab === "timeline" && (
            <ol className="flex flex-col">
              {sorted.slice(0, LIST_CAP).map((a, i, arr) => (
                <li key={a.id} className="flex gap-2.5">
                  <div className="flex flex-col items-center pt-1">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    {i < arr.length - 1 && <span className="w-px flex-1 bg-gray-200 min-h-[16px]" />}
                  </div>
                  <button onClick={() => setAlert(a)} className="text-left pb-3 min-w-0 group">
                    <div className="text-xs text-gray-800 truncate group-hover:text-green-700">{a.alertname}</div>
                    <div className="text-[11px] text-gray-400">
                      {a.service} · {timeAgo(a.timestamp)}
                    </div>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="p-4 border-t border-gray-100 flex gap-2">
          <Link
            href={`/incidents/${cluster.cluster_id}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium py-2 transition-colors"
          >
            Open full incident <HiOutlineArrowRight size={13} />
          </Link>
          <Link
            href={`/forecast/${cluster.cluster_id}`}
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 hover:border-green-300 text-gray-700 hover:text-green-700 text-xs font-medium px-3 py-2 transition-colors"
          >
            Forecast
          </Link>
        </div>
      </aside>

      <AlertDetailDrawer alert={alert} onClose={() => setAlert(null)} />
    </>
  );
}

function Fact({ label, value, full }: { label: string; value: string; full?: boolean }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <div className="text-gray-400">{label}</div>
      <div className="text-gray-800 font-medium break-words">{value}</div>
    </div>
  );
}
