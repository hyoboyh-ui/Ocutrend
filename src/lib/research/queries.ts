import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CategoryRow, ReportEntryRow, WeeklyRunRow } from "@/lib/supabase/types";

export interface ReportEntryWithCategory extends ReportEntryRow {
  categories: CategoryRow;
}

export async function getLatestWeeklyRun(): Promise<WeeklyRunRow | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("weekly_runs")
    .select("*")
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as WeeklyRunRow | null;
}

/**
 * Entries plus their favorited pickup refs in ONE round trip.
 *
 * Fetching favorites separately meant waiting for `report_entries` just to learn
 * the ids to filter by — a strictly serial third round trip on every dashboard and
 * archive-detail render. Embedding them via the `favorites.report_entry_id` FK
 * removes it (measured ~690ms -> ~490ms for the dashboard's query sequence).
 */
export async function getEntriesWithFavoritesForRun(
  runId: string
): Promise<{ entries: ReportEntryWithCategory[]; favoritedRefs: Set<string> }> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("report_entries")
    .select("*, categories(*), favorites(pickup_ref)")
    .eq("weekly_run_id", runId);

  const rows = (data ?? []) as unknown as (ReportEntryWithCategory & {
    favorites: { pickup_ref: string }[];
  })[];

  const favoritedRefs = new Set(rows.flatMap((row) => (row.favorites ?? []).map((f) => f.pickup_ref)));
  return { entries: rows, favoritedRefs };
}

export async function listWeeklyRuns(): Promise<WeeklyRunRow[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("weekly_runs").select("*").order("week_start", { ascending: false });
  return (data ?? []) as WeeklyRunRow[];
}

export async function getWeeklyRunById(id: string): Promise<WeeklyRunRow | null> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("weekly_runs").select("*").eq("id", id).maybeSingle();
  return data as WeeklyRunRow | null;
}

export async function listAllCategories(): Promise<CategoryRow[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (data ?? []) as CategoryRow[];
}
