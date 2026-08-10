import { z } from "zod";

const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),
  ANTHROPIC_MODEL: z.string().min(1).default("claude-sonnet-5"),
  // Web-search categories are the expensive path: search results are billed as input
  // tokens and re-charged across the server-side loop, so they dwarf the plain analysis
  // calls. Haiku 4.5 ($1/$5 per MTok) is half Sonnet 5's introductory rate and a third
  // of its list rate. Kept as its own variable so it can be reverted to
  // `claude-sonnet-5` from the Vercel dashboard without a redeploy if quality suffers.
  ANTHROPIC_WEB_SEARCH_MODEL: z.string().min(1).default("claude-haiku-4-5"),
  YOUTUBE_API_KEY: z.string().min(1),
  APP_PASSWORD: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  CRON_SECRET: z.string().min(1),
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().min(1),
});

type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/** Lazily validates process.env on first access so a missing var fails fast with a clear message. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(
      `Invalid/missing environment variables: ${parsed.error.issues
        .map((i) => i.path.join("."))
        .join(", ")}`
    );
  }
  cached = parsed.data;
  return cached;
}
