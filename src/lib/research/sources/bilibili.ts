import "server-only";
import { z } from "zod";
import type { CategoryRow } from "@/lib/supabase/types";
import type { RawMetricItem } from "../schemas";
import { BilibiliEndpointError } from "./types";

const bilibiliVideoSchema = z.object({
  title: z.string(),
  bvid: z.string(),
  pubdate: z.number(),
  stat: z.object({
    view: z.number(),
    like: z.number().optional().default(0),
    reply: z.number().optional().default(0),
  }),
});

const bilibiliResponseSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.object({
    list: z.array(bilibiliVideoSchema),
  }),
});

const TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 1_500;

async function fetchOnce(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Referer: "https://www.bilibili.com",
      },
    });
    if (!res.ok) {
      throw new BilibiliEndpointError(`bilibili endpoint returned HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url: string): Promise<unknown> {
  try {
    return await fetchOnce(url);
  } catch {
    // One short retry with a light backoff before treating this as a real failure —
    // avoids falling back to the (more expensive) Claude web-search path on a transient blip.
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    return await fetchOnce(url);
  }
}

/** Fetches bilibili's weekly ranking for a category's partition (or the cross-partition "popular" feed if none is set). */
export async function fetchBilibiliRanking(category: CategoryRow): Promise<RawMetricItem[]> {
  const url = category.bilibili_partition
    ? `https://api.bilibili.com/x/web-interface/ranking/v2?rid=${category.bilibili_partition}&type=all`
    : `https://api.bilibili.com/x/web-interface/popular?ps=20&pn=1`;

  let raw: unknown;
  try {
    raw = await fetchWithRetry(url);
  } catch (err) {
    throw new BilibiliEndpointError(
      `bilibili fetch failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const parsed = bilibiliResponseSchema.safeParse(raw);
  if (!parsed.success || parsed.data.code !== 0) {
    throw new BilibiliEndpointError(
      `bilibili response shape/envelope invalid: ${parsed.success ? parsed.data.message : parsed.error.message}`
    );
  }

  // Return the whole ranking rather than a head slice — the recency filter and
  // velocity ranking downstream need a real pool to choose from, and bilibili's own
  // ordering is by cumulative score, which favours older videos in the window.
  return parsed.data.data.list.map((v) => ({
    platform: "bilibili" as const,
    title: v.title,
    url: `https://www.bilibili.com/video/${v.bvid}`,
    viewCount: v.stat.view,
    likeCount: v.stat.like,
    commentCount: v.stat.reply,
    publishedAt: new Date(v.pubdate * 1000).toISOString(),
  }));
}
