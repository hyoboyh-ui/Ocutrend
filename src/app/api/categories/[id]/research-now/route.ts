import { NextResponse } from "next/server";
import { getCategoryById } from "@/lib/research/persist";
import { upsertWeeklyRun } from "@/lib/research/persist";
import { runOneCategory } from "@/lib/research/pipeline";

export const maxDuration = 60;

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
