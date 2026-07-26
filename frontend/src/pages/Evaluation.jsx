import { useEffect, useState } from "react";
import { fetchEvaluation } from "../api";
import { MetricCard } from "../components/ui";

export default function Evaluation() {
  const [eval_, setEval] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchEvaluation().then(setEval).catch((e) => setError(e.message));
  }, []);

  if (error) return <div className="p-6" style={{ color: "var(--critical)" }}>Evaluation unavailable: {error}</div>;
  if (!eval_) return <div className="p-6" style={{ color: "var(--muted)" }}>Computing measured evaluation…</div>;

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-lg font-semibold">Evaluation</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
          measured, not claimed
        </span>
      </div>
      <p className="text-[15px] mb-6 max-w-2xl" style={{ color: "var(--muted)" }}>
        Every synthetic alert carries a hidden <code className="px-1 rounded" style={{ background: "var(--panel-2)" }}>ground_truth</code> label
        naming the incident that produced it (or "noise"). The correlation, risk, and Alert DNA pipeline never reads that field —
        these numbers are computed by comparing pipeline output against it after the fact, across {eval_.seeds_tested} independently
        seeded synthetic batches. No AIOps competitor publishes this inside their own product.
      </p>

      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard
          label="Incident detection"
          value={`${eval_.incident_detection_pct}%`}
          accent="var(--ok)"
          sub={`${eval_.incidents_detected}/${eval_.incidents_total} synthetic incidents found`}
        />
        <MetricCard
          label="Cluster purity"
          value={`${eval_.cluster_purity_pct}%`}
          accent="var(--accent)"
          sub="correctly-grouped alerts per cluster"
        />
        <MetricCard
          label="Noise correctly excluded"
          value={`${eval_.noise_excluded_pct}%`}
          accent="var(--ok)"
          sub="background alerts kept out of incidents"
        />
        <MetricCard
          label="Alert DNA accuracy"
          value={`${eval_.dna_accuracy_pct}%`}
          accent="var(--accent)"
          sub={`${eval_.dna_correct}/${eval_.dna_total} matched to the correct past incident`}
        />
      </div>

      <div className="rounded-lg border p-4 mb-6" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="text-[15px] font-semibold mb-2">Incident fragmentation</div>
        <div className="text-2xl font-semibold" style={{ color: eval_.fragmentation_events === 0 ? "var(--ok)" : "var(--high)" }}>
          {eval_.fragmentation_events} events
        </div>
        <div className="text-[14px] mt-1" style={{ color: "var(--muted)" }}>
          Times a single real incident was incorrectly split across more than one cluster, across all {eval_.seeds_tested} seeds.
          Zero means every cascading failure stayed as one coherent incident — the property that makes the Escalation Risk Score meaningful.
        </div>
      </div>

      <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="text-[15px] font-semibold mb-2">How we measure</div>
        <ol className="text-[14px] space-y-1.5 list-decimal pl-4" style={{ color: "var(--muted)" }}>
          <li>Generate a synthetic alert batch — cascading incidents plus background noise, each alert secretly labeled with the incident that produced it.</li>
          <li>Run the real pipeline: dedup → embed → time-windowed DBSCAN → root cause → risk score → Alert DNA. The pipeline never sees the labels.</li>
          <li>Compare cluster membership against the hidden labels: purity = % of each cluster's alerts sharing the majority ground-truth incident.</li>
          <li>Repeat across {eval_.seeds_tested} random seeds and average — a single lucky batch can't inflate the numbers.</li>
        </ol>
      </div>
    </div>
  );
}
