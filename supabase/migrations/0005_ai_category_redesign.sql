-- AI category redesign: replace the paused web_search_only "AI関連" sub category
-- with 3 youtube_bilibili sub categories, dropping the ~10x-cost web-search path
-- entirely for AI content. See the 2026-08-14 plan
-- (C:\Users\hyobo\.claude\plans\ocutrend-ai-personalization.md) for the full rationale.

-- `search_queries`: when set, fetchYouTubeTrending issues one search.list call per
-- entry (each tagged with its own relevanceLanguage/regionCode) instead of the single
-- `search_query_hint` query. Existing categories leave this null and keep the
-- single-query path unchanged.
alter table categories add column search_queries jsonb;

-- `youtube_only`: when true, the pipeline skips bilibili entirely instead of falling
-- back to bilibili's cross-partition "popular" feed. The 3 new AI categories have no
-- bilibili equivalent (bilibili is a Chinese entertainment platform, not a venue for
-- Claude Code / local LLM / AI subtitle tool content), so that fallback would just
-- inject irrelevant items.
alter table categories add column youtube_only boolean not null default false;

-- Drop the old "AI tools" sub category. It was already paused (migration 0004) and
-- had no meaningful report history under the web_search_only path being replaced.
-- Cascades to its report_entries / report_metrics / favorites.
delete from categories where slug = 'ai-tools';

insert into categories
  (slug, name, group_type, description, search_query_hint, source_type, bilibili_partition, youtube_only, search_queries, sort_order, status)
values
(
  'claude-code-tips', 'Claude Code応用テクニック', 'sub',
  'Claude Codeの実践的な使い方・サブエージェント活用・hooksなど応用テクニックの最新情報を集める。',
  'Claude Code 使い方', 'youtube_bilibili', null, true,
  '[
    {"q": "Claude Code 使い方", "relevanceLanguage": "ja", "regionCode": "JP"},
    {"q": "Claude Code サブエージェント", "relevanceLanguage": "ja", "regionCode": "JP"},
    {"q": "Claude Code hooks", "relevanceLanguage": "ja", "regionCode": "JP"},
    {"q": "Claude Code tutorial", "relevanceLanguage": "en", "regionCode": "US"},
    {"q": "Claude Code tips and tricks", "relevanceLanguage": "en", "regionCode": "US"}
  ]'::jsonb,
  70, 'active'
),
(
  'ai-dev-local-llm', 'AI駆動開発・ローカルLLM活用', 'sub',
  'ローカルLLM(Ollama等)活用、vibe coding、MCP/エージェント構築など、AIを使った個人開発の最新情報を集める。',
  'Ollama 活用', 'youtube_bilibili', null, true,
  '[
    {"q": "Ollama 活用", "relevanceLanguage": "ja", "regionCode": "JP"},
    {"q": "個人開発 AI活用", "relevanceLanguage": "ja", "regionCode": "JP"},
    {"q": "Ollama tutorial local LLM", "relevanceLanguage": "en", "regionCode": "US"},
    {"q": "vibe coding workflow", "relevanceLanguage": "en", "regionCode": "US"},
    {"q": "MCP server tutorial", "relevanceLanguage": "en", "regionCode": "US"}
  ]'::jsonb,
  80, 'active'
),
(
  'ai-subtitle-translation', 'AI字幕・動画翻訳ツール', 'sub',
  'AIによる字幕自動生成・動画翻訳ツールの最新情報を集める。',
  'AI 字幕 自動生成', 'youtube_bilibili', null, true,
  '[
    {"q": "AI 字幕 自動生成", "relevanceLanguage": "ja", "regionCode": "JP"},
    {"q": "AI 動画翻訳", "relevanceLanguage": "ja", "regionCode": "JP"},
    {"q": "AI subtitle generator tool", "relevanceLanguage": "en", "regionCode": "US"},
    {"q": "AI video translation tool", "relevanceLanguage": "en", "regionCode": "US"}
  ]'::jsonb,
  90, 'active'
)
on conflict (slug) do nothing;
