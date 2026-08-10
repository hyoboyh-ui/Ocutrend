import { describe, it, expect } from "vitest";
import { parseAnalysisResult } from "./schemas";

const pickup = {
  title: "AIアニメの作り方",
  platform: "web",
  url: "https://example.com/a",
  whyTrending: "新しいワークフローが公開されたため",
  howToReplicate: "同じツールを順に使う",
};

describe("parseAnalysisResult", () => {
  it("accepts a well-formed tool input", () => {
    const result = parseAnalysisResult({ summary: "今週の傾向", pickups: [pickup] });
    expect(result.pickups).toHaveLength(1);
    expect(result.summary).toBe("今週の傾向");
  });

  it("recovers when pickups arrives as a JSON-encoded string", () => {
    // The exact failure seen in error_log for both AIアニメ and ショート動画系.
    const result = parseAnalysisResult({ summary: "今週の傾向", pickups: JSON.stringify([pickup]) });
    expect(result.pickups).toHaveLength(1);
    expect(result.pickups[0].title).toBe("AIアニメの作り方");
  });

  it("recovers when the whole input arrives as a JSON-encoded string", () => {
    const result = parseAnalysisResult(JSON.stringify({ summary: "今週の傾向", pickups: [pickup] }));
    expect(result.pickups).toHaveLength(1);
  });

  it("still rejects a genuinely malformed pickups string", () => {
    expect(() => parseAnalysisResult({ summary: "s", pickups: "not json at all" })).toThrow();
  });

  it("still rejects a truncated input with missing fields", () => {
    expect(() => parseAnalysisResult({})).toThrow();
  });

  it("tolerates explicit nulls on the optional numeric fields", () => {
    // Claude's tool schema declares these as ["number"|"string", "null"], and it does
    // send literal null rather than omitting the key.
    const result = parseAnalysisResult({
      summary: "s",
      pickups: [{ ...pickup, viewCount: null, publishedAt: null }],
    });
    expect(result.pickups[0].viewCount).toBeNull();
  });
});
