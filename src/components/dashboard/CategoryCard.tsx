"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Download, RefreshCw } from "lucide-react";
import type { ReportEntryWithCategory } from "@/lib/research/queries";
import { StatusBadge } from "@/components/ui/Badge";
import { PickupItemCard } from "./PickupItemCard";

export function CategoryCard({
  entry,
  favoritedRefs,
  defaultOpen = false,
}: {
  entry: ReportEntryWithCategory;
  favoritedRefs: Set<string>;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [researching, setResearching] = useState(false);
  const router = useRouter();
  const category = entry.categories;

  async function researchNow() {
    setResearching(true);
    try {
      await fetch(`/api/categories/${category.id}/research-now`, { method: "POST" });
      // `router.refresh()` re-fetches just this route's server data and keeps the
      // expanded/scroll state. A full `location.reload()` re-downloaded the app
      // shell, fonts and JS, and re-ran the auth proxy for no benefit.
      router.refresh();
    } finally {
      setResearching(false);
    }
  }

  return (
    <div className="card-enter rounded-2xl border border-border bg-bg-surface-raised">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <h3 className="font-semibold">{category.name}</h3>
          <StatusBadge status={entry.status} />
        </div>
        <ChevronDown size={18} className={open ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>

      {open && (
        <div className="space-y-4 border-t border-border p-4">
          {entry.status === "error" ? (
            <p className="text-sm text-danger">
              取得に失敗しました: {entry.error_message ?? "不明なエラー"}
            </p>
          ) : (
            <>
              {entry.summary_text && <p className="text-sm text-text-muted">{entry.summary_text}</p>}
              <div className="space-y-3">
                {entry.pickups.map((pickup) => (
                  <PickupItemCard
                    key={pickup.ref}
                    pickup={pickup}
                    reportEntryId={entry.id}
                    favorited={favoritedRefs.has(pickup.ref)}
                  />
                ))}
              </div>
            </>
          )}

          <div className="flex items-center gap-4 pt-1">
            <button
              type="button"
              onClick={researchNow}
              disabled={researching}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-accent disabled:opacity-50"
            >
              <RefreshCw size={14} className={researching ? "animate-spin" : ""} />
              今すぐリサーチ
            </button>
            <a
              href={`/api/reports/${entry.weekly_run_id}/${category.id}/export`}
              className="flex items-center gap-1 text-xs text-text-muted hover:text-accent"
            >
              <Download size={14} />
              Markdownエクスポート
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
