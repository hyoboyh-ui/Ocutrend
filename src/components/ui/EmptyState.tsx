import type { ReactNode } from "react";

/**
 * Simple inline placeholder illustration. Swap the <svg> below for a downloaded
 * unDraw asset (recolored to var(--accent)) once one is chosen — same call sites.
 */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-10 text-center">
      <svg width="120" height="90" viewBox="0 0 120 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="10" y="50" width="100" height="8" rx="4" className="fill-border" />
        <circle cx="60" cy="32" r="20" className="fill-accent/15" />
        <path d="M50 32 L58 40 L72 24" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      <h3 className="font-medium">{title}</h3>
      {description && <p className="max-w-sm text-sm text-text-muted">{description}</p>}
      {action}
    </div>
  );
}
