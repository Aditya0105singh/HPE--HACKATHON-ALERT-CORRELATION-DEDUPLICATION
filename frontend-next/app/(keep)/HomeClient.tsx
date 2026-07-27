"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Badge, Card, Text, Title } from "@tremor/react";
import {
  EmptyStateCard,
  KeepLoader,
  PageSubtitle,
  PageTitle,
  SeverityLabel,
} from "@/shared/ui";
import type { UISeverity } from "@/shared/ui";
import { AiOutlineFire, AiOutlineAlert } from "react-icons/ai";
import { IoMdGitMerge } from "react-icons/io";
import { TbChartDots3, TbTrendingDown } from "react-icons/tb";
import { HiOutlineInbox, HiOutlineEyeSlash } from "react-icons/hi2";
import { usePipelineState } from "@/entities/alertlens";
import type { Alert } from "@/entities/alertlens";
import { StatCard } from "@/entities/alertlens/ui/StatCard";
import { ClusterCard } from "@/entities/alertlens/ui/ClusterCard";
import { AlertDetailDrawer } from "@/entities/alertlens/ui/AlertDetailDrawer";
import { DataSourceButtons } from "@/entities/alertlens/ui/DataSourceMenu";
import { StormMenu } from "@/entities/alertlens/ui/StormControls";
import { riskColor, timeAgo } from "@/entities/alertlens/lib/format";

const RECENT_LIMIT = 12;

export function HomeClient() {
  const { state, isLoading, error } = usePipelineState();
  const [selected, setSelected] = useState<Alert | null>(null);

  const alerts = state.raw_alerts;
  const clusters = state.clusters;

  // Stat definitions preserved from the original AlertLens Home page.
  const stats = useMemo(() => {
    const firing = alerts.filter((a) => a.status === "firing").length;
    const suppressed = alerts.filter((a) => a.status === "suppressed").length;
    const deduped = [...clusters.flatMap((c) => c.alerts), ...state.noise];
    const groups = deduped.filter((a) => (a.duplicate_count ?? 1) > 1).length;
    const noise = alerts.length
      ? (100 * (1 - clusters.length / alerts.length)).toFixed(0)
      : "0";
    return { firing, suppressed, groups, noise };
  }, [alerts, clusters, state.noise]);

  const topServices = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of alerts) {
      if (!a.service) continue;
      counts.set(a.service, (counts.get(a.service) ?? 0) + 1);
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);
  }, [alerts]);

  const recent = useMemo(() => alerts.slice(0, RECENT_LIMIT), [alerts]);

  if (isLoading) {
    return <KeepLoader loadingText="Loading overview..." />;
  }

  if (error) {
    return (
      <div className="p-4">
        <EmptyStateCard
          icon={AiOutlineAlert}
          title="Could not load overview"
          description={String(error)}
        />
      </div>
    );
  }

  if (!state.dedup_stats) {
    return (
      <div className="flex flex-col gap-4 p-4">
        <div>
          <PageTitle>Overview</PageTitle>
          <PageSubtitle>
            Alert correlation, deduplication and AI-driven incident analysis.
          </PageSubtitle>
        </div>
        <Card>
          <EmptyStateCard
            noCard
            icon={HiOutlineInbox}
            title="No alert batch loaded"
            description="Load one of the datasets below to run the pipeline."
          >
            <DataSourceButtons />
          </EmptyStateCard>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <PageTitle>Overview</PageTitle>
          <PageSubtitle>
            Current alert and incident state across the loaded batch.
          </PageSubtitle>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DataSourceButtons />
          <StormMenu />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          label="Active incidents"
          value={clusters.length}
          hint="Correlated now"
          icon={AiOutlineFire}
          color="red"
        />
        <StatCard
          label="Firing alerts"
          value={stats.firing}
          hint="Active now"
          icon={AiOutlineAlert}
          color="orange"
        />
        <StatCard
          label="Correlated groups"
          value={stats.groups}
          hint="Fingerprints collapsed"
          icon={IoMdGitMerge}
          color="blue"
        />
        <StatCard
          label="Suppressed alerts"
          value={stats.suppressed}
          hint="Held back"
          icon={HiOutlineEyeSlash}
          color="gray"
        />
        <StatCard
          label="Noise reduction"
          value={`${stats.noise}%`}
          hint="Raw → incidents"
          icon={TbTrendingDown}
          color="emerald"
        />
        <StatCard
          label="Total alerts (raw)"
          value={alerts.length}
          hint="This batch"
          icon={HiOutlineInbox}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-3">
        <div className="2xl:col-span-2 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Title className="text-base">Top incidents by risk</Title>
            <Link href="/incidents" className="text-xs text-orange-500">
              View all →
            </Link>
          </div>
          {clusters.length === 0 ? (
            <Card>
              <EmptyStateCard
                noCard
                icon={TbChartDots3}
                title="No incidents correlated"
                description="Nothing in this batch grouped into an incident."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {clusters.slice(0, 4).map((c) => (
                <ClusterCard key={c.cluster_id} cluster={c} />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <Title className="text-base">Most affected services</Title>
          <Card className="p-4">
            {topServices.length === 0 ? (
              <Text className="text-sm text-gray-500">No services yet.</Text>
            ) : (
              <div className="flex flex-col gap-2">
                {topServices.map(([service, count]) => {
                  const max = topServices[0][1] || 1;
                  return (
                    <div key={service} className="flex items-center gap-2">
                      <div className="w-36 text-sm truncate">{service}</div>
                      <div className="flex-1 h-2 rounded bg-gray-100 overflow-hidden">
                        <div
                          className="h-full bg-orange-400"
                          style={{ width: `${(count / max) * 100}%` }}
                        />
                      </div>
                      <div className="w-8 text-xs text-gray-500 text-right">
                        {count}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          <div className="flex items-center justify-between">
            <Title className="text-base">Risk breakdown</Title>
          </div>
          <Card className="p-4 flex flex-col gap-2">
            {(["high", "medium", "low"] as const).map((level) => {
              const n = clusters.filter((c) => c.risk.level === level).length;
              return (
                <div key={level} className="flex items-center justify-between">
                  <Badge size="xs" color={riskColor(level)}>
                    {level}
                  </Badge>
                  <Text className="text-sm">{n} incidents</Text>
                </div>
              );
            })}
          </Card>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Title className="text-base">Recent alerts</Title>
        <Link href="/feed" className="text-xs text-orange-500">
          Open feed →
        </Link>
      </div>
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-200">
                <th className="py-2 px-3">Severity</th>
                <th className="py-2 px-3">Alert</th>
                <th className="py-2 px-3">Service</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Received</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr
                  key={a.id}
                  className="border-b border-gray-100 last:border-0 cursor-pointer hover:bg-gray-50"
                  onClick={() => setSelected(a)}
                >
                  <td className="py-2 px-3">
                    <SeverityLabel severity={a.severity as UISeverity} />
                  </td>
                  <td className="py-2 px-3">
                    <div className="font-medium truncate max-w-xs">
                      {a.alertname}
                    </div>
                    <div className="text-xs text-gray-500 truncate max-w-md">
                      {a.message}
                    </div>
                  </td>
                  <td className="py-2 px-3">{a.service}</td>
                  <td className="py-2 px-3">
                    <Badge size="xs" color="gray">
                      {a.status}
                    </Badge>
                  </td>
                  <td className="py-2 px-3 text-xs text-gray-500 whitespace-nowrap">
                    {timeAgo(a.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <AlertDetailDrawer alert={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
