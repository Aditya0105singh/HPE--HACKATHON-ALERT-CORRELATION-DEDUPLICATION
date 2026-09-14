import { useCallback } from "react";
import useSWR, { useSWRConfig, SWRConfiguration } from "swr";
import { useApi } from "@/shared/lib/hooks/useApi";
import type {
  AuditEntry,
  DemoRunRequest,
  DraftDetail,
  PipelineReport,
  QueueSummary,
  Topology,
} from "./types";

export const REPORT_KEY = "/ensylon/report";
export const QUEUE_KEY = "/ensylon/queue";
export const AUDIT_KEY = "/ensylon/audit";
export const TOPOLOGIES_KEY = "/ensylon/topologies";

/** GET /ensylon/report — the last scenario run's pipeline stats + measured
 * evaluation against its own injected ground truth (see pipeline.evaluate). */
export const useEnsylonReport = (options: SWRConfiguration = {}) => {
  const api = useApi();
  return useSWR<PipelineReport>(
    api.isReady() ? REPORT_KEY : null,
    (url: string) => api.get(url),
    { refreshInterval: 0, ...options }
  );
};

/** GET /ensylon/queue — every draft, any status. Filtered client-side so the
 * page can show pending/published/rejected/merged as tabs without refetching. */
export const useEnsylonQueue = (options: SWRConfiguration = {}) => {
  const api = useApi();
  return useSWR<QueueSummary[]>(
    api.isReady() ? QUEUE_KEY : null,
    (url: string) => api.get(url),
    { refreshInterval: 0, ...options }
  );
};

export const useEnsylonAudit = (options: SWRConfiguration = {}) => {
  const api = useApi();
  return useSWR<AuditEntry[]>(
    api.isReady() ? AUDIT_KEY : null,
    (url: string) => api.get(url),
    { refreshInterval: 0, ...options }
  );
};

export const useEnsylonTopologies = (options: SWRConfiguration = {}) => {
  const api = useApi();
  return useSWR<Topology[]>(
    api.isReady() ? TOPOLOGIES_KEY : null,
    (url: string) => api.get(url),
    options
  );
};

/** GET /ensylon/queue/{id} — the full ticket, fetched on demand when a row
 * is expanded rather than bundled into the list response. */
export const useEnsylonDraft = (draftId: string | null, options: SWRConfiguration = {}) => {
  const api = useApi();
  return useSWR<DraftDetail>(
    api.isReady() && draftId ? `${QUEUE_KEY}/${draftId}` : null,
    (url: string) => api.get(url),
    options
  );
};

/** Mutations. Every write here maps to exactly one backend route in
 * ensylon_api.py, which is itself a thin wrapper over app/ensylon/review.py
 * — the actual approval-token gate lives there, not in this hook. */
export const useEnsylonActions = () => {
  const api = useApi();
  const { mutate } = useSWRConfig();

  const refreshAll = useCallback(
    () => Promise.all([mutate(QUEUE_KEY), mutate(REPORT_KEY), mutate(AUDIT_KEY)]),
    [mutate]
  );

  const runDemo = useCallback(
    async (body: DemoRunRequest) => {
      const result = await api.post<{ report: PipelineReport; queue: QueueSummary[] }>(
        "/ensylon/demo/run",
        body
      );
      await refreshAll();
      return result;
    },
    [api, refreshAll]
  );

  const approve = useCallback(
    async (draftId: string, actor: string, edits?: Record<string, unknown>) => {
      const result = await api.post<DraftDetail>(`${QUEUE_KEY}/${draftId}/approve`, {
        actor,
        edits,
      });
      await refreshAll();
      return result;
    },
    [api, refreshAll]
  );

  const reject = useCallback(
    async (draftId: string, actor: string, note = "") => {
      const result = await api.post<DraftDetail>(`${QUEUE_KEY}/${draftId}/reject`, {
        actor,
        note,
      });
      await refreshAll();
      return result;
    },
    [api, refreshAll]
  );

  const merge = useCallback(
    async (draftId: string, into: string, actor: string, note = "") => {
      const result = await api.post<DraftDetail>(`${QUEUE_KEY}/${draftId}/merge`, {
        actor,
        into,
        note,
      });
      await refreshAll();
      return result;
    },
    [api, refreshAll]
  );

  return { runDemo, approve, reject, merge, refreshAll };
};
