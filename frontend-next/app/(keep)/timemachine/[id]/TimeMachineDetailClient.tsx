"use client";

import Link from "next/link";
import clsx from "clsx";
import {
  HiOutlineArrowRight,
  HiOutlineCheckCircle,
  HiOutlineClock,
  HiOutlineMinusCircle,
  HiOutlineSparkles,
  HiOutlineWrenchScrewdriver,
  HiOutlineXCircle,
} from "react-icons/hi2";
import { TbTimeline } from "react-icons/tb";
import { EmptyStateCard, KeepLoader, PageHero } from "@/shared/ui";
import { useIncident, useIncidentComparison } from "@/entities/alertlens";
import type { ComparisonMetric } from "@/entities/alertlens/model/types";
import { ReplayTimeline } from "@/entities/alertlens/ui/ReplayTimeline";
import { useCountUp } from "@/entities/alertlens/ui/KpiCards";
import { timeAgo } from "@/entities/alertlens/lib/format";

const shell = {
  background: "linear-gradient(160deg,#fff 60%,#f0fdf4)",
  boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 8px 24px -12px rgba(16,24,40,.12)",
} as const;

const Tag = ({ kind }: { kind: "computed" | "seeded" }) => (
  <span
    className={clsx(
      "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0",
      kind === "computed" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"
    )}
  >
    {kind === "computed" ? "Computed" : "Seeded history"}
  </span>
);

function Card({
  title,
  tag,
  icon: Icon,
  children,
  className,
  delay = 0,
}: {
  title: string;
  tag?: React.ReactNode;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={clsx("kpi-card rounded-2xl border border-white/80 p-4 min-w-0", className)}
      style={{ ...shell, animationDelay: `${delay}ms` }}
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <h2 className="flex items-center gap-1.5 text-sm font-bold text-gray-900">
          {Icon && <Icon size={16} className="text-green-600" />}
          {title}
        </h2>
        {tag}
      </header>
      {children}
    </section>
  );
}

