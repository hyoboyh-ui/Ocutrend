import "server-only";
import { z } from "zod";
import { getEnv } from "@/lib/env";
import { VoyageApiError } from "./sources/types";

/** Whether stage 2 (embedding rerank) can run at all — false until VOYAGE_API_KEY is set. */
export function isEmbeddingConfigured(): boolean {
  return Boolean(getEnv().VOYAGE_API_KEY);
}

const voyageResponseSchema = z.object({
  data: z.array(z.object({ embedding: z.array(z.number()), index: z.number() })),
});

/**
 * Embeds a batch of texts via Voyage AI in one call.
 *
 * Caller must check isEmbeddingConfigured() first — this throws if VOYAGE_API_KEY is
 * missing rather than silently no-op-ing, so a misconfigured deploy fails loudly in
 * the one place that calls it instead of quietly never reranking.
 */
export async function embedTexts(
  texts: string[],
  inputType: "document" | "query"
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const apiKey = getEnv().VOYAGE_API_KEY;
  if (!apiKey) {
    throw new VoyageApiError("VOYAGE_API_KEY is not set");
  }

  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input: texts, model: getEnv().VOYAGE_MODEL, input_type: inputType }),
  });
  if (!res.ok) {
    throw new VoyageApiError(`Voyage embeddings request failed: HTTP ${res.status}`);
  }
  const parsed = voyageResponseSchema.safeParse(await res.json());
  if (!parsed.success) {
    throw new VoyageApiError("Voyage embeddings response shape invalid");
  }

  // The API is documented to preserve input order, but sorting by the returned
  // `index` costs nothing and removes any doubt.
  return [...parsed.data.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

export { cosineSimilarity, maxSimilarity } from "./vector-math";
