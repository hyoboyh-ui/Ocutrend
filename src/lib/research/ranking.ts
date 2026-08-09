import type { RawMetricItem } from "./schemas";

/**
 * Recency window for candidate videos.
 *
 * 7 days looks like the obvious choice for a weekly run, but it judges a video
 * uploaded the day before the run on well under 24h of data. Widening to 10 days
 * means every video gets at least one run where it has had ~3 days to accumulate,
 * so a genuine hit is not missed just because it landed on a Sunday.
 */
export const MAX_AGE_DAYS = 10;

/**
 * Floor for the "hours since publish" denominator.
 *
 * Without it, velocity explodes for very young videos — a 2-hour-old clip with
 * 5,000 views scores 2,500/h and outranks everything on noise. Clamping the
 * denominator to 24h scores anything younger *as if* it were a day old: still
 * eligible, but it has to be genuinely large to win.
 */
export const MIN_HOURS = 24;

const VIEW_WEIGHT = 0.7;
const COMMENT_WEIGHT = 0.3;

export interface RankedItem extends RawMetricItem {
  /** Views per hour since publish (denominator clamped to MIN_HOURS). */
  viewVelocity: number | null;
  /** Comments per hour since publish (denominator clamped to MIN_HOURS). */
  commentVelocity: number | null;
  /** Combined 0..1 score, normalised within the item's own platform. */
  velocityScore: number;
}

export function hoursSincePublish(publishedAt: string | null | undefined, now: Date): number | null {
  if (!publishedAt) return null;
  const ts = new Date(publishedAt).getTime();
  if (Number.isNaN(ts)) return null;
  const hours = (now.getTime() - ts) / 3_600_000;
  return hours < 0 ? 0 : hours;
}

function velocity(count: number | null | undefined, hours: number | null): number | null {
  if (typeof count !== "number" || hours === null) return null;
  return count / Math.max(hours, MIN_HOURS);
}

/** Min-max normalise to 0..1; an all-equal set maps to 1 so it does not zero out the term. */
function normalise(values: number[]): (v: number | null) => number {
  const present = values.filter((v): v is number => v !== null && Number.isFinite(v));
  if (present.length === 0) return () => 0;
  const min = Math.min(...present);
  const max = Math.max(...present);
  if (max === min) return (v) => (v === null ? 0 : 1);
  return (v) => (v === null ? 0 : (v - min) / (max - min));
}

/**
 * Filters to the recency window and ranks by how fast views/comments are accruing.
 *
 * Normalisation is per-platform: YouTube and bilibili have very different absolute
 * view and comment scales, so a single global min-max would let one platform's
 * numbers decide the whole ordering. Items whose `publishedAt` is missing are kept
 * (we cannot prove they are stale) but score 0, so they sort last.
 */
export function rankByVelocity(
  items: RawMetricItem[],
  {
    now = new Date(),
    limitPerPlatform,
  }: { now?: Date; limitPerPlatform?: number } = {}
): RankedItem[] {
  const cutoffMs = now.getTime() - MAX_AGE_DAYS * 86_400_000;

  const fresh = items.filter((item) => {
    if (!item.publishedAt) return true;
    const ts = new Date(item.publishedAt).getTime();
    return Number.isNaN(ts) ? true : ts >= cutoffMs;
  });

  const withVelocity = fresh.map((item) => {
    const hours = hoursSincePublish(item.publishedAt, now);
    return {
      ...item,
      viewVelocity: velocity(item.viewCount, hours),
      commentVelocity: velocity(item.commentCount, hours),
    };
  });

  const byPlatform = new Map<string, typeof withVelocity>();
  for (const item of withVelocity) {
    const bucket = byPlatform.get(item.platform);
    if (bucket) bucket.push(item);
    else byPlatform.set(item.platform, [item]);
  }

  const scored: RankedItem[] = [];
  for (const bucket of byPlatform.values()) {
    const normView = normalise(bucket.map((i) => i.viewVelocity).filter((v): v is number => v !== null));
    const normComment = normalise(bucket.map((i) => i.commentVelocity).filter((v): v is number => v !== null));

    const bucketScored = bucket
      .map((item) => ({
        ...item,
        velocityScore:
          VIEW_WEIGHT * normView(item.viewVelocity) + COMMENT_WEIGHT * normComment(item.commentVelocity),
      }))
      .sort((a, b) => b.velocityScore - a.velocityScore);

    // Trim per platform, not across the merged list: bilibili's ranking endpoint
    // returns far more candidates than YouTube's search, so a single global cut
    // would let it crowd YouTube out of the list entirely.
    scored.push(
      ...(typeof limitPerPlatform === "number" ? bucketScored.slice(0, limitPerPlatform) : bucketScored)
    );
  }

  scored.sort((a, b) => b.velocityScore - a.velocityScore);
  return scored;
}
