import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { SnapshotError, type ReadPage } from "./snapshot";

/**
 * `ReadPage` の本物。**select しか呼ばない。** 書き込み・削除・アクセス記録は
 * この API では一切しない（snapshot.test.ts がこのファイルを検査している）。
 */
export function supabaseReadPage(): ReadPage {
  const supabase = createServerSupabaseClient();
  return async ({ table, columns, orderBy, from, to }) => {
    const { data, error, count } = await supabase
      .from(table)
      .select(columns, { count: "exact" })
      .order(orderBy, { ascending: true })
      .range(from, to);
    if (error) throw new SnapshotError("read_failed", `${table}: ${error.message}`);
    if (count === null) throw new SnapshotError("incomplete", `${table}: 総数が返りませんでした`);
    return { rows: (data ?? []) as unknown as Record<string, unknown>[], total: count };
  };
}
