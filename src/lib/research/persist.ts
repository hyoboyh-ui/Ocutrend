import "server-only";
import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentWeekStartJST } from "@/lib/date/schedule";
import type {
  CategoryRow,
  PickupItem,
  ReportEntryRow,
  SourceUsed,
  TriggeredBy,
  WeeklyRunRow,
} from "@/lib/supabase/types";
import type { AnalysisResult } from "./schemas";
import type { RankedItem } from "./ranking";
import type { FavoriteSignalInput } from "./personalization";

export async function upsertWeeklyRun(triggeredBy: TriggeredBy): Promise<WeeklyRunRow> {
  const supabase = createServerSupabaseClient();
  const weekStart = getCurrentWeekStartJST();

  const { data: existing } = await supabase
    .from("weekly_runs")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (existing) return existing as WeeklyRunRow;

  const { data, error } = await supabase
    .from("weekly_runs")
    .insert({ week_start: weekStart, status: "running", triggered_by: triggeredBy, started_at: new Date().toISOString() })
    .select("*")
    .single();
  if (error) throw error;
  return data as WeeklyRunRow;
}

export async function getActiveCategories(): Promise<CategoryRow[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("status", "active")
    .order("sort_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}

/**
 * Titles/channels of a category's favorited pickups, for personalization.ts's
 * frequency counts.
 *
 * Pulls every favorite plus its report_entry (category_id + pickups jsonb) in one
 * query and filters/looks-up client-side rather than a PostgREST embedded-filter,
 * since favorite volume for a personal app stays small enough that this is cheap and
 * avoids relying on `!inner` join-filter syntax working as expected.
 */
export async function getFavoriteSignalsForCategory(categoryId: string): Promise<FavoriteSignalInput[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("pickup_ref, report_entries(category_id, pickups)");
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    pickup_ref: string;
    report_entries: { category_id: string; pickups: PickupItem[] } | null;
  }[];

  const inputs: FavoriteSignalInput[] = [];
  for (const row of rows) {
    if (row.report_entries?.category_id !== categoryId) continue;
    const pickup = row.report_entries.pickups.find((p) => p.ref === row.pickup_ref);
    if (!pickup) continue;
    inputs.push({ title: pickup.title, channelTitle: pickup.channelTitle ?? null });
  }
  return inputs;
}

export interface FavoriteEmbeddingInput {
  favoriteId: string;
  title: string;
  channelTitle: string | null;
}

/** Same favorites-join shape as getFavoriteSignalsForCategory, but keyed by favorite id for embedding storage. */
export async function getFavoriteEmbeddingInputsForCategory(categoryId: string): Promise<FavoriteEmbeddingInput[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("id, pickup_ref, report_entries(category_id, pickups)");
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    id: string;
    pickup_ref: string;
    report_entries: { category_id: string; pickups: PickupItem[] } | null;
  }[];

  const inputs: FavoriteEmbeddingInput[] = [];
  for (const row of rows) {
    if (row.report_entries?.category_id !== categoryId) continue;
    const pickup = row.report_entries.pickups.find((p) => p.ref === row.pickup_ref);
    if (!pickup) continue;
    inputs.push({ favoriteId: row.id, title: pickup.title, channelTitle: pickup.channelTitle ?? null });
  }
  return inputs;
}

/** pgvector columns round-trip through PostgREST as "[0.1,0.2,...]" text, not a JS array. */
function parsePgVector(raw: string): number[] {
  return raw
    .slice(1, -1)
    .split(",")
    .filter(Boolean)
    .map(Number);
}

export async function getExistingFavoriteEmbeddings(favoriteIds: string[]): Promise<Map<string, number[]>> {
  const map = new Map<string, number[]>();
  if (favoriteIds.length === 0) return map;

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("favorite_embeddings")
    .select("favorite_id, embedding")
    .in("favorite_id", favoriteIds);
  if (error) throw error;

  for (const row of (data ?? []) as { favorite_id: string; embedding: string }[]) {
    map.set(row.favorite_id, parsePgVector(row.embedding));
  }
  return map;
}

export async function upsertFavoriteEmbeddings(
  rows: { favoriteId: string; embedding: number[]; model: string }[]
): Promise<void> {
  if (rows.length === 0) return;
  const supabase = createServerSupabaseClient();
  const { error } = await supabase.from("favorite_embeddings").upsert(
    rows.map((r) => ({
      favorite_id: r.favoriteId,
      embedding: `[${r.embedding.join(",")}]`,
      model: r.model,
    })),
    { onConflict: "favorite_id" }
  );
  if (error) throw error;
}

export async function getCategoryById(id: string): Promise<CategoryRow> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("categories").select("*").eq("id", id).single();
  if (error) throw error;
  return data as CategoryRow;
}

export async function upsertReportEntryRunning(
  weeklyRunId: string,
  categoryId: string
): Promise<ReportEntryRow> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("report_entries")
    .upsert(
      { weekly_run_id: weeklyRunId, category_id: categoryId, status: "running", started_at: new Date().toISOString() },
      { onConflict: "weekly_run_id,category_id" }
    )
    .select("*")
    .single();
  if (error) throw error;
  return data as ReportEntryRow;
}

