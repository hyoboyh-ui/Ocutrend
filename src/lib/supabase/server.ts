import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getEnv } from "@/lib/env";

/**
 * Service-role Supabase client. Only ever import this from `app/api/**` route
 * handlers or other server-only code — the `server-only` import above makes
 * accidentally bundling it into a client component a build-time error, which
 * matters because this repo is public.
 */
export function createServerSupabaseClient() {
  const env = getEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}
