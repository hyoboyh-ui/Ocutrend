import "server-only";
import type { CategoryRow, PickupItem, ReportEntryRow } from "@/lib/supabase/types";

function entryToMarkdown(category: CategoryRow, entry: ReportEntryRow): string {
  const lines: string[] = [`## ${category.name}`];

  if (entry.status === "error") {
    lines.push("", `⚠️ このカテゴリはエラーで取得できませんでした: ${entry.error_message ?? ""}`);
    return lines.join("\n");
  }

  if (entry.summary_text) {
    lines.push("", entry.summary_text);
  }

  for (const pickup of entry.pickups as PickupItem[]) {
    lines.push(
      "",
      `### ${pickup.title} (${pickup.platform})`,
      pickup.url ? `${pickup.url}` : "",
      "",
      `**なぜ伸びているか**: ${pickup.whyTrending}`,
      "",
      `**作り方**: ${pickup.howToReplicate}`
    );
  }

  return lines.join("\n");
}

export function buildWeeklyMarkdown(
  weekStart: string,
  entries: Array<{ category: CategoryRow; entry: ReportEntryRow }>
): string {
  const header = `# 週刊トレンドリサーチ (${weekStart})`;
  const body = entries.map(({ category, entry }) => entryToMarkdown(category, entry)).join("\n\n---\n\n");
  return `${header}\n\n${body}\n`;
}

export function buildCategoryMarkdown(
  weekStart: string,
  category: CategoryRow,
  entry: ReportEntryRow
): string {
  return `# ${category.name} (${weekStart})\n\n${entryToMarkdown(category, entry)}\n`;
}