export async function persistReportEntry(
  reportEntryId: string,
  analysis: AnalysisResult,
  sourceUsed: SourceUsed,
  fallbackReason: string | null,
  rawItems: RankedItem[]
): Promise<void> {
  const supabase = createServerSupabaseClient();

  const pickupsWithRef = analysis.pickups.map((p) => ({ ...p, ref: randomUUID() }));

  const metrics = rawItems.map((item, idx) => ({
    platform: item.platform,
    item_title: item.title,
    item_url: item.url ?? null,
    view_count: item.viewCount ?? null,
    like_count: item.likeCount ?? null,
    comment_count: item.commentCount ?? null,
    published_at: item.publishedAt ?? null,
    // Views per hour since publish — the value the ranking sorted on. Stored so the
    // v2 trend graphs can plot climb rate without recomputing it from raw counts.
    growth_rate: item.viewVelocity ?? null,
    keywords: [],
    rank_in_pickups: idx < pickupsWithRef.length ? idx + 1 : null,
  }));

  const { error } = await supabase.rpc("persist_report_entry", {
    p_report_entry_id: reportEntryId,
    p_status: fallbackReason ? "fallback_used" : "ok",
    p_summary_text: analysis.summary,
    p_pickups: pickupsWithRef,
    p_source_used: sourceUsed,
    p_fallback_reason: fallbackReason,
    p_raw_source_meta: { itemCount: rawItems.length },
    p_metrics: metrics,
  });
  if (error) throw error;
}

export async function markReportEntryError(reportEntryId: string, message: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("report_entries")
    .update({ status: "error", error_message: message, completed_at: new Date().toISOString() })
    .eq("id", reportEntryId);
}

export async function logError(params: {
  categoryId?: string | null;
  weeklyRunId?: string | null;
  source: string;
  message: string;
  detail?: Record<string, unknown>;
}): Promise<void> {
  const supabase = createServerSupabaseClient();
  await supabase.from("error_log").insert({
    category_id: params.categoryId ?? null,
    weekly_run_id: params.weeklyRunId ?? null,
    source: params.source,
    message: params.message,
    detail: params.detail ?? null,
  });
}

/** Resets a category's consecutive_failures streak (called after a successful run). */
export async function resetCategoryFailureStreak(categoryId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  await supabase
    .from("categories")
    .update({ consecutive_failures: 0, muted_until: null })
    .eq("id", categoryId);
}

/** Increments a category's consecutive_failures streak and mutes error pushes after the 2nd consecutive failure. Returns whether this failure should still be pushed immediately. */
export async function recordCategoryFailureAndShouldNotify(categoryId: string, category: CategoryRow): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  const nextCount = category.consecutive_failures + 1;
  const shouldNotify = nextCount <= 2; // 1st & 2nd consecutive failures notify; 3rd+ is muted as a "known issue"
  await supabase
    .from("categories")
    .update({
      consecutive_failures: nextCount,
      muted_until: shouldNotify ? null : new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString(),
    })
    .eq("id", categoryId);
  return shouldNotify;
}

export async function getAppSetting<T>(key: string): Promise<T | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("app_settings").select("value").eq("key", key).maybeSingle();
  return (data?.value as T) ?? null;
}

export async function upsertAppSetting(key: string, value: unknown): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
  if (error) throw error;
}

export interface FavoriteItemForSummary {
  categoryName: string;
  title: string;
  channelTitle: string | null;
}

/**
 * Every favorited item across the 5 trend categories (song-covers/meme/shorts/gaming/
 * freeform), for stage 3's monthly cross-category summary. The AI sub categories
 * (youtube_only) are excluded — per the plan, stage 3 only applies to the trend
 * categories.
 */
export async function getFavoriteItemsForTrendSummary(): Promise<FavoriteItemForSummary[]> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("pickup_ref, report_entries(pickups, categories(name, youtube_only))");
  if (error) throw error;

  const rows = (data ?? []) as unknown as {
    pickup_ref: string;
    report_entries: {
      pickups: PickupItem[];
      categories: { name: string; youtube_only: boolean } | null;
    } | null;
  }[];

  const result: FavoriteItemForSummary[] = [];
  for (const row of rows) {
    const entry = row.report_entries;
    const category = entry?.categories;
    if (!entry || !category || category.youtube_only) continue;
    const pickup = entry.pickups.find((p) => p.ref === row.pickup_ref);
    if (!pickup) continue;
    result.push({ categoryName: category.name, title: pickup.title, channelTitle: pickup.channelTitle ?? null });
  }
  return result;
}

export async function finalizeWeeklyRun(weeklyRunId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { data: entries } = await supabase
    .from("report_entries")
    .select("status")
    .eq("weekly_run_id", weeklyRunId);

  const hasError = (entries ?? []).some((e) => e.status === "error");
  await supabase
    .from("weekly_runs")
    .update({
      status: hasError ? "completed_with_errors" : "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", weeklyRunId);
}
