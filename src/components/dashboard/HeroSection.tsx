import { Flame } from "lucide-react";
import type { HeroPickup } from "@/lib/research/hero";
import { PickupItemCard } from "./PickupItemCard";

export function HeroSection({ items, favoritedRefs }: { items: HeroPickup[]; favoritedRefs: Set<string> }) {
  if (items.length === 0) return null;

  return (
    <section className="card-enter">
      <div className="mb-3 flex items-center gap-2 text-accent">
        <Flame size={20} />
        <h2 className="text-lg font-bold">今週いちばん注目</h2>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {items.map(({ pickup, categoryName, reportEntryId }) => (
          <div key={pickup.ref}>
            <p className="mb-1 text-xs text-text-muted">{categoryName}</p>
            <PickupItemCard
              pickup={pickup}
              reportEntryId={reportEntryId}
              favorited={favoritedRefs.has(pickup.ref)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
