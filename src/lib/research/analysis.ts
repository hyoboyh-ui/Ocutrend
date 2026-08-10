import "server-only";
import type { CategoryRow } from "@/lib/supabase/types";
import type { RankedItem } from "./ranking";
import { parseAnalysisResult, type AnalysisResult } from "./schemas";
import { getAnthropicClient, getAnalysisModel, submitAnalysisTool } from "./anthropic-client";

function extractToolInput(message: { content: Array<{ type: string; name?: string; input?: unknown }> }) {
  const block = message.content.find(
    (b) => b.type === "tool_use" && b.name === "submit_analysis"
  );
  return block?.input;
}

/**
 * Turns a truncated response into a readable error.
 *
 * When the model runs out of output tokens mid tool-call, the partially built input
 * still surfaces as a `tool_use` block — so validation failed with a baffling
 * "summary: expected string, received undefined" instead of saying it was cut off.
 */
export function assertNotTruncated(stopReason: string | null, label: string): void {
  if (stopReason === "max_tokens") {
    throw new Error(
      `${label}: Claudeの応答がmax_tokensで打ち切られ、分析結果が不完全になりました。max_tokensを増やすか、カテゴリの説明を短くしてください。`
    );
  }
}

/** Analyzes already-fetched numeric data (YouTube/bilibili) for a main category. No web search — pure reasoning over the given stats. */
export async function analyzeWithClaude(
  category: CategoryRow,
  items: RankedItem[]
): Promise<AnalysisResult> {
  const client = getAnthropicClient();

  const round = (n: number | null) => (n === null ? "不明" : Math.round(n).toLocaleString("ja-JP"));

  const itemsList = items
    .map(
      (i, idx) =>
        `${idx + 1}. [${i.platform}] 「${i.title}」 再生数:${i.viewCount ?? "不明"} いいね:${i.likeCount ?? "不明"} コメント:${i.commentCount ?? "不明"} 時速:${round(i.viewVelocity)}再生/h コメント時速:${round(i.commentVelocity)}/h 公開日:${i.publishedAt ?? "不明"} URL:${i.url ?? "不明"}`
    )
    .join("\n");

  const message = await client.messages.create({
    model: getAnalysisModel(),
    // Raised from 4096: analyses were being cut off mid tool-call, which surfaced as
    // an undefined `summary`/`pickups` rather than an obvious truncation error.
    max_tokens: 8192,
    tools: [submitAnalysisTool],
    tool_choice: { type: "tool", name: "submit_analysis" },
    messages: [
      {
        role: "user",
        content: `あなたは動画コンテンツのトレンド分析アナリストです。以下は「${category.name}」カテゴリで直近10日以内に公開され、伸びる速度が速い順に並べた動画データです。

${itemsList}

この中から3〜5件を選び、それぞれ「なぜ伸びているか」「作り方(編集手法・企画・タイトルやサムネの傾向)」を分析してください。加えて、カテゴリ全体の今週の傾向を1〜2段落のサマリーとしてまとめてください。

注意:
- 分析文章(whyTrending, howToReplicate, summary)は日本語で書くこと
- title(動画タイトル)は原語のまま、翻訳しないこと
- 実際に真似できる具体的な提案を含めること
- 累計再生数の大きさより「時速(伸びる速度)」を重視して選ぶこと。公開直後で累計は小さくても急上昇中のものを優先する
- 公開から24時間未満の動画は時速が過大に出やすいため、その点を割り引いて評価すること`,
      },
    ],
  });

  assertNotTruncated(message.stop_reason, `「${category.name}」の分析`);

  const input = extractToolInput(message);
  if (!input) {
    throw new Error(`「${category.name}」の分析: Claudeがsubmit_analysisを呼び出しませんでした`);
  }
  return parseAnalysisResult(input);
}
