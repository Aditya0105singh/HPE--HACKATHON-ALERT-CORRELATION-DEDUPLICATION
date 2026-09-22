"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import {
  HiOutlineArrowRight,
  HiOutlineArrowTrendingUp,
  HiOutlineBeaker,
  HiOutlineBolt,
  HiOutlineCheckCircle,
  HiOutlineExclamationTriangle,
  HiOutlinePause,
  HiOutlinePlay,
  HiOutlineQuestionMarkCircle,
} from "react-icons/hi2";
import { EmptyStateCard, KeepLoader, PageHero } from "@/shared/ui";
import { LuGauge } from "react-icons/lu";
import { useForecast, useIncident, usePipelineState } from "@/entities/alertlens";
import { useCountUp } from "@/entities/alertlens/ui/KpiCards";
import { timeAgo } from "@/entities/alertlens/lib/format";

const shell = {
  background: "linear-gradient(160deg,#fff 60%,#f0fdf4)",
  boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 8px 24px -12px rgba(16,24,40,.12)",
} as const;

const Tag = ({ kind }: { kind: "computed" | "predicted" }) => (
  <span
    className={clsx(
      "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full shrink-0",
      kind === "computed" ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"
    )}
  >
    {kind === "computed" ? "Computed now" : "Predicted"}
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
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="flex items-center gap-3.5">
      <div className="relative w-16 h-16 shrink-0">
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
        <div className="absolute inset-0 flex items-center justify-center text-sm font-extrabold text-gray-900 tabular-nums">
          {suffix === "%" ? shown : Math.round(value)}
          {suffix === "%" ? "%" : ""}
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-xs font-bold text-gray-700">{label}</div>
        {sub && <div className="text-[11px] text-gray-600 mt-0.5 truncate">{sub}</div>}
      </div>
    </div>
  );
}

/** Risk trajectory now -> +5m -> +10m -> +15m, drawn as a small line chart so
 * the escalation reads at a glance instead of four separate numbers. */
