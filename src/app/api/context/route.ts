import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { buildContextSnapshot, isPlainDate, SnapshotError } from "@/lib/context/snapshot";
import { supabaseReadPage } from "@/lib/context/source";

/**
 * GET /api/context — AI（Codex）向けの読み取り専用 API。
 *
 * ログインのクッキーではなく専用の合言葉（`OCUTREND_CONTEXT_TOKEN`）で通す。
 * proxy.ts でログインゲートから外してあるので、認証はここで完結させる。
 * 受け取る側に Supabase の管理用の鍵を渡さずに済ませるのが、この API の目的。
 *
 * 仕様と保証範囲は docs/context-api.md。
 */

const HEADERS = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex",
} as const;

/**
 * Vercel の関数が返せる大きさは約 4.5MB。レポートは週に 100KB ほど増えるので、
 * 全期間はいずれこれを超える。超えたら途中で切らずに、期間指定を促すエラーにする。
 */
const MAX_RESPONSE_BYTES = 4_000_000;

type ErrorCode =
  | "unauthorized"
  | "bad_request"
  | "not_found"
  | "method_not_allowed"
  | "too_large"
  | "server_error"
  | "incomplete"
  | "unstable";

function error(status: number, code: ErrorCode, message: string, extra?: HeadersInit) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status, headers: { ...HEADERS, ...extra } }
  );
}

/**
 * `getEnv()` を通さず直接読む。あのスキーマは全変数をまとめて検証するので、
 * ここに短すぎる値が入っていたときにアプリ全体を巻き込んで落ちる。
 * 未設定・空・32 文字未満は「窓口を閉じている」とみなす。
 */
function expectedToken(): string | null {
  const token = process.env.OCUTREND_CONTEXT_TOKEN?.trim();
  return token && token.length >= 32 ? token : null;
}

function tokenMatches(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const ALLOWED_PARAMS = new Set(["from", "to"]);

export async function GET(request: NextRequest) {
  const expected = expectedToken();
  if (!expected) return error(404, "not_found", "この窓口は現在使えません。");

  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!given || !tokenMatches(given, expected)) {
    return error(401, "unauthorized", "認証できません。", { "WWW-Authenticate": "Bearer" });
  }

  // 合言葉をクエリで渡す誤用もここで弾かれる。
  const params = request.nextUrl.searchParams;
  const unknown = [...new Set(params.keys())].filter((k) => !ALLOWED_PARAMS.has(k));
  if (unknown.length > 0) {
    return error(400, "bad_request", `対応していないパラメーターです: ${unknown.join(", ")}`);
  }
  for (const key of ALLOWED_PARAMS) {
    if (params.getAll(key).length > 1) return error(400, "bad_request", `${key} が複数あります。`);
  }
  const from = params.get("from");
  const to = params.get("to");
  for (const [key, value] of [["from", from], ["to", to]] as const) {
    if (value !== null && !isPlainDate(value)) {
      return error(400, "bad_request", `${key} は実在する YYYY-MM-DD で指定してください。`);
    }
  }
  if (from && to && from > to) return error(400, "bad_request", "from が to より後になっています。");

  try {
    const snapshot = await buildContextSnapshot(supabaseReadPage(), { range: { from, to } });
    const body = JSON.stringify(snapshot);
    if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) {
      return error(
        413,
        "too_large",
        "結果が大きすぎて一度に返せません。from / to で期間を分けて取得してください。"
      );
    }
    return new NextResponse(body, {
      headers: { ...HEADERS, "Content-Type": "application/json; charset=utf-8" },
    });
  } catch (e) {
    // 詳細はサーバーのログにだけ残す。応答には DB の内部情報を出さない。
    if (e instanceof SnapshotError) {
      console.error(`[api/context] ${e.code}: ${e.detail}`);
      if (e.code === "unstable") {
        return error(500, "unstable", "取得中にデータが更新されたため、全件をそろえられませんでした。少し待って再試行してください。");
      }
      if (e.code === "incomplete" || e.code === "integrity") {
        return error(500, "incomplete", "全件をそろえた状態で取得できませんでした。");
      }
      return error(500, "server_error", "データを取得できませんでした。");
    }
    console.error(`[api/context] unexpected: ${e instanceof Error ? e.message : String(e)}`);
    return error(500, "server_error", "サーバーの設定か取得処理に問題があります。");
  }
}

function methodNotAllowed() {
  return error(405, "method_not_allowed", "この窓口は GET のみ受け付けます。", { Allow: "GET" });
}

export const POST = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
