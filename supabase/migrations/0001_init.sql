-- Ocutrend initial schema
create extension if not exists pgcrypto;

-- ---------- Categories ----------
create table categories (
  id                  uuid primary key default gen_random_uuid(),
  slug                text not null unique,
  name                text not null,
  group_type          text not null check (group_type in ('main','sub','custom')),
  description         text not null default '',
  search_query_hint   text not null default '',
  source_type         text not null check (source_type in ('youtube_bilibili','web_search_only')),
  bilibili_partition   int,
  status              text not null default 'active' check (status in ('active','paused')),
  sort_order          int not null default 0,
  consecutive_failures int not null default 0,
  muted_until         timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ---------- Weekly run (one row per calendar week, spans ALL categories) ----------
create table weekly_runs (
  id              uuid primary key default gen_random_uuid(),
  week_start      date not null,
  status          text not null default 'pending' check (status in ('pending','running','completed','completed_with_errors')),
  triggered_by    text not null default 'cron' check (triggered_by in ('cron','manual')),
  started_at      timestamptz,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (week_start)
);

-- ---------- Per-category report entry within a run ----------
create table report_entries (
  id                uuid primary key default gen_random_uuid(),
  weekly_run_id     uuid not null references weekly_runs(id) on delete cascade,
  category_id       uuid not null references categories(id) on delete cascade,
  status            text not null default 'pending'
                      check (status in ('pending','running','ok','error','fallback_used')),
  summary_text      text,
  pickups           jsonb not null default '[]',
  source_used       text check (source_used in ('youtube','bilibili','claude_web_search')),
  fallback_reason   text,
  raw_source_meta   jsonb,
  error_message     text,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (weekly_run_id, category_id)
);

-- ---------- Structured numeric metrics (kept separate so v2 graphing needs no migration) ----------
create table report_metrics (
  id                uuid primary key default gen_random_uuid(),
  report_entry_id   uuid not null references report_entries(id) on delete cascade,
  platform          text not null check (platform in ('youtube','bilibili','other')),
  item_title        text not null,
  item_url          text,
  view_count        bigint,
  like_count        bigint,
  comment_count     bigint,
  published_at      timestamptz,
  growth_rate       numeric,
  keywords          text[] not null default '{}',
  rank_in_pickups   int,
  created_at        timestamptz not null default now()
);
create index idx_report_metrics_entry on report_metrics (report_entry_id);
create index idx_report_metrics_platform_pub on report_metrics (platform, published_at);

-- ---------- Favorites ----------
create table favorites (
  id                uuid primary key default gen_random_uuid(),
  report_entry_id   uuid not null references report_entries(id) on delete cascade,
  pickup_ref        text not null,
  note              text,
  created_at        timestamptz not null default now(),
  unique (report_entry_id, pickup_ref)
);

-- ---------- Error log ----------
create table error_log (
  id            uuid primary key default gen_random_uuid(),
  category_id   uuid references categories(id) on delete set null,
  weekly_run_id uuid references weekly_runs(id) on delete set null,
  source        text not null,
  message       text not null,
  detail        jsonb,
  created_at    timestamptz not null default now()
);
create index idx_error_log_created_at on error_log (created_at desc);

-- ---------- Push subscriptions ----------
create table push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

-- ---------- App settings ----------
create table app_settings (
  key           text primary key,
  value         jsonb not null,
  updated_at    timestamptz not null default now()
);

-- ---------- Login attempts (simple rate limit for the shared-password gate) ----------
create table login_attempts (
  id            uuid primary key default gen_random_uuid(),
  identifier    text not null, -- client IP (best-effort; app is behind a single shared password, not per-user)
  succeeded     boolean not null,
  created_at    timestamptz not null default now()
);
create index idx_login_attempts_identifier_time on login_attempts (identifier, created_at desc);

-- ---------- Atomic upsert of a report entry + its metrics (delete-then-insert metrics) ----------
create or replace function persist_report_entry(
  p_report_entry_id uuid,
  p_status text,
  p_summary_text text,
  p_pickups jsonb,
  p_source_used text,
  p_fallback_reason text,
  p_raw_source_meta jsonb,
  p_metrics jsonb -- array of report_metrics rows (platform, item_title, item_url, view_count, like_count, comment_count, published_at, growth_rate, keywords, rank_in_pickups)
) returns void as $$
begin
  update report_entries
  set status = p_status,
      summary_text = p_summary_text,
      pickups = p_pickups,
      source_used = p_source_used,
      fallback_reason = p_fallback_reason,
      raw_source_meta = p_raw_source_meta,
      completed_at = now(),
      updated_at = now()
  where id = p_report_entry_id;

  delete from report_metrics where report_entry_id = p_report_entry_id;

  insert into report_metrics (
    report_entry_id, platform, item_title, item_url, view_count, like_count,
    comment_count, published_at, growth_rate, keywords, rank_in_pickups
  )
  select
    p_report_entry_id,
    (m->>'platform')::text,
    (m->>'item_title')::text,
    (m->>'item_url')::text,
    nullif(m->>'view_count','')::bigint,
    nullif(m->>'like_count','')::bigint,
    nullif(m->>'comment_count','')::bigint,
    nullif(m->>'published_at','')::timestamptz,
    nullif(m->>'growth_rate','')::numeric,
    coalesce((select array_agg(x) from jsonb_array_elements_text(m->'keywords') x), '{}'),
    nullif(m->>'rank_in_pickups','')::int
  from jsonb_array_elements(coalesce(p_metrics, '[]'::jsonb)) m;
end;
$$ language plpgsql;
