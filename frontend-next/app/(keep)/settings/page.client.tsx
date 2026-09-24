"use client";

import { Badge, Button, Card, Text } from "@tremor/react";
import { HiOutlineCog6Tooth } from "react-icons/hi2";
import { EmptyStateCard, KeepLoader, PageHero } from "@/shared/ui";
import { useSettingsStatus } from "@/entities/alertlens";
import { useConfig } from "@/utils/hooks/useConfig";

function StatusRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <Text className="text-sm text-gray-500">{label}</Text>
      <span className={mono ? "text-xs font-mono text-gray-700" : "text-sm font-medium"}>
        {value}
      </span>
    </div>
  );
}

// The backend reports an absolute path; showing it would leak the host's
// directory layout to anyone who can open this page.
const fileName = (path: string) => path.split(/[\\/]/).pop() || path;

export default function SettingsPage() {
  const { data: status, isLoading, error } = useSettingsStatus();
  const { data: config } = useConfig();

  return (
    <div className="flex flex-col gap-4 p-4">
      <PageHero
        icon={HiOutlineCog6Tooth}
        title="Settings"
        subtitle="Real system status — what's actually running right now, not a settings form for accounts this backend doesn't have."
      />

      {isLoading ? (
        <KeepLoader includeMinHeight={false} loadingText="Loading status..." />
      ) : error ? (
        <EmptyStateCard
          icon={HiOutlineCog6Tooth}
          title="Could not load status"
          description={String(error)}
        />
      ) : status ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <Text className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              Engine
            </Text>
            <StatusRow
              label="Dataset loaded"
              value={<Badge color="emerald" size="xs">{status.dataset}</Badge>}
            />
            <StatusRow label="Persisted alerts" value={status.persisted_alert_count} />
            <StatusRow label="Active incidents" value={status.active_incident_count} />
            <StatusRow label="Database file" value={fileName(status.db_path)} mono />
          </Card>

          <Card>
            <Text className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              Automation
            </Text>
            <StatusRow
              label="LLM provider"
              value={
                status.llm_configured ? (
                  <Badge color="emerald" size="xs">
                    {status.llm_provider}
                  </Badge>
                ) : (
                  <Badge color="gray" size="xs">
                    not configured
                  </Badge>
                )
              }
            />
          </Card>

          <Card>
            <Text className="text-xs uppercase tracking-wide text-gray-400 mb-2">
              Frontend
            </Text>
            <StatusRow label="Auth mode" value={config?.AUTH_TYPE ?? "unknown"} />
            <StatusRow
              label="Backend URL"
              value={config?.API_URL_CLIENT || "same origin"}
              mono
            />
            <StatusRow
              label="Read-only mode"
              value={config?.READ_ONLY ? "enabled" : "disabled"}
            />
          </Card>
        </div>
      ) : null}
    </div>
  );
}
