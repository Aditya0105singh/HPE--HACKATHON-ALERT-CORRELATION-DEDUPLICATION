"""Synthetic scenario generator with ground truth.

Correlation quality cannot be asserted, it has to be measured — and measuring
it requires knowing which signals genuinely belong together. Because this
generator *injects* the faults, it knows exactly that, which is what turns
"the clusters look right" into a precision and recall number.

It emits raw payloads in each source's native shape rather than Signal objects
directly, so every run also exercises the adapters. A bug in CloudWatch's
prose-parsing shows up here instead of on hackathon day.

Ground truth is returned as a separate map keyed by (source_kind, service,
timestamp) rather than embedded in the payloads. Smuggling labels into the
telemetry would mean the pipeline could, in principle, read the answer — and
a benchmark the system can cheat on measures nothing.
"""

from __future__ import annotations

import random
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any

from .signal import Signal

# --------------------------------------------------------------------------
# topology
# --------------------------------------------------------------------------

# caller -> callee. Mirrors a small but realistic checkout-path architecture,
# deep enough that a root cause is genuinely several hops from its loudest
# symptom (which is the entire problem being solved).
TOPOLOGY: dict[str, list[str]] = {
    "checkout-bff": ["order-api", "payment-svc"],
    "order-api": ["postgres-primary", "redis-cache"],
    "payment-svc": ["postgres-primary", "stripe-gateway"],
    "api-gateway": ["checkout-bff", "auth-service"],
    "auth-service": ["redis-cache"],
    "session-svc": ["redis-cache"],
    "web-frontend": ["api-gateway"],
    "report-worker": ["postgres-replica"],
}

CRITICAL_SERVICES = {"payment-svc", "auth-service", "postgres-primary", "checkout-bff"}


def dependents_of(service: str) -> list[str]:
    """Services that call the given one (its immediate blast radius)."""
    return [caller for caller, callees in TOPOLOGY.items() if service in callees]


# --------------------------------------------------------------------------
# incident templates
# --------------------------------------------------------------------------


@dataclass
class IncidentTemplate:
    key: str
    root_service: str
    root_metric: str
    root_namespace: str
    threshold: float
    breach_value: float
    root_reason: str
    log_service: str
    log_message: str
    log_repeats: int
    grafana_service: str
    grafana_alert: str
    grafana_value: float
    downstream: list[str]
    downstream_error: str


TEMPLATES: list[IncidentTemplate] = [
    IncidentTemplate(
        key="db_pool_exhaustion",
        root_service="postgres-primary",
        root_metric="DatabaseConnections",
        root_namespace="AWS/RDS",
        threshold=180.0,
        breach_value=200.0,
        root_reason="connection pool saturated",
        log_service="order-api",
        log_message="ERROR connection pool exhausted: {n}/200 in use, waiters={w}",
        log_repeats=12,
        grafana_service="order-api",
        grafana_alert="HighLatencyP99",
        grafana_value=3200.0,
        downstream=["payment-svc", "checkout-bff"],
        downstream_error="upstream timeout calling order-api",
    ),
    IncidentTemplate(
        key="redis_memory_pressure",
        root_service="redis-cache",
        root_metric="DatabaseMemoryUsagePercentage",
        root_namespace="AWS/ElastiCache",
        threshold=85.0,
        breach_value=97.0,
        root_reason="maxmemory pressure, evictions climbing",
        log_service="session-svc",
        log_message="ERROR cache eviction storm: evicted={n} keys in {w}s",
        log_repeats=8,
        grafana_service="session-svc",
        grafana_alert="CacheMissRateHigh",
        grafana_value=71.5,
        downstream=["auth-service"],
        downstream_error="session lookup failed: cache unavailable",
    ),
    IncidentTemplate(
        key="auth_jwks_failure",
        root_service="auth-service",
        root_metric="5XXError",
        root_namespace="AWS/ApiGateway",
        threshold=5.0,
        breach_value=96.0,
        root_reason="JWKS endpoint returning 503",
        log_service="api-gateway",
        log_message="ERROR jwt validation failed: jwks fetch returned {n} after {w}ms",
        log_repeats=15,
        grafana_service="api-gateway",
        grafana_alert="AuthErrorRateHigh",
        grafana_value=96.2,
        downstream=["web-frontend"],
        downstream_error="401 from auth-service during token refresh",
    ),
    IncidentTemplate(
        key="disk_pressure",
        root_service="postgres-replica",
        root_metric="FreeStorageSpace",
        root_namespace="AWS/RDS",
        threshold=10.0,
        breach_value=3.2,
        root_reason="free storage below floor",
        log_service="report-worker",
        log_message="ERROR write failed: no space left on device (attempt {n})",
        log_repeats=5,
        grafana_service="report-worker",
        grafana_alert="BatchJobFailureRate",
        grafana_value=44.0,
        downstream=[],
        downstream_error="",
    ),
]

