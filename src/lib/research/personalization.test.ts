import { describe, it, expect } from "vitest";
import { extractFavoriteSignals, personalizationBoost, buildPersonalizedQuery } from "./personalization";

describe("extractFavoriteSignals", () => {
  it("requires at least 2 occurrences before a keyword counts as frequent", () => {
    const signals = extractFavoriteSignals([
      { title: "Ollama tutorial for beginners", channelTitle: null },
      { title: "Ollama tutorial advanced", channelTitle: null },
      { title: "totally unrelated video", channelTitle: null },
    ]);
    expect(signals.keywords).toContain("ollama");
    expect(signals.keywords).toContain("tutorial");
    expect(signals.keywords).not.toContain("beginners");
  });

  it("extracts CJK n-grams and counts channel frequency", () => {
    const signals = extractFavoriteSignals(
      [
        { title: "Claude Codeの使い方まとめ", channelTitle: "AI解説チャンネル" },
        { title: "Claude Codeの使い方入門", channelTitle: "AI解説チャンネル" },
      ],
      { topKeywords: 20 }
    );
    expect(signals.keywords).toContain("使い方");
    expect(signals.channels).toEqual(["AI解説チャンネル"]);
  });

  it("returns empty signals when there is no repetition", () => {
    const signals = extractFavoriteSignals([{ title: "just one video", channelTitle: "solo channel" }]);
    expect(signals.keywords).toEqual([]);
    expect(signals.channels).toEqual([]);
  });
});

describe("personalizationBoost", () => {
  it("boosts items whose title contains a favorite keyword", () => {
    const boost = personalizationBoost({ keywords: ["ollama"], channels: [] });
    expect(boost({ title: "Ollama setup guide" })).toBeGreaterThan(0);
    expect(boost({ title: "unrelated video" })).toBe(0);
  });

  it("boosts items from a favorite channel", () => {
    const boost = personalizationBoost({ keywords: [], channels: ["Favorite Channel"] });
    expect(boost({ title: "anything", channelTitle: "Favorite Channel" })).toBeGreaterThan(0);
    expect(boost({ title: "anything", channelTitle: "Other Channel" })).toBe(0);
  });

  it("is a no-op function when there are no signals", () => {
    const boost = personalizationBoost({ keywords: [], channels: [] });
    expect(boost({ title: "anything at all" })).toBe(0);
  });
});

describe("buildPersonalizedQuery", () => {
  it("appends the top keyword as an OR-term", () => {
    expect(buildPersonalizedQuery("Ollama 活用", { keywords: ["ローカルllm"], channels: [] })).toBe(
      "Ollama 活用 OR ローカルllm"
    );
  });

  it("leaves the query untouched when there are no keyword signals", () => {
    expect(buildPersonalizedQuery("Ollama 活用", { keywords: [], channels: [] })).toBe("Ollama 活用");
  });
});
