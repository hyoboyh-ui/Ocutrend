import { z } from "zod";

/** One "pickup" item inside a report entry's `pickups` jsonb array. */
export const pickupItemSchema = z.object({
  ref: z.string().min(1), // stable id, generated at write time (see analysis.ts) — favorites reference this, not array index
  title: z.string().min(1), // original-language title, left untranslated
  platform: z.enum(["youtube", "bilibili", "web"]),
  url: z.string().url().nullable(),
  whyTrending: z.string().min(1),
  howToReplicate: z.string().min(1),
  // Claude's tool schema (anthropic-client.ts) declares these as `["number"|"string", "null"]`,
  // i.e. explicit `null` is a valid value it will actually send — not just "field omitted".
  // zod's `.optional()` alone only tolerates `undefined`, so these must be `.nullable()` too.
  viewCount: z.number().int().nonnegative().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
});
export type PickupItem = z.infer<typeof pickupItemSchema>;

/** The shape Claude must produce (via forced tool-use) for a single category's weekly analysis. */
export const analysisResultSchema = z.object({
  summary: z.string().min(1),
  pickups: z.array(pickupItemSchema.omit({ ref: true })).min(1).max(5),
});
export type AnalysisResult = z.infer<typeof analysisResultSchema>;

export const rawMetricItemSchema = z.object({
  platform: z.enum(["youtube", "bilibili", "other"]),
  title: z.string(),
  url: z.string().nullable().optional(),
  viewCount: z.number().nullable().optional(),
  likeCount: z.number().nullable().optional(),
  commentCount: z.number().nullable().optional(),
  publishedAt: z.string().nullable().optional(),
});
export type RawMetricItem = z.infer<typeof rawMetricItemSchema>;
