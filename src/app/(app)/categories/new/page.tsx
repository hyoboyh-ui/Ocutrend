"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Newspaper } from "lucide-react";

export default function NewCategoryPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sourceType, setSourceType] = useState<"youtube_bilibili" | "web_search_only">("web_search_only");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, sourceType }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "作成に失敗しました。");
        return;
      }
      router.push("/categories");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card-enter max-w-lg space-y-5">
      <h1 className="text-lg font-bold">カテゴリを追加</h1>

      <div>
        <label className="mb-1 block text-sm text-text-muted" htmlFor="name">
          カテゴリ名
        </label>
        <input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
          placeholder="例: Claude Codeでのサイト制作"
          className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 outline-none focus:border-accent"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm text-text-muted" htmlFor="description">
          どんな内容を調べたいか自由に書いてください(この内容をAIへの調査指示として使います)
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          required
          rows={4}
          placeholder="例: Claude CodeやAIコーディングツールを使ったWebサイト制作の最新事例・テクニックを知りたい"
          className="w-full rounded-lg border border-border bg-bg-surface px-3 py-2 outline-none focus:border-accent"
        />
      </div>

      <div>
        <p className="mb-2 text-sm text-text-muted">調べ方</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setSourceType("youtube_bilibili")}
            className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm ${
              sourceType === "youtube_bilibili" ? "border-accent bg-accent/10" : "border-border"
            }`}
          >
            <BarChart3 size={18} className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-medium">📊 再生数ランキングで調べる</span>
              YouTube/bilibili対応ジャンル向け
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSourceType("web_search_only")}
            className={`flex items-start gap-2 rounded-lg border p-3 text-left text-sm ${
              sourceType === "web_search_only" ? "border-accent bg-accent/10" : "border-border"
            }`}
          >
            <Newspaper size={18} className="mt-0.5 shrink-0" />
            <span>
              <span className="block font-medium">📰 最新ニュース・話題で調べる</span>
              ソフト/ツール系向け
            </span>
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-bg-page disabled:opacity-50"
      >
        {submitting ? "作成中…" : "追加する"}
      </button>
    </form>
  );
}
