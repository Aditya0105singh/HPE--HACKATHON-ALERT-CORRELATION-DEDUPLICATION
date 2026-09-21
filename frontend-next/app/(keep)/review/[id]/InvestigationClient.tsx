"use client";

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "react-toastify";
import clsx from "clsx";
import {
  HiCheckCircle,
  HiOutlineCheckBadge,
  HiOutlineExclamationTriangle,
  HiOutlineLockClosed,
  HiOutlineNoSymbol,
  HiOutlinePaperAirplane,
  HiOutlineXCircle,
} from "react-icons/hi2";
import { KeepLoader, PageHero, EmptyStateCard } from "@/shared/ui";
import {
  useEngineActions,
  useEngineAudit,
  useEngineDraft,
  useEngineEvidence,
} from "@/entities/engine/useEngine";
import type { Evidence, EvidenceSignal } from "@/entities/engine/types";

const SOURCE_LABEL: Record<string, string> = {
  cloudwatch_metric: "CloudWatch metric",
  cloudwatch_log: "CloudWatch logs",
  grafana_alert: "Grafana alert",
  trace_span: "OTel trace",
  app_log: "App log",
  otel_log: "OTel log",
};

const clock = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC" });

function Card({
  title,
  tag,
  children,
  className,
  delay = 0,
}: {
  title: string;
  tag?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <section
      className={clsx("kpi-card rounded-2xl border border-white/80 p-4 min-w-0", className)}
      style={{
        background: "linear-gradient(160deg,#fff 60%,#f0fdf4)",
        boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 8px 24px -12px rgba(16,24,40,.12)",
        animationDelay: `${delay}ms`,
      }}
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <h2 className="text-sm font-bold text-gray-900">{title}</h2>
        {tag}
      </header>
      {children}
    </section>
  );
}

const Tag = ({ kind }: { kind: "computed" | "ai" }) => (
  <span
    className={clsx(
      "text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full",
      kind === "computed" ? "bg-green-100 text-green-800" : "bg-violet-100 text-violet-800"
    )}
  >
    {kind === "computed" ? "Computed" : "AI-generated"}
  </span>
);

function Funnel({ ev }: { ev: Evidence }) {
  const steps = [
    { n: ev.raw_signals, label: "raw signals", sub: "all sources, redacted" },
    { n: ev.unique_signals, label: "unique after dedup", sub: `${ev.raw_signals - ev.unique_signals} repeats collapsed` },
    { n: 1, label: "incident", sub: `root cause ${ev.root_cause.service ?? "unknown"}`, strong: true },
  ];
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center gap-2">
          <div
            className={clsx(
              "rounded-xl px-4 py-2.5 border min-w-[9rem]",
              s.strong ? "bg-green-700 border-green-700 text-white" : "bg-white border-gray-200"
            )}
          >
            <div className="text-2xl font-extrabold tabular-nums leading-none">{s.n}</div>
            <div className={clsx("text-xs font-semibold mt-1", s.strong ? "text-green-50" : "text-gray-800")}>{s.label}</div>
            <div className={clsx("text-[11px]", s.strong ? "text-green-100" : "text-gray-600")}>{s.sub}</div>
          </div>
          {i < steps.length - 1 && <span className="text-gray-400 text-lg">→</span>}
        </div>
      ))}
      {ev.excluded.length > 0 && (
        <div className="rounded-xl px-4 py-2.5 border border-red-200 bg-red-50 min-w-[9rem] ml-2">
          <div className="text-2xl font-extrabold tabular-nums leading-none text-red-700">{ev.excluded.length}</div>
          <div className="text-xs font-semibold mt-1 text-red-800">rejected</div>
          <div className="text-[11px] text-red-700">shared no context</div>
        </div>
      )}
    </div>
  );
}