# Background chatter — real systems are never quiet. None of this should ever
# be correlated into an incident, and a run where it is has a precision bug.
NOISE_LOGS = [
    ("web-frontend", "INFO served 200 in {n}ms path=/health", "info"),
    ("report-worker", "INFO nightly rollup complete rows={n}", "info"),
    ("api-gateway", "WARN rate limit near cap for tenant-{n}", "warning"),
    ("stripe-gateway", "INFO webhook received id=evt_{n}", "info"),
    ("order-api", "INFO cache warm complete keys={n}", "info"),
]

NOISE_ALARMS = [
    ("log-archive", "FreeStorageSpace", "AWS/S3", 20.0, 18.4, "archive bucket filling"),
    ("ci-runner", "CPUUtilization", "AWS/EC2", 80.0, 84.0, "build queue busy"),
]


# --------------------------------------------------------------------------
# result
# --------------------------------------------------------------------------


@dataclass
class Scenario:
    """Raw payloads plus the answer key."""

    cloudwatch_alarms: list[dict[str, Any]] = field(default_factory=list)
    cloudwatch_logs: list[dict[str, Any]] = field(default_factory=list)
    grafana_batches: list[dict[str, Any]] = field(default_factory=list)
    otlp_logs: list[dict[str, Any]] = field(default_factory=list)
    otlp_traces: list[dict[str, Any]] = field(default_factory=list)
    # (source_kind, service, iso_timestamp) -> {"incident": str|None, "root": bool}
    truth: dict[tuple[str, str, str], dict[str, Any]] = field(default_factory=dict)
    incident_count: int = 0

    def mark(self, kind: str, service: str, ts: datetime,
             incident: str | None, root: bool = False) -> None:
        self.truth[(kind, service, ts.isoformat())] = {"incident": incident, "root": root}


def _res_span(service: str, spans: list[dict]) -> dict:
    return {
        "resource": {"attributes": [
            {"key": "service.name", "value": {"stringValue": service}},
        ]},
        "scopeSpans": [{"spans": spans}],
    }


def _nano(ts: datetime) -> str:
    return str(int(ts.timestamp() * 1e9))


# --------------------------------------------------------------------------
# generator
# --------------------------------------------------------------------------


def generate(
    n_incidents: int = 3,
    noise_signals: int = 40,
    seed: int = 7,
    base_time: datetime | None = None,
    stagger_minutes: float = 45.0,
) -> Scenario:
    """Build a scenario with `n_incidents` genuine incidents plus background noise.

    `stagger_minutes` controls how far apart the incidents start. The default
    keeps them well separated, which is the easy case. Setting it to 0 makes
    every incident fire simultaneously — the genuinely hard case, and the one
    that decides whether correlation is doing real work: a time-window
    correlator merges all of them into a single wrong ticket, and only the
    shared-context gate keeps them apart.
    """
    rng = random.Random(seed)
    t0 = base_time or datetime(2026, 8, 26, 14, 0, 0, tzinfo=timezone.utc)
    sc = Scenario()

    chosen = TEMPLATES[:n_incidents] if n_incidents <= len(TEMPLATES) else TEMPLATES
    sc.incident_count = len(chosen)

    for idx, tpl in enumerate(chosen):
        incident_id = f"INC-{idx + 1:02d}-{tpl.key}"
        # A few seconds of offset even when fully concurrent, so identical
        # timestamps don't collide in the truth map.
        start = t0 + timedelta(minutes=idx * stagger_minutes, seconds=idx * 3)
        _emit_incident(sc, tpl, incident_id, start, rng)

    _emit_noise(sc, t0, noise_signals, rng)
    return sc


