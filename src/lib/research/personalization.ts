/**
 * Stage 1 personalization: pure functions over already-fetched favorite data.
 *
 * No embeddings, no extra API calls — just frequency counts over titles/channels the
 * user has already favorited for a given category, fed back into that category's next
 * search query and ranking score. See the 2026-08-14 plan
 * (C:\Users\hyobo\.claude\plans\ocutrend-ai-personalization.md) for why this is split
 * from stage 2 (embeddings) and stage 3 (Claude summary injection).
 */

export interface FavoriteSignalInput {
  title: string;
  channelTitle: string | null;
}

export interface FavoriteSignals {
  keywords: string[];
  channels: string[];
}

const STOPWORDS = new Set([
  // JP particles/common words that would otherwise dominate frequency counts
  "の","を","に","は","が","で","と","も","へ","や","から","まで","より","です","ます","した","する","こと","これ","それ","あの","この",
  // EN common words
  "the","a","an","to","of","and","in","on","for","with","is","are","how","what",
]);

/** Splits a title into candidate keyword tokens: whole latin/alphanumeric words, plus 2-4 char n-grams from CJK runs (no dependency-free JP tokenizer exists, so n-grams stand in for real segmentation). */
function tokenize(title: string): string[] {
  const latinTokens = (title.match(/[A-Za-z0-9]{2,}/g) ?? []).map((t) => t.toLowerCase());

  const cjkRuns = title.match(/[\u3040-\u30ff\u3400-\u9fff]{2,}/g) ?? [];
  const cjkTokens: string[] = [];
  for (const run of cjkRuns) {
    const maxLen = Math.min(4, run.length);
    for (let len = 2; len <= maxLen; len++) {
      for (let i = 0; i + len <= run.length; i++) cjkTokens.push(run.slice(i, i + len));
    }
  }

  return [...latinTokens, ...cjkTokens].filter((t) => !STOPWORDS.has(t));
}

/**
 * Counts keyword/channel frequency across a category's favorited items.
 *
 * Requires at least 2 occurrences to count as "frequent" — with typically small
 * per-category favorite counts, a single title's words would otherwise dominate the
 * boost and query augmentation on the very next run.
 */
export function extractFavoriteSignals(
  inputs: FavoriteSignalInput[],
  { topKeywords = 5, topChannels = 3 }: { topKeywords?: number; topChannels?: number } = {}
): FavoriteSignals {
  const keywordCounts = new Map<string, number>();
  const channelCounts = new Map<string, number>();

  for (const { title, channelTitle } of inputs) {
    for (const token of tokenize(title)) {
      keywordCounts.set(token, (keywordCounts.get(token) ?? 0) + 1);
    }
    if (channelTitle) {
      channelCounts.set(channelTitle, (channelCounts.get(channelTitle) ?? 0) + 1);
    }
  }

  const topByCount = (counts: Map<string, number>, limit: number) =>
    [...counts.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([key]) => key);

  return {
    keywords: topByCount(keywordCounts, topKeywords),
    channels: topByCount(channelCounts, topChannels),
  };
}

const BOOST_AMOUNT = 0.15;

/** Returns a per-item score bump for rankByVelocity's `boost` option: title-keyword match and/or exact channel match, each worth BOOST_AMOUNT. */
export function personalizationBoost(
  signals: FavoriteSignals
): (item: { title: string; channelTitle?: string | null }) => number {
  if (signals.keywords.length === 0 && signals.channels.length === 0) return () => 0;

  return (item) => {
    let boost = 0;
    const lowerTitle = item.title.toLowerCase();
    if (signals.keywords.some((k) => lowerTitle.includes(k.toLowerCase()))) boost += BOOST_AMOUNT;
    if (item.channelTitle && signals.channels.includes(item.channelTitle)) boost += BOOST_AMOUNT;
    return boost;
  };
}

/** Appends the single most frequent favorite keyword as an OR-term, so the next search.list call also pulls in candidates the plain category query would miss. */
export function buildPersonalizedQuery(baseQuery: string, signals: FavoriteSignals): string {
  if (signals.keywords.length === 0) return baseQuery;
  return `${baseQuery} OR ${signals.keywords[0]}`;
}
