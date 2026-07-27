"use client";

import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, ProgressBar, Text } from "@tremor/react";
import { DropdownMenu, showErrorToast, showSuccessToast } from "@/shared/ui";
import { LuZap, LuPause, LuPlay, LuFastForward, LuShuffle, LuX } from "react-icons/lu";
import { useApi } from "@/shared/lib/hooks/useApi";
import { usePipelineActions } from "@/entities/alertlens";
import type { PipelineState } from "@/entities/alertlens";
import {
  STORM_SCENARIOS,
  STORM_SECONDS,
  STORM_SPEEDS,
  useStormStore,
} from "@/entities/alertlens/model/useStormStore";

const TICK_MS = 100;

/**
 * Drives the replay clock. Mounted once (in the app layout) so the animation
 * keeps running as the user moves between pages.
 */
export function StormEngine() {
  const isStorming = useStormStore((s) => s.full !== null);
  const tick = useStormStore((s) => s.tick);

  useEffect(() => {
    if (!isStorming) return;
    const iv = setInterval(tick, TICK_MS);
    return () => clearInterval(iv);
  }, [isStorming, tick]);

  return null;
}

/**
 * "Inject failure" — loads a scenario batch and replays it progressively so
 * you can watch correlation happen, rather than seeing the finished result.
 */
export function StormMenu() {
  const api = useApi();
  const { loadDemo } = usePipelineActions();
  const start = useStormStore((s) => s.start);
  const isStorming = useStormStore((s) => s.full !== null);
  const [busy, setBusy] = useState(false);

  const inject = async (scenario: string | null, replay: boolean) => {
    setBusy(true);
    try {
      await loadDemo(scenario ? { scenario } : {});
      if (!replay) {
        showSuccessToast("Batch loaded");
        return;
      }
      // Read the freshly-loaded batch, then reveal it over the replay window.
      const full = await api.get<PipelineState>("/pipeline");
      start(full, scenario);
    } catch (e) {
      showErrorToast(e, "Could not inject failure");
    } finally {
      setBusy(false);
    }
  };

  return (
    <DropdownMenu.Menu
      icon={LuZap}
      label={busy ? "Storm incoming…" : "Inject failure"}
      disabled={busy || isStorming}
    >
      {STORM_SCENARIOS.map((s) => (
        <DropdownMenu.Item
          key={s.key}
          icon={LuZap}
          label={s.label}
          onClick={() => inject(s.key, true)}
        />
      ))}
      <DropdownMenu.Item
        icon={LuShuffle}
        label="Surprise me"
        onClick={() => inject(null, true)}
      />
      <DropdownMenu.Item
        icon={LuFastForward}
        label="Instant load (no replay)"
        onClick={() => inject(null, false)}
      />
    </DropdownMenu.Menu>
  );
}

/** Floating transport controls, shown only while a replay is running. */
export function StormControls() {
  const { full, elapsed, speed, paused, scenario, setSpeed, togglePause, stop } =
    useStormStore();
  const lastCount = useRef(0);

  if (!full) {
    lastCount.current = 0;
    return null;
  }

  const progress = Math.min(elapsed / STORM_SECONDS, 1) * 100;
  const label =
    STORM_SCENARIOS.find((s) => s.key === scenario)?.label ?? "Live replay";

  return (
    <Card className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 w-[min(30rem,calc(100vw-2.5rem))] p-3 shadow-2xl">
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <LuZap className="w-4 h-4 text-orange-500 shrink-0" />
          <Text className="font-medium truncate">{label}</Text>
          <Badge size="xs" color="orange">
            replaying
          </Badge>
        </div>
        <button
          type="button"
          aria-label="Stop replay"
          onClick={stop}
          className="p-1 rounded hover:bg-gray-100 text-gray-500"
        >
          <LuX className="w-4 h-4" />
        </button>
      </div>

      <ProgressBar value={progress} color="orange" />

      <div className="flex items-center justify-between gap-2 mt-2">
        <Button
          size="xs"
          variant="secondary"
          color="orange"
          icon={paused ? LuPlay : LuPause}
          onClick={togglePause}
        >
          {paused ? "Resume" : "Pause"}
        </Button>
        <div className="flex items-center gap-1">
          {STORM_SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              className={`text-xs px-2 py-1 rounded border ${
                speed === s
                  ? "border-orange-400 text-orange-600"
                  : "border-gray-200 text-gray-500"
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
        <Text className="text-xs text-gray-500 tabular-nums">
          {Math.min(elapsed, STORM_SECONDS).toFixed(1)}s / {STORM_SECONDS}s
        </Text>
      </div>
    </Card>
  );
}