def _emit_incident(
    sc: Scenario, tpl: IncidentTemplate, incident_id: str,
    start: datetime, rng: random.Random,
) -> None:
    trace_id = f"trace{abs(hash(incident_id)) % 10**12:012d}"

    # --- 1. root cause: CloudWatch metric alarm ---
    sc.cloudwatch_alarms.append({
        "AlarmName": f"{tpl.root_service}-{tpl.root_metric}-alarm",
        "AlarmDescription": tpl.root_reason,
        "NewStateValue": "ALARM",
        "NewStateReason": (
            f"Threshold Crossed: 1 datapoint [{tpl.breach_value} "
            f"({start.strftime('%d/%m/%y %H:%M:%S')})] was greater than "
            f"the threshold ({tpl.threshold})."
        ),
        "StateChangeTime": start.isoformat().replace("+00:00", "Z"),
        "Region": "ap-south-1",
        "Trigger": {
            "MetricName": tpl.root_metric,
            "Namespace": tpl.root_namespace,
            "Statistic": "AVERAGE",
            "Threshold": tpl.threshold,
            "ComparisonOperator": "GreaterThanThreshold",
            "Dimensions": [{"name": "DBInstanceIdentifier", "value": tpl.root_service}],
        },
    })
    sc.mark("cloudwatch_metric", tpl.root_service, start, incident_id, root=True)

    # --- 2. log burst on the first dependent service ---
    events = []
    for i in range(tpl.log_repeats):
        ts = start + timedelta(seconds=8 + i * 3)
        events.append({
            "timestamp": int(ts.timestamp() * 1000),
            "message": tpl.log_message.format(n=rng.randint(150, 210), w=rng.randint(2, 40)),
            "logStreamName": f"{tpl.log_service}/task/{rng.randrange(16**6):06x}",
        })
        sc.mark("cloudwatch_log", tpl.log_service, ts, incident_id)
    sc.cloudwatch_logs.append({
        "logGroupName": f"/aws/ecs/{tpl.log_service}",
        "events": events,
    })

    # --- 3. Grafana alert, already thresholded by its own rule ---
    g_ts = start + timedelta(seconds=42)
    sc.grafana_batches.append({
        "receiver": "alertlens",
        "status": "firing",
        "alerts": [{
            "status": "firing",
            "labels": {
                "alertname": tpl.grafana_alert,
                "service": tpl.grafana_service,
                "severity": "critical",
                "trace_id": trace_id,
            },
            "annotations": {"description": f"{tpl.grafana_alert} on {tpl.grafana_service}"},
            "startsAt": g_ts.isoformat(),
            "valueString": f"[ var='B' labels={{}} value={tpl.grafana_value} ]",
        }],
    })
    sc.mark("grafana_alert", tpl.grafana_service, g_ts, incident_id)

    # --- 4. downstream failures, carrying the shared trace ---
    #
    # Span nesting must follow the real call direction: the *caller* is the
    # parent and the service it calls is the child. Emitting an affected
    # service as the child of the alerting service (the obvious shortcut)
    # invents an edge pointing the wrong way, and since the causal engine
    # derives topology from exactly these spans, one reversed edge is enough
    # to make the graph cyclic and the ancestor reasoning meaningless.
    #
    # So each affected caller gets a span chain walked along the genuine path
    # from it down to the failing root service.
    resource_spans = []
    span_seq = 0

    for i, svc in enumerate(tpl.downstream):
        path = _call_path(svc, tpl.root_service)
        base_ts = start + timedelta(seconds=67 + i * 9)
        parent_span: str | None = None

        for depth, hop in enumerate(path):
            span_seq += 1
            span_id = f"sp{span_seq:03d}"
            ts = base_ts + timedelta(milliseconds=depth * 120)
            span: dict[str, Any] = {
                "traceId": trace_id,
                "spanId": span_id,
                "name": f"{hop} call",
                "startTimeUnixNano": _nano(ts),
                "status": {"code": 2, "message": tpl.downstream_error},
            }
            if parent_span:
                span["parentSpanId"] = parent_span
            resource_spans.append(_res_span(hop, [span]))
            # Every hop on this path is emitted as an ERROR span, which makes
            # it a genuine injected symptom of this incident — not incidental
            # topology. Labelling only the originally-listed caller would mark
            # real members of the incident as noise and understate correlation
            # precision against our own fault injection.
            sc.mark("trace_span", hop, ts, incident_id)
            parent_span = span_id

        # Matching application log, so the incident has cross-source evidence.
        log_ts = base_ts + timedelta(seconds=2)
        sc.otlp_logs.append({"resourceLogs": [{
            "resource": {"attributes": [
                {"key": "service.name", "value": {"stringValue": svc}},
            ]},
            "scopeLogs": [{"logRecords": [{
                "timeUnixNano": _nano(log_ts),
                "severityText": "ERROR",
                "body": {"stringValue": tpl.downstream_error},
                "traceId": trace_id,
                "spanId": f"sp{span_seq:03d}",
                "attributes": [{"key": "http.status_code", "value": {"intValue": 504}}],
            }]}],
        }]})
        sc.mark("app_log", svc, log_ts, incident_id)

    if resource_spans:
        sc.otlp_traces.append({"resourceSpans": resource_spans})


