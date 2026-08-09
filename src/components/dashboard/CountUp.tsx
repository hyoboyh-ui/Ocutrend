"use client";

import { useEffect, useRef, useState } from "react";

/** Animates from 0 to `value` on mount. Respects prefers-reduced-motion by rendering the final value immediately. */
export function CountUp({ value, formatter }: { value: number; formatter?: (n: number) => string }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- static final value, no animation loop to defer to
      setDisplay(value);
      return;
    }
    const durationMs = 600;
    let raf: number;
    const step = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / durationMs, 1);
      setDisplay(Math.round(value * progress));
      if (progress < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const format = formatter ?? ((n: number) => n.toLocaleString("ja-JP"));
  return <span className="font-mono tabular-nums">{format(display)}</span>;
}
