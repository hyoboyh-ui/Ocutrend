import type { ReactNode } from "react";

const platformColor: Record<string, string> = {
  youtube: "bg-platform-youtube/15 text-platform-youtube",
  bilibili: "bg-platform-bilibili/15 text-platform-bilibili",
  web: "bg-accent/15 text-accent",
};

export function PlatformBadge({ platform }: { platform: "youtube" | "bilibili" | "web" }) {
  const label = platform === "youtube" ? "YouTube" : platform === "bilibili" ? "bilibili" : "Web";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${platformColor[platform]}`}>
      {label}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    ok: { label: "OK", className: "bg-accent/15 text-accent" },
    fallback_used: { label: "代替取得", className: "bg-warning/15 text-warning" },
    error: { label: "エラー", className: "bg-danger/15 text-danger" },
    pending: { label: "待機中", className: "bg-text-muted/15 text-text-muted" },
    running: { label: "実行中", className: "bg-text-muted/15 text-text-muted" },
  };
  const item = map[status] ?? { label: status, className: "bg-text-muted/15 text-text-muted" };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${item.className}`}>{item.label}</span>;
}

export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-border px-2.5 py-0.5 text-xs text-text-muted">
      {children}
    </span>
  );
}
