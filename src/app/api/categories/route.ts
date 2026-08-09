import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from("categories").select("*").order("sort_order");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: data });
}

const createCategorySchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().min(1).max(2000),
  sourceType: z.enum(["youtube_bilibili", "web_search_only"]),
  searchQueryHint: z.string().max(200).optional(),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "category"}-${Date.now().toString(36)}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = createCategorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({
      slug: slugify(parsed.data.name),
      name: parsed.data.name,
      group_type: "custom",
      description: parsed.data.description,
      search_query_hint: parsed.data.searchQueryHint ?? "",
      source_type: parsed.data.sourceType,
      status: "active",
      sort_order: 100,
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data }, { status: 201 });
}
