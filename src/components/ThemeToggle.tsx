"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Hydration-safe mount flag: server always renders `false`, so this one-time
    // effect->setState is the standard way to defer theme-dependent UI to the client.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);
  if (!mounted) return <div className="h-9 w-9" />;

  const isDark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-bg-surface text-text-primary transition-colors hover:border-accent"
      aria-label="テーマ切り替え"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
