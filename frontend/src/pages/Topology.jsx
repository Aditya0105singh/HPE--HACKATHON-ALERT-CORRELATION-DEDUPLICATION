import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ReactFlow, Background, BackgroundVariant, Controls, Handle, Position,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "@dagrejs/dagre";
import { Activity, Crown, Dna, Network, Radio, Server, Share2, Zap } from "lucide-react";
import { AlertIcon, SeverityDot, StatCard, timeAgo } from "../components/ui";
import { techLogoFor } from "../components/techLogos";

const STATUS_COLOR = { critical: "var(--critical)", warning: "var(--high)", healthy: "var(--ok)" };

// ---- derive an honest service graph from real pipeline output ----------
// Nodes = every service seen in this batch. Edges = services that fired
// together inside the same real incident cluster (a genuine correlation
// signal from the pipeline, not a fabricated architecture diagram).
function buildTopology(data) {
  const clusters = data?.clusters ?? [];
  const rawAlerts = data?.raw_alerts ?? [];

  const serviceStats = new Map();
  for (const a of rawAlerts) {
    if (!serviceStats.has(a.service)) serviceStats.set(a.service, { total: 0, critical: 0, high: 0, info: 0, alerts: [] });
    const s = serviceStats.get(a.service);
    s.total += 1;
    s[a.severity] = (s[a.severity] || 0) + 1;
    s.alerts.push(a);
  }

  const rootCauseServices = new Set(clusters.map((c) => c.root_cause.service));
  const serviceCluster = new Map(); // service -> highest-risk cluster it belongs to
  for (const c of clusters) {
    for (const svc of new Set(c.alerts.map((a) => a.service))) {
      const existing = serviceCluster.get(svc);
      if (!existing || c.risk.score > existing.risk.score) serviceCluster.set(svc, c);
    }
  }

  const allServices = new Set([...serviceStats.keys(), ...rootCauseServices]);

  const nodes = [...allServices].map((service) => {
    const stats = serviceStats.get(service) || { total: 0, critical: 0, high: 0, info: 0, alerts: [] };
    const cluster = serviceCluster.get(service) || null;
    const errorRate = stats.total ? Math.round((((stats.critical || 0) + (stats.high || 0)) / stats.total) * 100) : 0;
    const isRoot = rootCauseServices.has(service) && cluster?.root_cause.service === service;
    const status = cluster ? (isRoot || cluster.risk.level === "high" ? "critical" : "warning") : "healthy";
    return { id: service, service, cluster, isRoot, errorRate, activeAlerts: stats.total, stats, status };
  });

  const edgeMap = new Map();
  for (const c of clusters) {
    const root = c.root_cause.service;
    const members = [...new Set(c.alerts.map((a) => a.service))].filter((s) => s !== root);
    for (const svc of members) {
      const key = [root, svc].sort().join("::");
      if (!edgeMap.has(key)) edgeMap.set(key, { id: key, source: root, target: svc, cluster: c });
    }
  }

  return { nodes, edges: [...edgeMap.values()] };
}

const CARD_W = 224;
const CARD_H = 132;
const COMPACT_W = 168;
const COMPACT_H = 60;
const IDLE_COLS = 6;
const IDLE_GAP = 14;
const IDLE_LABEL_H = 32;

