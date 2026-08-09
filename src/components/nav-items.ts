import { TrendingUp, Archive, ListTodo, Star, AlertTriangle } from "lucide-react";

/** Shared by the desktop header nav (labels visible) and the mobile bottom bar (icon-only). */
export const navItems = [
  { href: "/", label: "ダッシュボード", icon: TrendingUp },
  { href: "/archive", label: "アーカイブ", icon: Archive },
  { href: "/categories", label: "カテゴリ", icon: ListTodo },
  { href: "/favorites", label: "お気に入り", icon: Star },
  { href: "/errors", label: "エラーログ", icon: AlertTriangle },
] as const;

/**
 * Nested routes should keep their section highlighted — an exact `===` check left
 * both `/archive/<runId>` and `/categories/new` showing no active tab at all.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
