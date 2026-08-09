-- Default categories (5 main + 2 sub), per grill-me spec.
-- bilibili_partition uses bilibili's tid (分区) values where a stable partition exists;
-- null means "no single partition fits" -> code falls back to the cross-partition
-- x/web-interface/popular endpoint instead of ranking/v2.
insert into categories (slug, name, group_type, description, search_query_hint, source_type, bilibili_partition, sort_order) values
('song-covers', '歌(中国語カバー曲)', 'main',
  'bilibiliで人気の中国語カバー曲・歌ってみた動画。なぜ伸びているか、選曲・アレンジ・サムネの傾向を分析する。',
  '中国語 カバー 歌ってみた OR 翻唱', 'youtube_bilibili', 3, 10),
('meme', 'ネタ・meme系', 'main',
  'ネタ動画・ミーム・鬼畜系コンテンツのトレンド。編集手法や小ネタの構造を分析する。',
  'ネタ動画 ミーム 面白い 鬼畜', 'youtube_bilibili', 119, 20),
('shorts', 'ショート動画系', 'main',
  'YouTube Shortsやbilibiliのショートフォームコンテンツのトレンド。フォーマット・構成・フックの作り方を分析する。',
  'ショート動画 shorts バズ', 'youtube_bilibili', null, 30),
('gaming', 'ゲーム(新作・実況)', 'main',
  '新作ゲームや伸びているゲーム実況のトレンド。実況の見せ方・編集の工夫を分析する。',
  '新作ゲーム 実況 プレイ動画', 'youtube_bilibili', 4, 40),
('freeform', 'その他自由入力', 'main',
  '上記に当てはまらない、今週なんとなく話題になっているジャンル全般を幅広く拾う。',
  '今週 話題 バズ 動画', 'youtube_bilibili', null, 50),
('photoshop-premiere', 'Photoshop/Premiere', 'sub',
  '直近1ヶ月のPhotoshop・Premiere Proの新機能・アップデート情報。公式リリースノート、解説動画、SNSでの話題を横断的に集める。',
  '', 'web_search_only', null, 60),
('ai-tools', 'AI関連', 'sub',
  '直近1ヶ月のAI動画生成・AIアニメ・Claude Codeなど生成AIツールの新機能・アップデート情報。',
  '', 'web_search_only', null, 70)
on conflict (slug) do nothing;

insert into app_settings (key, value) values
('research_schedule', '{"cron": "0 7 * * 1", "timezone": "Asia/Tokyo", "note": "毎週月曜 07:00 JST を既定とする。cron式はJST基準で解釈され、実際に判定されるのは曜日フィールドのみ(時刻はvercel.jsonの発火時刻が決める)"}')
on conflict (key) do nothing;
