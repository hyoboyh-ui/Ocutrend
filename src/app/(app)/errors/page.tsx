import { createServerSupabaseClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function ErrorsPage() {
  const supabase = createServerSupabaseClient();
  const { data } = await supabase
    .from("error_log")
    .select("*, categories(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const errors = data ?? [];

  if (errors.length === 0) {
    return <EmptyState title="エラーはありません" description="リサーチ中にエラーが起きると、ここに記録されます。" />;
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">エラーログ</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="bg-bg-surface-raised text-text-muted">
            <tr>
              <th className="p-3 font-medium">日時</th>
              <th className="p-3 font-medium">カテゴリ</th>
              <th className="p-3 font-medium">ソース</th>
              <th className="p-3 font-medium">メッセージ</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((e) => (
              <tr key={e.id} className="border-t border-border align-top">
                <td className="whitespace-nowrap p-3 text-text-muted">
                  {new Date(e.created_at).toLocaleString("ja-JP")}
                </td>
                <td className="p-3">{(e.categories as { name?: string } | null)?.name ?? "-"}</td>
                <td className="p-3">{e.source}</td>
                <td className="p-3 font-mono text-xs">{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
