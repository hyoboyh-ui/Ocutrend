import { describe, expect, it } from "vitest";
import { getCurrentWeekStartJST } from "./schedule";

describe("getCurrentWeekStartJST", () => {
  it("returns the Monday of the current JST week", () => {
    // 2026-08-09 is a Sunday JST -> week start should be 2026-08-03 (Monday)
    const sunday = new Date("2026-08-09T10:00:00Z"); // 19:00 JST Sunday
    expect(getCurrentWeekStartJST(sunday)).toBe("2026-08-03");
  });

  it("returns the same date when already Monday JST", () => {
    const monday = new Date("2026-08-10T01:00:00Z"); // 10:00 JST Monday
    expect(getCurrentWeekStartJST(monday)).toBe("2026-08-10");
  });

  it("handles a UTC date that is still the previous day in JST", () => {
    // 2026-08-09 23:30 UTC is 2026-08-10 08:30 JST (Monday)
    const lateUtc = new Date("2026-08-09T23:30:00Z");
    expect(getCurrentWeekStartJST(lateUtc)).toBe("2026-08-10");
  });
});
