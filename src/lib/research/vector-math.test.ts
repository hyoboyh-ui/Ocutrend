import { describe, it, expect } from "vitest";
import { cosineSimilarity, maxSimilarity } from "./vector-math";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
  });

  it("returns 0 for a zero vector rather than dividing by zero", () => {
    expect(cosineSimilarity([0, 0], [1, 2])).toBe(0);
  });
});

describe("maxSimilarity", () => {
  it("picks the best match among several reference vectors", () => {
    const sim = maxSimilarity(
      [1, 0],
      [
        [0, 1],
        [1, 0],
        [-1, 0],
      ]
    );
    expect(sim).toBeCloseTo(1);
  });

  it("returns 0 when there are no reference vectors", () => {
    expect(maxSimilarity([1, 2, 3], [])).toBe(0);
  });
});
