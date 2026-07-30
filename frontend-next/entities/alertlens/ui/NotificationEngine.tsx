"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { usePipelineState } from "../model/usePipeline";

/**
 * Fires a real OS-level browser notification the moment a cluster crosses
 * into "high" risk - whether that's a live storm replay, a real dataset
 * load, or the routine 30s poll. Mounted once at the app root so it keeps
 * watching regardless of which page is open, the same way StormEngine keeps
 * the replay clock running across navigation.
 *
 * Dedupes on "have we already notified for this cluster", not "have we seen
 * this cluster id" - during a storm replay a cluster's risk score is scaled
 * by how much of it has been revealed (see projectStorm in useStormStore),
 * so a real incident typically enters at low/medium risk and only crosses
 * into "high" partway through the replay. Deduping on first sight would
 * baseline it at that first, still-low appearance and it would never fire
 * once it later escalated - the opposite of what this is for.
 *
 * Deliberately silent if permission was never granted - see
 * useBrowserNotifications, which is the only place that ever prompts.
 */
export function NotificationEngine() {
  const { state } = usePipelineState();
  const { clusters } = state;
  const router = useRouter();
  const notified = useRef<Set<number>>(new Set());
  // First render after a page load/reload would otherwise notify for every
  // incident already at high risk in the batch, not just ones that newly
  // cross into it - this flags once that baseline has been recorded.
  const baselined = useRef(false);

  useEffect(() => {
    const canNotify =
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "granted";

    for (const cluster of clusters) {
      if (cluster.risk.level !== "high") continue;
      if (notified.current.has(cluster.cluster_id)) continue;
      notified.current.add(cluster.cluster_id);

      if (!baselined.current || !canNotify) continue;

      const notification = new Notification(
        `New high-risk incident: ${cluster.root_cause.alertname}`,
        {
          body: `${cluster.root_cause.service} · ${cluster.size} alerts · ${Math.round(cluster.risk.score * 100)}% risk`,
          tag: `alertlens-cluster-${cluster.cluster_id}`,
          icon: "/icons-pwa/icon-192.png",
        }
      );
      notification.onclick = () => {
        window.focus();
        router.push(`/incidents/${cluster.cluster_id}`);
        notification.close();
      };
    }

    baselined.current = true;
  }, [clusters, router]);

  return null;
}
