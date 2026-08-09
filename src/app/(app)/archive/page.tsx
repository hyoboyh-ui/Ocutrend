import Link from "next/link";
import { listWeeklyRuns } from "@/lib/research/queries";
import { StatusBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const runs = await listWeeklyRuns();

  if (runs.length === 0) {
    return <EmptyState title="アーカイブはまだありません" />;
  }

  return (
    <div className="space-y-2">
      <h1 className="text-lg font-bold">アーカイブ</h1>
      {runs.map((run) => (
        <Link
          key={run.id}
          href={`/archive/${run.id}`}
          className="card-enter flex items-center justify-between rounded-xl border border-border bg-bg-surface p-4 hover:border-accent"
        >
          <span>{run.week_start}</span>
          <div className="flex items-center gap-2">
            <StatusBadge status={run.status} />
            <span className="text-xs text-text-muted">{run.triggered_by === "cron" ? "自動" : "手動"}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}
