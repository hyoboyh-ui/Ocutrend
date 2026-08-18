// Hand-written types mirroring supabase/migrations/0001_init.sql.
// TODO: once a live Supabase project exists, replace with `supabase gen types typescript`
// output to keep this in sync automatically.

export type GroupType = "main" | "sub" | "custom";
export type SourceType = "youtube_bilibili" | "web_search_only";
export type CategoryStatus = "active" | "paused";

/** One search.list query for a category with multiple JP/EN queries (see search_queries). */
export interface YoutubeSearchQuery {
  q: string;
  relevanceLanguage: string;
  regionCode: string;
}

export interface CategoryRow {
  id: string;
  slug: string;
  name: string;
  group_type: GroupType;
  description: string;
  search_query_hint: string;
  source_type: SourceType;
  bilibili_partition: number | null;
  /** When set, fetchYouTubeTrending issues one search.list call per entry instead of the single search_query_hint query. */
  search_queries: YoutubeSearchQuery[] | null;
  /** When true, the pipeline skips bilibili entirely rather than falling back to its cross-partition "popular" feed. */
  youtube_only: boolean;
  /** When true, the pipeline skips YouTube entirely and uses bilibili alone. */
  bilibili_only: boolean;
  status: CategoryStatus;
  sort_order: number;
  consecutive_failures: number;
  muted_until: string | null;
  created_at: string;
  updated_at: string;
}

export type WeeklyRunStatus = "pending" | "running" | "completed" | "completed_with_errors";
export type TriggeredBy = "cron" | "manual";

export interface WeeklyRunRow {
  id: string;
  week_start: string;
  status: WeeklyRunStatus;
  triggered_by: TriggeredBy;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export type ReportEntryStatus = "pending" | "running" | "ok" | "error" | "fallback_used";
export type SourceUsed = "youtube" | "bilibili" | "claude_web_search";

export interface PickupItem {
  ref: string; // stable id, generated at write time — favorites reference this, not array index
  title: string;
  channelTitle?: string | null;
  platform: "youtube" | "bilibili" | "web";
  url: string | null;
  whyTrending: string;
  howToReplicate: string;
  viewCount?: number;
  publishedAt?: string;
}

export interface ReportEntryRow {
  id: string;
  weekly_run_id: string;
  category_id: string;
  status: ReportEntryStatus;
  summary_text: string | null;
  pickups: PickupItem[];
  source_used: SourceUsed | null;
  fallback_reason: string | null;
  raw_source_meta: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ReportMetricRow {
  id: string;
  report_entry_id: string;
  platform: "youtube" | "bilibili" | "other";
  item_title: string;
  item_url: string | null;
  view_count: number | null;
  like_count: number | null;
  comment_count: number | null;
  published_at: string | null;
  growth_rate: number | null;
  keywords: string[];
  rank_in_pickups: number | null;
  created_at: string;
}

export interface FavoriteRow {
  id: string;
  report_entry_id: string;
  pickup_ref: string;
  note: string | null;
  created_at: string;
}

export interface ErrorLogRow {
  id: string;
  category_id: string | null;
  weekly_run_id: string | null;
  source: string;
  message: string;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
}

export interface AppSettingRow {
  key: string;
  value: unknown;
  updated_at: string;
}
