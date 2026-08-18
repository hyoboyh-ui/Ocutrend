-- Default categories (5 main + 2 sub), per grill-me spec.
--
-- bilibili_partition uses bilibili's tid (分区) values where a stable partition exists;
-- null means "no single partition fits" -> code falls back to the cross-partition
-- x/web-interface/popular endpoint instead of ranking/v2.
-- Use the 1000-range ids: the legacy ones (3=音乐, 4=游戏, 119=鬼畜) are retired and
-- ranking/v2 still answers code 0 for them while serving data frozen in March 2025.
-- See migration 0003 for how the replacements were verified.
--
-- The two `sub` categories are seeded as PAUSED. They use `web_search_only`, where
-- search results are billed as input tokens and re-charged across the server-side
-- search loop — roughly 10x the cost of a youtube_bilibili category, plus a flat
-- per-search fee. They are kept here so the capability stays discoverable and is one
-- toggle away on the カテゴリ管理 screen; enable them only if the spend is acceptable.
-- See migration 0004.
-- The 5 main categories are bilibili-first: `bilibili_only` skips YouTube's
-- search.list quota and the extra Claude input tokens for a second platform's items
-- entirely. See migration 0006 for the rationale.
insert into categories (slug, name, group_type, description, search_query_hint, source_type, bilibili_partition, bilibili_only, sort_order, status) values
('song-covers', '歌(中国語カバー曲)', 'main',
  'bilibiliで人気の中国語カバー曲・歌ってみた動画。なぜ伸びているか、選曲・アレンジ・サムネの傾向を分析する。',
  '中国語 カバー 歌ってみた OR 翻唱', 'youtube_bilibili', 1003, true, 10, 'active'),
('meme', 'ネタ・meme系', 'main',
  'ネタ動画・ミーム・鬼畜系コンテンツのトレンド。編集手法や小ネタの構造を分析する。',
  'ネタ動画 ミーム 面白い 鬼畜', 'youtube_bilibili', 1007, true, 20, 'active'),
('shorts', 'ショート動画系', 'main',
  'bilibiliのショートフォームコンテンツのトレンド。フォーマット・構成・フックの作り方を分析する。',
  'ショート動画 shorts バズ', 'youtube_bilibili', null, true, 30, 'active'),
('gaming', 'ゲーム(新作・実況)', 'main',
  '新作ゲームや伸びているゲーム実況のトレンド。実況の見せ方・編集の工夫を分析する。',
  '新作ゲーム 実況 プレイ動画', 'youtube_bilibili', 1008, true, 40, 'active'),
('freeform', 'その他自由入力', 'main',
  '上記に当てはまらない、今週なんとなく話題になっているジャンル全般を幅広く拾う。',
  '今週 話題 バズ 動画', 'youtube_bilibili', null, true, 50, 'active'),
('photoshop-premiere', 'Photoshop/Premiere', 'sub',
  '直近1ヶ月のPhotoshop・Premiere Proの新機能・アップデート情報。公式リリースノート、解説動画、SNSでの話題を横断的に集める。',
  '', 'web_search_only', null, 60, 'paused'),
('ai-tools', 'AI関連', 'sub',
  '直近1ヶ月のAI動画生成・AIアニメ・Claude Codeなど生成AIツールの新機能・アップデート情報。',
  '', 'web_search_only', null, 70, 'paused')
on conflict (slug) do nothing;

insert into app_settings (key, value) values
('research_schedule', '{"cron": "0 7 * * 1", "timezone": "Asia/Tokyo", "note": "毎週月曜 07:00 JST を既定とする。cron式はJST基準で解釈され、実際に判定されるのは曜日フィールドのみ(時刻はvercel.jsonの発火時刻が決める)"}')
on conflict (key) do nothing;
