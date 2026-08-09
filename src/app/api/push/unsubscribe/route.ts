import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const schema = z.object({ endpoint: z.string().url() });

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const supabase = createServerSupabaseClient();
  await supabase.from("push_subscriptions").delete().eq("endpoint", parsed.data.endpoint);
  return NextResponse.json({ ok: true });
}
