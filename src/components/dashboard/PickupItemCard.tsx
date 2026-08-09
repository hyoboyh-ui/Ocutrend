"use client";

import { useState } from "react";
import { ChevronDown, ExternalLink } from "lucide-react";
import type { PickupItem } from "@/lib/supabase/types";
import { PlatformBadge } from "@/components/ui/Badge";
import { FavoriteButton } from "./FavoriteButton";
import { CountUp } from "./CountUp";

export function PickupItemCard({
  pickup,
  reportEntryId,
  favorited,
}: {
  pickup: PickupItem;
  reportEntryId: string;
  favorited: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-border bg-bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <PlatformBadge platform={pickup.platform} />
          {typeof pickup.viewCount === "number" && (
            <span className="text-xs text-text-muted">
              <CountUp value={pickup.viewCount} /> 回再生
            </span>
          )}
        </div>
        <FavoriteButton reportEntryId={reportEntryId} pickupRef={pickup.ref} initiallyFavorited={favorited} />
      </div>

      <h4 className="mt-2 font-medium leading-snug">{pickup.title}</h4>

      <p className="mt-2 line-clamp-2 text-sm text-text-muted">{pickup.whyTrending}</p>

      {expanded && (
        <div className="mt-3 space-y-2 border-t border-border pt-3 text-sm">
          <p>
            <span className="font-medium text-accent">なぜ伸びているか: </span>
            {pickup.whyTrending}
          </p>
          <p>
            <span className="font-medium text-accent">作り方: </span>
            {pickup.howToReplicate}
          </p>
          {pickup.url && (
            <a
              href={pickup.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-accent hover:underline"
            >
              動画を見る <ExternalLink size={14} />
            </a>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-2 flex items-center gap-1 text-xs text-text-muted hover:text-accent"
      >
        {expanded ? "閉じる" : "詳しく見る"}
        <ChevronDown size={14} className={expanded ? "rotate-180 transition-transform" : "transition-transform"} />
      </button>
    </div>
  );
}
