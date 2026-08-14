import type { RawMetricItem } from "../schemas";
import type { SourceUsed } from "@/lib/supabase/types";

export interface RawSourceData {
  items: RawMetricItem[];
  sourceUsed: SourceUsed;
  fallbackReason: string | null;
}

export class BilibiliEndpointError extends Error {}
export class YouTubeApiError extends Error {}
export class VoyageApiError extends Error {}
