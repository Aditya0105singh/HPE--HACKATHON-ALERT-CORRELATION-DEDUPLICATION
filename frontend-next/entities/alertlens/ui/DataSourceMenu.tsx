"use client";

import { useState } from "react";
import { Button } from "@tremor/react";
import { DropdownMenu, showErrorToast, showSuccessToast } from "@/shared/ui";
import { HiOutlineCircleStack } from "react-icons/hi2";
import { LuFlaskConical, LuSparkles, LuDatabase } from "react-icons/lu";
import { usePipelineActions } from "@/entities/alertlens";

export type DataSourceKey = "loghub" | "aiops" | "synthetic";

export const DATA_SOURCES: {
  key: DataSourceKey;
  label: string;
  sub: string;
  icon: React.ElementType;
}[] = [
  {
    key: "loghub",
    label: "Loghub HDFS_v1",
    sub: "Real dataset",
    icon: LuSparkles,
  },
  {
    key: "aiops",
    label: "AIOps Challenge 2020",
    sub: "Real dataset",
    icon: LuFlaskConical,
  },
  {
    key: "synthetic",
    label: "Synthetic Demo",
    sub: "Scripted incident scenarios",
    icon: LuDatabase,
  },
];

/**
 * Switches the loaded alert batch. Each option replaces the current batch
 * server-side and revalidates the pipeline, so the whole app follows.
 */
export function DataSourceMenu({
  onLoaded,
}: {
  onLoaded?: (key: DataSourceKey) => void;
}) {
  const { loadDemo, loadReal, loadAiops } = usePipelineActions();
  const [busy, setBusy] = useState<DataSourceKey | null>(null);

  const select = async (key: DataSourceKey) => {
    setBusy(key);
    const label = DATA_SOURCES.find((d) => d.key === key)?.label ?? key;
    try {
      const result =
        key === "loghub"
          ? await loadReal()
          : key === "aiops"
            ? await loadAiops()
            : await loadDemo();

      showSuccessToast(
        `Loaded ${label} — ${result.raw_alerts} alerts, ${result.clusters_formed} incidents`
      );
      onLoaded?.(key);
    } catch (e) {
      showErrorToast(e, `Could not load ${label}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <DropdownMenu.Menu
      icon={HiOutlineCircleStack}
      label={busy ? "Loading..." : "Load dataset"}
    >
      {DATA_SOURCES.map(({ key, label, sub, icon }) => (
        <DropdownMenu.Item
          key={key}
          icon={icon}
          label={`${label} — ${sub}`}
          onClick={() => select(key)}
        />
      ))}
    </DropdownMenu.Menu>
  );
}

/** Inline button row variant, for pages that want the choices visible. */
export function DataSourceButtons() {
  const { loadDemo, loadReal, loadAiops } = usePipelineActions();
  const [busy, setBusy] = useState<DataSourceKey | null>(null);

  const run = async (key: DataSourceKey, fn: () => Promise<unknown>) => {
    setBusy(key);
    const label = DATA_SOURCES.find((d) => d.key === key)?.label ?? key;
    try {
      await fn();
      showSuccessToast(`Loaded ${label}`);
    } catch (e) {
      showErrorToast(e, `Could not load ${label}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        size="xs"
        color="orange"
        loading={busy === "loghub"}
        disabled={busy !== null}
        onClick={() => run("loghub", loadReal)}
      >
        Loghub HDFS_v1
      </Button>
      <Button
        size="xs"
        color="orange"
        variant="secondary"
        loading={busy === "aiops"}
        disabled={busy !== null}
        onClick={() => run("aiops", loadAiops)}
      >
        AIOps Challenge 2020
      </Button>
      <Button
        size="xs"
        color="orange"
        variant="secondary"
        loading={busy === "synthetic"}
        disabled={busy !== null}
        onClick={() => run("synthetic", () => loadDemo())}
      >
        Synthetic Demo
      </Button>
    </div>
  );
}
