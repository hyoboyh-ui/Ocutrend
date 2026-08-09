"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { TrendingUp, LogOut } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import { navItems, isNavItemActive } from "./nav-items";

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    // `pt-[env(safe-area-inset-top)]`: the manifest uses a translucent status bar, so
    // in standalone mode the page paints *behind* the clock. Without this the header
    // row sat under it — a large part of why the tabs felt squeezed on iPhone.
    <header className="sticky top-0 z-10 border-b border-border bg-bg-page/90 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-bold">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
            <TrendingUp size={18} />
          </div>
          Ocutrend
        </Link>

        {/* Phones get the icon-only <BottomNav /> instead. */}
        <nav className="hidden flex-1 items-center gap-1 text-sm sm:flex">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isNavItemActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 transition-colors ${
                  active ? "bg-accent/15 text-accent" : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Icon size={14} />
                {label}
              </Link>
            );
          })}
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
