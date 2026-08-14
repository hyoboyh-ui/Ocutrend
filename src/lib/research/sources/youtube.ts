import "server-only";
import { z } from "zod";
import type { CategoryRow } from "@/lib/supabase/types";
import type { RawMetricItem } from "../schemas";
import { getEnv } from "@/lib/env";
import { MAX_AGE_DAYS } from "../ranking";
import { buildPersonalizedQuery, type FavoriteSignals } from "../personalization";
import { YouTubeApiError } from "./types";

const searchResponseSchema = z.object({
  items: z.array(z.object({ id: z.object({ videoId: z.string() }) })),
});

const videosResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({ title: z.string(), publishedAt: z.string(), channelTitle: z.string() }),
      statistics: z.object({
        viewCount: z.string().optional(),
        likeCount: z.string().optional(),
        commentCount: z.string().optional(),
      }),
    })
  ),
});

async function searchVideoIds(
  apiKey: string,
  publishedAfter: string,
  query: { q: string; relevanceLanguage?: string; regionCode?: string }
): Promise<string[]> {
  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("order", "viewCount");
  searchUrl.searchParams.set("maxResults", "25");
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  searchUrl.searchParams.set("q", query.q);
  if (query.relevanceLanguage) searchUrl.searchParams.set("relevanceLanguage", query.relevanceLanguage);
  if (query.regionCode) searchUrl.searchParams.set("regionCode", query.regionCode);

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new YouTubeApiError(`YouTube search.list failed: HTTP ${searchRes.status}`);
  }
  const searchParsed = searchResponseSchema.safeParse(await searchRes.json());
  if (!searchParsed.success) {
    throw new YouTubeApiError(`YouTube search.list response shape invalid`);
  }
  return searchParsed.data.items.map((i) => i.id.videoId).filter(Boolean);
}

/** videos.list only accepts up to 50 ids per call. */
function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function fetchVideosByIds(apiKey: string, ids: string[]): Promise<RawMetricItem[]> {
  if (ids.length === 0) return [];

  const results = await Promise.all(
    chunk(ids, 50).map(async (idChunk) => {
      const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
      videosUrl.searchParams.set("key", apiKey);
      videosUrl.searchParams.set("part", "snippet,statistics");
      videosUrl.searchParams.set("id", idChunk.join(","));

      const videosRes = await fetch(videosUrl);
      if (!videosRes.ok) {
        throw new YouTubeApiError(`YouTube videos.list failed: HTTP ${videosRes.status}`);
      }
      const videosParsed = videosResponseSchema.safeParse(await videosRes.json());
      if (!videosParsed.success) {
        throw new YouTubeApiError(`YouTube videos.list response shape invalid`);
      }
      return videosParsed.data.items;
    })
  );

  return results.flat().map((v) => ({
    platform: "youtube" as const,
    title: v.snippet.title,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    channelTitle: v.snippet.channelTitle,
    viewCount: v.statistics.viewCount ? Number(v.statistics.viewCount) : null,
    likeCount: v.statistics.likeCount ? Number(v.statistics.likeCount) : null,
    commentCount: v.statistics.commentCount ? Number(v.statistics.commentCount) : null,
    publishedAt: v.snippet.publishedAt,
  }));
}

/**
 * Fetches recent high-view videos for a category via search.list + videos.list.
 *
 * `order=viewCount` is only a coarse server-side pre-filter to get a decent pool —
 * the actual ordering is redone locally by view/comment velocity (see ranking.ts),
 * so that a 2-day-old climber outranks a 9-day-old video with a bigger total.
 *
 * Categories with `search_queries` set (the AI sub categories) run one search.list
 * call per entry, each tagged with its own relevanceLanguage/regionCode, and the
 * resulting video ids are de-duplicated before videos.list. Everything else keeps the
 * single `search_query_hint` query it always used.
 *
 * `favoriteSignals`, when given, appends the category's top favorited keyword as an
 * OR-term to every query (stage 1 personalization — see personalization.ts).
 */
export async function fetchYouTubeTrending(
  category: CategoryRow,
  favoriteSignals?: FavoriteSignals
): Promise<RawMetricItem[]> {
  const apiKey = getEnv().YOUTUBE_API_KEY;
  const publishedAfter = new Date(Date.now() - MAX_AGE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const baseQueries =
    category.search_queries && category.search_queries.length > 0
      ? category.search_queries
      : [{ q: category.search_query_hint || category.name }];

  const queries = favoriteSignals
    ? baseQueries.map((query) => ({ ...query, q: buildPersonalizedQuery(query.q, favoriteSignals) }))
    : baseQueries;

  const idLists = await Promise.all(
    queries.map((query) => searchVideoIds(apiKey, publishedAfter, query))
  );
  const ids = [...new Set(idLists.flat())];

  return fetchVideosByIds(apiKey, ids);
}
