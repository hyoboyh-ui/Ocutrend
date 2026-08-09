"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItems, isNavItemActive } from "./nav-items";

/**
 * Icon-only tab bar, phones only (`sm:hidden` — the desktop header nav keeps its labels).
 *
 * Labels are dropped on purpose: five Japanese labels never fit five tab widths at
 * 375px without truncating. Each link carries an `aria-label` so the icon still has
 * an accessible name, and the touch target stays at 56px tall.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-border bg-bg-page/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      <ul className="flex">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-label={label}
                aria-current={active ? "page" : undefined}
                className={`flex h-14 items-center justify-center transition-colors ${
                  active ? "text-accent" : "text-text-muted"
                }`}
              >
                <Icon size={24} strokeWidth={active ? 2.4 : 1.8} />
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