// Only services actually involved in a real correlated incident go through
// dagre — that keeps the incident graph tight and readable. Idle/healthy
// services (no cluster) are laid out separately as a tidy fixed grid below
// it, so a batch with a handful of incidents and a dozen quiet services
// doesn't turn into one wide, sparse dagre graph that has to zoom out to fit.
function layout(nodes, edges) {
  const clusterNodes = nodes.filter((n) => n.cluster);
  const idleNodes = nodes.filter((n) => !n.cluster);

  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "TB", nodesep: 48, ranksep: 110, align: "UL" });
  g.setDefaultEdgeLabel(() => ({}));
  clusterNodes.forEach((n) => g.setNode(n.id, { width: CARD_W, height: CARD_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const positioned = clusterNodes.map((n) => {
    const pos = g.node(n.id);
    return { ...n, position: pos ? { x: pos.x - CARD_W / 2, y: pos.y - CARD_H / 2 } : { x: 0, y: 0 } };
  });

  const minX = positioned.length ? Math.min(...positioned.map((n) => n.position.x)) : 0;
  const maxY = positioned.length ? Math.max(...positioned.map((n) => n.position.y + CARD_H)) : 0;
  const idleTop = maxY + (positioned.length ? 56 : 0) + IDLE_LABEL_H;

  const idlePositioned = idleNodes.map((n, i) => {
    const row = Math.floor(i / IDLE_COLS);
    const col = i % IDLE_COLS;
    return {
      ...n,
      position: {
        x: minX + col * (COMPACT_W + IDLE_GAP),
        y: idleTop + row * (COMPACT_H + IDLE_GAP),
      },
    };
  });

  const label = idleNodes.length && positioned.length
    ? [{
        id: "__idle_label",
        type: "label",
        position: { x: minX, y: idleTop - IDLE_LABEL_H },
      }]
    : [];

  return { nodes: [...positioned, ...idlePositioned], labelNodes: label };
}

function ServiceIcon({ service, color, size = 15 }) {
  const brand = techLogoFor(service);
  if (brand) return <brand.Icon size={size} color={brand.color} />;
  return <Server size={size} strokeWidth={2} style={{ color }} />;
}

// Isolated / no-incident services fade into a compact strip — the graph's
// visual weight should belong to what's actually correlated, not every
// idle service that happened to fire once this window.
function CompactServiceNode({ data, selected }) {
  const color = STATUS_COLOR[data.status];
  const dimmed = data.dimmed;
  return (
    <div
      className="rounded-lg border flex items-center gap-2 px-2.5 py-2 transition-all duration-300"
      style={{
        width: COMPACT_W,
        background: "var(--panel)",
        borderColor: selected ? color : "var(--border)",
        borderWidth: selected ? 1.5 : 1,
        opacity: dimmed ? 0.2 : 1,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "var(--border)", border: "none", width: 5, height: 5, opacity: 0 }} />
      <span className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: "var(--panel-2)" }}>
        <ServiceIcon service={data.service} color="var(--muted)" size={13} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[11.5px] truncate" style={{ color: "var(--text)" }}>{data.service}</div>
        <div className="text-[10px] truncate" style={{ color: "var(--muted)" }}>{data.activeAlerts} alert{data.activeAlerts === 1 ? "" : "s"} · idle</div>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ background: "var(--border)", border: "none", width: 5, height: 5, opacity: 0 }} />
    </div>
  );
}

function SectionLabel() {
  return (
    <div className="flex items-center gap-2 select-none pointer-events-none" style={{ width: 500 }}>
      <span className="text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--muted)" }}>
        Other services — no active incident
      </span>
      <span className="h-px flex-1" style={{ background: "var(--border)" }} />
    </div>
  );
}

