"use client";

import Link from "next/link";
import { Card, ProgressBar, Text, Title } from "@tremor/react";
import {
  EmptyStateCard,
  KeepLoader,
  PageSubtitle,
  PageTitle,
} from "@/shared/ui";
import { LuGauge } from "react-icons/lu";
import { useForecast, useIncident } from "@/entities/alertlens";
import { StatCard } from "@/entities/alertlens/ui/StatCard";
import { timeAgo } from "@/entities/alertlens/lib/format";

export function ForecastDetailClient({ incidentId }: { incidentId: string }) {
  const { incident, notFound } = useIncident(incidentId);
  const { data, error, isLoading } = useForecast(incidentId);

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
          <Link href="/forecast" className="text-orange-500 text-sm">
            Back to forecast
          </Link>
        </EmptyStateCard>
      </div>
    );
  }

  const reasoning = Array.isArray(data.reasoning)
    ? data.reasoning
    : data.reasoning
      ? [data.reasoning]
      : [];

  const peak = data.forecast?.length
    ? Math.max(...data.forecast.map((p) => p.alerts))
    : 0;

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div>
        <Link
          href="/forecast"
          className="text-xs text-gray-500 hover:text-orange-500"
        >
          ← Forecast
        </Link>
        <div className="mt-1">
          <PageTitle>
            {incident ? incident.root_cause.alertname : `Incident ${incidentId}`}
          </PageTitle>
          {incident && (
            <PageSubtitle>
              Root cause on {incident.root_cause.service} ·{" "}
              {timeAgo(incident.root_cause.timestamp)}
            </PageSubtitle>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Current risk"
          value={`${data.currentRisk}%`}
          icon={LuGauge}
          color="red"
        />
        <StatCard
          label="Predicted blast radius"
          value={`${data.predictedBlastRadius} services`}
          color="amber"
        />
        <StatCard
          label="Forecast confidence"
          value={`${Math.round(data.confidence * 100)}%`}
          color="blue"
        />
        <StatCard label="Peak alert volume" value={peak} color="orange" />
      </div>

      <Card className="p-4">
        <Title className="text-base">Recommended immediate action</Title>
        <Text className="mt-1">{data.recommendedImmediateAction}</Text>
      </Card>

      <Card className="p-4">
        <Title className="text-base mb-3">Projection</Title>
        <div className="flex flex-col gap-3">
          {data.forecast?.map((p) => (
            <div key={p.minutes}>
              <div className="flex items-center gap-3">
                <div className="w-14 text-xs text-gray-500 shrink-0">
                  +{p.minutes}m
                </div>
                <div className="flex-1">
                  <ProgressBar value={p.risk} color="red" />
                </div>
                <div className="w-44 text-xs text-gray-500 text-right shrink-0">
                  risk {p.risk}% · {p.alerts} alerts ·{" "}
                  {Math.round(p.confidence * 100)}% conf
                </div>
              </div>
              {p.newServices?.length > 0 && (
                <div className="ml-14 mt-1 text-xs text-gray-500">
                  New services affected: {p.newServices.join(", ")}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      {reasoning.length > 0 && (
        <Card className="p-4">
          <Title className="text-base mb-2">Why this forecast</Title>
          <ul className="list-disc pl-5 text-sm space-y-1">
            {reasoning.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </Card>
      )}

      {incident && (
        <Link
          href={`/incidents/${incident.cluster_id}`}
          className="text-sm text-orange-500"
        >
          Open full incident →
        </Link>
      )}
    </div>
  );
}
