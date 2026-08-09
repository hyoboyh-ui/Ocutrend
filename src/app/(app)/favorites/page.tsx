import Link from "next/link";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { PlatformBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import type { CategoryRow, PickupItem, ReportEntryRow, WeeklyRunRow } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

interface FavoriteRowJoined {
  id: string;
  pickup_ref: string;
  note: string | null;
  report_entries: ReportEntryRow & { categories: CategoryRow; weekly_runs: WeeklyRunRow };
}

export default async function FavoritesPage() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("favorites")
    .select("*, report_entries(*, categories(*), weekly_runs(*))")
    .order("created_at", { ascending: false });

  const favorites = (data ?? []) as unknown as FavoriteRowJoined[];

  if (favorites.length === 0) {
    return <EmptyState title="お気に入りはまだありません" description="ダッシュボードの☆から動画をお気に入り登録できます。" />;
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">お気に入り</h1>
      {favorites.map((fav) => {
        const pickup = (fav.report_entries.pickups as PickupItem[]).find((p) => p.ref === fav.pickup_ref);
        if (!pickup) return null;
        const run = fav.report_entries.weekly_runs;
        const category = fav.report_entries.categories;
        return (
          <Link
            key={fav.id}
            href={`/archive/${run.id}`}
            className="card-enter block rounded-xl border border-border bg-bg-surface p-4 hover:border-accent"
          >
            <div className="mb-1 flex items-center gap-2">
              <PlatformBadge platform={pickup.platform} />
              <span className="text-xs text-text-muted">
                {category.name} ・ {run.week_start}
              </span>
            </div>
            <h3 className="font-medium">{pickup.title}</h3>
            <p className="mt-1 line-clamp-2 text-sm text-text-muted">{pickup.whyTrending}</p>
          </Link>
        );
      })}
    </div>
  );
}
