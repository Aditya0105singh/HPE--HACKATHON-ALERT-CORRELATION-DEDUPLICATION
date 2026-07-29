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

const workflow = (
  id: string,
  name: string,
  description: string,
  disabled: boolean,
  successes: number,
  failures: number
) => ({
  id,
  name,
  description,
  created_by: "demo@alertlens.local",
  creation_time: daysAgo(21),
  triggers: [
    { type: "alert", filters: [{ key: "severity", value: "critical" }] },
  ],
  interval: 0,
  disabled,
  provisioned: false,
  last_execution_time: daysAgo(0),
  last_execution_status: failures > 0 ? "error" : "success",
  last_updated: daysAgo(2),
  // Must satisfy YamlWorkflowDefinitionSchema: triggers needs >=1 entry, and
  // the workflow needs at least one real step (an empty steps array fails
  // the schema's own "at least one step or action" check).
  workflow_raw: `workflow:\n  id: ${id}\n  description: ${description}\n  triggers:\n    - type: alert\n  steps:\n    - name: notify\n      provider:\n        type: console\n        with: {}\n`,
  workflow_raw_id: id,
  revision: 1,
  last_executions: Array.from({ length: 8 }, (_, i) => ({
    id: `${id}-exec-${i}`,
    started: daysAgo(i),
    execution_time: 1200 + i * 90,
    status: i === 2 && failures > 0 ? "error" : "success",
  })),
  workflow_execution_count: successes + failures,
  workflow_success_count: successes,
  workflow_fail_count: failures,
});

export const WORKFLOWS = [
  workflow(
    "escalate-critical",
    "Escalate critical incidents",
    "Page the on-call engineer when an incident is scored high risk.",
    false,
    142,
    3
  ),
  workflow(
    "notify-service-owner",
    "Notify service owner",
    "Message the owning team channel when their service enters an incident.",
    false,
    318,
    0
  ),
  workflow(
    "open-ticket",
    "Open incident ticket",
    "Create a tracking ticket for any incident open longer than 30 minutes.",
    false,
    64,
    2
  ),
  workflow(
    "suppress-maintenance",
    "Suppress during maintenance",
    "Silence alerts from services inside an active maintenance window.",
    true,
    27,
    0
  ),
];

export const WORKFLOW_EXECUTIONS = {
  count: 24,
  items: Array.from({ length: 12 }, (_, i) => ({
    id: `exec-${i + 1}`,
    workflow_id: WORKFLOWS[i % WORKFLOWS.length].id,
    workflow_name: WORKFLOWS[i % WORKFLOWS.length].name,
    started: daysAgo(i % 7),
    triggered_by: i % 3 === 0 ? "manual" : "alert",
    status: i % 5 === 4 ? "error" : "success",
    execution_time: 900 + i * 120,
    results: {},
    logs: [],
  })),
};

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

export const DASHBOARDS = [
  {
    id: "dash-1",
    dashboard_name: "Reliability overview",
    dashboard_config: { layout: [], widgetData: [] },
sort_order: 1,
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

export const ROLES = [
  {
    id: "admin",
    name: "admin",
    description: "Full access to every AlertLens surface.",
    scopes: ["read:*", "write:*", "delete:*"],
    predefined: true,
  },
  {
    id: "viewer",
    name: "viewer",
    description: "Read-only access to alerts and incidents.",
    scopes: ["read:*"],
    predefined: true,
  },
];

export const GROUPS = [
  {
    id: "platform",
    name: "Platform",
    roles: ["admin"],
    members: ["demo@alertlens.local"],
    memberCount: 1,
  },
];

export const PERMISSIONS = [
  {
    id: "perm-1",
    name: "incidents",
    description: "Access incident data",
    resource_id: "incidents",
    resource_name: "Incidents",
    resource_type: "incident",
    permissions: [{ id: "admin", type: "user" }],
  },
];

export const SCOPES = [
  "read:alerts",
  "write:alerts",
  "read:incidents",
  "write:incidents",
  "read:workflows",
  "write:workflows",
];

export const AI_STATS = {
  alerts_count: 130,
  first_alert_datetime: daysAgo(11),
  incidents_count: 4,
  is_mining_enabled: false,
  algorithm_configs: [],
};

export const TENANT_CONFIGURATION = {};

export const EMPTY_ARRAY: unknown[] = [];
