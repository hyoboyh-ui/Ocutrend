/**
 * AI（Codex）向け読み取り専用 API（GET /api/context）の中身を組み立てる。
 *
 * DB への接続はここに持たない。`ReadPage`（1 ページ読むだけの関数）を外から受け取るので、
 * 本物の Supabase でも、snapshot.test.ts の偽物の DB でも同じ処理が走る。
 * そのため `server-only` も `@/` の別名も使わない（vitest から素のまま読み込めるように）。
 *
 * この API の約束は「返したものが（指定した範囲の）全件」。受け取る側は、前回あった ID が
 * 今回無ければ削除されたとみなす。だから *欠けた結果を成功として返すこと* が一番まずい:
 *
 * 1. ページング — PostgREST は 1 回に返す行数に上限がある（既定 1000）。
 *    `count: "exact"` の総数に届くまで読み、届かなければ失敗にする。
 * 2. 整合性の検証 — ID の重複、関連先の欠落、日付の形式。1 つでも崩れていれば失敗。
 * 3. 読み取り中の変更の検知 — 表は別々のリクエストで読むので、全体を 2 回続けて読み、
 *    中身が一致したときだけ返す。
 *
 * 期間を指定しても、読むのは常に全件（検証を全体に対して行うため）。絞り込みは最後にする。
 * Tacotask の同名ファイルと同じ設計。
 */
import { formatInTimeZone } from "date-fns-tz";
import { JST } from "../date/schedule";
import { GROUP_LABELS } from "../category-labels";

export type ContextTable =
  | "categories"
  | "weekly_runs"
  | "report_entries"
  | "report_metrics"
  | "favorites"
  | "app_settings";

export type PageRequest = {
  table: ContextTable;
  /** 取得する列（カンマ区切り）。`*` は使わない。 */
  columns: string;
  /** 並びを固定する一意な列。 */
  orderBy: string;
  /** 0 始まり、両端を含む。 */
  from: number;
  to: number;
};

export type PageResult = {
  rows: Record<string, unknown>[];
  /** その表の全行数（`count: "exact"`）。 */
  total: number;
};

/** 1 ページ読む。並びは `orderBy` の昇順で固定すること。 */
export type ReadPage = (request: PageRequest) => Promise<PageResult>;

export type SnapshotErrorCode = "read_failed" | "incomplete" | "integrity" | "unstable";

/** 失敗の種類。`detail` はサーバーのログにだけ出し、レスポンスには載せない。 */
export class SnapshotError extends Error {
  constructor(
    public readonly code: SnapshotErrorCode,
    public readonly detail: string
  ) {
    super(`${code}: ${detail}`);
  }
}

/**
 * 各表から読む列。ここに無い表（ログイン履歴・通知の購読・エラーログ・お気に入りの
 * embedding）と列（失敗回数・通知の休止期限・`raw_source_meta`・常に空の `keywords`・
 * ピックアップとは無関係に番号が振られている `rank_in_pickups`）は読みもしない。
 */
const TABLES: Record<ContextTable, { columns: readonly string[]; orderBy: string }> = {
  categories: {
    columns: [
      "id", "slug", "name", "group_type", "description", "search_query_hint", "source_type",
      "bilibili_partition", "search_queries", "youtube_only", "bilibili_only", "status",
      "sort_order", "created_at", "updated_at",
    ],
    orderBy: "id",
  },
  weekly_runs: {
    columns: ["id", "week_start", "status", "triggered_by", "started_at", "completed_at", "created_at"],
    orderBy: "id",
  },
  report_entries: {
    columns: [
      "id", "weekly_run_id", "category_id", "status", "summary_text", "pickups", "source_used",
      "fallback_reason", "error_message", "started_at", "completed_at", "created_at", "updated_at",
    ],
    orderBy: "id",
  },
  report_metrics: {
    columns: [
      "id", "report_entry_id", "platform", "item_title", "item_url", "view_count", "like_count",
      "comment_count", "published_at", "growth_rate", "created_at",
    ],
    orderBy: "id",
  },
  favorites: {
    columns: ["id", "report_entry_id", "pickup_ref", "note", "created_at"],
    orderBy: "id",
  },
  // 主キーが `key`。返すのは favorite_trend_summary だけ（research_schedule は内部設定）。
  app_settings: { columns: ["key", "value", "updated_at"], orderBy: "key" },
};

