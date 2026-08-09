import { getLatestWeeklyRun, getEntriesWithFavoritesForRun } from "@/lib/research/queries";
import { pickHeroItems } from "@/lib/research/hero";
import { HeroSection } from "@/components/dashboard/HeroSection";
import { CategoryCard } from "@/components/dashboard/CategoryCard";
import { EmptyState } from "@/components/ui/EmptyState";
import type { GroupType } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const groupLabels: Record<GroupType, string> = {
  main: "メインカテゴリ",
  sub: "制作お役立ち",
  custom: "カスタム",
};

export default async function DashboardPage() {
  const run = await getLatestWeeklyRun();

  if (!run) {
    return (
      <EmptyState
        title="まだリサーチ結果がありません"
        description="週次リサーチが実行されるとここに表示されます。カテゴリ管理画面から「今すぐリサーチ」を試すこともできます。"
      />
    );
  }

  const { entries, favoritedRefs } = await getEntriesWithFavoritesForRun(run.id);
  const heroItems = pickHeroItems(entries);

  const groups: GroupType[] = ["main", "sub", "custom"];
  const entriesByGroup = groups
    .map((group) => ({
      group,
      entries: entries
        .filter((e) => e.categories.group_type === group)
        .sort((a, b) => a.categories.sort_order - b.categories.sort_order),
    }))
    .filter((g) => g.entries.length > 0);

  return (
    <>
      <p className="text-sm text-text-muted">今週: {run.week_start} 〜</p>

      <HeroSection items={heroItems} favoritedRefs={favoritedRefs} />

      {entriesByGroup.map(({ group, entries: groupEntries }) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-semibold text-text-muted">{groupLabels[group]}</h2>
          <div className="space-y-3">
            {groupEntries.map((entry) => (
              <CategoryCard key={entry.id} entry={entry} favoritedRefs={favoritedRefs} />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
