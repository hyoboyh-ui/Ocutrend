-- Cost: switch off every web-search category.
--
-- `web_search_only` is by far the most expensive path in this app. Search results are
-- billed as input tokens AND re-charged on each inference of the server-side search
-- loop, so one such category cost roughly 10x a youtube_bilibili one — the three active
-- ones accounted for about two thirds of the weekly spend on their own. On top of the
-- tokens, each search carries a flat fee ($10 per 1,000 searches) that no model choice
-- reduces.
--
-- PAUSED, not deleted: getActiveCategories() filters on status = 'active', so paused
-- rows cost nothing, their past report_entries stay intact, and any of them can be
-- switched back on from the カテゴリ管理 screen without a deploy.
--
-- This covers all three: 'photoshop-premiere', 'ai-tools', and the user-added
-- 'AIアニメ' custom category.

update categories
set status = 'paused'
where source_type = 'web_search_only'
  and status = 'active';
