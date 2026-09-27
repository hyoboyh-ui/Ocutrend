import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { getWeeklyRunById, getEntriesWithFavoritesForRun } from "@/lib/research/queries";
import { CategoryCard } from "@/components/dashboard/CategoryCard";
import type { GroupType } from "@/lib/supabase/types";
import { GROUP_LABELS as groupLabels } from "@/lib/category-labels";

export const dynamic = "force-dynamic";

export default async function ArchiveDetailPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const run = await getWeeklyRunById(runId);
  if (!run) notFound();

  const { entries, favoritedRefs } = await getEntriesWithFavoritesForRun(runId);

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
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">{run.week_start} の週</h1>
        <a
          href={`/api/reports/${run.id}/export`}
          className="flex items-center gap-1 text-sm text-text-muted hover:text-accent"
        >
          <Download size={14} />
          全体をMarkdownで書き出す
        </a>
      </div>

      {entriesByGroup.map(({ group, entries: groupEntries }) => (
        <section key={group} className="space-y-3">
          <h2 className="text-sm font-semibold text-text-muted">{groupLabels[group]}</h2>
          <div className="space-y-3">
            {groupEntries.map((entry) => (
              <CategoryCard key={entry.id} entry={entry} favoritedRefs={favoritedRefs} defaultOpen />
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
