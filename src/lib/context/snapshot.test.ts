import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildContextSnapshot,
  isPlainDate,
  SnapshotError,
  type ContextTable,
  type ReadPage,
} from "./snapshot";

/**
 * GET /api/context の組み立て処理を、偽物の DB で確かめる。本番のデータには触れない。
 * 本番では作れない状況（取得上限を超える件数、途中で読み取りが失敗する、
 * 読んでいる最中に中身が変わる、壊れた行が混ざる）をここで再現する。
 */

type Tables = Record<ContextTable, Record<string, unknown>[]>;

/** PostgREST の真似: orderBy 昇順、1 回に返す行数は serverCap まで、総数を毎回返す。 */
function fakeDb(
  getTables: () => Tables,
  opts: { serverCap?: number; failOn?: ContextTable; lieTotalBy?: number } = {}
): ReadPage & { calls: number } {
  const fn = (async ({ table, columns, orderBy, from, to }) => {
    fn.calls++;
    if (opts.failOn === table) throw new Error("connection reset");
    const cols = columns.split(",");
    const all = [...getTables()[table]].sort((a, b) => String(a[orderBy]).localeCompare(String(b[orderBy])));
    const end = Math.min(to + 1, from + (opts.serverCap ?? 1000));
    const rows = all.slice(from, end).map((r) => Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
    return { rows, total: all.length + (opts.lieTotalBy ?? 0) };
  }) as ReadPage & { calls: number };
  fn.calls = 0;
  return fn;
}

const TS = "2026-09-20T15:30:00.123456+00:00"; // JST 2026-09-21 00:30:00.123

function category(id: string, extra: Record<string, unknown> = {}) {
  return {
    id, slug: id, name: `カテゴリ${id}`, group_type: "main", description: "説明", search_query_hint: "",
    source_type: "youtube_bilibili", bilibili_partition: 1003, search_queries: null, youtube_only: false,
    bilibili_only: true, status: "active", sort_order: 10, created_at: TS, updated_at: TS,
    consecutive_failures: 5, muted_until: TS, // 返してはいけない列
    ...extra,
  };
}

function run(id: string, weekStart: string) {
  return { id, week_start: weekStart, status: "completed", triggered_by: "cron", started_at: TS, completed_at: TS, created_at: TS };
}

function entry(id: string, runId: string, categoryId: string, refs: string[] = ["ref-a"]) {
  return {
    id, weekly_run_id: runId, category_id: categoryId, status: "ok", summary_text: "今週の傾向",
    pickups: refs.map((ref) => ({ ref, title: `動画${ref}`, platform: "bilibili", url: null, whyTrending: "理由", howToReplicate: "作り方" })),
    source_used: "bilibili", fallback_reason: null, error_message: null,
    started_at: TS, completed_at: TS, created_at: TS, updated_at: TS,
    raw_source_meta: { itemCount: 12 }, // 返してはいけない列
  };
}

function metric(id: string, entryId: string, growth: number | null) {
  return {
    id, report_entry_id: entryId, platform: "bilibili", item_title: `動画${id}`, item_url: null,
    view_count: 1000, like_count: 10, comment_count: 1, published_at: TS, growth_rate: growth, created_at: TS,
    keywords: [], rank_in_pickups: 1, // 返してはいけない列
  };
}

function baseTables(): Tables {
  return {
    categories: [category("c1"), category("c2", { status: "paused", group_type: "sub", sort_order: 70 })],
    weekly_runs: [run("r1", "2026-09-14"), run("r2", "2026-09-21")],
    report_entries: [entry("e1", "r1", "c1"), entry("e2", "r2", "c1", ["ref-b"]), entry("e3", "r2", "c2", ["ref-c"])],
    report_metrics: [metric("m1", "e1", 5), metric("m2", "e2", 1), metric("m3", "e2", 9), metric("m4", "e3", null)],
    favorites: [
      { id: "f1", report_entry_id: "e1", pickup_ref: "ref-a", note: null, created_at: TS },
      { id: "f2", report_entry_id: "e2", pickup_ref: "ref-old", note: "メモ", created_at: TS },
    ],
    app_settings: [
      { key: "favorite_trend_summary", value: { summary: "好みの傾向", monthStart: "2026-09-01", generatedAt: "2026-08-31T22:13:07.234Z" }, updated_at: TS },
      { key: "research_schedule", value: { cron: "0 7 * * 1" }, updated_at: TS },
    ],
  };
}

async function expectCode(run: () => Promise<unknown>, code: string) {
  const err = await run().then(
    () => null,
    (e: unknown) => e
  );
  expect(err, "部分データを成功扱いしている").toBeInstanceOf(SnapshotError);
  expect((err as SnapshotError).code).toBe(code);
}

describe("buildContextSnapshot: 通常の取得", () => {
  it("全件を返し、日時を日本時間に直し、停止中や失敗も含める", async () => {
    const s = await buildContextSnapshot(fakeDb(baseTables), { now: new Date("2026-09-28T03:00:00Z") });
    expect(s.ok && s.complete).toBe(true);
    expect(s.scope.type).toBe("full");
    expect(s.counts).toEqual({ categories: 2, weekly_runs: 2, report_entries: 3, report_metrics: 4, favorites: 2 });
    expect(s.categories.find((c) => c.id === "c2")!.status).toBe("paused");
    expect(s.categories[0].created_at).toBe("2026-09-21T00:30:00.123+09:00");
    expect(s.weekly_runs.map((r) => r.week_start)).toEqual(["2026-09-14", "2026-09-21"]);
    expect(s.generatedAt).toBe("2026-09-28T12:00:00+09:00");
  });

  it("お気に入りにピックアップの中身を添え、見つからないものは null で返す", async () => {
    const s = await buildContextSnapshot(fakeDb(baseTables));
    expect(s.favorites.find((f) => f.id === "f1")!.pickup?.title).toBe("動画ref-a");
    expect(s.favorites.find((f) => f.id === "f2")!.pickup).toBeNull();
  });

  it("動画データはレポートごとに伸び率の高い順、null は最後", async () => {
    const s = await buildContextSnapshot(fakeDb(baseTables));
    expect(s.report_metrics.filter((m) => m.report_entry_id === "e2").map((m) => m.id)).toEqual(["m3", "m2"]);
  });

  it("お気に入り傾向の要約を返し、内部設定は返さない", async () => {
    const s = await buildContextSnapshot(fakeDb(baseTables));
    expect(s.favorite_trend_summary).toEqual({
      summary: "好みの傾向",
      month_start: "2026-09-01",
      generated_at: "2026-09-01T07:13:07.234+09:00",
    });
    const body = JSON.stringify(s);
    for (const k of ["consecutive_failures", "muted_until", "raw_source_meta", "keywords", "rank_in_pickups", "research_schedule", "service_role", "Bearer"]) {
      expect(body, k).not.toContain(k);
    }
  });

  it("要約がまだ無ければ null", async () => {
    const t = baseTables();
    t.app_settings = t.app_settings.filter((r) => r.key !== "favorite_trend_summary");
    const s = await buildContextSnapshot(fakeDb(() => t));
    expect(s.favorite_trend_summary).toBeNull();
  });
});

describe("buildContextSnapshot: 期間指定", () => {
  it("週の範囲で絞り、関連する表も一緒に絞る。カテゴリと要約は常に全部", async () => {
    const s = await buildContextSnapshot(fakeDb(baseTables), { range: { from: "2026-09-21", to: null } });
    expect(s.scope).toMatchObject({ type: "range", from: "2026-09-21", to: null });
    expect(s.weekly_runs.map((r) => r.id)).toEqual(["r2"]);
    expect(s.report_entries.map((e) => e.id).sort()).toEqual(["e2", "e3"]);
    expect(s.report_metrics.every((m) => m.report_entry_id !== "e1")).toBe(true);
    expect(s.favorites.map((f) => f.id)).toEqual(["f2"]);
    expect(s.counts.categories).toBe(2);
    expect(s.favorite_trend_summary).not.toBeNull();
  });

  it("両端を含む", async () => {
    const s = await buildContextSnapshot(fakeDb(baseTables), { range: { from: "2026-09-14", to: "2026-09-14" } });
    expect(s.weekly_runs.map((r) => r.id)).toEqual(["r1"]);
  });
});

describe("buildContextSnapshot: 件数が多い", () => {
  it("取得上限を超える件数を、サーバーの上限が小さくても取りこぼさない", async () => {
    const t = baseTables();
    for (let n = 0; n < 2500; n++) t.report_metrics.push(metric(`x-${String(n).padStart(5, "0")}`, "e1", n));
    const s = await buildContextSnapshot(fakeDb(() => t));
    expect(s.counts.report_metrics).toBe(2504);
    const small = fakeDb(() => t, { serverCap: 7 });
    const s2 = await buildContextSnapshot(small);
    expect(s2.counts.report_metrics).toBe(2504);
    expect(new Set(s2.report_metrics.map((m) => m.id)).size).toBe(2504);
  });
});

describe("buildContextSnapshot: 失敗を成功扱いしない", () => {
  it("1 つの表の取得失敗", () => expectCode(() => buildContextSnapshot(fakeDb(baseTables, { failOn: "favorites" })), "read_failed"));
  it("総数に届かないまま行が尽きた", () => expectCode(() => buildContextSnapshot(fakeDb(baseTables, { lieTotalBy: 3 })), "incomplete"));

  const broken: [string, (t: Tables) => void][] = [
    ["存在しない週次実行を指すレポート", (t) => void (t.report_entries[0].weekly_run_id = "r-missing")],
    ["存在しないカテゴリを指すレポート", (t) => void (t.report_entries[0].category_id = "c-missing")],
    ["存在しないレポートを指す動画データ", (t) => void (t.report_metrics[0].report_entry_id = "e-missing")],
    ["存在しないレポートを指すお気に入り", (t) => void (t.favorites[0].report_entry_id = "e-missing")],
    ["ID の重複", (t) => void t.report_entries.push({ ...t.report_entries[0] })],
    ["実在しない日付", (t) => void (t.weekly_runs[0].week_start = "2026-02-30")],
    ["pickups が配列でない", (t) => void (t.report_entries[0].pickups = "[]")],
    ["pickups の ref が重複", (t) => void (t.report_entries[0].pickups = [{ ref: "x", title: "a" }, { ref: "x", title: "b" }])],
    ["数値列に文字列", (t) => void (t.report_metrics[0].view_count = "1000")],
  ];
  for (const [label, breakIt] of broken) {
    it(label, () => {
      const t = baseTables();
      breakIt(t);
      return expectCode(() => buildContextSnapshot(fakeDb(() => t)), "integrity");
    });
  }
});

describe("buildContextSnapshot: 読み取り中の変更", () => {
  it("読むたびに中身が変わると諦めて unstable", async () => {
    let n = 0;
    const db = fakeDb(() => {
      const t = baseTables();
      t.categories[0].name = `毎回変わる${n++}`;
      return t;
    });
    await expectCode(() => buildContextSnapshot(db), "unstable");
  });

  it("1 度だけ変わった場合は揃ったあとの内容を返す", async () => {
    let reads = 0;
    const db = fakeDb(() => {
      const t = baseTables();
      if (reads++ < 6) t.categories[0].name = "変更前"; // 最初の 1 周（6 表）だけ古い内容
      return t;
    });
    const s = await buildContextSnapshot(db);
    expect(s.categories.find((c) => c.id === "c1")!.name).toBe("カテゴリc1");
  });
});

describe("窓口のコード", () => {
  const root = path.resolve(__dirname, "../../..");
  const files = ["src/lib/context/source.ts", "src/lib/context/snapshot.ts", "src/app/api/context/route.ts"];

  it("DB への書き込み・関数呼び出しが無い", () => {
    for (const f of files) {
      expect(readFileSync(path.join(root, f), "utf8"), f).not.toMatch(/\.(insert|update|upsert|delete|rpc)\s*\(/);
    }
  });

  it("select(\"*\") を使っていない", () => {
    for (const f of files) {
      expect(readFileSync(path.join(root, f), "utf8"), f).not.toMatch(/select\(\s*["']\*["']/);
    }
  });
});

describe("isPlainDate", () => {
  it("実在する日付だけを通す", () => {
    expect(isPlainDate("2026-09-21")).toBe(true);
    expect(isPlainDate("2026-02-30")).toBe(false);
    expect(isPlainDate("2026-9-21")).toBe(false);
    expect(isPlainDate(null)).toBe(false);
  });
});
