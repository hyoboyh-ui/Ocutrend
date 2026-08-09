import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LOGIN_RATE_LIMIT_MAX_ATTEMPTS, LOGIN_RATE_LIMIT_WINDOW_MINUTES } from "./constants";

/** Returns true if `identifier` (client IP) has too many recent failed login attempts. */
export async function isLoginRateLimited(identifier: string): Promise<boolean> {
  const supabase = createServerSupabaseClient();
  const windowStart = new Date(Date.now() - LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();

  const { count, error } = await supabase
    .from("login_attempts")
    .select("id", { count: "exact", head: true })
    .eq("identifier", identifier)
    .eq("succeeded", false)
    .gte("created_at", windowStart);

  if (error) {
    // Fail open on infra hiccups rather than locking the owner out of their own app.
    return false;
  }
  return (count ?? 0) >= LOGIN_RATE_LIMIT_MAX_ATTEMPTS;
}

export async function recordLoginAttempt(identifier: string, succeeded: boolean): Promise<void> {
  const supabase = createServerSupabaseClient();
  await supabase.from("login_attempts").insert({ identifier, succeeded });
}
