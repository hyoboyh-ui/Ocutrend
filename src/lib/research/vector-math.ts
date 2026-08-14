/** Pure vector math for stage 2 similarity reranking — no I/O, kept separate from embeddings.ts (which is server-only) so it stays unit-testable. */

export function cosineSimilarity(a: number[], b: number[]): number {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Highest cosine similarity between a vector and any vector in a reference set; 0 when the set is empty. */
export function maxSimilarity(vector: number[], referenceVectors: number[][]): number {
  let max = 0;
  for (const ref of referenceVectors) {
    const sim = cosineSimilarity(vector, ref);
    if (sim > max) max = sim;
  }
  return max;
}
