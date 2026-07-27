import { useCallback } from "react";
import { useSWRConfig } from "swr";
import { useApi } from "@/shared/lib/hooks/useApi";
import { PIPELINE_KEY } from "./usePipeline";
import type { PipelineRunSummary } from "./types";

/**
 * Per-alert actions. These persist to the backend's actions table and then
 * replay the current batch through the pipeline, so they can change cluster
 * membership and risk — not just a badge. Each therefore revalidates the whole
 * pipeline rather than patching a single alert locally.
 */
export const useAlertActions = () => {
  const api = useApi();
  const { mutate } = useSWRConfig();

  const refreshPipeline = useCallback(() => mutate(PIPELINE_KEY), [mutate]);

  /** POST /alerts/{id}/ack */
  const ackAlert = useCallback(
    async (alertId: string, value: boolean) => {
      const result = await api.post<PipelineRunSummary>(
        `/alerts/${encodeURIComponent(alertId)}/ack`,
        { value }
      );
      await refreshPipeline();
      return result;
    },
    [api, refreshPipeline]
  );

  /** POST /alerts/{id}/assign — pass null to unassign. */
  const assignAlert = useCallback(
    async (alertId: string, assignee: string | null) => {
      const result = await api.post<PipelineRunSummary>(
        `/alerts/${encodeURIComponent(alertId)}/assign`,
        { assignee }
      );
      await refreshPipeline();
      return result;
    },
    [api, refreshPipeline]
  );

  /**
   * POST /alerts/{id}/dismiss — status override.
   * "suppressed" | "resolved" | null (null clears the override).
   */
  const dismissAlert = useCallback(
    async (alertId: string, status: "suppressed" | "resolved" | null) => {
      const result = await api.post<PipelineRunSummary>(
        `/alerts/${encodeURIComponent(alertId)}/dismiss`,
        { status }
      );
      await refreshPipeline();
      return result;
    },
    [api, refreshPipeline]
  );

  /** POST /alerts/{id}/escalate */
  const escalateAlert = useCallback(
    async (alertId: string, value: boolean) => {
      const result = await api.post<PipelineRunSummary>(
        `/alerts/${encodeURIComponent(alertId)}/escalate`,
        { value }
      );
      await refreshPipeline();
      return result;
    },
    [api, refreshPipeline]
  );

  return { ackAlert, assignAlert, dismissAlert, escalateAlert };
};
