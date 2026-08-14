import "server-only";
import { getAnthropicClient, getAnalysisModel, logUsage } from "./anthropic-client";
import { assertNotTruncated } from "./analysis";
import { getFavoriteItemsForTrendSummary, getAppSetting, upsertAppSetting } from "./persist";
import { getCurrentMonthStartJST, jstNow } from "@/lib/date/schedule";

interface StoredFavoriteTrendSummary {
  summary: string;
  monthStart: string;
  generatedAt: string;
}

const SETTING_KEY = "favorite_trend_summary";

/** The most recently generated monthly summary, if any — read by analysis.ts to inject into trend-category prompts. */
export async function getStoredFavoriteTrendSummary(): Promise<string | null> {
  const stored = await getAppSetting<StoredFavoriteTrendSummary>(SETTING_KEY);
  return stored?.summary ?? null;
}

/**
 * Stage 3: summarizes the user's favorited items across the 5 trend categories into a
 * short "what this person tends to like and why" writeup, via a single plain (no
 * tool-use) Claude call. Skips generation (returns without writing) when there are no
 * favorites yet, or when this month's summary already exists — this is meant to run
 * once a month, not on every cron invocation.
 */
export async function generateMonthlyFavoriteTrendSummary(): Promise<void> {
  const monthStart = getCurrentMonthStartJST(jstNow());
  const existing = await getAppSetting<StoredFavoriteTrendSummary>(SETTING_KEY);
  if (existing?.monthStart === monthStart) return;

  const items = await getFavoriteItemsForTrendSummary();
  if (items.length === 0) return;

  const byCategory = new Map<string, string[]>();
  for (const item of items) {
    const label = item.channelTitle ? `「${item.title}」(${item.channelTitle})` : `「${item.title}」`;
    const list = byCategory.get(item.categoryName) ?? [];
    list.push(label);
    byCategory.set(item.categoryName, list);
  }
  const favoritesList = [...byCategory.entries()]
    .map(([categoryName, titles]) => `【${categoryName}】\n${titles.join("\n")}`)
    .join("\n\n");

  const client = getAnthropicClient();
  const message = await client.messages.create({
    model: getAnalysisModel(),
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `以下は、あるユーザーがこれまでにお気に入り登録した動画の一覧です(カテゴリ別)。

${favoritesList}

このユーザーがどんな傾向のコンテンツを好むか(選曲・編集手法・企画のパターン・チャンネルの傾向など)を、日本語で1〜2段落に要約してください。今後の週次トレンド分析で「このユーザーの好みを踏まえるとどう再現・応用できるか」を考える際の参考情報として使います。`,
      },
    ],
  });

  logUsage("favorite-trend-summary", getAnalysisModel(), message.usage);
  assertNotTruncated(message.stop_reason, "お気に入り傾向の月次要約");

  const summary = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n")
    .trim();
  if (!summary) return;

  const value: StoredFavoriteTrendSummary = { summary, monthStart, generatedAt: new Date().toISOString() };
  await upsertAppSetting(SETTING_KEY, value);
}
