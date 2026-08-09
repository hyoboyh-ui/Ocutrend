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

export async function getReportEntriesForRun(runId: string): Promise<ReportEntryWithCategory[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("report_entries")
    .select("*, categories(*)")
    .eq("weekly_run_id", runId);
  return (data ?? []) as unknown as ReportEntryWithCategory[];
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

export async function getFavoritedRefsForEntries(entryIds: string[]): Promise<Set<string>> {
  if (entryIds.length === 0) return new Set();
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("favorites").select("pickup_ref").in("report_entry_id", entryIds);
  return new Set((data ?? []).map((f) => f.pickup_ref));
}

export async function listAllCategories(): Promise<CategoryRow[]> {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase.from("categories").select("*").order("sort_order");
  return (data ?? []) as CategoryRow[];
}
