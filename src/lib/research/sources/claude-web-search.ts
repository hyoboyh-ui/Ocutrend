import "server-only";
import { z } from "zod";
import type { CategoryRow } from "@/lib/supabase/types";
import type { RawMetricItem } from "../schemas";
import { analysisResultSchema, type AnalysisResult } from "../schemas";
import { getAnthropicClient, getAnalysisModel, submitAnalysisTool } from "../anthropic-client";

// Deliberately pinned to the older, simpler web_search tool rather than the
// newer web_search_20260318: the newer version routes searches through a
// code_execution sandbox ("dynamic filtering") where the model writes ad-hoc
// Python to call web_search and parse results. In testing that added 60-100s+
// of unpredictable latency (sometimes looping on debugging code that never
// converges) versus a consistent ~30s with this version — well inside Vercel's
// function timeout, which matters since this runs from a request handler.
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 6,
};

const submitRawItemsTool = {
  name: "submit_raw_items",
  description: "Web検索で見つけた候補動画のリストを提出する。",
  input_schema: {
    type: "object" as const,
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string" },
            url: { type: ["string", "null"] },
            viewCount: { type: ["number", "null"] },
            publishedAt: { type: ["string", "null"] },
          },
          required: ["title"],
        },
      },
    },
    required: ["items"],
  },
};

const rawItemsSchema = z.object({
  items: z.array(
    z.object({
      title: z.string(),
      url: z.string().nullable().optional(),
      viewCount: z.number().nullable().optional(),
      publishedAt: z.string().nullable().optional(),
    })
  ),
});

function findToolUse(
  message: { content: Array<{ type: string; name?: string; input?: unknown }> },
  name: string
) {
  return message.content.find((b) => b.type === "tool_use" && b.name === name)?.input;
}

/** Fallback path when the bilibili unofficial endpoint fails: ask Claude to search for this week's top bilibili videos for the category instead. */
export async function fetchBilibiliViaWebSearch(category: CategoryRow): Promise<RawMetricItem[]> {
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: getAnalysisModel(),
    max_tokens: 2048,
    tools: [WEB_SEARCH_TOOL, submitRawItemsTool],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `bilibiliの「${category.name}」カテゴリで今週(直近7日間)特に再生数が伸びている動画を5〜10件、Web検索で調べてください。見つけたら必ず最後にsubmit_raw_itemsツールを1回呼び出して結果を提出してください。`,
      },
    ],
  });

  const raw = findToolUse(message, "submit_raw_items");
  if (!raw) {
    throw new Error("Claude web search did not return submit_raw_items — bilibili fallback failed");
  }
  const parsed = rawItemsSchema.parse(raw);
  return parsed.items.map((i) => ({
    platform: "bilibili" as const,
    title: i.title,
    url: i.url ?? null,
    viewCount: i.viewCount ?? null,
    likeCount: null,
    commentCount: null,
    publishedAt: i.publishedAt ?? null,
  }));
}

/** Full research+analysis in one call for web_search_only categories (Photoshop/Premiere, AI関連, etc.). */
export async function fetchAndAnalyzeViaWebSearch(category: CategoryRow): Promise<AnalysisResult> {
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: getAnalysisModel(),
    max_tokens: 4096,
    tools: [WEB_SEARCH_TOOL, submitAnalysisTool],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: `あなたは「${category.name}」分野のリサーチアナリストです。カテゴリの説明: ${category.description}

直近1ヶ月以内の最新アップデート・話題を、公式リリースノート・ブログ、YouTube解説動画、SNS(X等)の投稿など複数の情報源を横断してWeb検索で調べてください。動画で良い解説が見つかればそれを優先し、無ければテキスト情報で補ってください。

3〜5件のピックアップ項目それぞれについて「何が新しいか/なぜ重要か」(whyTrending)と「どう使えるか/取り入れ方」(howToReplicate)を日本語でまとめ、カテゴリ全体の傾向を1〜2段落のサマリーにもまとめてください。調査が終わったら必ず最後にsubmit_analysisツールを1回呼び出して結果を提出してください。`,
      },
    ],
  });

  const input = findToolUse(message, "submit_analysis");
  if (!input) {
    throw new Error("Claude web search did not return submit_analysis — category analysis failed");
  }
  return analysisResultSchema.parse(input);
}
