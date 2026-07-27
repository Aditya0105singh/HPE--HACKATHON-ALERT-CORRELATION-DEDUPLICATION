"use client";

import { Card } from "@tremor/react";
import {
  EmptyStateCard,
  KeepLoader,
  PageSubtitle,
  PageTitle,
} from "@/shared/ui";
import { TbChartDots3 } from "react-icons/tb";
import { HiOutlineInbox } from "react-icons/hi2";
import { IoMdGitMerge } from "react-icons/io";
import { LuClock } from "react-icons/lu";
import { usePipelineState } from "@/entities/alertlens";
import { StatCard } from "@/entities/alertlens/ui/StatCard";
import { ClusterCard } from "@/entities/alertlens/ui/ClusterCard";
import { ChaosOrder } from "@/entities/alertlens/ui/ChaosOrder";

export function CorrelationsClient() {
  const { state, isLoading, error } = usePipelineState();

  if (isLoading) {
    return <KeepLoader loadingText="Correlating alerts..." />;
  }

  if (error) {
    return (
      <div className="p-4">
        <EmptyStateCard
          icon={TbChartDots3}
          title="Could not load correlations"
          description={String(error)}
        />
      </div>
    );
  }

  const { clusters, noise } = state;
  const correlatedAlerts = clusters.reduce((sum, c) => sum + c.size, 0);
  const triageSaved = clusters.reduce(
    (sum, c) => sum + c.est_triage_minutes_saved,
    0
  );

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <div>
        <PageTitle>Correlations</PageTitle>
        <PageSubtitle>
          Deduplicated alerts grouped into incidents by the correlation engine.
          Each group shares a suspected root cause.
        </PageSubtitle>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard
          label="Incidents formed"
          value={clusters.length}
          hint="Correlated alert groups"
          icon={TbChartDots3}
          color="orange"
        />
        <StatCard
          label="Alerts correlated"
          value={correlatedAlerts}
          hint="Alerts placed into an incident"
          icon={IoMdGitMerge}
          color="blue"
        />
        <StatCard
          label="Uncorrelated"
          value={noise.length}
          hint="Standalone noise, no group"
          icon={HiOutlineInbox}
          color="gray"
        />
        <StatCard
          label="Triage time saved"
          value={`${triageSaved}m`}
          hint="Estimated across all incidents"
          icon={LuClock}
          color="emerald"
        />
      </div>

      {clusters.length > 0 && <ChaosOrder />}

      {clusters.length === 0 ? (
        <Card>
          <EmptyStateCard
            noCard
            icon={TbChartDots3}
            title="No incidents correlated"
            description="No alert batch is loaded, or nothing in it correlated into a group."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-3">
          {clusters.map((cluster) => (
            <ClusterCard key={cluster.cluster_id} cluster={cluster} />
          ))}
        </div>
      )}
    </div>
  );
}
