import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { buildCategoryMarkdown } from "@/lib/markdown/export";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/reports/[runId]/[categoryId]/export">
) {
  const { runId, categoryId } = await ctx.params;
  const supabase = createServerSupabaseClient();

  const { data: run } = await supabase.from("weekly_runs").select("*").eq("id", runId).single();
  const { data: entry } = await supabase
    .from("report_entries")
    .select("*, categories(*)")
    .eq("weekly_run_id", runId)
    .eq("category_id", categoryId)
    .single();

  if (!run || !entry) return NextResponse.json({ error: "not found" }, { status: 404 });

  const markdown = buildCategoryMarkdown(run.week_start, entry.categories as never, entry as never);
  return new NextResponse(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entry.categories.slug}-${run.week_start}.md"`,
    },
  });
}
