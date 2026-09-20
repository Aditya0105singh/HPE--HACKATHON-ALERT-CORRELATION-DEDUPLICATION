"use client";

import { useState } from "react";
import clsx from "clsx";

export interface SeveritySlice {
  severity: string;
  count: number;
  color: string;
}

/** Interactive severity donut: hover a slice or a legend row to focus it. */
export function SeverityDonut({ slices }: { slices: SeveritySlice[] }) {
  const [active, setActive] = useState<string | null>(null);
  const total = slices.reduce((n, s) => n + s.count, 0) || 1;
  const r = 15.9155;
  const focus = slices.find((s) => s.severity === active);
  let offset = 25; // start at 12 o'clock

  return (
    <div className="flex flex-col sm:flex-row xl:flex-col 2xl:flex-row items-center gap-4" onMouseLeave={() => setActive(null)}>
      <div className="relative w-36 h-36 shrink-0">
        <svg viewBox="0 0 36 36" className="w-full h-full" role="img" aria-label={`Alerts by severity, ${total} total`}>
          <circle cx="18" cy="18" r={r} fill="none" stroke="#f3f4f6" strokeWidth="4.5" />
          {slices.map((s, i) => {
            const pct = (100 * s.count) / total;
            const gap = slices.length > 1 ? Math.min(0.8, pct / 2) : 0;
            const el = (
              <circle
                key={s.severity}
                className="kpi-ring cursor-pointer"
                cx="18"
                cy="18"
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={active === s.severity ? 6 : 4.5}
                pathLength={100}
                strokeDasharray={`${pct - gap} ${100 - pct + gap}`}
                strokeDashoffset={offset}
                opacity={active && active !== s.severity ? 0.35 : 1}
                style={{ transition: "stroke-width .2s, opacity .2s", animationDelay: `${300 + i * 120}ms` }}
                onMouseEnter={() => setActive(s.severity)}
              />
            );
            offset -= pct;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-2xl font-extrabold text-gray-900 tabular-nums leading-none">
            {(focus ? focus.count : total).toLocaleString()}
          </span>
          <span className="text-[11px] text-gray-600 mt-1 capitalize">
            {focus ? `${focus.severity} · ${Math.round((100 * focus.count) / total)}%` : "Total alerts"}
          </span>
        </div>
      </div>

      <ul className="flex flex-col gap-1 text-xs min-w-0 w-full">
        {slices.map((s) => {
          const pct = Math.round((100 * s.count) / total);
          return (
            <li
              key={s.severity}
              onMouseEnter={() => setActive(s.severity)}
              className={clsx("rounded-lg px-2 py-1.5 transition-colors cursor-default", active === s.severity ? "bg-green-50" : "")}
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="capitalize text-gray-700">{s.severity}</span>
                <span className="ml-auto font-bold text-gray-900 tabular-nums">{s.count.toLocaleString()}</span>
                <span className="text-gray-500 w-9 text-right tabular-nums">{pct}%</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-gray-100 overflow-hidden">
                <div className="kpi-hbar h-full rounded-full" style={{ width: `${pct}%`, background: s.color, animationDelay: "500ms" }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
