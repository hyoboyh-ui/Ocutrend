import { describe, it, expect } from "vitest";
import { rankByVelocity, hoursSincePublish, MAX_AGE_DAYS, MIN_HOURS } from "./ranking";
import type { RawMetricItem } from "./schemas";

const NOW = new Date("2026-08-09T00:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

function item(over: Partial<RawMetricItem>): RawMetricItem {
  return {
    platform: "bilibili",
    title: "t",
    url: null,
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    publishedAt: daysAgo(1),
    ...over,
  };
}

describe("hoursSincePublish", () => {
  it("returns null for missing or unparseable dates", () => {
    expect(hoursSincePublish(null, NOW)).toBeNull();
    expect(hoursSincePublish("not-a-date", NOW)).toBeNull();
  });

  it("clamps a future publish date to 0 rather than going negative", () => {
    expect(hoursSincePublish(new Date(NOW.getTime() + 3_600_000).toISOString(), NOW)).toBe(0);
  });
});

describe("rankByVelocity", () => {
  it("drops items older than the recency window", () => {
    const ranked = rankByVelocity(
      [
        item({ title: "fresh", publishedAt: daysAgo(2), viewCount: 100 }),
        item({ title: "stale", publishedAt: daysAgo(MAX_AGE_DAYS + 1), viewCount: 999_999_999 }),
      ],
      { now: NOW }
    );
    expect(ranked.map((i) => i.title)).toEqual(["fresh"]);
  });

  it("keeps the 500-day-old frozen-ranking case out entirely", () => {
    const ranked = rankByVelocity([item({ title: "march2025", publishedAt: daysAgo(496), viewCount: 17_727_693 })], {
      now: NOW,
    });
    expect(ranked).toHaveLength(0);
  });

  it("ranks a fast climber above an older video with more total views", () => {
    const ranked = rankByVelocity(
      [
        item({ title: "slow-but-big", publishedAt: daysAgo(9), viewCount: 900_000 }),
        item({ title: "fast-climber", publishedAt: daysAgo(2), viewCount: 500_000 }),
      ],
      { now: NOW }
    );
    expect(ranked[0].title).toBe("fast-climber");
  });

  it("clamps the denominator so a very young video cannot win on noise alone", () => {
    const ranked = rankByVelocity(
      [
        item({ title: "one-hour-old", publishedAt: hoursAgo(1), viewCount: 5_000 }),
        item({ title: "two-days-old", publishedAt: daysAgo(2), viewCount: 200_000 }),
      ],
      { now: NOW }
    );
    // Without the MIN_HOURS floor the 1h video would score 5000/h and win.
    expect(ranked[0].title).toBe("two-days-old");
    expect(ranked.find((i) => i.title === "one-hour-old")!.viewVelocity).toBe(5_000 / MIN_HOURS);
  });

  it("normalises per platform so one platform's scale cannot crowd out the other", () => {
    const ranked = rankByVelocity(
      [
        item({ platform: "bilibili", title: "bili-top", viewCount: 5_000_000 }),
        item({ platform: "bilibili", title: "bili-low", viewCount: 10_000 }),
        item({ platform: "youtube", title: "yt-top", viewCount: 50_000 }),
        item({ platform: "youtube", title: "yt-low", viewCount: 100 }),
      ],
      { now: NOW }
    );
    // Each platform's best normalises to 1.0, so both lead their own group.
    expect(ranked.slice(0, 2).map((i) => i.title).sort()).toEqual(["bili-top", "yt-top"]);
  });

  it("applies limitPerPlatform to each platform separately", () => {
    const items = [
      ...Array.from({ length: 20 }, (_, n) => item({ platform: "bilibili", title: `b${n}`, viewCount: n * 1000 })),
      ...Array.from({ length: 3 }, (_, n) => item({ platform: "youtube", title: `y${n}`, viewCount: n * 1000 })),
    ];
    const ranked = rankByVelocity(items, { now: NOW, limitPerPlatform: 5 });
    expect(ranked.filter((i) => i.platform === "bilibili")).toHaveLength(5);
    // YouTube had fewer than the limit — it keeps all of them rather than being padded out.
    expect(ranked.filter((i) => i.platform === "youtube")).toHaveLength(3);
  });

  it("keeps items with no publish date but sorts them last", () => {
    const ranked = rankByVelocity(
      [
        item({ title: "no-date", publishedAt: null, viewCount: 1_000_000 }),
        item({ title: "dated", publishedAt: daysAgo(1), viewCount: 1_000 }),
      ],
      { now: NOW }
    );
    expect(ranked.map((i) => i.title)).toEqual(["dated", "no-date"]);
    expect(ranked.find((i) => i.title === "no-date")!.viewVelocity).toBeNull();
  });

  it("breaks a tie on view velocity using comment velocity", () => {
    const ranked = rankByVelocity(
      [
        item({ title: "quiet", viewCount: 100_000, commentCount: 10 }),
        item({ title: "talked-about", viewCount: 100_000, commentCount: 50_000 }),
      ],
      { now: NOW }
    );
    expect(ranked[0].title).toBe("talked-about");
  });

  it("still lets a clear view-velocity lead outrank a comment-heavy video", () => {
    // Views carry more weight than comments, so engagement alone should not flip a
    // video that is genuinely accruing views much faster.
    const ranked = rankByVelocity(
      [
        item({ title: "much-faster-views", viewCount: 1_000_000, commentCount: 0 }),
        item({ title: "comment-heavy", viewCount: 10_000, commentCount: 50_000 }),
      ],
      { now: NOW }
    );
    expect(ranked[0].title).toBe("much-faster-views");
  });
});
