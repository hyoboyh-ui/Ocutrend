import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { getEnv } from "@/lib/env";
import { createSessionToken } from "@/lib/auth/session";
import { isLoginRateLimited, recordLoginAttempt } from "@/lib/auth/rate-limit";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";

function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function getClientIdentifier(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  const identifier = getClientIdentifier(request);

  if (await isLoginRateLimited(identifier)) {
    return NextResponse.json(
      { ok: false, error: "試行回数が多すぎます。しばらくしてから再度お試しください。" },
      { status: 429 }
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const correct = constantTimeEquals(password, getEnv().APP_PASSWORD);

  await recordLoginAttempt(identifier, correct);

  if (!correct) {
    return NextResponse.json({ ok: false, error: "パスワードが違います。" }, { status: 401 });
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
