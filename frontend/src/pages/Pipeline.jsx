import { useState } from "react";

const EXPLAIN = {
  ingest: {
    title: "1 · Ingest",
    text: "Alerts arrive from every monitoring source — Prometheus, Datadog, GCP Monitoring, Grafana, custom apps — into one stream. In production this is a webhook endpoint; in this demo a synthetic generator plays realistic incident cascades.",
  },
  dedup: {
    title: "2 · Deduplication",
    text: "Monitoring tools re-fire the same alert every evaluation interval, so one stuck condition produces dozens of identical alerts. We fingerprint each alert (service + alert name + 5-minute window) and collapse repeats, keeping the earliest.",
  },
  cluster: {
    title: "3 · Correlation",
    text: "Each alert's text is embedded with a sentence-transformer model, combined with a time-proximity penalty, and clustered with DBSCAN. Alerts that are semantically related AND close in time group into one incident. Background noise is deliberately left ungrouped.",
  },
  risk: {
    title: "4a · Escalation Risk Score",
    text: "Per incident, an explainable score: 0.40 × alert growth rate + 0.35 × severity trend + 0.25 × service spread. It answers the question no grouping tool answers — which incident is about to get WORSE. Every factor is defensible, no black box.",
  },
  dna: {
    title: "4b · Alert DNA",
    text: "The incident's embedding centroid is compared against a library of past incidents. Above 60% similarity, we surface what resolved it last time — institutional memory as an automatic assist. Below it, we honestly report a novel incident.",
  },
  noise: {
    title: "4c · Noise filter",
    text: "Alerts that correlate with nothing stay out of incidents instead of being force-grouped. A cert-expiry reminder is not part of your database outage — refusing to pretend otherwise is what keeps clusters trustworthy.",
  },
};

function Stage({ id, label, value, sub, active, onClick, accent }) {
  return (
    <button
      onClick={() => onClick(id)}
      className="rounded-lg border p-4 text-left cursor-pointer transition-all w-full"
      style={{
        background: "var(--panel)",
        borderColor: active ? "var(--accent)" : "var(--border)",
        boxShadow: active ? "0 0 14px color-mix(in srgb, var(--accent) 25%, transparent)" : "none",
      }}
    >
      <div className="text-[13px] uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="text-2xl font-semibold" style={{ color: accent || "var(--text)" }}>{value}</div>
      {sub && <div className="text-[13px] mt-1" style={{ color: "var(--muted)" }}>{sub}</div>}
    </button>
  );
}

function FlowArrow() {
  return (
    <div className="flex items-center justify-center px-1 shrink-0" style={{ color: "var(--muted)" }}>
      <div className="relative w-10 h-0.5 overflow-hidden rounded" style={{ background: "var(--border)" }}>
        <div className="absolute inset-y-0 w-3 rounded flow-dot" style={{ background: "var(--accent)" }} />
      </div>
    </div>
  );
}

export default function Pipeline({ data }) {
  const [active, setActive] = useState("cluster");
  const stats = data?.dedup_stats;
  const clusters = data?.clusters ?? [];
  const noise = data?.noise ?? [];
  if (!stats) return null;

  const high = clusters.filter((c) => c.risk.level === "high").length;
  const matched = clusters.filter((c) => c.dna_match).length;
  const exp = EXPLAIN[active];

  return (
    <div className="p-6 overflow-auto h-full">
      <h1 className="text-lg font-semibold mb-1">Pipeline</h1>
      <p className="text-[15px] mb-6" style={{ color: "var(--muted)" }}>
        The architecture, live — every number below is the current batch flowing through the real pipeline. Click a stage to see what it does.
      </p>

      <div className="flex items-stretch gap-1 mb-4">
        <div className="flex-1"><Stage id="ingest" label="Ingest" value={stats.raw_count} sub="raw alerts, 5 sources" active={active === "ingest"} onClick={setActive} /></div>
        <FlowArrow />
        <div className="flex-1"><Stage id="dedup" label="Deduplication" value={`−${stats.raw_count - stats.unique_count}`} sub={`${stats.unique_count} unique remain`} active={active === "dedup"} onClick={setActive} /></div>
        <FlowArrow />
        <div className="flex-1"><Stage id="cluster" label="Embed + Cluster" value={clusters.length} sub="incident clusters formed" accent="var(--accent)" active={active === "cluster"} onClick={setActive} /></div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6 pl-[36%]">
        <Stage id="risk" label="Escalation Risk" value={high ? `${high} HIGH` : "all low/med"} sub="explainable heuristic per cluster" accent={high ? "var(--critical)" : "var(--ok)"} active={active === "risk"} onClick={setActive} />
        <Stage id="dna" label="Alert DNA" value={`${matched}/${clusters.length}`} sub="matched to past incidents" accent="var(--accent)" active={active === "dna"} onClick={setActive} />
        <Stage id="noise" label="Noise filtered" value={noise.length} sub="kept out — not force-grouped" active={active === "noise"} onClick={setActive} />
      </div>

      <div className="rounded-lg border p-5" style={{ borderColor: "var(--accent)", background: "var(--panel)" }}>
        <div className="text-[16px] font-semibold mb-2" style={{ color: "var(--accent)" }}>{exp.title}</div>
        <p className="text-[15px] leading-relaxed max-w-3xl" style={{ color: "var(--text)" }}>{exp.text}</p>
      </div>

      <div className="mt-6 text-[14px]" style={{ color: "var(--muted)" }}>
        Net effect this window: <span style={{ color: "var(--text)" }}>{stats.raw_count} alerts</span> →{" "}
        <span style={{ color: "var(--accent)" }}>{clusters.length} actionable incidents</span>{" "}
        ({stats.raw_count ? (100 * (1 - clusters.length / stats.raw_count)).toFixed(1) : 0}% noise reduction), risk-ranked, with known fixes attached where history matches.
      </div>
    </div>
  );
}
