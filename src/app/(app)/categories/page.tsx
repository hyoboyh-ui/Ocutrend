import Link from "next/link";
import { Plus } from "lucide-react";
import { listAllCategories } from "@/lib/research/queries";
import { CategoryListItem } from "@/components/categories/CategoryListItem";
import type { GroupType } from "@/lib/supabase/types";

export const dynamic = "force-dynamic";

const groupLabels: Record<GroupType, string> = {
  main: "メインカテゴリ",
  sub: "制作お役立ち",
  custom: "カスタム",
};

export default async function CategoriesPage() {
  const categories = await listAllCategories();
  const groups: GroupType[] = ["main", "sub", "custom"];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">カテゴリ管理</h1>
        <Link
          href="/categories/new"
          className="flex items-center gap-1 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-bg-page"
        >
          <Plus size={16} />
          追加
        </Link>
      </div>

      {groups.map((group) => {
        const items = categories.filter((c) => c.group_type === group);
        if (items.length === 0) return null;
        return (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold text-text-muted">{groupLabels[group]}</h2>
            <div className="space-y-2">
              {items.map((category) => (
                <CategoryListItem key={category.id} category={category} />
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}
