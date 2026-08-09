"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pause, Play, RefreshCw, BarChart3, Newspaper } from "lucide-react";
import type { CategoryRow } from "@/lib/supabase/types";
import { Chip } from "@/components/ui/Badge";

export function CategoryListItem({ category }: { category: CategoryRow }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const paused = category.status === "paused";

  async function togglePause() {
    setBusy(true);
    try {
      await fetch(`/api/categories/${category.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: paused ? "active" : "paused" }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function researchNow() {
    setBusy(true);
    try {
      await fetch(`/api/categories/${category.id}/research-now`, { method: "POST" });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-bg-surface p-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate font-medium">{category.name}</h3>
          <Chip>
            {category.source_type === "youtube_bilibili" ? (
              <span className="flex items-center gap-1">
                <BarChart3 size={12} /> 再生数ランキング
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Newspaper size={12} /> 最新ニュース
              </span>
            )}
          </Chip>
          {paused && <Chip>停止中</Chip>}
        </div>
        <p className="mt-1 truncate text-sm text-text-muted">{category.description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={researchNow}
          disabled={busy || paused}
          aria-label="今すぐリサーチ"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-muted hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <RefreshCw size={16} className={busy ? "animate-spin" : ""} />
        </button>
        <button
          type="button"
          onClick={togglePause}
          disabled={busy}
          aria-label={paused ? "再開" : "停止"}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-muted hover:border-accent hover:text-accent disabled:opacity-40"
        >
          {paused ? <Play size={16} /> : <Pause size={16} />}
        </button>
      </div>
    </div>
  );
}