function SignalRow({ s }: { s: EvidenceSignal }) {
  const c = s.join.components;
  return (
    <li className={clsx("rounded-xl border p-3", s.is_root_cause_signal ? "border-green-300 bg-green-50/60" : "border-gray-100 bg-white/70")}>
      <div className="flex items-start gap-2 flex-wrap">
        <span className="text-[11px] font-mono text-gray-600 pt-0.5">{clock(s.at)}</span>
        <span className="text-[11px] font-semibold rounded-md bg-gray-100 text-gray-700 px-1.5 py-0.5">
          {SOURCE_LABEL[s.source] ?? s.source}
        </span>
        <span className="text-sm font-semibold text-gray-900">{s.service}</span>
        {s.occurrences > 1 && (
          <span className="text-[11px] font-bold rounded-md bg-amber-100 text-amber-800 px-1.5 py-0.5">
            ×{s.occurrences} collapsed into 1
          </span>
        )}
        {s.is_root_cause_signal && (
          <span className="text-[11px] font-bold rounded-md bg-green-700 text-white px-1.5 py-0.5">root-cause signal</span>
        )}
      </div>
      <p className="text-xs text-gray-700 mt-1 break-words">{s.message}</p>
      {(s.value !== null || s.detection_reason) && (
        <p className="text-[11px] text-gray-600 mt-0.5">
          {s.value !== null && (
            <>
              value <b>{s.value}</b>
              {s.threshold !== null && <> vs threshold {s.threshold}</>} ·{" "}
            </>
          )}
          {s.detection_reason}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        {s.badges.map((b) => (
          <span
            key={b.label}
            className={clsx(
              "text-[11px] font-semibold rounded-full px-2 py-0.5 border",
              b.ok ? "bg-green-50 text-green-800 border-green-200" : "bg-gray-50 text-gray-400 border-gray-200 line-through"
            )}
          >
            {b.ok ? "✓" : "✕"} {b.label}
          </span>
        ))}
        {s.join.gate && (
          <span className="text-[11px] text-gray-600">
            gate: <b className="text-gray-800">{s.join.gate}</b>
            {s.join.linked_to && <> with {s.join.linked_to}</>}
            {c && <> · similarity {c.total.toFixed(2)}</>}
          </span>
        )}
      </div>
    </li>
  );
}

function CorrelationExplorer({ ev }: { ev: Evidence }) {
  const w = ev.correlation.weights;
  return (
    <Card title="Correlation Explorer — why these signals became one incident" tag={<Tag kind="computed" />} delay={80}>
      <p className="text-xs text-gray-700 mb-3">
        similarity = {w.time_proximity} × time + {w.service_affinity} × service + {w.dependency_closeness} × dependency +{" "}
        {w.template_similarity} × template. A pair may only join if it also passes the{" "}
        <b>shared-context gate</b> (same service, dependency edge, or common trace). Time alone never groups.
      </p>
      <ul className="flex flex-col gap-2">
        {ev.signals.map((s) => (
          <SignalRow key={s.id} s={s} />
        ))}
      </ul>

      {ev.excluded.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-red-700 mb-2">Considered and rejected</h3>
          <ul className="flex flex-col gap-2">
            {ev.excluded.map((x) => (
              <li key={x.service + x.at} className="rounded-xl border border-red-200 bg-red-50/70 p-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <HiOutlineNoSymbol className="text-red-600" size={16} />
                  <span className="text-[11px] font-mono text-gray-600">{clock(x.at)}</span>
                  <span className="text-sm font-semibold text-gray-900">{x.service}</span>
                  <span className="text-[11px] font-bold rounded-md bg-red-600 text-white px-1.5 py-0.5">REJECTED FROM INCIDENT</span>
                </div>
                <p className="text-xs text-gray-700 mt-1">{x.message}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {x.checks.map((c) => (
                    <span
                      key={c.label}
                      className={clsx(
                        "text-[11px] font-semibold rounded-full px-2 py-0.5 border",
                        c.ok ? "bg-green-50 text-green-800 border-green-200" : "bg-white text-red-700 border-red-200"
                      )}
                    >
                      {c.ok ? "✓" : "✕"} {c.label}
                    </span>
                  ))}
                </div>
                <p className="text-[11px] text-red-800 mt-1.5">Reason: {x.reason}. It fired inside the same window, but shares nothing with the incident.</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function RootCauseCard({ ev }: { ev: Evidence }) {
  const rc = ev.root_cause;
  const maxScore = Math.max(...rc.candidates.map((c) => c.rank_score), 0.01);
  return (
    <Card title="Root cause — causal, not chronological" tag={<Tag kind="computed" />} delay={140}>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-extrabold text-gray-900">{rc.service}</span>
        <span className="text-xs font-semibold text-green-800 bg-green-100 rounded-full px-2 py-0.5">confidence {Math.round(rc.confidence * 100)}%</span>
      </div>
      <ul className="mt-3 flex flex-col gap-2">
        {rc.candidates.map((c, i) => (
          <li key={c.service} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className={clsx("font-semibold", i === 0 ? "text-gray-900" : "text-gray-700")}>
                {i + 1}. {c.service}
                {c.is_symptom && <span className="ml-1.5 text-[10px] font-bold text-red-700">SYMPTOM</span>}
              </span>
              <span className="tabular-nums font-bold text-gray-900">{c.rank_score.toFixed(2)}</span>
            </div>
            <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden mt-1">
              <div
                className="kpi-hbar h-full rounded-full"
                style={{ width: `${(c.rank_score / maxScore) * 100}%`, background: i === 0 ? "#15803d" : "#9ca3af", animationDelay: `${300 + i * 90}ms` }}
              />
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">
              precedence {c.temporal_precedence} · dependency reach {c.dependency_reach} · evidence {c.evidence_strength}
              {c.rejection_reason && <span className="block text-red-700">✕ {c.rejection_reason}</span>}
              {c.uniquely_explains.length > 0 && <span className="block text-green-800">✓ uniquely explains {c.uniquely_explains.join(", ")}</span>}
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl border border-gray-200 bg-white/80 p-3">
        <div className="text-[11px] font-bold uppercase tracking-wide text-gray-700 mb-1">Counterfactual check (graph ablation)</div>
        <ul className="text-xs text-gray-700 space-y-1">
          {rc.reasoning.map((r, i) => (
            <li key={i}>• {r}</li>
          ))}
        </ul>
        <p className="text-[11px] text-gray-500 mt-1.5">A rule-based simulation over the dependency graph, not a trained causal model.</p>
      </div>
    </Card>
  );
}

function SeverityCard({ ev }: { ev: Evidence }) {
  const s = ev.severity;
  return (
    <Card title="Severity — why this priority" tag={<Tag kind="computed" />} delay={200}>
      <div className="flex items-baseline gap-2">
        <span
          className={clsx(
            "text-2xl font-extrabold",
            s.priority === "P1" ? "text-red-700" : s.priority === "P2" ? "text-orange-700" : "text-blue-700"
          )}
        >
          {s.priority}
        </span>
        <span className="text-lg font-bold text-gray-900 tabular-nums">{s.score.toFixed(3)}</span>
        <span className="text-xs text-gray-600">
          {s.score >= s.p1_threshold ? `≥ ${s.p1_threshold} → P1` : s.score >= s.p2_threshold ? `≥ ${s.p2_threshold} → P2` : `< ${s.p2_threshold} → P3`}
        </span>
      </div>
      <ul className="mt-3 flex flex-col gap-2.5">
        {s.factors.map((f, i) => (
          <li key={f.key} className="text-xs">
            <div className="flex justify-between gap-2">
              <span className="font-semibold text-gray-800">
                {f.label} <span className="text-gray-500 font-normal">(weight {f.weight})</span>
              </span>
              <span className="tabular-nums font-bold text-gray-900">+{f.contribution.toFixed(2)}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden mt-1">
              <div
                className="kpi-hbar h-full rounded-full bg-green-600"
                style={{ width: `${Math.round(f.value * 100)}%`, animationDelay: `${300 + i * 90}ms` }}
              />
            </div>
            <div className="text-[11px] text-gray-600 mt-0.5">
              value {f.value.toFixed(2)} — {f.note}
            </div>
          </li>
        ))}
      </ul>
      {(s.suppressed || s.flap_count > 1) && (
        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 mt-3">
          {s.suppressed ? `Suppressed: ${s.suppression_reason}. ` : ""}
          {s.flap_count > 1 ? `Flapped ${s.flap_count} times.` : ""}
        </p>
      )}
    </Card>
  );
}

function ConfidenceCard({ ev }: { ev: Evidence }) {
  const c = ev.correlation.confidence;
  return (
    <Card title="Correlation confidence — how it adds up" tag={<Tag kind="computed" />} delay={260}>
      <ul className="text-xs text-gray-800 space-y-1.5">
        {c.parts.map((p) => (
          <li key={p.label} className="flex justify-between gap-3">
            <span>{p.label}</span>
            <b className="tabular-nums">+{p.points.toFixed(2)}</b>
          </li>
        ))}
        <li className="flex justify-between gap-3 border-t border-gray-200 pt-1.5 font-bold text-gray-900">
          <span>Final</span>
          <span className="tabular-nums">{c.final.toFixed(2)}</span>
        </li>
      </ul>
      <p className="text-[11px] text-gray-600 mt-2">
        Links used: {Object.entries(c.gate_reasons).map(([k, v]) => `${v} × ${k}`).join(", ")}. Weaker evidence lowers the score,
        which puts uncertain incidents at the top of the review queue.
      </p>
    </Card>
  );
}

function TicketCard({ draftId, ev }: { draftId: string; ev: Evidence }) {
  const { data: draft } = useEngineDraft(draftId);
  const { data: audit } = useEngineAudit();
  const { approve, reject, merge } = useEngineActions();
  const { data: session } = useSession();
  const [busy, setBusy] = useState(false);
  const [reviewer, setReviewer] = useState(session?.user?.name ?? "");
  const [mergeInto, setMergeInto] = useState("");

  if (!draft) return <KeepLoader includeMinHeight={false} loadingText="Loading ticket..." />;

  const published = draft.status === "published";
  const rejected = draft.status === "rejected";
  const merged = draft.status === "merged";
  const pending = draft.status === "awaiting_review";
  const actor = reviewer.trim() || session?.user?.name || "";

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    if (!actor) {
      toast.error("Enter a reviewer name — approval requires a named human");
      return;
    }
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
    } catch (e: any) {
      toast.error(e?.message || "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const trail = (audit ?? []).filter((a) => a.draft_id === draftId);

  return (
    <Card title="Ticket draft — what the engineer will receive" delay={320} className="lg:col-span-2">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-green-200 bg-white/80 p-4">
          <div className="mb-2"><Tag kind="computed" /></div>
          <dl className="text-xs text-gray-800 space-y-2">
            <div><dt className="font-bold text-gray-600">Title</dt><dd className="text-sm font-semibold text-gray-900">{draft.title}</dd></div>
            <div><dt className="font-bold text-gray-600">Severity</dt><dd>{draft.severity_line}</dd></div>
            <div><dt className="font-bold text-gray-600">Confidence</dt><dd>correlation {draft.correlation_confidence.toFixed(2)} · root cause {draft.causal_confidence}%</dd></div>
            <div><dt className="font-bold text-gray-600">Root cause</dt><dd>{draft.root_cause_detail}</dd></div>
            <div><dt className="font-bold text-gray-600">Affected services</dt><dd>{draft.affected_services.join(", ")}</dd></div>
            <div>
              <dt className="font-bold text-gray-600">Timeline</dt>
              <dd className="font-mono text-[11px] space-y-0.5 mt-0.5">
                {draft.timeline.map((t, i) => (
                  <div key={i}>
                    {clock(t.at)} [{SOURCE_LABEL[t.source] ?? t.source}] {t.service}
                    {t.count > 1 ? ` ×${t.count}` : ""} — {t.detail}
                  </div>
                ))}
              </dd>
            </div>
            {draft.considered_excluded.length > 0 && (
              <div>
                <dt className="font-bold text-gray-600">Considered &amp; excluded</dt>
                {draft.considered_excluded.map((x) => (
                  <dd key={x.service + x.at} className="text-red-800">{x.service} ({x.detail}) — {x.reason}</dd>
                ))}
              </div>
            )}
          </dl>
        </div>

        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4">
          <div className="mb-2 flex items-center gap-2">
            <Tag kind="ai" />
            <span className="text-[11px] text-gray-600">
              {draft.summary_source === "llm" ? "written by the LLM from the computed facts" : "template fallback — no LLM configured"}
            </span>
          </div>
          <h3 className="text-xs font-bold text-gray-700">Summary</h3>
          <p className="text-sm text-gray-900 mt-0.5">{draft.summary}</p>
          <h3 className="text-xs font-bold text-gray-700 mt-3">Suggested investigation</h3>
          <ol className="list-decimal list-inside text-sm text-gray-900 space-y-0.5 mt-0.5">
            {draft.investigation_steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
          <p className="text-[11px] text-gray-600 mt-3">
            The LLM only writes prose from the facts on the left. It cannot add services, timestamps, severity or a root cause.
            {draft.redaction_kinds.length > 0 && <> Redacted before processing: {draft.redaction_kinds.join(", ")}.</>}
          </p>
        </div>
      </div>

      {/* Review gate */}
      <div
        className={clsx(
          "mt-4 rounded-xl border p-4",
          published ? "border-green-300 bg-green-50" : pending ? "border-amber-300 bg-amber-50" : "border-gray-200 bg-gray-50"
        )}
      >
        <div className="flex items-center gap-2 flex-wrap">
          {pending && (
            <>
              <HiOutlineLockClosed className="text-amber-700" size={20} />
              <span className="text-sm font-extrabold text-amber-900">AWAITING HUMAN REVIEW</span>
              <span className="text-xs text-amber-900">Jira issue NOT created. The system cannot publish without an approval.</span>
            </>
          )}
          {published && (
            <>
              <HiOutlineCheckBadge className="text-green-700" size={22} />
              <span className="text-sm font-extrabold text-green-900">PUBLISHED as {draft.jira_key}</span>
              <span className="text-xs text-green-900">(mock Jira)</span>
            </>
          )}
          {rejected && <span className="text-sm font-extrabold text-gray-800">REJECTED AS NOISE — fed back to correlation</span>}
          {merged && <span className="text-sm font-extrabold text-gray-800">MERGED into {draft.merged_into}</span>}
        </div>

        {published && (
          <ul className="text-xs text-green-900 mt-2 space-y-0.5">
            <li>✓ Human approval recorded{draft.reviewer ? ` (${draft.reviewer})` : ""}</li>
            <li>✓ Single-use approval token minted, bound to this draft</li>
            <li>✓ Jira issue created once (idempotency key = draft id)</li>
          </ul>
        )}

        {pending && (
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <input
              value={reviewer}
              onChange={(e) => setReviewer(e.target.value)}
              placeholder="Reviewer name"
              aria-label="Reviewer name"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm w-44 focus:outline-none focus:border-green-500"
            />
            <button
              disabled={busy}
              onClick={() => act(() => approve(draftId, actor), "Approved — Jira issue created")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-700 hover:bg-green-800 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2"
            >
              <HiOutlinePaperAirplane size={15} /> Approve &amp; create Jira
            </button>
            <button
              disabled={busy}
              onClick={() => act(() => reject(draftId, actor, "rejected as noise"), "Rejected as noise")}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-800 text-sm font-semibold px-4 py-2"
            >
              <HiOutlineXCircle size={15} /> Reject as noise
            </button>
            <input
              value={mergeInto}
              onChange={(e) => setMergeInto(e.target.value)}
              placeholder="Merge into draft id"
              aria-label="Merge into draft id"
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm w-44 focus:outline-none focus:border-green-500"
            />
            <button
              disabled={busy || !mergeInto.trim()}
              onClick={() => act(() => merge(draftId, mergeInto.trim(), actor, "merged by reviewer"), "Merged")}
              className="rounded-lg border border-gray-300 bg-white hover:bg-gray-50 disabled:opacity-50 text-gray-800 text-sm font-semibold px-4 py-2"
            >
              Merge
            </button>
          </div>
        )}
      </div>

      {trail.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-1">Audit trail</h3>
          <ul className="text-xs text-gray-700 space-y-0.5">
            {trail.map((a, i) => (
              <li key={i} className="font-mono">
                {new Date(a.at).toLocaleTimeString()} · {a.actor} · {a.action} · {a.detail}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

export default function InvestigationClient({ draftId }: { draftId: string }) {
  const { data: ev, isLoading, error } = useEngineEvidence(draftId);
  const { data: draft } = useEngineDraft(draftId);

  if (isLoading) return <KeepLoader loadingText="Loading investigation..." />;
  if (error || !ev) {
    return (
      <div className="p-4">
        <EmptyStateCard
          icon={HiOutlineExclamationTriangle}
          title="No incident to investigate"
          description="Run Inject failure from the Overview (or load a scenario on the Review Queue) to create one."
        >
          <Link href="/" className="text-sm font-semibold text-green-700 hover:underline">Go to Overview →</Link>
        </EmptyStateCard>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHero
        icon={HiOutlineExclamationTriangle}
        eyebrow={<Link href="/review" className="hover:text-green-700 font-medium">← Review Queue</Link>}
        title={draft?.title ?? "Incident investigation"}
        subtitle="How the engine turned raw telemetry into this incident, and what it will tell the on-call engineer."
      >
        {draft && (
          <>
            <span className="rounded-full bg-red-50 text-red-700 font-bold text-xs px-3 py-1 border border-red-200">{draft.priority}</span>
            <span
              className={clsx(
                "rounded-full font-bold text-xs px-3 py-1 border",
                draft.status === "published"
                  ? "bg-green-100 text-green-800 border-green-200"
                  : "bg-amber-50 text-amber-800 border-amber-200"
              )}
            >
              {draft.status === "awaiting_review" ? "Awaiting human review" : draft.status}
            </span>
          </>
        )}
      </PageHero>

      <Funnel ev={ev} />

      <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-4 items-start">
        <CorrelationExplorer ev={ev} />
        <div className="flex flex-col gap-4 min-w-0">
          <RootCauseCard ev={ev} />
          <SeverityCard ev={ev} />
          <ConfidenceCard ev={ev} />
        </div>
      </div>

      <TicketCard draftId={draftId} ev={ev} />
    </div>
  );
}
