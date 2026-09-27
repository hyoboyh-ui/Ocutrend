import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken } from "@/lib/auth/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

export const config = {
  matcher: [
    // `api/context`（AI 向けの読み取り専用 API）はクッキーを持たないので除外し、
    // 代わりにルート側で OCUTREND_CONTEXT_TOKEN を検証する。
    "/((?!api/cron|api/auth|api/context|login|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons|illustrations).*)",
  ],
};

export async function proxy(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const authenticated = token ? await verifySessionToken(token) : false;

  if (!authenticated) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
