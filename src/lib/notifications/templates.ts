/** Extracts the lead sentence (up to and including the first `。`) from a summary paragraph. */
export function extractLeadSentence(text: string): string {
  const idx = text.indexOf("。");
  if (idx === -1) return text.slice(0, 80);
  return text.slice(0, idx + 1);
}

export function buildReportReadyPayload(leadSentence: string, errorCount: number) {
  const suffix = errorCount > 0 ? ` ⚠️${errorCount}件のカテゴリでエラーが発生しました` : "";
  return {
    title: "今週のトレンドレポートが完成しました",
    body: `${leadSentence}${suffix}`,
    url: "/",
  };
}

export function buildCategoryErrorPayload(categoryName: string, message: string) {
  return {
    title: "リサーチでエラーが発生しました",
    body: `${categoryName}: ${message}`.slice(0, 120),
    url: "/errors",
  };
}
