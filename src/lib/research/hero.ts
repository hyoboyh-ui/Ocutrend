import type { ReportEntryWithCategory } from "./queries";
import type { PickupItem } from "@/lib/supabase/types";

export interface HeroPickup {
  pickup: PickupItem;
  categoryName: string;
  reportEntryId: string;
}

/** Picks the top N pickups across all categories by view count, for the dashboard's hero section. */
export function pickHeroItems(entries: ReportEntryWithCategory[], count = 2): HeroPickup[] {
  const all: HeroPickup[] = entries
    .filter((e) => e.status === "ok" || e.status === "fallback_used")
    .flatMap((e) =>
      e.pickups.map((pickup) => ({
        pickup,
        categoryName: e.categories.name,
        reportEntryId: e.id,
      }))
    );

  return all
    .sort((a, b) => (b.pickup.viewCount ?? 0) - (a.pickup.viewCount ?? 0))
    .slice(0, count);
}
