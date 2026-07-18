import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, Plus, RotateCcw, X } from "lucide-react";
import { SeverityDot } from "./ui";

const ADDABLE_FIELDS = [
  { key: "service", label: "Service" },
  { key: "alertname", label: "Alert Name" },
];

const SEV_COLOR = { critical: "var(--critical)", high: "var(--high)", info: "var(--info)" };
const STATUS_COLOR = { firing: "var(--critical)", suppressed: "var(--muted)", resolved: "var(--ok)" };

// Best-effort color for a facet option, so every group gets the same
// "colored dot" treatment the severity group had — not just severity.
function dotColorFor(groupKey, value) {
  if (groupKey === "severity") return SEV_COLOR[value] || "var(--muted)";
  if (groupKey === "status") return STATUS_COLOR[value] || "var(--muted)";
  if (groupKey === "dismissed") return value === "true" || value === true ? "var(--high)" : "var(--ok)";
  return "var(--accent)";
}

function Checkbox({ on, color }) {
  return (
    <span className={`ck ${on ? "on" : ""}`} style={{ "--sc": color }}>
      <Check size={11} strokeWidth={3} color="#fff" />
    </span>
  );
}

function FacetGroup({ groupKey, title, options, selected, onToggle, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-2">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left text-[12.5px] font-semibold mb-1 cursor-pointer py-1 rounded-lg transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]"
        style={{ color: "var(--text)" }}
      >
        <ChevronRight
          size={12}
          strokeWidth={2.5}
          className="transition-transform duration-200 shrink-0"
          style={{ transform: open ? "rotate(90deg)" : "none", color: "var(--muted)" }}
        />
        {title}
      </button>
      <div className={`collapse-rows ${open ? "is-open" : ""}`}>
        <div>
          {options.map(({ value, count }) => {
            const on = selected.has(value);
            const color = dotColorFor(groupKey, value);
            return (
              <label
                key={String(value)}
                className="ck-row filter-row flex items-center gap-2.5 py-1.5 px-1.5 pl-1 cursor-pointer text-[13.5px] rounded-lg"
                style={{ color: "var(--muted)" }}
              >
                <input type="checkbox" checked={on} onChange={() => onToggle(value)} className="sr-only" />
                <Checkbox on={on} color={color} />
                {groupKey === "severity" ? <SeverityDot severity={value} /> : (
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                )}
                <span className="flex-1 capitalize truncate" style={{ color: on ? "var(--text)" : "var(--muted)" }}>
                  {typeof value === "boolean" ? String(value) : value}
                </span>
                <span
                  className="px-1.5 py-0.5 rounded-full text-[11px] font-semibold tabular-nums"
                  style={{ background: "var(--panel-2)", color: "var(--muted)" }}
                >
                  {count}
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function FacetSidebar({ alerts, facets, setFacets, extraFacets, setExtraFacets }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const countBy = (key) => {
    const m = new Map();
    for (const a of alerts) m.set(a[key], (m.get(a[key]) || 0) + 1);
    return [...m.entries()].map(([value, count]) => ({ value, count }));
  };

  const toggle = (facet) => (value) =>
    setFacets((prev) => {
      const next = new Set(prev[facet] ?? []);
      next.has(value) ? next.delete(value) : next.add(value);
      return { ...prev, [facet]: next };
    });

  const addableOptions = ADDABLE_FIELDS.filter((f) => !extraFacets.some((e) => e.key === f.key));

  const addFacet = (field) => {
    setExtraFacets((prev) => [...prev, field]);
    setFacets((prev) => ({ ...prev, [field.key]: new Set() }));
    setMenuOpen(false);
  };

  const removeFacet = (key) => {
    setExtraFacets((prev) => prev.filter((f) => f.key !== key));
    setFacets((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const activePills = Object.entries(facets).flatMap(([key, set]) =>
    [...(set ?? [])].map((value) => ({ key, value }))
  );

  const clearAll = () =>
    setFacets((prev) => {
      const next = {};
      for (const key of Object.keys(prev)) next[key] = new Set();
      return next;
    });

  const groupLabel = (key) =>
    extraFacets.find((f) => f.key === key)?.label ||
    { severity: "Severity", status: "Status", source: "Source", assignee: "Assignee", dismissed: "Dismissed" }[key] ||
    key;

  return (
    <div
      className="w-60 shrink-0 border-r p-4 overflow-y-auto"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      <div className="relative mb-3" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-full flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13.5px] cursor-pointer text-left transition-colors hover:bg-[color-mix(in_srgb,var(--text)_5%,transparent)]"
          style={{ borderColor: "var(--border)", color: "var(--muted)" }}
        >
          <Plus size={14} strokeWidth={2.25} /> Add Facet
        </button>
        {menuOpen && (
          <div
            className="absolute left-0 right-0 top-full mt-1 rounded-lg border overflow-hidden z-10"
            style={{ borderColor: "var(--border)", background: "var(--panel)", boxShadow: "var(--shadow-pop)" }}
          >
            {addableOptions.length === 0 ? (
              <div className="px-3 py-2 text-[13.5px]" style={{ color: "var(--muted)" }}>
                All available fields added
              </div>
            ) : (
              addableOptions.map((f) => (
                <button
                  key={f.key}
                  onClick={() => addFacet(f)}
                  className="block w-full text-left px-3 py-1.5 text-[13.5px] cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--text)_6%,transparent)]"
                  style={{ color: "var(--text)" }}
                >
                  {f.label}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {activePills.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              Active Filters
            </span>
            <button
              onClick={clearAll}
              className="flex items-center gap-1 text-[11px] cursor-pointer transition-colors hover:text-[var(--critical)]"
              style={{ color: "var(--muted)" }}
            >
              <RotateCcw size={11} strokeWidth={2.25} /> Reset
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {activePills.map(({ key, value }) => {
              const color = dotColorFor(key, value);
              return (
                <button
                  key={`${key}:${value}`}
                  onClick={() => toggle(key)(value)}
                  className="count-in flex items-center gap-1 pl-2 pr-1.5 py-1 rounded-full text-[11.5px] font-medium cursor-pointer transition-transform hover:scale-105"
                  style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
                >
                  {groupLabel(key)}: {String(value)}
                  <X size={11} strokeWidth={2.5} />
                </button>
              );
            })}
          </div>
        </div>
      )}

      {extraFacets.map((f) => (
        <div key={f.key} className="group relative">
          <FacetGroup
            groupKey={f.key}
            title={f.label}
            options={countBy(f.key)}
            selected={facets[f.key] ?? new Set()}
            onToggle={toggle(f.key)}
          />
          <button
            onClick={() => removeFacet(f.key)}
            title="Remove facet"
            className="hidden group-hover:flex absolute right-0 top-0 cursor-pointer p-1"
            style={{ color: "var(--muted)" }}
          >
            <X size={12} strokeWidth={2.25} />
          </button>
        </div>
      ))}

      <FacetGroup groupKey="severity" title="Severity" options={countBy("severity")} selected={facets.severity} onToggle={toggle("severity")} />
      <FacetGroup groupKey="status" title="Status" options={countBy("status")} selected={facets.status} onToggle={toggle("status")} />
      <FacetGroup groupKey="source" title="Source" options={countBy("source")} selected={facets.source} onToggle={toggle("source")} />
      <FacetGroup groupKey="assignee" title="Assignee" options={countBy("assignee")} selected={facets.assignee} onToggle={toggle("assignee")} defaultOpen={false} />
      <FacetGroup groupKey="dismissed" title="Dismissed" options={countBy("dismissed")} selected={facets.dismissed} onToggle={toggle("dismissed")} defaultOpen={false} />
    </div>
  );
}
