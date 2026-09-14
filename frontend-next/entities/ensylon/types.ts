/** Mirrors the shapes returned by backend/app/ensylon_api.py exactly - see
 * that file's _queue_summary / _draft_detail / _report_dict for the source
 * of truth. Kept as a separate entity from the original AlertLens pipeline
 * types since this is a distinct engine (app/ensylon/) with its own API
 * prefix, not a variant of the existing Cluster/Incident shapes. */

export type Priority = "P1" | "P2" | "P3";

export type DraftStatus = "awaiting_review" | "published" | "rejected" | "merged";

export interface QueueSummary {
  draft_id: string;
  title: string;
  priority: Priority;
  severity_score: number;
  correlation_confidence: number;
  causal_confidence: number;
  root_cause_service: string | null;
  affected_services: string[];
  signal_count: number;
  started_at: string;
  status: DraftStatus;
  jira_key: string | null;
  merged_into: string | null;
  reviewer: string | null;
  suppressed: boolean;
  summary_source: "llm" | "template";
}

export interface TimelineEntry {
  at: string;
  source: string;
  service: string;
  detail: string;
  count: number;
}

export interface ExcludedSignal {
  service: string;
  at: string;
  detail: string;
  reason: string;
}

export interface DraftDetail extends QueueSummary {
  severity_line: string;
  root_cause_detail: string;
  summary: string;
  investigation_steps: string[];
  causal_reasoning: string[];
  severity_factors: Record<string, string>;
  redaction_kinds: string[];
  timeline: TimelineEntry[];
  considered_excluded: ExcludedSignal[];
  jira_fields: { summary: string; description: string; labels: string[] } | null;
  note: string;
  decided_at: string | null;
}

export interface Evaluation {
  pair_precision: number;
  pair_recall: number;
  pair_f1: number;
  cluster_purity: number;
  incidents_expected: number;
  incidents_formed: number;
  root_cause_correct: number;
  root_cause_total: number;
  root_cause_accuracy: number;
  noise_precision: number;
}

export interface PipelineReport {
  scenario: string;
  signals_ingested: number;
  redaction_counts: Record<string, number>;
  redaction_backends: { regex: boolean; ner: boolean };
  unique_signals: number;
  dedup_collapsed: number;
  dedup_collapsed_pct: number;
  dedup_bucket_minutes: number;
  anomalies_detected: number;
  within_baseline: number;
  incidents_formed: number;
  noise_signals: number;
  root_causes_identified: number;
  drafts_created: number;
  auto_published: number;
  priorities: Record<string, number>;
  noise_reduction_pct: number;
  possible_pairs: number;
  candidate_pairs: number;
  blocking_saved_pct: number;
  calibration_warning: string | null;
  elapsed_ms: Record<string, number>;
  causal_splits: string[];
  evaluation?: Evaluation;
}

export interface AuditEntry {
  at: string;
  actor: string;
  action: string;
  draft_id: string;
  detail: string;
}

export interface Topology {
  name: string;
  services: string[];
  archetype_roles: string[];
}

export interface DemoRunRequest {
  n_incidents?: number;
  noise_signals?: number;
  seed?: number;
  stagger_minutes?: number;
  topology?: string | null;
  use_llm?: boolean;
}
