/**
 * Demo data for the KeepHQ-native pages that AlertLens's backend does not
 * serve (providers catalogue, workflow engine, enrichment rules, dashboards,
 * tenant settings).
 *
 * These exist so those pages render their real KeepHQ UI instead of hanging on
 * a missing endpoint. Nothing here is wired to the AlertLens engine — every
 * page fed from this file is a demo surface. Anything backed by the real
 * pipeline (alerts, incidents, correlation, dedup, forecast, topology,
 * evaluation, assistant) is served by FastAPI and never touches this file.
 *
 * Shapes mirror KeepHQ's own TypeScript types so its components work unchanged.
 */

const now = () => new Date().toISOString();
const daysAgo = (n: number) =>
  new Date(Date.now() - n * 86_400_000).toISOString();

export const MAINTENANCE_RULES = [
  {
    id: 1,
    name: "Weekly database patching",
    description: "Suppresses postgres-primary alerts during the patch window.",
    created_by: "demo@alertlens.local",
    created_at: daysAgo(40),
    start_time: daysAgo(-2),
    end_time: daysAgo(-2),
    duration_seconds: 7200,
    cel_query: 'service == "postgres-primary"',
    enabled: true,
    suppress: true,
  },
];

export const CORRELATION_RULES = [
  {
    id: "rule-1",
    name: "Gateway + upstream timeouts",
    definition: { sql: "", params: {} },
    definition_cel: 'service in ["api-gateway", "order-api"]',
    timeframe: 600,
    timeunit: "seconds",
    created_by: "demo@alertlens.local",
    creation_time: daysAgo(25),
    tenant_id: "alertlens",
    updated_by: null,
    update_time: null,
    grouping_criteria: ["service"],
    group_description: "Gateway timeouts correlated with upstream failures",
    require_approve: false,
    resolve_on: "all_resolved",
    create_on: "any",
    incident_name_template: "",
    incident_prefix: "INC",
    multi_level: false,
    multi_level_property_name: "",
    threshold: 2,
    assignee: null,
  },
];

export const DEDUPLICATION_RULES = [
  {
    id: "dedup-1",
    name: "Default fingerprint",
    description: "service + alert name + 5-minute window",
    default: true,
    distribution: Array.from({ length: 24 }, (_, hour) => ({
      hour,
      number: Math.round(4 + 6 * Math.sin(hour / 3)),
    })),
    provider_id: null,
    provider_type: "alertlens",
    last_updated: daysAgo(1),
    last_updated_by: "system",
    created_at: daysAgo(60),
    created_by: "system",
    ingested: 130,
    dedup_ratio: 19.2,
    enabled: true,
    fingerprint_fields: ["service", "alertname"],
    full_deduplication: false,
    ignore_fields: [],
    is_provisioned: false,
  },
];

export const PRESETS = [
  {
    id: "preset-feed",
    name: "feed",
    options: [{ label: "CEL", value: "" }],
    created_by: "demo@alertlens.local",
    is_private: false,
    is_noisy: false,
    should_do_noise_now: false,
    alerts_count: 130,
    static: true,
    tags: [],
    counter_shows_firing_only: false,
  },
];

export const TAGS = [
  { id: 1, name: "production" },
  { id: 2, name: "tier-1" },
  { id: 3, name: "customer-facing" },
];

export const USERS = [
  {
    email: "demo@alertlens.local",
    name: "AlertLens Demo",
    role: "admin",
    picture: null,
    created_at: daysAgo(90),
    last_login: now(),
    ldap: false,
    groups: [],
  },
];

export const EMPTY_ARRAY: unknown[] = [];
