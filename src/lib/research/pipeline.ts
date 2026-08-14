import "server-only";
import type { CategoryRow, SourceUsed, TriggeredBy } from "@/lib/supabase/types";
import type { AnalysisResult } from "./schemas";
import { rankByVelocity, type RankedItem } from "./ranking";
import { fetchYouTubeTrending } from "./sources/youtube";
import { fetchBilibiliRanking } from "./sources/bilibili";
import { fetchAndAnalyzeViaWebSearch } from "./sources/claude-web-search";
import { BilibiliEndpointError, YouTubeApiError } from "./sources/types";
import { analyzeWithClaude } from "./analysis";
import {
  upsertWeeklyRun,
  getActiveCategories,
  upsertReportEntryRunning,
  persistReportEntry,
  markReportEntryError,
  logError,
  finalizeWeeklyRun,
  resetCategoryFailureStreak,
  recordCategoryFailureAndShouldNotify,
  getFavoriteSignalsForCategory,
} from "./persist";
import { extractFavoriteSignals, personalizationBoost, type FavoriteSignals } from "./personalization";
import { isEmbeddingConfigured } from "./embeddings";
import { rerankByFavoriteSimilarity } from "./stage2-rerank";
import { getStoredFavoriteTrendSummary } from "./stage3-summary";
import { sendReportReadyPush, sendCategoryErrorPush } from "@/lib/notifications/webpush";

interface FetchResult {
  items: RankedItem[];
  sourceUsed: SourceUsed;
  fallbackReason: string | null;
}

/** How many videos per platform survive into the list Claude analyses. */
const ITEMS_PER_PLATFORM = 12;

async function fetchRawDataForMainCategory(
  category: CategoryRow,
  favoriteSignals: FavoriteSignals
): Promise<FetchResult> {
  const boost = personalizationBoost(favoriteSignals);

  // The AI sub categories have no bilibili equivalent — skip it entirely rather than
  // falling back to bilibili's cross-partition "popular" feed, which would inject
  // unrelated Chinese-entertainment items into an AI-tooling report.
  if (category.youtube_only) {
    const ytItems = await fetchYouTubeTrending(category, favoriteSignals);
    return {
      items: rankByVelocity(ytItems, { limitPerPlatform: ITEMS_PER_PLATFORM, boost }),
      sourceUsed: "youtube",
      fallbackReason: null,
    };
  }

  const [ytResult, biliResult] = await Promise.allSettled([
    fetchYouTubeTrending(category, favoriteSignals),
    fetchBilibiliRanking(category),
  ]);

  if (biliResult.status === "rejected") {
    await logError({
      categoryId: category.id,
      source: "bilibili",
      message: biliResult.reason instanceof Error ? biliResult.reason.message : String(biliResult.reason),
    });

    // Deliberately no web-search substitute for bilibili here. A searched-up list
    // carries no comment counts and unreliable publish dates, so every such item
    // scores 0 in rankByVelocity and the recency filter cannot drop stale hits —
    // the report would quietly lose the ranking it is built around while paying
    // per search for the privilege. Degrading to YouTube-only stays free and
    // honest; the fallback_used badge and the error log surface the outage so the
    // endpoint itself gets fixed (as in the dead-partition fix).
    if (ytResult.status === "rejected") {
      await logError({
        categoryId: category.id,
        source: "youtube",
        message: ytResult.reason instanceof Error ? ytResult.reason.message : String(ytResult.reason),
      });
      // Rethrow bilibili's own error so classifyErrorSource still attributes it correctly.
      throw biliResult.reason instanceof Error
        ? biliResult.reason
        : new Error(String(biliResult.reason));
    }

    return {
      items: rankByVelocity(ytResult.value, { limitPerPlatform: ITEMS_PER_PLATFORM, boost }),
      sourceUsed: "youtube",
      fallbackReason: "bilibili_endpoint_failed",
    };
  }

  if (ytResult.status === "rejected") {
    await logError({
      categoryId: category.id,
      source: "youtube",
      message: ytResult.reason instanceof Error ? ytResult.reason.message : String(ytResult.reason),
    });
    return {
      items: rankByVelocity(biliResult.value, { limitPerPlatform: ITEMS_PER_PLATFORM, boost }),
      sourceUsed: "bilibili",
      fallbackReason: "youtube_api_failed",
    };
  }

  return {
    // Ranked across both platforms at once so the list handed to Claude is ordered by
    // how fast each video is climbing, not by which API happened to return it.
    items: rankByVelocity([...ytResult.value, ...biliResult.value], {
      limitPerPlatform: ITEMS_PER_PLATFORM,
      boost,
    }),
    sourceUsed: "youtube", // mixed source; source_used records the primary happy-path source
    fallbackReason: null,
  };
}

export async function runOneCategory(weeklyRunId: string, category: CategoryRow): Promise<void> {
  const entry = await upsertReportEntryRunning(weeklyRunId, category.id);

  try {
    let analysis: AnalysisResult;
    let sourceUsed: SourceUsed;
    let fallbackReason: string | null;
    let rawItems: RankedItem[];

    if (category.source_type === "web_search_only") {
      analysis = await fetchAndAnalyzeViaWebSearch(category);
      sourceUsed = "claude_web_search";
      fallbackReason = null;
      rawItems = [];
    } else {
      const favoriteInputs = await getFavoriteSignalsForCategory(category.id);
      const favoriteSignals = extractFavoriteSignals(favoriteInputs);
      const raw = await fetchRawDataForMainCategory(category, favoriteSignals);

      // Stage 2 (embedding similarity rerank) only applies to the 5 trend categories,
      // not the AI sub categories (youtube_only) — see the plan's stage split — and
      // only once VOYAGE_API_KEY is configured.
      const items =
        !category.youtube_only && isEmbeddingConfigured()
          ? await rerankByFavoriteSimilarity(category, raw.items)
          : raw.items;

      // Stage 3 (monthly favorite-trend summary) is injected the same way — trend
      // categories only, no-op until a summary has actually been generated.
      const favoriteTrendSummary = !category.youtube_only ? await getStoredFavoriteTrendSummary() : null;

      analysis = await analyzeWithClaude(category, items, favoriteTrendSummary);
      sourceUsed = raw.sourceUsed;
      fallbackReason = raw.fallbackReason;
      rawItems = items;
    }

    await persistReportEntry(entry.id, analysis, sourceUsed, fallbackReason, rawItems);
    await resetCategoryFailureStreak(category.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await markReportEntryError(entry.id, message);
    await logError({
      categoryId: category.id,
      weeklyRunId,
      source: classifyErrorSource(err),
      message,
    });
    const shouldNotify = await recordCategoryFailureAndShouldNotify(category.id, category);
    if (shouldNotify) {
      await sendCategoryErrorPush(category, message);
    }
  }
}

function classifyErrorSource(err: unknown): string {
  if (err instanceof BilibiliEndpointError) return "bilibili";
  if (err instanceof YouTubeApiError) return "youtube";
  return "claude";
}

export async function runWeeklyResearch(triggeredBy: TriggeredBy): Promise<string> {
  const run = await upsertWeeklyRun(triggeredBy);
  const categories = await getActiveCategories();

  await Promise.allSettled(categories.map((cat) => runOneCategory(run.id, cat)));

  await finalizeWeeklyRun(run.id);
  await sendReportReadyPush(run.id);
  return run.id;
}
