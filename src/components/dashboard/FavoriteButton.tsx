"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export function FavoriteButton({
  reportEntryId,
  pickupRef,
  initiallyFavorited = false,
}: {
  reportEntryId: string;
  pickupRef: string;
  initiallyFavorited?: boolean;
}) {
  const [favorited, setFavorited] = useState(initiallyFavorited);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    setLoading(true);
    const next = !favorited;
    setFavorited(next); // optimistic
    try {
      await fetch("/api/favorites", {
        method: next ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportEntryId, pickupRef }),
      });
    } catch {
      setFavorited(!next); // revert on failure
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      aria-pressed={favorited}
      aria-label="お気に入り"
      className="text-text-muted transition-colors hover:text-accent disabled:opacity-50"
    >
      <Star size={18} fill={favorited ? "currentColor" : "none"} className={favorited ? "text-accent" : ""} />
    </button>
  );
}
