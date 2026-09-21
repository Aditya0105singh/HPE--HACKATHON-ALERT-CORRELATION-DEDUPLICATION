"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@tremor/react";
import { LuZap } from "react-icons/lu";
import { showErrorToast } from "@/shared/ui";
import { useEngineActions } from "./useEngine";

/**
 * Injects the fixed golden failure into the real engine and opens the incident
 * it produced. Nothing is published: the draft waits in the review queue.
 */
export function InjectFailureButton() {
  const { injectGolden } = useEngineActions();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const inject = async () => {
    setBusy(true);
    try {
      const { queue } = await injectGolden();
      const first = queue[0];
      router.push(first ? `/review/${encodeURIComponent(first.draft_id)}` : "/review");
    } catch (e) {
      showErrorToast(e, "Could not inject failure");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button size="xs" color="emerald" icon={LuZap} loading={busy} disabled={busy} onClick={inject} className="whitespace-nowrap">
      {busy ? "Running pipeline…" : "Inject failure"}
    </Button>
  );
}
