import "server-only";
import { z } from "zod";
import type { CategoryRow } from "@/lib/supabase/types";
import type { RawMetricItem } from "../schemas";
import { getEnv } from "@/lib/env";
import { YouTubeApiError } from "./types";

const searchResponseSchema = z.object({
  items: z.array(z.object({ id: z.object({ videoId: z.string() }) })),
});

const videosResponseSchema = z.object({
  items: z.array(
    z.object({
      id: z.string(),
      snippet: z.object({ title: z.string(), publishedAt: z.string() }),
      statistics: z.object({
        viewCount: z.string().optional(),
        likeCount: z.string().optional(),
        commentCount: z.string().optional(),
      }),
    })
  ),
});

/** Fetches the past week's most-viewed videos for a category via search.list + videos.list. */
export async function fetchYouTubeTrending(category: CategoryRow): Promise<RawMetricItem[]> {
  const apiKey = getEnv().YOUTUBE_API_KEY;
  const publishedAfter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const query = category.search_query_hint || category.name;

  const searchUrl = new URL("https://www.googleapis.com/youtube/v3/search");
  searchUrl.searchParams.set("key", apiKey);
  searchUrl.searchParams.set("part", "snippet");
  searchUrl.searchParams.set("type", "video");
  searchUrl.searchParams.set("order", "viewCount");
  searchUrl.searchParams.set("maxResults", "15");
  searchUrl.searchParams.set("publishedAfter", publishedAfter);
  searchUrl.searchParams.set("q", query);

  const searchRes = await fetch(searchUrl);
  if (!searchRes.ok) {
    throw new YouTubeApiError(`YouTube search.list failed: HTTP ${searchRes.status}`);
  }
  const searchParsed = searchResponseSchema.safeParse(await searchRes.json());
  if (!searchParsed.success) {
    throw new YouTubeApiError(`YouTube search.list response shape invalid`);
  }

  const ids = searchParsed.data.items.map((i) => i.id.videoId).filter(Boolean);
  if (ids.length === 0) return [];

  const videosUrl = new URL("https://www.googleapis.com/youtube/v3/videos");
  videosUrl.searchParams.set("key", apiKey);
  videosUrl.searchParams.set("part", "snippet,statistics");
  videosUrl.searchParams.set("id", ids.join(","));

  const videosRes = await fetch(videosUrl);
  if (!videosRes.ok) {
    throw new YouTubeApiError(`YouTube videos.list failed: HTTP ${videosRes.status}`);
  }
  const videosParsed = videosResponseSchema.safeParse(await videosRes.json());
  if (!videosParsed.success) {
    throw new YouTubeApiError(`YouTube videos.list response shape invalid`);
  }

  return videosParsed.data.items.map((v) => ({
    platform: "youtube" as const,
    title: v.snippet.title,
    url: `https://www.youtube.com/watch?v=${v.id}`,
    viewCount: v.statistics.viewCount ? Number(v.statistics.viewCount) : null,
    likeCount: v.statistics.likeCount ? Number(v.statistics.likeCount) : null,
    commentCount: v.statistics.commentCount ? Number(v.statistics.commentCount) : null,
    publishedAt: v.snippet.publishedAt,
  }));
}
