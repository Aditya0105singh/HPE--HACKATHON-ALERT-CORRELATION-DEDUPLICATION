"use client";

import Link from "next/link";
import { Badge, Text } from "@tremor/react";
import { LuChevronRight, LuListChecks } from "react-icons/lu";
import { EmptyStateCard, KeepLoader, SeverityLabel } from "@/shared/ui";
import type { UISeverity } from "@/shared/ui";
import { useClusters } from "@/entities/alertlens";
import { riskColor, timeAgo } from "@/entities/alertlens/lib/format";
import { AlertIcon } from "./AlertIcon";

// Tailwind's compiler needs literal class names in source, so a template
// string like `border-t-${color}-400` gets purged at build time — this maps
// each risk level to a class Tailwind can actually see.
const RISK_ACCENT: Record<string, string> = {
  red: "border-t-red-400",
  amber: "border-t-amber-400",
  emerald: "border-t-emerald-400",
  gray: "border-t-gray-300",
};

const shell = {
  background: "linear-gradient(160deg,#fff 60%,#f0fdf4)",
  boxShadow: "0 1px 2px rgba(16,24,40,.05), 0 8px 24px -12px rgba(16,24,40,.12)",
} as const;

/**
 * Shared incident chooser for the analysis pages (/forecast, /timemachine)
 * that operate on one incident at a time.
 *
 * Deliberately does not accept the empty-state icon as a prop: the callers
 * are Server Components, and passing a component reference (as opposed to a
 * rendered element) from a Server Component into this "use client" module
 * crashes with "functions cannot be passed to Client Components". Since the
 * icon is decorative, it's simplest to just own a default here.
 */
export function IncidentPicker({
  basePath,
  emptyTitle,
}: {
  basePath: string;
  emptyTitle: string;
}) {
  const { clusters, isLoading, error } = useClusters();

  if (isLoading) return <KeepLoader loadingText="Loading incidents..." />;

  if (error) {
    return (
      <EmptyStateCard
        icon={LuListChecks}
        title="Could not load incidents"
        description={String(error)}
      />
    );
  }

  if (clusters.length === 0) {
    return (
      <div className="kpi-card rounded-2xl border border-white/80 p-4" style={shell}>
        <EmptyStateCard
          noCard
          icon={LuListChecks}
          title={emptyTitle}
          description="Load an alert batch to get incidents to analyse."
        />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
      {clusters.map((c, i) => (
        <Link key={c.cluster_id} href={`${basePath}/${c.cluster_id}`} className="group">
          <div
            className={`kpi-card rounded-2xl border border-white/80 border-t-2 p-4 h-full transition-shadow hover:shadow-md ${RISK_ACCENT[riskColor(c.risk.level)] ?? RISK_ACCENT.gray}`}
            style={{ ...shell, animationDelay: `${Math.min(i, 12) * 60}ms` }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2.5 min-w-0">
                <AlertIcon
                  alertname={c.root_cause.alertname}
                  severity={c.root_cause.severity}
                  service={c.root_cause.service}
                  className="mt-0.5"
                />
                <div className="min-w-0">
                  <div className="font-semibold text-gray-900 truncate">
                    {c.root_cause.alertname}
                  </div>
                  <Text className="text-xs text-gray-600 truncate">
                    {c.root_cause.service} · {timeAgo(c.root_cause.timestamp)}
                  </Text>
                </div>
              </div>
              <SeverityLabel severity={c.root_cause.severity as UISeverity} />
            </div>
            <div className="flex items-center justify-between gap-2 mt-2">
              <div className="flex items-center gap-2">
                <Badge size="xs" color={riskColor(c.risk.level)}>
                  {c.risk.level} risk
                </Badge>
                <Text className="text-xs text-gray-600">
                  {c.size} alerts · {c.risk.services_affected} services
                </Text>
              </div>
              <LuChevronRight className="w-4 h-4 text-gray-300 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-green-500" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