export const CONTEXT_TABLES = Object.keys(TABLES) as ContextTable[];

export const DEFAULT_PAGE_SIZE = 1000;

/** 「2 回続けて同じ中身」を確かめる読み直しの上限（最初の 1 回は含まない）。 */
export const DEFAULT_CONFIRM_ATTEMPTS = 3;

type Raw = Record<ContextTable, Record<string, unknown>[]>;

async function readAll(
  readPage: ReadPage,
  table: ContextTable,
  pageSize: number
): Promise<Record<string, unknown>[]> {
  const { columns, orderBy } = TABLES[table];
  const rows: Record<string, unknown>[] = [];
  let total: number | null = null;

  while (total === null || rows.length < total) {
    let page: PageResult;
    try {
      page = await readPage({
        table,
        columns: columns.join(","),
        orderBy,
        from: rows.length,
        to: rows.length + pageSize - 1,
      });
    } catch (e) {
      if (e instanceof SnapshotError) throw e;
      throw new SnapshotError("read_failed", `${table}: ${String(e)}`);
    }
    if (!Number.isInteger(page.total) || page.total < 0) {
      throw new SnapshotError("incomplete", `${table}: 総数が取得できませんでした`);
    }
    if (total !== null && page.total !== total) {
      throw new SnapshotError("unstable", `${table}: 読み取り中に件数が ${total} → ${page.total}`);
    }
    total = page.total;
    if (page.rows.length === 0 && rows.length < total) {
      throw new SnapshotError("incomplete", `${table}: ${total} 件中 ${rows.length} 件で途切れました`);
    }
    rows.push(...page.rows);
  }

  if (rows.length !== total) {
    throw new SnapshotError("incomplete", `${table}: 総数 ${total} に対して ${rows.length} 件`);
  }
  return rows;
}

async function readOnce(readPage: ReadPage, pageSize: number): Promise<Raw> {
  const results = await Promise.all(CONTEXT_TABLES.map((t) => readAll(readPage, t, pageSize)));
  return Object.fromEntries(CONTEXT_TABLES.map((t, i) => [t, results[i]])) as Raw;
}

// ---------- 検証と変換 ----------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(detail: string): never {
  throw new SnapshotError("integrity", detail);
}

function requireString(row: Record<string, unknown>, key: string, where: string): string {
  const v = row[key];
  if (typeof v !== "string" || v === "") fail(`${where}.${key} が文字列ではありません`);
  return v;
}

function optionalString(row: Record<string, unknown>, key: string, where: string): string | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") fail(`${where}.${key} が文字列でも null でもありません`);
  return v;
}

function optionalNumber(row: Record<string, unknown>, key: string, where: string): number | null {
  const v = row[key];
  if (v === null || v === undefined) return null;
  if (typeof v !== "number" || !Number.isFinite(v)) fail(`${where}.${key} が数値でも null でもありません`);
  return v;
}

function requireBoolean(row: Record<string, unknown>, key: string, where: string): boolean {
  const v = row[key];
  if (typeof v !== "boolean") fail(`${where}.${key} が真偽値ではありません`);
  return v;
}

/** timestamptz → 日本時間の ISO 8601（ミリ秒まで）。 */
function jstTimestamp(v: unknown, where: string, nullable: boolean): string | null {
  if ((v === null || v === undefined) && nullable) return null;
  if (typeof v !== "string") fail(`${where} が日時ではありません`);
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) fail(`${where} が日時として読めません`);
  return formatInTimeZone(d, JST, "yyyy-MM-dd'T'HH:mm:ss.SSSXXX");
}