function ServiceNode({ data, selected }) {
  if (!data.cluster) return <CompactServiceNode data={data} selected={selected} />;

  const color = STATUS_COLOR[data.status];
  const dimmed = data.dimmed;
  return (
    <div
      className={`rounded-2xl border px-4 py-3.5 transition-all duration-300 ${data.status === "critical" && !dimmed ? "risk-pulse-border" : ""}`}
      style={{
        width: CARD_W,
        background: `linear-gradient(150deg, color-mix(in srgb, ${color} 15%, transparent), transparent 60%), var(--panel)`,
        borderColor: selected ? color : `color-mix(in srgb, ${color} 50%, var(--border))`,
        borderWidth: selected ? 2 : 1,
        opacity: dimmed ? 0.3 : 1,
        transform: selected ? "translateY(-2px)" : "none",
        "--pulse-color": color,
        boxShadow: selected
          ? `0 10px 28px -8px color-mix(in srgb, ${color} 45%, transparent)`
          : data.status === "critical" && !dimmed
          ? `0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`
          : "var(--shadow-card)",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: "var(--border)", border: "none", width: 6, height: 6 }} />

      <div className="flex items-center gap-2.5 mb-3">
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: `color-mix(in srgb, ${color} 18%, transparent)` }}
        >
          <ServiceIcon service={data.service} color={color} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[13.5px] truncate">{data.service}</span>
          </div>
          <span className="text-[10.5px]" style={{ color: "var(--muted)" }}>Incident #{data.cluster.cluster_id}</span>
        </div>
        <span
          className="w-2 h-2 rounded-full shrink-0 mt-0.5"
          style={{ background: color, boxShadow: data.status !== "healthy" ? `0 0 7px ${color}` : "none" }}
        />
      </div>

      <div className="mb-2.5 flex items-center gap-1.5 flex-wrap">
        <span
          className="px-2 py-0.5 rounded-md text-xs font-medium"
          style={{
            color,
            background: `color-mix(in srgb, ${color} 14%, transparent)`,
            border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
          }}
        >
          {data.status === "critical" ? "Critical" : data.status === "warning" ? "Degraded" : "Healthy"}
        </span>
        {data.isRoot && (
          <span
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
            style={{ color: "var(--high)", background: "color-mix(in srgb, var(--high) 14%, transparent)", border: "1px solid color-mix(in srgb, var(--high) 30%, transparent)" }}
          >
            <Crown size={11} strokeWidth={2.25} fill="currentColor" /> Root cause
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-[11.5px] mb-1.5" style={{ color: "var(--muted)" }}>
        <span>Error rate</span>
        <b style={{ color: data.errorRate > 50 ? "var(--critical)" : "var(--text)" }}>{data.errorRate}%</b>
      </div>
      <div className="h-1 rounded-full overflow-hidden mb-2.5" style={{ background: "var(--panel-2)" }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${data.errorRate}%`, background: color }} />
      </div>

      <div className="text-[11px]" style={{ color: "var(--muted)" }}>{data.activeAlerts} alert{data.activeAlerts === 1 ? "" : "s"} this window</div>

      <Handle type="source" position={Position.Bottom} style={{ background: "var(--border)", border: "none", width: 6, height: 6 }} />
    </div>
  );
}

const nodeTypes = { service: ServiceNode, label: SectionLabel };

function HoverCard({ node, pos }) {
  if (!node) return null;
  const recent = node.stats.alerts.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 4);
  return (
    <div
      className="fixed z-50 w-72 rounded-xl border p-4 pointer-events-none"
      style={{ left: pos.x + 16, top: pos.y, background: "var(--panel)", borderColor: "var(--border)", boxShadow: "var(--shadow-pop)" }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="w-2 h-2 rounded-full" style={{ background: STATUS_COLOR[node.status] }} />
        <span className="font-semibold text-[14px]">{node.service}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="rounded-lg p-2" style={{ background: "var(--panel-2)" }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Active Alerts</div>
          <div className="text-[16px] font-bold">{node.activeAlerts}</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: "var(--panel-2)" }}>
          <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>Error Rate</div>
          <div className="text-[16px] font-bold" style={{ color: node.errorRate > 50 ? "var(--critical)" : "var(--text)" }}>{node.errorRate}%</div>
        </div>
      </div>
      {node.cluster?.dna_match && (
        <div className="flex items-start gap-1.5 text-[11.5px] mb-3" style={{ color: "var(--purple)" }}>
          <Dna size={13} strokeWidth={2} className="mt-0.5 shrink-0" />
          Last incident: {node.cluster.dna_match.title} ({node.cluster.dna_match.date})
        </div>
      )}
      <div className="text-[10px] uppercase tracking-wide mb-1.5" style={{ color: "var(--muted)" }}>Recent Alerts</div>
      {recent.length === 0 ? (
        <div className="text-[11.5px]" style={{ color: "var(--muted)" }}>No alerts this window</div>
      ) : (
        recent.map((a) => (
          <div key={a.id} className="flex items-center gap-1.5 text-[11.5px] py-0.5">
            <SeverityDot severity={a.severity} />
            <span className="truncate flex-1">{a.alertname}</span>
            <span style={{ color: "var(--muted)" }}>{timeAgo(a.timestamp)}</span>
          </div>
        ))
      )}
    </div>
  );
}

function TopologyInner({ data }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [hover, setHover] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  const { nodes: rawNodes, edges: rawEdges } = useMemo(() => buildTopology(data), [data]);
  const { nodes: laidOut, labelNodes } = useMemo(() => layout(rawNodes, rawEdges), [rawNodes, rawEdges]);

  const selectedClusterId = selected?.cluster?.cluster_id ?? null;

  const flowNodes = useMemo(
    () => [
      ...laidOut.map((n) => ({
        id: n.id,
        type: "service",
        position: n.position,
        data: {
          ...n,
          dimmed: selectedClusterId != null && n.cluster?.cluster_id !== selectedClusterId,
        },
      })),
      ...labelNodes.map((n) => ({ ...n, selectable: false, draggable: false, data: {} })),
    ],
    [laidOut, labelNodes, selectedClusterId]
  );

  const flowEdges = useMemo(
    () =>
      rawEdges.map((e) => {
        const inSelected = selectedClusterId != null && e.cluster.cluster_id === selectedClusterId;
        const dimmed = selectedClusterId != null && !inSelected;
        const color = e.cluster.risk.level === "high" ? "var(--critical)" : e.cluster.risk.level === "medium" ? "var(--high)" : "var(--ok)";
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          type: "default",
          animated: true,
          markerEnd: { type: "arrowclosed", color, width: 16, height: 16 },
          style: {
            stroke: color,
            strokeWidth: inSelected ? 3 : 2,
            opacity: dimmed ? 0.12 : 0.9,
            filter: inSelected ? `drop-shadow(0 0 4px ${color})` : "none",
          },
        };
      }),
    [rawEdges, selectedClusterId]
  );

  const onNodeClick = useCallback((_, node) => {
    setSelected((prev) => (prev?.id === node.id ? null : node.data));
  }, []);

  const onNodeMouseEnter = useCallback((evt, node) => {
    setHover(node.data);
    setHoverPos({ x: evt.clientX, y: evt.clientY });
  }, []);
  const onNodeMouseLeave = useCallback(() => setHover(null), []);

  const stats = useMemo(() => {
    const critical = rawNodes.filter((n) => n.status === "critical").length;
    const warning = rawNodes.filter((n) => n.status === "warning").length;
    const healthy = rawNodes.filter((n) => n.status === "healthy").length;
    return { total: rawNodes.length, critical, warning, healthy, edges: rawEdges.length };
  }, [rawNodes, rawEdges]);

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 pt-5 pb-3">
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-lg font-semibold">Service Topology</h1>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "var(--panel-2)", color: "var(--muted)" }}>live from current batch</span>
        </div>
        <p className="text-[13px] mb-4" style={{ color: "var(--muted)" }}>
          Every service that fired an alert this window, connected wherever the real pipeline correlated them into the same incident.
          Hover a service for details, click it to trace its blast radius.
        </p>
        <div className="grid grid-cols-2 min-[900px]:grid-cols-5 gap-3">
          <StatCard icon={<Network size={16} />} label="Total Services" value={stats.total} color="var(--accent)" delta="in this batch" spark={false} />
          <StatCard icon={<Zap size={16} />} label="Critical" value={stats.critical} color="var(--critical)" delta="root cause / high risk" spark={false} />
          <StatCard icon={<Radio size={16} />} label="Degraded" value={stats.warning} color="var(--high)" delta="in an incident" spark={false} />
          <StatCard icon={<Activity size={16} />} label="Healthy" value={stats.healthy} color="var(--ok)" delta="no active incident" spark={false} />
          <StatCard icon={<Share2 size={16} />} label="Dependencies" value={stats.edges} color="var(--purple)" delta="correlated links" spark={false} />
        </div>
      </div>

      <div className="flex-1 min-h-0 mx-6 mb-6 rounded-xl border overflow-hidden relative" style={{ borderColor: "var(--border)" }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: stats.critical > 0
              ? "radial-gradient(ellipse 60% 45% at 50% 20%, color-mix(in srgb, var(--critical) 8%, transparent), transparent 70%)"
              : "radial-gradient(ellipse 60% 45% at 50% 20%, color-mix(in srgb, var(--accent) 6%, transparent), transparent 70%)",
          }}
        />
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          onNodeMouseEnter={onNodeMouseEnter}
          onNodeMouseLeave={onNodeMouseLeave}
          onPaneClick={() => setSelected(null)}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          proOptions={{ hideAttribution: true }}
          colorMode="system"
          minZoom={0.35}
        >
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border)" />
          <Controls showInteractive={false} className="topology-controls" style={{ button: { background: "var(--panel)", color: "var(--text)", borderColor: "var(--border)" } }} />
        </ReactFlow>

        {selected?.cluster && (
          <button
            onClick={() => navigate(`/incidents/${selected.cluster.cluster_id}`)}
            className="absolute top-3 right-3 flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold cursor-pointer grad-btn"
          >
            <AlertIcon alertname={selected.cluster.root_cause.alertname} severity={selected.cluster.root_cause.severity} service={selected.cluster.root_cause.service} />
            View Incident #{selected.cluster.cluster_id} →
          </button>
        )}
      </div>

      <HoverCard node={hover} pos={hoverPos} />
    </div>
  );
}

export default function Topology({ data }) {
  if (!data) return null;
  return (
    <ReactFlowProvider>
      <TopologyInner data={data} />
    </ReactFlowProvider>
  );
}
