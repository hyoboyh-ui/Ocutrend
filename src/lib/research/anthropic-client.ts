import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { getEnv } from "@/lib/env";

let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!client) {
    client = new Anthropic({ apiKey: getEnv().ANTHROPIC_API_KEY });
  }
  return client;
}

export function getAnalysisModel(): string {
  return getEnv().ANTHROPIC_MODEL;
}

/** Anthropic tool JSON Schema for the structured {summary, pickups[]} analysis output. */
export const submitAnalysisTool = {
  name: "submit_analysis",
  description:
    "今週の分析結果を提出する。必ず最後にこのツールを1回だけ呼び出すこと。",
  input_schema: {
    type: "object" as const,
    properties: {
      summary: {
        type: "string",
        description: "今週の傾向についての1〜2段落のサマリー(日本語)。",
      },
      pickups: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "原題(原語のまま、翻訳しない)" },
            platform: { type: "string", enum: ["youtube", "bilibili", "web"] },
            url: { type: ["string", "null"] },
            whyTrending: { type: "string", description: "なぜ伸びているか(日本語)" },
            howToReplicate: { type: "string", description: "作り方・編集手法・タイトル/サムネの傾向(日本語)" },
            viewCount: { type: ["number", "null"] },
            publishedAt: { type: ["string", "null"] },
          },
          required: ["title", "platform", "url", "whyTrending", "howToReplicate"],
        },
      },
    },
    required: ["summary", "pickups"],
  },
};
