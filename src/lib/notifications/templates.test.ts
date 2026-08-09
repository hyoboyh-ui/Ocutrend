import { describe, expect, it } from "vitest";
import { extractLeadSentence, buildReportReadyPayload, buildCategoryErrorPayload } from "./templates";

describe("extractLeadSentence", () => {
  it("extracts up to and including the first 。", () => {
    expect(extractLeadSentence("今週は中国語カバー曲が伸びています。続報もあります。")).toBe(
      "今週は中国語カバー曲が伸びています。"
    );
  });

  it("falls back to a truncated prefix when there is no 。", () => {
    const text = "a".repeat(200);
    expect(extractLeadSentence(text)).toBe("a".repeat(80));
  });
});

describe("buildReportReadyPayload", () => {
  it("appends an error suffix when errorCount > 0", () => {
    const payload = buildReportReadyPayload("今週は歌が伸びています。", 2);
    expect(payload.body).toContain("2件のカテゴリでエラー");
  });

  it("omits the error suffix when errorCount is 0", () => {
    const payload = buildReportReadyPayload("今週は歌が伸びています。", 0);
    expect(payload.body).toBe("今週は歌が伸びています。");
  });
});

describe("buildCategoryErrorPayload", () => {
  it("truncates long messages to 120 chars", () => {
    const payload = buildCategoryErrorPayload("歌", "x".repeat(200));
    expect(payload.body.length).toBeLessThanOrEqual(120);
  });
});