function RiskTrajectory({
  points,
  activeStage,
}: {
  points: { minutes: number; risk: number }[];
  activeStage: number;
}) {
  const W = 480;
  const H = 90;
  const pad = 8;
  const n = points.length;
  const x = (i: number) => pad + (i / (n - 1)) * (W - 2 * pad);
  const y = (v: number) => H - pad - (Math.min(100, v) / 100) * (H - 2 * pad);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.risk).toFixed(1)}`).join(" ");
  const activeIdx = Math.max(0, points.findIndex((p) => p.minutes === activeStage));
  const rising = points[points.length - 1].risk >= points[0].risk;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20" preserveAspectRatio="none" role="img" aria-label="Projected risk over time">
        <defs>
          <linearGradient id="forecast-fill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={rising ? "#ef4444" : "#22c55e"} stopOpacity="0.3" />
            <stop offset="1" stopColor={rising ? "#ef4444" : "#22c55e"} stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 50, 100].map((g) => (
          <line
            key={g}
            x1={pad}
            x2={W - pad}
            y1={y(g)}
            y2={y(g)}
            stroke="#e5e7eb"
            strokeDasharray={g === 0 ? "" : "3 3"}
          />
        ))}
        <path className="kpi-fade" d={`${line} L${x(n - 1)},${y(0)} L${x(0)},${y(0)} Z`} fill="url(#forecast-fill)" />
        <path
          className="kpi-draw"
          d={line}
          pathLength={1}
          fill="none"
          stroke={rising ? "#dc2626" : "#16a34a"}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((p, i) => (
          <circle
            key={p.minutes}
            cx={x(i)}
            cy={y(p.risk)}
            r={i === activeIdx ? 5 : 3}
            fill="#fff"
            stroke={i === activeIdx ? (rising ? "#dc2626" : "#16a34a") : "#9ca3af"}
            strokeWidth="2"
          />
        ))}
      </svg>
      <div className="flex justify-between text-[11px] text-gray-600 mt-1 px-1">
        {points.map((p) => (
          <span key={p.minutes} className={clsx(p.minutes === activeStage && "font-bold text-gray-900")}>
            {p.minutes === 0 ? "Now" : `+${p.minutes}m`}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ForecastDetailClient({ incidentId }: { incidentId: string }) {
  const { incident, notFound } = useIncident(incidentId);
  const { data, error, isLoading } = useForecast(incidentId);
  const { state } = usePipelineState();

  const [activeStage, setActiveStage] = useState(0);
  const [playing, setPlaying] = useState(false);

  // Every service name this dataset has actually mentioned anywhere, so a
  // predicted service can be honestly flagged as "known in this environment"
  // vs. a heuristic guess this batch has never observed.
  const knownServices = useMemo(() => {
    const set = new Set<string>();
    for (const c of state.clusters ?? []) {
      set.add(c.root_cause.service);
      for (const a of c.alerts) set.add(a.service);
    }
    return set;
  }, [state.clusters]);

  useEffect(() => {
    if (!playing || !data?.forecast?.length) return;
    const all = [0, ...data.forecast.map((p) => p.minutes)];
    const iv = setInterval(() => {
      setActiveStage((prev) => {
        const idx = all.indexOf(prev);
        return all[(idx + 1) % all.length];
      });
    }, 2000);
    return () => clearInterval(iv);
  }, [playing, data?.forecast]);

  if (isLoading) return <KeepLoader loadingText="Computing forecast..." />;

  if (error || notFound || !data) {
    return (
      <div className="p-4">
        <EmptyStateCard
          icon={LuGauge}
          title={notFound ? "Incident not found" : "Could not load forecast"}
          description={
            notFound
              ? `No incident with id ${incidentId} in the current batch.`
              : String(error)
          }
        >
          <Link href="/forecast" className="text-green-600 font-semibold text-sm hover:underline">
            Back to forecast
          </Link>
        </EmptyStateCard>
      </div>
    );
  }

  const reasoning = Array.isArray(data.reasoning) ? data.reasoning : data.reasoning ? [data.reasoning] : [];
  const peak = data.forecast?.length ? Math.max(...data.forecast.map((p) => p.alerts)) : 0;
  const stages = [0, ...(data.forecast?.map((p) => p.minutes) ?? [])];
  const trajectoryPoints = [{ minutes: 0, risk: data.currentRisk }, ...(data.forecast ?? [])];
  const rising = trajectoryPoints[trajectoryPoints.length - 1].risk >= trajectoryPoints[0].risk;

  const stagePoint =
    data.forecast?.find((p) => p.minutes === activeStage) ?? {
      minutes: 0,
      risk: data.currentRisk,
      alerts: incident?.raw_alert_count ?? 0,
      newServices: [],
      confidence: data.confidence,
    };

  const stageAffected = (data.forecast ?? [])
    .filter((p) => p.minutes <= activeStage)
    .flatMap((p) => p.newServices ?? []);

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <PageHero
        icon={LuGauge}
        eyebrow={
          <Link href="/forecast" className="hover:text-green-700 font-medium">
            ← Forecast
          </Link>
        }
        title={incident ? incident.root_cause.alertname : `Incident ${incidentId}`}
        subtitle={
          incident ? (
            <>Root cause on {incident.root_cause.service} · {timeAgo(incident.root_cause.timestamp)}</>
          ) : undefined
        }
      >
        <span
          className={clsx(
            "inline-flex items-center gap-1.5 rounded-full font-bold text-xs px-3 py-1 border",
            rising ? "bg-red-50 text-red-700 border-red-200" : "bg-green-100 text-green-800 border-green-200"
          )}
        >
          <HiOutlineArrowTrendingUp size={14} className={clsx(!rising && "-scale-y-100")} />
          {rising ? "Risk projected to rise" : "Risk projected to ease"}
        </span>
      </PageHero>

      {/* Headline: what's real right now */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="kpi-card rounded-2xl border border-red-200 p-4" style={shell}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-gray-700">Current risk</span>
            <Tag kind="computed" />
          </div>
          <StatRing label="Escalation risk right now" value={data.currentRisk} color="#dc2626" />
        </div>
        <div className="kpi-card rounded-2xl border border-orange-200 p-4" style={{ ...shell, animationDelay: "60ms" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-gray-700">Predicted blast radius</span>
            <Tag kind="predicted" />
          </div>
          <StatRing label={`${data.predictedBlastRadius} service(s)`} suffix="" value={data.predictedBlastRadius} color="#ea580c" sub="By the final horizon, if unhandled" />
        </div>
        <div className="kpi-card rounded-2xl border border-blue-200 p-4" style={{ ...shell, animationDelay: "120ms" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-gray-700">Forecast confidence</span>
            <Tag kind="predicted" />
          </div>
          <StatRing label="Averaged across all horizons" value={data.confidence * 100} color="#2563eb" />
        </div>
        <div className="kpi-card rounded-2xl border border-amber-200 p-4" style={{ ...shell, animationDelay: "180ms" }}>
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-xs font-bold text-gray-700">Peak alert volume</span>
            <Tag kind="predicted" />
          </div>
          <StatRing label="If left unhandled to +15m" suffix="" value={peak} color="#d97706" />
        </div>
      </div>

      <Card title="Recommended immediate action" icon={HiOutlineBolt} tag={<Tag kind="predicted" />} delay={220}>
        <p className="text-sm text-gray-900">{data.recommendedImmediateAction}</p>
      </Card>

      <Card title="Projection" icon={LuGauge} tag={<Tag kind="predicted" />} delay={260} className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3 flex-wrap -mt-1">
          <p className="text-xs text-gray-700 max-w-xl">
            How far this spreads if left unhandled, deterministically projected from the current risk score, alert
            growth rate and severity trend. Step through the horizons or play them.
          </p>
          <button
            onClick={() => setPlaying(!playing)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-800 border border-green-300 bg-green-50 hover:bg-green-100 rounded-lg px-3 py-1.5 shrink-0"
          >
            {playing ? <HiOutlinePause size={14} /> : <HiOutlinePlay size={14} />}
            {playing ? "Pause" : "Play"}
          </button>
        </div>

        <RiskTrajectory points={trajectoryPoints} activeStage={activeStage} />

        <div className="flex items-center gap-1.5 flex-wrap">
          {stages.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setPlaying(false);
                setActiveStage(m);
              }}
              className={clsx(
                "text-sm px-3 py-1.5 rounded-full border font-semibold transition-all",
                activeStage === m
                  ? "bg-green-700 border-green-700 text-white shadow-sm"
                  : "border-gray-200 text-gray-600 bg-white hover:border-green-300 hover:text-green-700"
              )}
            >
              {m === 0 ? "Now" : `+${m}m`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="rounded-xl border border-gray-100 bg-white/70 p-3">
            <StatRing label={activeStage === 0 ? "Risk now" : `Risk at +${activeStage}m`} value={stagePoint.risk} color="#dc2626" />
          </div>
          <div className="rounded-xl border border-gray-100 bg-white/70 p-3">
            <StatRing label="Alert volume" suffix="" value={stagePoint.alerts} color="#15803d" />
          </div>
          <div className="rounded-xl border border-gray-100 bg-white/70 p-3">
            <StatRing label="Confidence" value={stagePoint.confidence * 100} color="#2563eb" />
          </div>
        </div>

        {stageAffected.length > 0 ? (
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide text-gray-600 mb-1.5">
              Services predicted affected by +{activeStage}m
            </div>
            <div className="flex flex-wrap gap-1.5">
              {stageAffected.map((s) => {
                const known = knownServices.has(s);
                return (
                  <span
                    key={s}
                    title={known ? "Seen elsewhere in this dataset" : "Not observed anywhere in this batch — a heuristic guess, not a known service"}
                    className={clsx(
                      "inline-flex items-center gap-1 text-[11px] font-semibold rounded-full px-2.5 py-1 border",
                      known ? "bg-amber-50 text-amber-800 border-amber-200" : "bg-gray-50 text-gray-500 border-gray-200"
                    )}
                  >
                    {known ? <HiOutlineCheckCircle size={12} /> : <HiOutlineQuestionMarkCircle size={12} />}
                    {s}
                  </span>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-500 mt-1.5">
              <HiOutlineCheckCircle size={11} className="inline text-amber-700 -mt-0.5" /> known in this dataset ·{" "}
              <HiOutlineQuestionMarkCircle size={11} className="inline text-gray-400 -mt-0.5" /> not observed anywhere
              in this batch — a typical-cascade guess, not evidence.
            </p>
          </div>
        ) : (
          <p className="text-xs text-gray-600">No additional services predicted at this horizon.</p>
        )}
      </Card>

      {reasoning.length > 0 && (
        <Card title="Why this forecast" icon={HiOutlineBeaker} tag={<Tag kind="predicted" />} delay={320}>
          <ul className="flex flex-col gap-2">
            {reasoning.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5 text-sm text-gray-800">
                <HiOutlineExclamationTriangle size={15} className="text-orange-500 shrink-0 mt-0.5" />
                {r}
              </li>
            ))}
          </ul>
        </Card>
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
