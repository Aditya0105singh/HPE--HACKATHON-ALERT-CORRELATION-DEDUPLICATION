"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Width of an element, kept current as its container resizes. A callback ref
 * (not useRef) so it also starts measuring when the element mounts later, e.g.
 * after a chart swaps its "not enough data" message for the real axis.
 */
export function useElementWidth<T extends HTMLElement>() {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useCallback((node: T | null) => setEl(node), []);
  useEffect(() => {
    if (!el) return;
    const update = () => setWidth(el.getBoundingClientRect().width);
    update();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return { ref, width };
}

/**
 * Which of `n` x-axis positions get a label, so labels never overlap at any
 * chart width. A fixed "label every 6th bucket" overlapped on narrow charts;
 * this fits as many as the measured width allows (labelPx per label, including
 * breathing room). Before the first measurement, falls back to `fallback`.
 */
export function labelIndices(n: number, width: number, labelPx = 76, fallback = 4): number[] {
  if (n <= 0) return [];
  const fit = width > 0 ? Math.max(2, Math.floor(width / labelPx)) : fallback;
  const every = Math.max(1, Math.ceil(n / fit));
  const out: number[] = [];
  for (let i = 0; i < n; i += every) out.push(i);
  return out;
}

/**
 * Anchor a label at `frac` (0..1) along the axis: left-aligned at the start,
 * centred in the middle, right-aligned at the end, and smoothly in between. A
 * label can then never poke past either edge, and two labels spaced at least
 * one label-width apart cannot collide.
 */
export const anchorAt = (frac: number) => `translateX(-${Math.min(1, Math.max(0, frac)) * 100}%)`;