/** 日付の形式と実在を確かめる（2026-02-30 のような値も弾く）。 */
export function isPlainDate(v: unknown): v is string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

function plainDate(v: unknown, where: string): string {
  if (!isPlainDate(v)) fail(`${where} が実在する YYYY-MM-DD ではありません`);
  return v;
}

function uniqueIds(rows: Record<string, unknown>[], table: ContextTable): Set<string> {
  const ids = new Set<string>();
  for (const row of rows) {
    const id = requireString(row, "id", table);
    if (ids.has(id)) fail(`${table}: id ${id} が重複しています`);
    ids.add(id);
  }
  return ids;
}

type Pickup = Record<string, unknown> & { ref: string; title: string };

/** pickups は保存されたまま返す。中身の項目は時期によって増えている（channelTitle は途中から）ので、ref と title だけ確かめる。 */
function pickups(v: unknown, where: string): Pickup[] {
  if (!Array.isArray(v)) fail(`${where}.pickups が配列ではありません`);
  const refs = new Set<string>();
  return v.map((p, i) => {
    if (p === null || typeof p !== "object") fail(`${where}.pickups[${i}] がオブジェクトではありません`);
    const obj = p as Record<string, unknown>;
    const ref = requireString(obj, "ref", `${where}.pickups[${i}]`);
    requireString(obj, "title", `${where}.pickups[${i}]`);
    if (refs.has(ref)) fail(`${where}.pickups: ref ${ref} が重複しています`);
    refs.add(ref);
    return obj as Pickup;
  });
}

const byCreatedThenId = (a: { created_at: string | null; id: string }, b: typeof a) =>
  (a.created_at ?? "").localeCompare(b.created_at ?? "") || a.id.localeCompare(b.id);

