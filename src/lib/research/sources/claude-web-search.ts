import "server-only";
import type { CategoryRow } from "@/lib/supabase/types";
import { parseAnalysisResult, type AnalysisResult } from "../schemas";
import { getAnthropicClient, getWebSearchModel, logUsage, submitAnalysisTool } from "../anthropic-client";
import { assertNotTruncated } from "../analysis";

// Deliberately pinned to the older, simpler web_search tool rather than the
// newer web_search_20260318: the newer version routes searches through a
// code_execution sandbox ("dynamic filtering") where the model writes ad-hoc
// Python to call web_search and parse results. In testing that added 60-100s+
// of unpredictable latency (sometimes looping on debugging code that never
// converges) versus a consistent ~30s with this version — well inside Vercel's
// function timeout, which matters since this runs from a request handler.
//
// `max_uses` is the single biggest cost lever in this app. Search results are billed as
// input tokens and accumulate across the server-side loop: with N searches, the first
// result set is re-charged on every later inference, so input tokens grow roughly with
// N². Going 6 -> 3 cuts this category's token cost to well under half, plus $0.03/run
// in per-search fees ($10 per 1,000 searches). Raise it only if reports get too thin.
const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 3,
};

function findToolUse(
  message: { content: Array<{ type: string; name?: string; input?: unknown }> },
  name: string
) {
  return message.content.find((b) => b.type === "tool_use" && b.name === name)?.input;
}

/** Full research+analysis in one call for web_search_only categories (Photoshop/Premiere, AI関連, etc.). */
export async function fetchAndAnalyzeViaWebSearch(category: CategoryRow): Promise<AnalysisResult> {
  const client = getAnthropicClient();

  const message = await client.messages.create({
    model: getWebSearchModel(),
    // Higher than the plain analysis path: web-search results are echoed back into the
    // context and the model narrates its research before calling the tool, so the tool
    // call itself starts much closer to the output limit.
    max_tokens: 12288,
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

  logUsage(`web-search:${category.slug}`, getWebSearchModel(), message.usage);
  assertNotTruncated(message.stop_reason, `「${category.name}」のWeb検索リサーチ`);

  const input = findToolUse(message, "submit_analysis");
  if (!input) {
    throw new Error(
      `「${category.name}」のWeb検索リサーチ: Claudeがsubmit_analysisを呼び出しませんでした（検索は行われた可能性があります）`
    );
  }
  return parseAnalysisResult(input);
}
