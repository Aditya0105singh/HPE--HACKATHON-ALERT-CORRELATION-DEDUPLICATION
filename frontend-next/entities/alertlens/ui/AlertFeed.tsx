"use client";

import { useMemo, useState } from "react";
import { Badge, Card, Text, TextInput } from "@tremor/react";
import { DisplayColumnDef } from "@tanstack/react-table";
import { GenericTable } from "@/components/table/GenericTable";
import {
  EmptyStateCard,
  KeepLoader,
  PageSubtitle,
  PageTitle,
  SeverityLabel,
} from "@/shared/ui";
import type { UISeverity } from "@/shared/ui";
import { AiOutlineAlert } from "react-icons/ai";
import { useFilteredAlerts } from "@/entities/alertlens";
import type { Alert } from "@/entities/alertlens";
import { timeAgo } from "@/entities/alertlens/lib/format";
import { AlertDetailDrawer } from "./AlertDetailDrawer";
import {
  AlertFacets,
  applyFacets,
  emptySelections,
  type FacetKey,
} from "./AlertFacets";

const PAGE_SIZE = 20;

const statusColor = (status: string) => {
  switch (status) {
    case "firing":
      return "red";
    case "resolved":
      return "emerald";
    case "suppressed":
      return "gray";
    default:
      return "gray";
  }
};

export function AlertFeed({
  title,
  subtitle,
  firingOnly = false,
  criticalOnly = false,
}: {
  title: string;
  subtitle: string;
  firingOnly?: boolean;
  criticalOnly?: boolean;
}) {
  const { alerts, isLoading, error } = useFilteredAlerts({
    firingOnly,
    criticalOnly,
  });

  const [query, setQuery] = useState("");
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<Alert | null>(null);
  const [facets, setFacets] = useState(emptySelections);

  const toggleFacet = (key: FacetKey, value: string) => {
    setFacets((prev) => {
      const next = { ...prev, [key]: new Set(prev[key]) };
      if (next[key].has(value)) next[key].delete(value);
      else next[key].add(value);
      return next;
    });
    setOffset(0);
  };

  const filtered = useMemo(() => {
    const faceted = applyFacets(alerts, facets);
    const q = query.trim().toLowerCase();
    if (!q) return faceted;
    return faceted.filter((a) =>
      [a.alertname, a.service, a.message, a.source].some((f) =>
        f?.toLowerCase().includes(q)
      )
    );
  }, [alerts, facets, query]);

  const columns = useMemo<DisplayColumnDef<Alert>[]>(
    () => [
      {
        id: "severity",
        header: "Severity",
        cell: ({ row }) => (
          <SeverityLabel severity={row.original.severity as UISeverity} />
        ),
      },
      {
        id: "alertname",
        header: "Alert",
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium truncate">{row.original.alertname}</div>
            <div className="text-xs text-gray-500 truncate">
              {row.original.message}
            </div>
          </div>
        ),
      },
      {
        id: "service",
        header: "Service",
        cell: ({ row }) => (
          <Text className="truncate">{row.original.service}</Text>
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => (
          <Badge size="xs" color={statusColor(row.original.status)}>
            {row.original.status}
          </Badge>
        ),
      },
      {
        id: "source",
        header: "Source",
        cell: ({ row }) => (
          <Text className="text-xs text-gray-500">{row.original.source}</Text>
        ),
      },
      {
        id: "flags",
        header: "",
        cell: ({ row }) => (
          <div className="flex gap-1">
            {row.original.acked && (
              <Badge size="xs" color="emerald">
                ack
              </Badge>
            )}
            {row.original.escalated && (
              <Badge size="xs" color="red">
                esc
              </Badge>
            )}
            {(row.original.duplicate_count ?? 1) > 1 && (
              <Badge size="xs" color="orange">
                ×{row.original.duplicate_count}
              </Badge>
            )}
          </div>
        ),
      },
      {
        id: "timestamp",
        header: "Received",
        cell: ({ row }) => (
          <Text className="text-xs text-gray-500 whitespace-nowrap">
            {timeAgo(row.original.timestamp)}
          </Text>
        ),
      },
    ],
    []
  );

  const pageRows = useMemo(
    () => filtered.slice(offset, offset + limit),
    [filtered, offset, limit]
  );

  if (isLoading) {
    return <KeepLoader loadingText="Loading alerts..." />;
  }

  if (error) {
    return (
      <div className="p-4">
        <EmptyStateCard
          icon={AiOutlineAlert}
          title="Could not load alerts"
          description={String(error)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <PageTitle>{title}</PageTitle>
          <PageSubtitle>{subtitle}</PageSubtitle>
        </div>
        <TextInput
          className="max-w-xs"
          placeholder="Filter alerts..."
          value={query}
          onValueChange={(v) => {
            setQuery(v);
            setOffset(0);
          }}
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-4 items-start">
        <AlertFacets
          alerts={alerts}
          selections={facets}
          onToggle={toggleFacet}
          onReset={() => {
            setFacets(emptySelections());
            setOffset(0);
          }}
        />

        <div className="flex-1 min-w-0 w-full">
          {filtered.length === 0 ? (
            <Card>
              <EmptyStateCard
                noCard
                icon={AiOutlineAlert}
                title="No alerts match"
                description={
                  alerts.length === 0
                    ? "No alert batch is loaded, or none match this view."
                    : "Try clearing the filters."
                }
              />
            </Card>
          ) : (
            <GenericTable<Alert>
              data={pageRows}
              columns={columns}
              rowCount={filtered.length}
              offset={offset}
              limit={limit}
              dataFetchedAtOneGO
              onRowClick={(row) => setSelected(row)}
              onPaginationChange={(newLimit, newOffset) => {
                setLimit(newLimit);
                setOffset(newOffset);
              }}
            />
          )}
        </div>
      </div>

      <AlertDetailDrawer alert={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