function shape(raw: Raw) {
  const categoryIds = uniqueIds(raw.categories, "categories");
  const runIds = uniqueIds(raw.weekly_runs, "weekly_runs");
  const entryIds = uniqueIds(raw.report_entries, "report_entries");
  uniqueIds(raw.report_metrics, "report_metrics");
  uniqueIds(raw.favorites, "favorites");

  const categories = raw.categories
    .map((row) => {
      const where = `categories[${String(row.id)}]`;
      const queries = row.search_queries;
      if (queries !== null && queries !== undefined && !Array.isArray(queries)) {
        fail(`${where}.search_queries が配列でも null でもありません`);
      }
      return {
        id: row.id as string,
        slug: requireString(row, "slug", where),
        name: requireString(row, "name", where),
        group_type: requireString(row, "group_type", where),
        description: optionalString(row, "description", where) ?? "",
        search_query_hint: optionalString(row, "search_query_hint", where) ?? "",
        source_type: requireString(row, "source_type", where),
        bilibili_partition: optionalNumber(row, "bilibili_partition", where),
        search_queries: (queries ?? null) as unknown[] | null,
        youtube_only: requireBoolean(row, "youtube_only", where),
        bilibili_only: requireBoolean(row, "bilibili_only", where),
        status: requireString(row, "status", where),
        sort_order: optionalNumber(row, "sort_order", where) ?? 0,
        created_at: jstTimestamp(row.created_at, `${where}.created_at`, false),
        updated_at: jstTimestamp(row.updated_at, `${where}.updated_at`, false),
      };
    })
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id));

  const weeklyRuns = raw.weekly_runs
    .map((row) => {
      const where = `weekly_runs[${String(row.id)}]`;
      return {
        id: row.id as string,
        week_start: plainDate(row.week_start, `${where}.week_start`),
        status: requireString(row, "status", where),
        triggered_by: requireString(row, "triggered_by", where),
        started_at: jstTimestamp(row.started_at, `${where}.started_at`, true),
        completed_at: jstTimestamp(row.completed_at, `${where}.completed_at`, true),
        created_at: jstTimestamp(row.created_at, `${where}.created_at`, false),
      };
    })
    .sort((a, b) => a.week_start.localeCompare(b.week_start) || a.id.localeCompare(b.id));

  const pickupsByEntry = new Map<string, Pickup[]>();
  const reportEntries = raw.report_entries
    .map((row) => {
      const where = `report_entries[${String(row.id)}]`;
      const runId = requireString(row, "weekly_run_id", where);
      if (!runIds.has(runId)) fail(`${where}: 週次実行 ${runId} が存在しません`);
      const categoryId = requireString(row, "category_id", where);
      if (!categoryIds.has(categoryId)) fail(`${where}: カテゴリ ${categoryId} が存在しません`);
      const entryPickups = pickups(row.pickups, where);
      pickupsByEntry.set(row.id as string, entryPickups);
      return {
        id: row.id as string,
        weekly_run_id: runId,
        category_id: categoryId,
        status: requireString(row, "status", where),
        summary_text: optionalString(row, "summary_text", where),
        pickups: entryPickups,
        source_used: optionalString(row, "source_used", where),
        fallback_reason: optionalString(row, "fallback_reason", where),
        error_message: optionalString(row, "error_message", where),
        started_at: jstTimestamp(row.started_at, `${where}.started_at`, true),
        completed_at: jstTimestamp(row.completed_at, `${where}.completed_at`, true),
        created_at: jstTimestamp(row.created_at, `${where}.created_at`, false),
        updated_at: jstTimestamp(row.updated_at, `${where}.updated_at`, false),
      };
    })
    .sort(byCreatedThenId);

  const reportMetrics = raw.report_metrics
    .map((row) => {
      const where = `report_metrics[${String(row.id)}]`;
      const entryId = requireString(row, "report_entry_id", where);
      if (!entryIds.has(entryId)) fail(`${where}: レポート ${entryId} が存在しません`);
      return {
        id: row.id as string,
        report_entry_id: entryId,
        platform: requireString(row, "platform", where),
        item_title: requireString(row, "item_title", where),
        item_url: optionalString(row, "item_url", where),
        view_count: optionalNumber(row, "view_count", where),
        like_count: optionalNumber(row, "like_count", where),
        comment_count: optionalNumber(row, "comment_count", where),
        published_at: jstTimestamp(row.published_at, `${where}.published_at`, true),
        growth_rate: optionalNumber(row, "growth_rate", where),
        created_at: jstTimestamp(row.created_at, `${where}.created_at`, false),
      };
    })
    .sort(
      (a, b) =>
        a.report_entry_id.localeCompare(b.report_entry_id) ||
        (b.growth_rate ?? -1) - (a.growth_rate ?? -1) ||
        a.id.localeCompare(b.id)
    );

  const favorites = raw.favorites
    .map((row) => {
      const where = `favorites[${String(row.id)}]`;
      const entryId = requireString(row, "report_entry_id", where);
      if (!entryIds.has(entryId)) fail(`${where}: レポート ${entryId} が存在しません`);
      const ref = requireString(row, "pickup_ref", where);
      // 同じ週に「今すぐリサーチ」をやり直すとピックアップが作り直され、古い ref を指す
      // お気に入りが残ることがある。データの状態としてはあり得るので失敗にはせず、null で返す。
      const pickup = pickupsByEntry.get(entryId)?.find((p) => p.ref === ref) ?? null;
      return {
        id: row.id as string,
        report_entry_id: entryId,
        pickup_ref: ref,
        pickup,
        note: optionalString(row, "note", where),
        created_at: jstTimestamp(row.created_at, `${where}.created_at`, false),
      };
    })
    .sort(byCreatedThenId);

  const summaryRow = raw.app_settings.find((r) => r.key === "favorite_trend_summary");
  let favoriteTrendSummary: {
    summary: string;
    month_start: string;
    generated_at: string | null;
  } | null = null;
  if (summaryRow) {
    const v = summaryRow.value as Record<string, unknown> | null;
    if (!v || typeof v !== "object") fail("app_settings.favorite_trend_summary の値が壊れています");
    favoriteTrendSummary = {
      summary: requireString(v, "summary", "favorite_trend_summary"),
      month_start: plainDate(v.monthStart, "favorite_trend_summary.monthStart"),
      generated_at: jstTimestamp(v.generatedAt, "favorite_trend_summary.generatedAt", true),
    };
  }

  return { categories, weeklyRuns, reportEntries, reportMetrics, favorites, favoriteTrendSummary };
}

