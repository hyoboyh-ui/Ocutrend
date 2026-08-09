"use client";

import { useEffect, useRef } from "react";

// Module-level so the identity is stable across renders — an inline default would
// re-trigger the animation effect on every render.
const defaultFormat = (n: number) => n.toLocaleString("ja-JP");

/**
 * Animates from 0 to `value` on mount. Respects prefers-reduced-motion.
 *
 * Writes to the DOM node directly instead of using state: a dashboard renders a
 * dozen-plus of these at once, and a setState per animation frame meant hundreds of
 * React re-renders in the first 600ms — right when the page is also hydrating.
 * Server-renders the FINAL value so the correct number is on screen before hydration.
 */
export function CountUp({ value, formatter }: { value: number; formatter?: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const format = formatter ?? defaultFormat;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const durationMs = 600;
    let start: number | null = null;
    let raf = 0;
    let last = "";

    const step = (ts: number) => {
      start ??= ts;
      const progress = Math.min((ts - start) / durationMs, 1);
      const next = format(Math.round(value * progress));
      // Skip the DOM write when the formatted text hasn't changed (large numbers
      // round to the same string for several consecutive frames).
      if (next !== last) {
        node.textContent = next;
        last = next;
      }
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value, format]);

  return (
    <span ref={ref} className="font-mono tabular-nums">
      {format(value)}
    </span>
  );
}
