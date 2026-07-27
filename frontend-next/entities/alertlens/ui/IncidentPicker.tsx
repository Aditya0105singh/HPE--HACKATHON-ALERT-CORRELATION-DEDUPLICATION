"use client";

import Link from "next/link";
import { Badge, Card, Text } from "@tremor/react";
import { EmptyStateCard, KeepLoader, SeverityLabel } from "@/shared/ui";
import type { UISeverity } from "@/shared/ui";
import { useClusters } from "@/entities/alertlens";
import { riskColor, timeAgo } from "@/entities/alertlens/lib/format";

/**
 * Shared incident chooser for the analysis pages (/forecast, /timemachine)
 * that operate on one incident at a time.
 */
export function IncidentPicker({
  basePath,
  icon,
  emptyTitle,
}: {
  basePath: string;
  icon?: React.ElementType;
  emptyTitle: string;
}) {
  const { clusters, isLoading, error } = useClusters();

  if (isLoading) return <KeepLoader loadingText="Loading incidents..." />;

  if (error) {
    return (
      <EmptyStateCard
        icon={icon}
        title="Could not load incidents"
        description={String(error)}
      />
    );
  }

  if (clusters.length === 0) {
    return (
      <Card>
        <EmptyStateCard
          noCard
          icon={icon}
          title={emptyTitle}
          description="Load an alert batch to get incidents to analyse."
        />
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
      {clusters.map((c) => (
        <Link key={c.cluster_id} href={`${basePath}/${c.cluster_id}`}>
          <Card className="p-4 hover:shadow-md transition-shadow h-full">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium truncate">
                  {c.root_cause.alertname}
                </div>
                <Text className="text-xs text-gray-500 truncate">
                  {c.root_cause.service} · {timeAgo(c.root_cause.timestamp)}
                </Text>
              </div>
              <SeverityLabel severity={c.root_cause.severity as UISeverity} />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Badge size="xs" color={riskColor(c.risk.level)}>
                {c.risk.level} risk
              </Badge>
              <Text className="text-xs text-gray-500">
                {c.size} alerts · {c.risk.services_affected} services
              </Text>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
