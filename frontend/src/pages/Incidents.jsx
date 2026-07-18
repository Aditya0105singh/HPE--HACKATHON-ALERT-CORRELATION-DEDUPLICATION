import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Clock, Dna, Shield, TrendingUp, Users, Wrench } from "lucide-react";
import { PriorityBadge, RiskMeter, SeverityDot, SeverityBadge, ServiceChip, SourceTag, StatCard } from "../components/ui";

const FACTOR_LABEL = {
  growth_rate: "Alert growth rate",
  severity_trend: "Severity trend",
  service_spread: "Service spread",
};
const RISK_COLOR = { high: "var(--critical)", medium: "var(--high)", low: "var(--ok)" };

function FactorBar({ label, value }) {
  const pct = Math.round(value * 100);
  return (
    <div className="mb-3">
      <div className="flex items-center justify-between text-[14px] mb-1">
        <span style={{ color: "var(--text)" }}>{label}</span>
        <span style={{ color: "var(--muted)" }}>{pct}%</span>
      </div>
      <div className="h-2 rounded-full" style={{ background: "var(--panel-2)" }}>
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, background: "var(--accent)" }} />
      </div>
    </div>
  );
}

function IncidentDetail({ cluster, onBack }) {
  const root = cluster.root_cause;
  const dna = cluster.dna_match;
  const risk = cluster.risk;

  return (
    <div className="p-6 overflow-auto h-full">
      <button onClick={onBack} className="flex items-center gap-1.5 text-[15px] mb-4 cursor-pointer" style={{ color: "var(--accent)" }}>
        <ArrowLeft size={15} strokeWidth={2.25} /> Back to Incidents
      </button>

      <div className="flex items-start gap-4 mb-6">
        <div className="flex-1">
          <div className="text-[13px] font-semibold px-2 py-0.5 rounded inline-block mb-2" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
            INCIDENT CLUSTER {cluster.cluster_id}
          </div>
          <h1 className="text-xl font-semibold flex items-center gap-2">
            <SeverityDot severity={root.severity} />
            {root.service} / {root.alertname}
          </h1>
          <p className="text-[15px] mt-2 max-w-2xl" style={{ color: "var(--muted)" }}>{cluster.summary}</p>
        </div>
        <div className="w-64 shrink-0 rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <RiskMeter risk={risk} />
          <div className="text-[13px] mt-3" style={{ color: "var(--muted)" }}>
            {risk.services_affected} services affected · {cluster.raw_alert_count} raw alerts → {cluster.size} unique
          </div>
          {cluster.est_triage_minutes_saved > 0 && (
            <div className="text-[14px] mt-2" style={{ color: "var(--ok)" }}>
              ⏱ est. {cluster.est_triage_minutes_saved} min triage saved
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <div className="rounded-lg border p-4 mb-6" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
            <div className="text-[15px] font-semibold mb-3">
              Why this is <span style={{ color: RISK_COLOR[risk.level] }}>{risk.level.toUpperCase()}</span> risk
            </div>
            {Object.entries(risk.factors).map(([key, value]) => (
              <FactorBar key={key} label={FACTOR_LABEL[key] || key} value={value} />
            ))}
            <div className="text-[13px] mt-2" style={{ color: "var(--muted)" }}>
              score = 0.40·growth + 0.35·severity trend + 0.25·service spread — explainable by design, defensible under questioning.
            </div>
          </div>

          {dna ? (
            <div className="rounded-lg border p-4" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
              <div className="flex items-center gap-1.5 text-[15px] font-semibold mb-2">
                <Dna size={15} strokeWidth={2} style={{ color: "var(--purple)" }} /> Alert DNA · {dna.similarity_pct}% match to {dna.incident_id}
              </div>
              <div className="text-[15px] font-medium mb-1">{dna.title}</div>
              <div className="text-[13px] mb-3" style={{ color: "var(--muted)" }}>{dna.date} · {dna.services_affected?.join(", ")}</div>
              <div className="text-[14px] mb-1"><span style={{ color: "var(--muted)" }}>Root cause: </span>{dna.root_cause}</div>
              <div className="text-[14px] mb-1"><span style={{ color: "var(--muted)" }}>Resolution: </span>{dna.resolution}</div>
              <div className="text-[14px]" style={{ color: "var(--ok)" }}>Resolved in {dna.resolution_minutes} min last time</div>
            </div>
          ) : (
            <div className="rounded-lg border p-4 text-[15px] flex items-center gap-1.5" style={{ borderColor: "var(--border)", background: "var(--panel)", color: "var(--high)" }}>
              <Dna size={15} strokeWidth={2} /> No match in the incident library — this is a novel pattern with no prior playbook.
            </div>
          )}
        </div>

        <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <div className="px-4 py-2.5 text-[15px] font-semibold border-b" style={{ borderColor: "var(--border)" }}>
            Alert timeline ({cluster.alerts.length})
          </div>
          <div className="max-h-[520px] overflow-auto">
            {cluster.alerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2 border-t text-[14px]" style={{ borderColor: "var(--border)" }}>
                <span className="font-mono text-[13px] w-16 shrink-0" style={{ color: "var(--muted)" }}>{a.timestamp.slice(11, 19)}</span>
                <SeverityBadge severity={a.severity} />
                <span className="font-medium w-36 truncate">{a.service}</span>
                <span className="flex-1 truncate" style={{ color: "var(--muted)" }}>{a.alertname}</span>
                <SourceTag source={a.source} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Incidents({ data }) {
  const clusters = data?.clusters ?? [];
  const totalSaved = clusters.reduce((s, c) => s + (c.est_triage_minutes_saved || 0), 0);
  const totalAlerts = clusters.reduce((s, c) => s + (c.raw_alert_count || c.size), 0);
  const services = new Set(clusters.flatMap((c) => c.alerts.map((a) => a.service))).size;
  const knownFixes = clusters.filter((c) => c.dna_match).length;
  const { clusterId } = useParams();
  const navigate = useNavigate();

  if (clusterId != null) {
    const cluster = clusters.find((c) => String(c.cluster_id) === clusterId);
    if (cluster) {
      return <IncidentDetail cluster={cluster} onBack={() => navigate("/incidents")} />;
    }
  }

  return (
    <div className="p-6 overflow-auto h-full">
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-lg font-semibold">Incidents</h1>
        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>
          {clusters.length} open · ranked by escalation risk
        </span>
        {totalSaved > 0 && (
          <span className="ml-auto text-[15px]" style={{ color: "var(--ok)" }}>
            ⏱ est. {totalSaved} min of manual triage saved this window
          </span>
        )}
      </div>

      <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>
        What the on-call engineer actually acts on — one row per real problem, ordered by what's about to get worse. Click a row for the full story.
      </p>

      <div className="grid grid-cols-2 md:grid-cols-3 min-[1280px]:grid-cols-5 gap-3 mb-5">
        <StatCard icon={<Shield size={16} />} label="Open Incidents" value={clusters.length} color="var(--critical)" delta="ranked by risk" />
        <StatCard icon={<TrendingUp size={16} />} label="Total Alerts" value={totalAlerts} color="var(--high)" delta="inside incidents" />
        <StatCard icon={<Users size={16} />} label="Affected Services" value={services} color="var(--accent)" delta="across incidents" />
        <StatCard icon={<Wrench size={16} />} label="Known Fixes" value={knownFixes} color="var(--info)" delta="Alert DNA matches" />
        <StatCard icon={<Clock size={16} />} label="Triage Saved" value={`${totalSaved} min`} color="var(--ok)" delta="manual work avoided" />
      </div>

      <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--border)" }}>
        <table className="w-full text-[15px]">
          <thead>
            <tr className="text-left text-[13px] uppercase tracking-wider" style={{ color: "var(--muted)", background: "var(--panel)" }}>
              <th className="px-4 py-2.5 font-medium">Incident</th>
              <th className="px-2 py-2.5 font-medium">Escalation Risk</th>
              <th className="px-2 py-2.5 font-medium">Alerts</th>
              <th className="px-2 py-2.5 font-medium">Services</th>
              <th className="px-2 py-2.5 font-medium">Known fix</th>
              <th className="px-2 py-2.5 font-medium text-right pr-4">Triage saved</th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((c) => (
              <tr
                key={c.cluster_id}
                onClick={() => navigate(`/incidents/${c.cluster_id}`)}
                className="border-t align-top cursor-pointer hover:brightness-125 transition-all"
                style={{ borderColor: "var(--border)" }}
              >
                <td className="px-4 py-3 border-l-2" style={{ borderLeftColor: c.risk.level === "high" ? "var(--critical)" : c.risk.level === "medium" ? "var(--high)" : "var(--ok)" }}>
                  <div className="font-medium flex items-center gap-2">
                    <PriorityBadge severity={c.root_cause.severity} riskLevel={c.risk.level} />
                    <SeverityDot severity={c.root_cause.severity} />
                    {c.root_cause.service} / {c.root_cause.alertname}
                  </div>
                  <div className="text-[13px] mt-1 max-w-md" style={{ color: "var(--muted)" }}>{c.summary}</div>
                  <div className="flex gap-1.5 mt-1.5 flex-wrap">
                    {[...new Set(c.alerts.map((a) => a.service))].slice(0, 3).map((s) => <ServiceChip key={s} name={s} />)}
                    {new Set(c.alerts.map((a) => a.service)).size > 3 && (
                      <span className="text-[13px]" style={{ color: "var(--muted)" }}>+{new Set(c.alerts.map((a) => a.service)).size - 3}</span>
                    )}
                  </div>
                </td>
                <td className="px-2 py-3 w-44"><RiskMeter risk={c.risk} compact /></td>
                <td className="px-2 py-3" style={{ color: "var(--muted)" }}>
                  {c.raw_alert_count} raw → {c.size}
                </td>
                <td className="px-2 py-3" style={{ color: "var(--muted)" }}>{c.risk.services_affected}</td>
                <td className="px-2 py-3 max-w-xs">
                  {c.dna_match ? (
                    <span className="text-[14px]">
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-semibold"
                        style={{ background: "color-mix(in srgb, var(--accent) 16%, transparent)", color: "var(--purple)" }}
                      >
                        <Dna size={12} strokeWidth={2} /> {c.dna_match.incident_id}
                      </span>{" "}
                      <span style={{ color: "var(--muted)" }}>{c.dna_match.resolution.slice(0, 60)}…</span>
                    </span>
                  ) : (
                    <span className="text-[14px]" style={{ color: "var(--high)" }}>novel — no match</span>
                  )}
                </td>
                <td className="px-2 py-3 text-right pr-4 font-semibold" style={{ color: "var(--ok)" }}>
                  {c.est_triage_minutes_saved > 0 ? `${c.est_triage_minutes_saved} min` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
