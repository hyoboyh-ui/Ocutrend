"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TrendingUp, Archive, ListTodo, Star, AlertTriangle, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";

const navItems = [
  { href: "/", label: "ダッシュボード", icon: TrendingUp },
  { href: "/archive", label: "アーカイブ", icon: Archive },
  { href: "/categories", label: "カテゴリ", icon: ListTodo },
  { href: "/favorites", label: "お気に入り", icon: Star },
  { href: "/errors", label: "エラーログ", icon: AlertTriangle },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="sticky top-0 z-10 border-b border-border bg-bg-page/90 backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <TrendingUp size={18} />
          </div>
          Ocutrend
        </Link>
        <nav className="flex flex-1 items-center gap-1 overflow-x-auto text-sm">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 transition-colors ${
                pathname === href ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Icon size={14} />
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={logout}
            aria-label="ログアウト"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border text-text-muted hover:border-accent hover:text-accent"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
