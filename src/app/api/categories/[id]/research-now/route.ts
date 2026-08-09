import { NextResponse } from "next/server";
import { getCategoryById } from "@/lib/research/persist";
import { upsertWeeklyRun } from "@/lib/research/persist";
import { runOneCategory } from "@/lib/research/pipeline";

// Observed real runs of a single web-search-only category take 30-65s; a main
// category (YouTube+bilibili+Claude analysis) can take longer still. 60s cut it
// close in testing, so this is set above Vercel's default and relies on Fluid
// Compute (default on new projects) to actually honor >60s on the Hobby plan.
export const maxDuration = 120;

export async function POST(_request: Request, ctx: RouteContext<"/api/categories/[id]/research-now">) {
  const { id } = await ctx.params;
  const category = await getCategoryById(id);

  if (category.status === "paused") {
    return NextResponse.json({ error: "category is paused" }, { status: 400 });
  }

  const run = await upsertWeeklyRun("manual");
  await runOneCategory(run.id, category);

  return NextResponse.json({ ok: true, runId: run.id });
}
