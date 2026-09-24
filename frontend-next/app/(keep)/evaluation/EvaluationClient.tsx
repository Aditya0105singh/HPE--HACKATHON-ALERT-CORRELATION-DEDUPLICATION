"use client";

import { Card, ProgressBar, Text, Title } from "@tremor/react";
import { EmptyStateCard, KeepLoader, PageHero } from "@/shared/ui";
import { LuBrainCircuit } from "react-icons/lu";
import { EngineEvaluationCard } from "@/entities/engine/EngineCards";
import { EngineBenchmarkCard } from "@/entities/engine/EngineBenchmarkCard";
import { HiOutlineShieldCheck } from "react-icons/hi2";
import { useEvaluation } from "@/entities/alertlens";
import { StatCard } from "@/entities/alertlens/ui/StatCard";
import {
  DataTable,
  TableHead,
  Td,
  Th,
  Tr,
} from "@/entities/alertlens/ui/Table";

const pctColor = (v: number) =>
  v >= 90 ? "emerald" : v >= 70 ? "amber" : "red";

export function EvaluationClient() {
  const { data, error, isLoading } = useEvaluation();

  return (
    <div className="flex flex-col gap-4 p-4 h-full">
      <PageHero
        icon={HiOutlineShieldCheck}
        title="Model Evaluation"
        subtitle="Every number here is measured against an answer key the system never reads. The engine is scored on held-out estates; the golden run is a reproduction check; the baseline below is a different, simpler algorithm."
      />

      <EngineBenchmarkCard />

      <EngineEvaluationCard />

      {/* The engine benchmark above never depends on the baseline below: a
          missing or failed baseline evaluation must not hide the engine's own
          numbers. */}
      {isLoading ? (
        <KeepLoader
          includeMinHeight={false}
          loadingText="Scoring the baseline across its seed set..."
        />
      ) : error || !data ? (
        <EmptyStateCard
          icon={LuBrainCircuit}
          title="Baseline evaluation unavailable"
          description={error ? String(error) : "Load an alert batch first."}
        />
      ) : (
        <>
          <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3">
            <h2 className="text-sm font-bold text-gray-900">
              Baseline: dataset scale explorer
            </h2>
            <p className="text-xs text-gray-600 max-w-4xl mt-0.5">
              The Overview, Incidents, Correlations and Topology pages run on a
              simpler baseline pipeline built for large datasets: DBSCAN over
              alert text and time, without the engine&apos;s shared-context
              gate, causal root cause or review gate. It is scored here on its
              own generator across {data.seeds_tested} fixed seeds. These
              numbers describe that baseline, not the engine above, and the two
              generators differ, so they are not directly comparable.
            </p>
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <StatCard
              label="Incident detection"
              value={`${data.incident_detection_pct}%`}
              hint={`${data.incidents_detected} of ${data.incidents_total} incidents found`}
              icon={LuBrainCircuit}
              color="emerald"
            />
            <StatCard
              label="Cluster purity"
              value={`${data.cluster_purity_pct}%`}
              hint="Alerts grouped with the right incident"
              color="blue"
            />
            <StatCard
              label="Noise excluded"
              value={`${data.noise_excluded_pct}%`}
              hint="Background noise correctly left out"
              color="emerald"
            />
            <StatCard
              label="Alert DNA accuracy"
              value={`${data.dna_accuracy_pct}%`}
              hint={`${data.dna_correct} of ${data.dna_total} matched correctly`}
              color="amber"
            />
          </div>

          <Card className="p-4">
            <Title className="text-base mb-3">Baseline: overall</Title>
            <div className="flex flex-col gap-3">
              {[
                {
                  label: "Incident detection",
                  value: data.incident_detection_pct,
                },
                { label: "Cluster purity", value: data.cluster_purity_pct },
                { label: "Noise excluded", value: data.noise_excluded_pct },
                { label: "Alert DNA accuracy", value: data.dna_accuracy_pct },
              ].map((row) => (
                <div key={row.label} className="flex items-center gap-3">
                  <div className="w-44 text-xs text-gray-500 shrink-0">
                    {row.label}
                  </div>
                  <div className="flex-1">
                    <ProgressBar
                      value={row.value}
                      color={pctColor(row.value)}
                    />
                  </div>
                  <div className="w-14 text-xs text-right shrink-0">
                    {row.value}%
                  </div>
                </div>
              ))}
            </div>
            <Text className="text-xs text-gray-500 mt-3">
              Fragmentation events: {data.fragmentation_events} — incidents
              split across more than one cluster.
            </Text>
          </Card>

          <Card className="p-4">
            <Title className="text-base mb-3">Baseline: per-seed results</Title>
            <div className="overflow-x-auto">
              <DataTable>
                <TableHead>
                  <Th>Seed</Th>
                  <Th>Detection</Th>
                  <Th>Purity</Th>
                  <Th>Noise excluded</Th>
                </TableHead>
                <tbody>
                  {data.per_seed?.map((s) => (
                    <Tr key={s.seed}>
                      <Td className="font-mono text-xs">{s.seed}</Td>
                      <Td className="tabular-nums">
                        {s.incident_detection_pct}%
                      </Td>
                      <Td className="tabular-nums">{s.cluster_purity_pct}%</Td>
                      <Td className="tabular-nums">{s.noise_excluded_pct}%</Td>
                    </Tr>
                  ))}
                </tbody>
              </DataTable>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
