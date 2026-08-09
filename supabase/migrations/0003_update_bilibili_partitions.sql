-- Fix: bilibili retired its legacy 分区 ids, so ranking/v2 was serving frozen data.
--
-- Verified live on 2026-08-09 against x/web-interface/ranking/v2?rid=<id>&type=all:
--   rid=3   (音乐)  -> every entry published ~494-554 days ago, 0/96 within 7 days
--   rid=4   (游戏)  -> every entry published ~494-499 days ago, 0/96 within 7 days
--   rid=119 (鬼畜)  -> code -352 (endpoint refuses the id outright)
-- The endpoint still returns code 0 for the music/game ids, so the pipeline treated
-- the stale payload as a success and never fell back — reports were built from
-- videos published in March 2025.
--
-- The replacement ids were identified by scanning rid 1000-1030 and reading the
-- `tname`/`tname_v2` of the returned videos:
--   1003 -> 音乐综合 / 翻唱 / VOCALOID·UTAU      (94/100 within 7 days)
--   1007 -> 鬼畜剧场 / 鬼畜调教 / 人力VOCALOID   (85/100 within 7 days)
--   1008 -> 单机游戏 / 手机游戏 / 网络游戏       (100/100 within 7 days)

update categories set bilibili_partition = 1003 where slug = 'song-covers' and bilibili_partition = 3;
update categories set bilibili_partition = 1007 where slug = 'meme'        and bilibili_partition = 119;
update categories set bilibili_partition = 1008 where slug = 'gaming'      and bilibili_partition = 4;