function definitions() {
  return {
    groupTypes: GROUP_LABELS,
    weekStartConvention: "week_start は日本時間の月曜日",
    pickupsNote:
      "pickups は保存されたまま。channelTitle は 2026-08-14 以降のレポートにだけある。",
  };
}

export type Range = { from: string | null; to: string | null };

export type BuildOptions = {
  range?: Range;
  pageSize?: number;
  confirmAttempts?: number;
  now?: Date;
};

export async function buildContextSnapshot(readPage: ReadPage, options: BuildOptions = {}) {
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;
  const confirmAttempts = options.confirmAttempts ?? DEFAULT_CONFIRM_ATTEMPTS;
  const range: Range = options.range ?? { from: null, to: null };

  const readSettled = async (): Promise<Raw | null> => {
    try {
      return await readOnce(readPage, pageSize);
    } catch (e) {
      if (e instanceof SnapshotError && e.code === "unstable") return null;
      throw e;
    }
  };

  let previous = await readSettled();
  for (let attempt = 0; attempt < confirmAttempts; attempt++) {
    const current = await readSettled();
    if (previous && current && JSON.stringify(previous) === JSON.stringify(current)) {
      const all = shape(current);

      // 絞り込みは検証のあと。週次実行 → そのレポート → その動画データ・お気に入り、の順にたどる。
      const inRange = (weekStart: string) =>
        (range.from === null || weekStart >= range.from) && (range.to === null || weekStart <= range.to);
      const weeklyRuns = all.weeklyRuns.filter((r) => inRange(r.week_start));
      const runIds = new Set(weeklyRuns.map((r) => r.id));
      const reportEntries = all.reportEntries.filter((e) => runIds.has(e.weekly_run_id));
      const entryIds = new Set(reportEntries.map((e) => e.id));
      const reportMetrics = all.reportMetrics.filter((m) => entryIds.has(m.report_entry_id));
      const favorites = all.favorites.filter((f) => entryIds.has(f.report_entry_id));

      const isFull = range.from === null && range.to === null;
      return {
        ok: true as const,
        schemaVersion: 1,
        generatedAt: formatInTimeZone(options.now ?? new Date(), JST, "yyyy-MM-dd'T'HH:mm:ssXXX"),
        timezone: JST,
        scope: {
          type: isFull ? ("full" as const) : ("range" as const),
          from: range.from,
          to: range.to,
          rangeAppliesTo: "weekly_runs.week_start（両端を含む）",
          alwaysFull: ["categories", "favorite_trend_summary"],
          includesPausedCategories: true,
          includesFailedEntries: true,
        },
        complete: true as const,
        counts: {
          categories: all.categories.length,
          weekly_runs: weeklyRuns.length,
          report_entries: reportEntries.length,
          report_metrics: reportMetrics.length,
          favorites: favorites.length,
        },
        categories: all.categories,
        weekly_runs: weeklyRuns,
        report_entries: reportEntries,
        report_metrics: reportMetrics,
        favorites,
        favorite_trend_summary: all.favoriteTrendSummary,
        definitions: definitions(),
      };
    }
    previous = current;
  }
  throw new SnapshotError("unstable", `${confirmAttempts + 1} 回読んでも内容が揃いませんでした`);
}

export type ContextSnapshot = Awaited<ReturnType<typeof buildContextSnapshot>>;
