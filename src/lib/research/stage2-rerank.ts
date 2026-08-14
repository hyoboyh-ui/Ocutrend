import "server-only";
import type { CategoryRow } from "@/lib/supabase/types";
import { getEnv } from "@/lib/env";
import type { RankedItem } from "./ranking";
import { embedTexts } from "./embeddings";
import { maxSimilarity } from "./vector-math";
import {
  getFavoriteEmbeddingInputsForCategory,
  getExistingFavoriteEmbeddings,
  upsertFavoriteEmbeddings,
} from "./persist";

const SIMILARITY_BOOST_WEIGHT = 0.2;

function embeddingText(item: { title: string; channelTitle?: string | null }): string {
  return item.channelTitle ? `${item.title} — ${item.channelTitle}` : item.title;
}

/** Favorite vectors for a category, embedding+caching any favorites added since the last run. */
async function getOrCreateFavoriteVectors(category: CategoryRow): Promise<number[][]> {
  const inputs = await getFavoriteEmbeddingInputsForCategory(category.id);
  if (inputs.length === 0) return [];

  const existing = await getExistingFavoriteEmbeddings(inputs.map((i) => i.favoriteId));
  const missing = inputs.filter((i) => !existing.has(i.favoriteId));

  if (missing.length > 0) {
    const vectors = await embedTexts(missing.map(embeddingText), "document");
    const model = getEnv().VOYAGE_MODEL;
    await upsertFavoriteEmbeddings(
      missing.map((m, idx) => ({ favoriteId: m.favoriteId, embedding: vectors[idx], model }))
    );
    missing.forEach((m, idx) => existing.set(m.favoriteId, vectors[idx]));
  }

  return [...existing.values()];
}

/**
 * Stage 2: reranks already stage-1-ranked candidates by similarity to the category's
 * favorited items.
 *
 * No-ops (returns `items` unchanged) when the category has no favorites yet, or when
 * the Voyage call fails for any reason — this is a ranking enhancement layered on top
 * of stage 1, not something a category run should fail over.
 */
export async function rerankByFavoriteSimilarity(
  category: CategoryRow,
  items: RankedItem[]
): Promise<RankedItem[]> {
  if (items.length === 0) return items;

  try {
    const favoriteVectors = await getOrCreateFavoriteVectors(category);
    if (favoriteVectors.length === 0) return items;

    const candidateVectors = await embedTexts(items.map(embeddingText), "query");

    const boosted = items.map((item, idx) => ({
      ...item,
      velocityScore:
        item.velocityScore + SIMILARITY_BOOST_WEIGHT * maxSimilarity(candidateVectors[idx], favoriteVectors),
    }));
    boosted.sort((a, b) => b.velocityScore - a.velocityScore);
    return boosted;
  } catch (err) {
    console.error("[stage2-rerank] skipped due to error:", err instanceof Error ? err.message : err);
    return items;
  }
}
