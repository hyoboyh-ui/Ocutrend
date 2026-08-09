-- Fix: the weekly cron gate never matched, so the weekly research never ran.
--
-- `/api/cron/weekly-research` compares the schedule's day-of-week field against
-- `jstNow().getDay()` (JST), but the seeded value used the UTC day-of-week that
-- vercel.json fires on ("0" = Sunday 22:00 UTC). At that instant JST is already
-- Monday (getDay() === 1), so the gate always returned "not scheduled today".
--
-- The stored cron is JST-based; only its day-of-week field is enforced.

update app_settings
set value = '{"cron": "0 7 * * 1", "timezone": "Asia/Tokyo", "note": "毎週月曜 07:00 JST を既定とする。cron式はJST基準で解釈され、実際に判定されるのは曜日フィールドのみ(時刻はvercel.jsonの発火時刻が決める)"}'::jsonb
where key = 'research_schedule';
