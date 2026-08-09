import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getCurrentWeekStartJST, jstNow } from "@/lib/date/schedule";
import { runWeeklyResearch } from "@/lib/research/pipeline";

// The cron route runs ALL active categories via Promise.allSettled (concurrent,
// not sequential), so wall time tracks the single slowest category rather than
// their sum — but give it real headroom since individual runs measured 30-65s+.
export const maxDuration = 180;

interface ResearchSchedule {
  // Standard 5-field cron expression interpreted in `timezone` (JST), NOT in UTC like
  // vercel.json's own schedule. Only the day-of-week field is enforced here — the
  // time-of-day is whatever vercel.json fires at, so keep the two in sync manually:
  // vercel.json "0 22 * * *" (22:00 UTC daily) lands on 07:00 JST the NEXT day, i.e. dow=1 on Monday.
  cron: string;
  timezone: string;
}

// Very small cron-field matcher: supports "*", a single number, or "star-slash-N" step syntax — enough for day-of-week gating.
function matchesCronField(field: string, value: number): boolean {
  if (field === "*") return true;
  if (field.startsWith("*/")) return value % Number(field.slice(2)) === 0;
  return Number(field) === value;
}

function isScheduledNow(schedule: ResearchSchedule, now: Date): boolean {
  const [, , , , dow] = schedule.cron.split(" ");
  return matchesCronField(dow, now.getDay());
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${getEnv().CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createServerSupabaseClient();
  const { data: settingRow } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "research_schedule")
    .maybeSingle();
  const schedule = (settingRow?.value as ResearchSchedule) ?? { cron: "0 7 * * 1", timezone: "Asia/Tokyo" };

  const now = jstNow();
  if (!isScheduledNow(schedule, now)) {
    return NextResponse.json({ skipped: true, reason: "not scheduled today" });
  }

  const weekStart = getCurrentWeekStartJST();
  const { data: existingRun } = await supabase
    .from("weekly_runs")
    .select("status")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (existingRun && (existingRun.status === "completed" || existingRun.status === "completed_with_errors")) {
    return NextResponse.json({ skipped: true, reason: "already completed this week" });
  }

  const runId = await runWeeklyResearch("cron");
  return NextResponse.json({ ok: true, runId });
}