def _call_path(caller: str, callee: str) -> list[str]:
    """Real call path from `caller` down to `callee` in the static topology.

    Falls back to a direct two-hop pair when no path exists, so a template
    naming an unconnected service still produces a coherent trace rather than
    silently emitting nothing.
    """
    import networkx as nx

    digraph = nx.DiGraph()
    for src, dsts in TOPOLOGY.items():
        for dst in dsts:
            digraph.add_edge(src, dst)
    try:
        return nx.shortest_path(digraph, caller, callee)
    except (nx.NetworkXNoPath, nx.NodeNotFound):
        return [caller, callee]


def _emit_noise(
    sc: Scenario, t0: datetime, count: int, rng: random.Random
) -> None:
    """Unrelated background traffic spread across the whole window."""
    span_minutes = 200

    for i in range(count):
        service, template, severity = NOISE_LOGS[i % len(NOISE_LOGS)]
        ts = t0 + timedelta(seconds=rng.randint(0, span_minutes * 60), microseconds=i)
        sc.otlp_logs.append({"resourceLogs": [{
            "resource": {"attributes": [
                {"key": "service.name", "value": {"stringValue": service}},
            ]},
            "scopeLogs": [{"logRecords": [{
                "timeUnixNano": _nano(ts),
                "severityText": severity.upper(),
                "body": {"stringValue": template.format(n=rng.randint(1, 9999))},
                "attributes": [],
            }]}],
        }]})
        sc.mark("app_log", service, ts, None)

    # A couple of genuine-but-unrelated alarms. These are the ones a naive
    # time-window correlator wrongly absorbs into whatever else is firing.
    for j, (svc, metric, ns, thr, val, reason) in enumerate(NOISE_ALARMS):
        ts = t0 + timedelta(minutes=3 + j * 47, seconds=22)
        sc.cloudwatch_alarms.append({
            "AlarmName": f"{svc}-{metric}-alarm",
            "AlarmDescription": reason,
            "NewStateValue": "ALARM",
            "NewStateReason": (
                f"Threshold Crossed: 1 datapoint [{val} "
                f"({ts.strftime('%d/%m/%y %H:%M:%S')})] was greater than "
                f"the threshold ({thr})."
            ),
            "StateChangeTime": ts.isoformat().replace("+00:00", "Z"),
            "Region": "ap-south-1",
            "Trigger": {
                "MetricName": metric, "Namespace": ns, "Statistic": "AVERAGE",
                "Threshold": thr, "ComparisonOperator": "GreaterThanThreshold",
                "Dimensions": [{"name": "ServiceName", "value": svc}],
            },
        })
        sc.mark("cloudwatch_metric", svc, ts, None)


# --------------------------------------------------------------------------
# truth attachment
# --------------------------------------------------------------------------


def attach_truth(signals: list[Signal], scenario: Scenario) -> list[Signal]:
    """Copy the answer key onto Signals *after* the adapters have run.

    Matching on (source, service, timestamp) is exact because the generator
    controls all three, and noise timestamps carry a per-item microsecond
    offset specifically to keep these keys unique.
    """
    for signal in signals:
        key = (str(signal.source), signal.service, signal.timestamp.isoformat())
        entry = scenario.truth.get(key)
        if entry:
            signal.truth_incident = entry["incident"]
            signal.truth_is_root_cause = entry["root"]
    return signals


def build_signals(scenario: Scenario) -> list[Signal]:
    """Run every raw payload through the real adapters, then attach truth."""
    from . import adapters

    signals: list[Signal] = []
    for alarm in scenario.cloudwatch_alarms:
        signal = adapters.from_cloudwatch_alarm(alarm)
        if signal:
            signals.append(signal)
    for response in scenario.cloudwatch_logs:
        signals.extend(adapters.from_cloudwatch_logs(response))
    for batch in scenario.grafana_batches:
        signals.extend(adapters.from_grafana_webhook(batch))
    for payload in scenario.otlp_logs:
        signals.extend(adapters.from_otlp_logs(payload))
    for payload in scenario.otlp_traces:
        signals.extend(adapters.from_otlp_traces(payload))

    attach_truth(signals, scenario)
    signals.sort(key=lambda s: s.timestamp)
    return signals


def dependency_edges(scenario: Scenario) -> set[tuple[str, str]]:
    """Topology observed from the scenario's traces, plus the static map.

    Traces only reveal edges that were actually exercised in the window; the
    static topology fills in the rest, the way a real deployment would supply
    a service catalogue alongside live tracing.
    """
    from . import adapters

    edges: set[tuple[str, str]] = set()
    for payload in scenario.otlp_traces:
        edges |= adapters.service_dependency_edges(payload)
    for caller, callees in TOPOLOGY.items():
        for callee in callees:
            edges.add((caller, callee))
    return edges
