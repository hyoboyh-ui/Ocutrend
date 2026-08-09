"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ログインに失敗しました。");
        return;
      }
      router.push(searchParams.get("next") || "/");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="card-enter w-full max-w-sm rounded-2xl border border-border bg-bg-surface p-8 shadow-lg"
    >
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent/15 text-accent">
          <TrendingUp size={22} />
        </div>
        <h1 className="text-lg font-bold">Ocutrend</h1>
      </div>
      <label htmlFor="password" className="mb-1 block text-sm text-text-muted">
        パスワード
      </label>
      <input
        id="password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        className="mb-4 w-full rounded-lg border border-border bg-bg-page px-3 py-2 text-text-primary outline-none focus:border-accent"
      />
      {error && <p className="mb-4 text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-accent px-4 py-2 font-medium text-bg-page transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {loading ? "確認中…" : "ログイン"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-bg-page p-4">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
