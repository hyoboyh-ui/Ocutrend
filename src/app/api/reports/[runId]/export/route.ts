import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildWeeklyMarkdown } from "@/lib/markdown/export";
import type { CategoryRow, ReportEntryRow } from "@/lib/supabase/types";

export async function GET(_request: Request, ctx: RouteContext<"/api/reports/[runId]/export">) {
  const { runId } = await ctx.params;
  const supabase = createServerSupabaseClient();

  const { data: run } = await supabase.from("weekly_runs").select("*").eq("id", runId).single();
  if (!run) return NextResponse.json({ error: "not found" }, { status: 404 });

  const { data: entries } = await supabase
    .from("report_entries")
    .select("*, categories(*)")
    .eq("weekly_run_id", runId);

  const pairs = (entries ?? []).map((e) => ({
    category: e.categories as unknown as CategoryRow,
    entry: e as unknown as ReportEntryRow,
  }));

  const markdown = buildWeeklyMarkdown(run.week_start, pairs);
  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="trends-${run.week_start}.md"`,
    },
  });
}
