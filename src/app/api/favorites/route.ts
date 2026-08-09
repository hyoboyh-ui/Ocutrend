import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("favorites")
    .select("*, report_entries(*, categories(*), weekly_runs(*))")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorites: data });
}

const favoriteSchema = z.object({
  reportEntryId: z.string().uuid(),
  pickupRef: z.string().min(1),
  note: z.string().max(500).optional(),
});

export async function POST(request: NextRequest) {
  const parsed = favoriteSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("favorites")
    .upsert(
      { report_entry_id: parsed.data.reportEntryId, pickup_ref: parsed.data.pickupRef, note: parsed.data.note },
      { onConflict: "report_entry_id,pickup_ref" }
    )
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ favorite: data }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  const parsed = favoriteSchema.pick({ reportEntryId: true, pickupRef: true }).safeParse(
    await request.json().catch(() => null)
  );
  if (!parsed.success) return NextResponse.json({ error: parsed.error.message }, { status: 400 });

  const supabase = createServerSupabaseClient();
  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("report_entry_id", parsed.data.reportEntryId)
    .eq("pickup_ref", parsed.data.pickupRef);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
