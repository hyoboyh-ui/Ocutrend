import { toZonedTime, fromZonedTime } from "date-fns-tz";
import { startOfWeek, startOfMonth, format } from "date-fns";

const JST = "Asia/Tokyo";

/** Returns this week's Monday (JST) as a YYYY-MM-DD string — the `weekly_runs.week_start` key. */
export function getCurrentWeekStartJST(now: Date = new Date()): string {
  const zoned = toZonedTime(now, JST);
  const monday = startOfWeek(zoned, { weekStartsOn: 1 });
  return format(monday, "yyyy-MM-dd");
}

/** Returns this month's 1st (JST) as a YYYY-MM-DD string — the idempotency key for the monthly favorite-trend summary. */
export function getCurrentMonthStartJST(now: Date = new Date()): string {
  const zoned = toZonedTime(now, JST);
  return format(startOfMonth(zoned), "yyyy-MM-dd");
}

export function jstNow(): Date {
  return toZonedTime(new Date(), JST);
}

/** Converts a JST wall-clock Date back to a real instant, for comparisons against `Date.now()`. */
export function fromJST(zonedDate: Date): Date {
  return fromZonedTime(zonedDate, JST);
}
