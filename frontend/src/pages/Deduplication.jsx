import { useMemo, useState } from "react";
import { ChevronDown, Copy, FingerprintPattern, Inbox, TrendingDown } from "lucide-react";
import { AlertIcon, Pager, SeverityDot, SourceTag, StatCard, timeAgo } from "../components/ui";

function GroupRow({ a }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <tr
        onClick={() => setOpen(!open)}
        className="border-t cursor-pointer hover:brightness-125 transition-all"
        style={{ borderColor: "var(--border)" }}
      >
        <td className="px-4 py-2.5"><SeverityDot severity={a.severity} /></td>
        <td className="px-2 py-2.5">
          <div className="flex items-center gap-2.5">
            <AlertIcon alertname={a.alertname} severity={a.severity} service={a.service} />
            <span className="font-medium">{a.alertname}</span>
          </div>
        </td>
        <td className="px-2 py-2.5" style={{ color: "var(--muted)" }}>{a.service}</td>
        <td className="px-2 py-2.5 font-mono text-[13px]" style={{ color: "var(--muted)" }}>{a.fingerprint}</td>
        <td className="px-2 py-2.5 text-right">
          <span
            className="px-2 py-0.5 rounded-md text-xs font-bold"
            style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--purple)" }}
          >
            ×{a.duplicate_count}
          </span>
        </td>
        <td className="px-3 py-2.5 text-right pr-4" style={{ color: "var(--muted)" }}>
          <span className="inline-flex transition-transform" style={{ transform: open ? "rotate(180deg)" : "none" }}><ChevronDown size={14} strokeWidth={2} /></span>
        </td>
      </tr>
      {open && (
        <tr className="border-t" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
          <td />
          <td colSpan={5} className="px-2 py-3">
            <div className="text-[14px] mb-1.5" style={{ color: "var(--text)" }}>{a.message}</div>
            <div className="flex items-center gap-4 text-[13px]" style={{ color: "var(--muted)" }}>
              <SourceTag source={a.source} />
              <span>last received {timeAgo(a.timestamp)}</span>
              <span>{a.duplicate_count} identical firings collapsed into 1 — fingerprint = service + alert + 5-min window</span>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default function Deduplication({ data }) {
  const stats = data?.dedup_stats;
  const unique = useMemo(
    () =>
      [...(data?.clusters ?? []).flatMap((c) => c.alerts), ...(data?.noise ?? [])]
        .filter((a) => (a.duplicate_count ?? 1) > 1)
        .sort((a, b) => (b.duplicate_count ?? 0) - (a.duplicate_count ?? 0)),
    [data]
  );

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const pageRows = unique.slice((page - 1) * perPage, page * perPage);

  if (!stats) return null;

  return (
    <div className="p-6 overflow-auto h-full">
      <h1 className="text-lg font-semibold mb-1">Deduplication</h1>
      <p className="text-[14px] mb-4" style={{ color: "var(--muted)" }}>
        Monitoring re-fires the same alert every check interval — the first layer of noise removal collapses those repeats before any ML runs.
      </p>

      <div className="grid grid-cols-2 min-[1280px]:grid-cols-4 gap-3 mb-6">
        <StatCard icon={<Inbox size={16} />} label="Raw Alerts Received" value={stats.raw_count} color="var(--accent)" delta="all incoming alerts" />
        <StatCard icon={<FingerprintPattern size={16} />} label="Unique After Dedup" value={stats.unique_count} color="var(--high)" delta="after deduplication" />
        <StatCard icon={<Copy size={16} />} label="Duplicates Removed" value={stats.raw_count - stats.unique_count} color="var(--info)" delta="collapsed duplicates" />
        <StatCard icon={<TrendingDown size={16} />} label="Reduction" value={`${stats.reduction_pct}%`} color="var(--ok)" delta="service + alert + 5-min window" />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--panel)" }}>
        <div className="px-4 py-3 text-[15px] font-semibold border-b flex items-center gap-2" style={{ borderColor: "var(--border)" }}>
          <span
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: "color-mix(in srgb, var(--accent) 18%, transparent)", color: "var(--accent)" }}
          >
            <FingerprintPattern size={13} strokeWidth={2} />
          </span>
          Fingerprint groups with collapsed duplicates
          <span className="ml-auto text-[13px] font-normal" style={{ color: "var(--muted)" }}>click a row to expand</span>
        </div>
        <table className="w-full text-[15px]">
          <thead>
            <tr className="text-left text-[13px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              <th className="px-4 py-2 font-medium w-8"></th>
              <th className="px-2 py-2 font-medium">Alert</th>
              <th className="px-2 py-2 font-medium">Service</th>
              <th className="px-2 py-2 font-medium">Fingerprint</th>
              <th className="px-2 py-2 font-medium text-right">Collapsed</th>
              <th className="px-2 py-2 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((a) => <GroupRow key={a.id} a={a} />)}
          </tbody>
        </table>
        <Pager page={page} setPage={setPage} total={unique.length} perPage={perPage} setPerPage={setPerPage} />
      </div>
    </div>
  );
}
