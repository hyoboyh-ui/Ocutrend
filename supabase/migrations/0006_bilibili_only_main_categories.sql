-- Drop YouTube from the 5 main trend categories: bilibili is the primary platform
-- (both the user's own focus and where research results actually cluster), so
-- YouTube's search.list quota and the extra Claude input tokens for a second
-- platform's items are no longer worth paying for there. The 3 AI sub categories
-- stay youtube_only (see migration 0005) — unaffected.

-- `bilibili_only`: mirrors `youtube_only` (0005) in the other direction. When true,
-- the pipeline skips YouTube entirely for this category instead of merging its
-- items in alongside bilibili's.
alter table categories add column bilibili_only boolean not null default false;

update categories
set bilibili_only = true
where slug in ('song-covers', 'meme', 'shorts', 'gaming', 'freeform');
