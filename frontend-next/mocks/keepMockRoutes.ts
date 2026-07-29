import * as data from "./keepMockData";

type Resolver = (path: string, search: URLSearchParams) => unknown;

/**
 * Endpoints that belong to KeepHQ's own product surface and have no equivalent
 * in the AlertLens FastAPI backend. Requests to these are served from demo data
 * so KeepHQ's pages render their real UI instead of hanging on a 404.
 *
 * This table is the single source of truth: a path is treated as Keep-only if
 * and only if it resolves here. Everything else falls through to FastAPI.
 *
 * DANGER: never add a prefix that shadows a real AlertLens endpoint. The
 * backend owns `/ingest`, `/demo/*`, `/pipeline`, `/alerts/{id}/ack|assign|
 * dismiss|escalate`, `/forecast/{id}`, `/incidents/{id}/comparison|
 * root_cause_confidence|playbook`, `/evaluation`, `/debug/*`, `/assistant*`
 * and `/providers` (CRUD + `/providers/{id}/test`). Shadowing any of those
 * would silently replace engine output with demo data.
 */
const WORKFLOW_FACETS = [
  {
    id: "wf-status",
    property_path: "last_execution_status",
    name: "Status",
    is_static: true,
    is_lazy: false,
  },
  {
    id: "wf-disabled",
    property_path: "disabled",
    name: "Enabled",
    is_static: true,
    is_lazy: false,
  },
];

const ROUTES: [string, Resolver][] = [
  // Keep's ApiClient probes this; a 404 makes every page show
  // "API server is not available".
  ["healthcheck", () => ({ status: "ok" })],

  // Provider logos live in Keep's own storage; no equivalent here. Real
  // provider CRUD (/providers, /providers/{id}/test) is served by FastAPI now.
  ["provider-images", () => []],

  // Keep's workflows table POSTs a query and expects a paginated envelope.
  [
    "workflows/query",
    () => ({
      count: data.WORKFLOWS.length,
      results: data.WORKFLOWS,
      limit: 12,
      offset: 0,
    }),
  ],
  [
    "workflows/facets/options",
    () => ({
      "wf-status": [
        { display_name: "success", value: "success", matches_count: 3 },
        { display_name: "error", value: "error", matches_count: 1 },
      ],
      "wf-disabled": [
        { display_name: "Enabled", value: false, matches_count: 3 },
        { display_name: "Disabled", value: true, matches_count: 1 },
      ],
    }),
  ],
  // Keep's server-side FacetsPanel expects a richer contract than the demo
  // layer provides; an empty list renders the table without facet filters.
  ["workflows/facets", () => []],
  [
    "workflows/templates/query",
    () => ({ count: 0, results: [], limit: 12, offset: 0 }),
  ],
  ["workflows/executions", () => data.WORKFLOW_EXECUTIONS],
  [
    "workflows",
    (path) => {
      const rest = path.replace(/^workflows\/?/, "");
      if (!rest) return data.WORKFLOWS;
      if (rest.endsWith("/executions")) return data.WORKFLOW_EXECUTIONS;
      const id = rest.split("/")[0];
      return data.WORKFLOWS.find((w) => w.id === id) ?? data.WORKFLOWS;
    },
  ],

  ["maintenance", () => data.MAINTENANCE_RULES],
  ["rules", () => data.CORRELATION_RULES],
  ["deduplications", () => data.DEDUPLICATION_RULES],
  ["dashboard", () => data.DASHBOARDS],
  [
    "preset",
    (path) =>
      // /preset/{name}/alerts returns alerts, not presets. AlertLens's own
      // alert views read /pipeline, so an empty list is correct here.
      path.endsWith("/alerts") ? [] : data.PRESETS,
  ],
  ["tags", () => data.TAGS],

  ["auth/permissions/scopes", () => data.SCOPES],
  ["auth/permissions", () => data.PERMISSIONS],
  ["auth/users", () => data.USERS],
  ["auth/roles", () => data.ROLES],
  ["auth/groups", () => data.GROUPS],

  ["settings/apikeys", () => ({ apiKeys: [] })],
  ["settings/tenant/configuration", () => data.TENANT_CONFIGURATION],

  // Keep's own alert search. Safe as an exact path: it cannot match
  // AlertLens's /alerts/{id}/ack|assign|dismiss|escalate, which stay on
  // FastAPI. AlertLens's own alert views use /pipeline, not this.
  ["alerts/query", () => ({ count: 0, results: [], limit: 20, offset: 0 })],
  ["alerts/facets", () => []],
  ["ai/stats", () => data.AI_STATS],
  ["incidents/meta", () => ({})],
];

const normalize = (path: string) => path.replace(/^\/+/, "");

/** Longest matching prefix, so `/workflows/executions` beats `/workflows`. */
const matchRoute = (path: string): [string, Resolver] | null => {
  const p = normalize(path);
  const matches = ROUTES.filter(
    ([prefix]) => p === prefix || p.startsWith(`${prefix}/`)
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b[0].length - a[0].length)[0];
};

export const isKeepOnlyPath = (path: string): boolean =>
  matchRoute(path) !== null;

export const resolveMock = (
  path: string,
  search: URLSearchParams
): unknown | null => {
  const match = matchRoute(path);
  return match ? match[1](normalize(path), search) : null;
};