/** A large, ring-backed percentage — used for the two headline numbers. */
function StatRing({
  label,
  value,
  suffix = "%",
  color,
  sub,
}: {
  label: string;
  value: number;
  suffix?: string;
  color: string;
  sub?: string;
}) {
  const shown = useCountUp(Math.round(value));
  const r = 15.9155;
  const pct = Math.min(100, value);
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-20 h-20 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4" />
          <circle
            className="kpi-ring"
            cx="18"
            cy="18"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="4"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${pct} ${100 - pct}`}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-base font-extrabold text-gray-900 tabular-nums">
          {shown}
          {suffix}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-gray-700">{label}</div>
        {sub && <div className="text-[11px] text-gray-600 mt-0.5">{sub}</div>}
      </div>
    </div>
  );
}

const STATUS_STYLE: Record<
  ComparisonMetric["status"],
  { icon: React.ElementType; text: string; bg: string; label: string }
> = {
  match: { icon: HiOutlineCheckCircle, text: "text-green-700", bg: "bg-green-50 border-green-200", label: "Matches" },
  partial: { icon: HiOutlineMinusCircle, text: "text-amber-700", bg: "bg-amber-50 border-amber-200", label: "Partial" },
  different: { icon: HiOutlineXCircle, text: "text-gray-500", bg: "bg-gray-50 border-gray-200", label: "Different" },
  info: { icon: HiOutlineClock, text: "text-blue-700", bg: "bg-blue-50 border-blue-200", label: "Not comparable" },
};

function ComparisonRow({ metric, delay }: { metric: ComparisonMetric; delay: number }) {
  const s = STATUS_STYLE[metric.status] ?? STATUS_STYLE.info;
  const Icon = s.icon;
  return (
    <div
      className={clsx("kpi-row grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 sm:gap-3 items-center rounded-xl border p-3", s.bg)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="min-w-0">
        <div className="text-[10px] font-bold uppercase tracking-wide text-gray-500">{metric.field}</div>
        <div className="text-xs text-gray-500 mt-0.5 sm:hidden">now</div>
        <div className="text-sm text-gray-900 break-words">{metric.current}</div>
      </div>
      <div className="min-w-0">
        <div className="text-xs text-gray-500 mb-0.5 sm:hidden">then ({metric.historical ? "seeded history" : "—"})</div>
        <div className="text-sm text-gray-900 break-words">{metric.historical}</div>
      </div>
      <span className={clsx("inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full whitespace-nowrap justify-self-start sm:justify-self-end", s.text)}>
        <Icon size={14} />
        {s.label}
      </span>
    </div>
  );
}

export function TimeMachineDetailClient({
  incidentId,
}: {
  incidentId: string;
}) {
  const { incident, notFound } = useIncident(incidentId);
  const { data, error, isLoading } = useIncidentComparison(incidentId);

  if (isLoading) {
    return <KeepLoader loadingText="Searching incident history..." />;
  }

  if (error || notFound || !data) {
    return (
      <div className="p-4">
        <EmptyStateCard
          icon={TbTimeline}
          title={notFound ? "Incident not found" : "Could not load comparison"}
          description={
            notFound
              ? `No incident with id ${incidentId} in the current batch.`
              : String(error)
          }
        >
          <Link href="/timemachine" className="text-green-600 font-semibold text-sm hover:underline">
            Back to Time Machine
          </Link>
        </EmptyStateCard>
      </div>
    );
  }

  const dna = data.historical_incident;
  const current = data.current_incident;
  const b = data.similarity_breakdown;

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <PageHero
        icon={TbTimeline}
        eyebrow={
          <Link href="/timemachine" className="hover:text-green-700 font-medium">
            ← Time Machine
          </Link>
        }
        title={incident ? incident.root_cause.alertname : `Incident ${incidentId}`}
        subtitle={
          incident ? (
            <>Root cause on {incident.root_cause.service} · {timeAgo(incident.root_cause.timestamp)}</>
          ) : undefined
        }
      >
        {data.has_match && (
          <span className="rounded-full bg-green-100 text-green-800 font-bold text-xs px-3 py-1 border border-green-200">
            {Math.round(data.similarity)}% match — {dna?.incident_id}
          </span>
        )}
      </PageHero>

      {incident && <ReplayTimeline cluster={incident} />}

      {!data.has_match ? (
        <div className="kpi-card rounded-2xl border border-white/80 p-6" style={shell}>
          <EmptyStateCard
            noCard
            icon={TbTimeline}
            title="Novel incident signature"
            description="Nothing in the Alert DNA history clears the match threshold — there is no prior playbook to reuse. This is reported honestly rather than forcing a weak match."
          />
        </div>
      ) : (
        <>
          {/* Headline: two real, measured numbers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="kpi-card rounded-2xl border border-green-200 p-4" style={shell}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-gray-700">Symptom similarity</span>
                <Tag kind="computed" />
              </div>
              <StatRing
                label="TF-IDF cosine similarity"
                value={b.symptom_similarity}
                color="#15803d"
                sub="Against every incident's symptom text in the seeded library"
              />
            </div>
            <div className="kpi-card rounded-2xl border border-blue-200 p-4" style={{ ...shell, animationDelay: "70ms" }}>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-bold text-gray-700">Service overlap</span>
                <Tag kind="computed" />
              </div>
              <StatRing
                label={`${current.services.length ? current.services.length : 0} current service(s) checked`}
                value={b.service_overlap}
                color="#2563eb"
                sub="Share of this incident's services also affected back then"
              />
            </div>
          </div>

          {/* Side-by-side comparison */}
          <Card title="Now vs. then" tag={<Tag kind="seeded" />} icon={HiOutlineSparkles} delay={140}>
            <p className="text-xs text-gray-700 mb-3">
              Every row is either a real match/partial/different verdict, or marked <b>not comparable</b> when the two
              sides are different kinds of number (an estimate now vs. a recorded outcome then) — never a guess dressed up as a verdict.
            </p>
            <div className="flex flex-col gap-2">
              {data.comparison_metrics.map((m, i) => (
                <ComparisonRow key={m.field} metric={m} delay={200 + i * 60} />
              ))}
            </div>
          </Card>

          {/* Timeline comparison */}
          <Card title="Symptom order — now vs. then" icon={HiOutlineClock} delay={220}>
            <p className="text-xs text-gray-700 mb-3">
              The current column has real timestamps. The historical column only ever recorded symptom{" "}
              <i>order</i>, not elapsed time — so it&apos;s labelled by position, not a fabricated clock.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-green-700 mb-1.5">This incident</div>
                <ol className="flex flex-col gap-1.5">
                  {data.timeline_comparison.current.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="font-mono text-gray-500 shrink-0 pt-px">{p.time}</span>
                      <span className="text-gray-900">{p.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wide text-amber-700 mb-1.5">{dna?.incident_id}</div>
                <ol className="flex flex-col gap-1.5">
                  {data.timeline_comparison.historical.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <span className="font-mono text-gray-500 shrink-0 pt-px">{p.time}</span>
                      <span className="text-gray-900">{p.text}</span>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </Card>

          {/* Suggested actions */}
          {data.suggested_actions.length > 0 && (
            <Card title="Suggested actions from the past fix" tag={<Tag kind="seeded" />} icon={HiOutlineWrenchScrewdriver} delay={280}>
              <ol className="flex flex-col gap-2">
                {data.suggested_actions.map((a, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-gray-800">
                    <span className="w-5 h-5 rounded-full bg-green-100 text-green-800 text-[11px] font-bold flex items-center justify-center shrink-0 mt-px">
                      {i + 1}
                    </span>
                    {a}
                  </li>
                ))}
              </ol>
            </Card>
          )}
        </>
      )}

      {incident && (
        <Link
          href={`/incidents/${incident.cluster_id}`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-700 hover:underline w-fit"
        >
          Open full incident <HiOutlineArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
