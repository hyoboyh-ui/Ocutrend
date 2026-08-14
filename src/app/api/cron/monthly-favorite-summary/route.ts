import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { jstNow } from "@/lib/date/schedule";
import { generateMonthlyFavoriteTrendSummary } from "@/lib/research/stage3-summary";

// Single Claude call over a small favorites list — nowhere near weekly-research's
// multi-category budget, but kept generous since it shares the same cold-start cost.
export const maxDuration = 60;

// Fired daily by vercel.json like weekly-research; the actual monthly cadence is
// enforced here (day 1 of the month) and again inside generateMonthlyFavoriteTrendSummary
// (skips if this month's summary already exists), so a retry or duplicate invocation
// on the same day is harmless.
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${getEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = jstNow();
  if (now.getDate() !== 1) {
    return NextResponse.json({ skipped: true, reason: "not the 1st of the month" });
  }

  await generateMonthlyFavoriteTrendSummary();
  return NextResponse.json({ ok: true });
}
