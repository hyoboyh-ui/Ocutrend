import "server-only";
import webpush from "web-push";
import { getEnv } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { CategoryRow } from "@/lib/supabase/types";
import { buildCategoryErrorPayload, buildReportReadyPayload, extractLeadSentence } from "./templates";

function configureWebPush() {
  const env = getEnv();
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
}

async function sendToAllSubscriptions(payload: { title: string; body: string; url: string }) {
  configureWebPush();
  const supabase = createServerSupabaseClient();
  const { data: subs } = await supabase.from("push_subscriptions").select("*");
  if (!subs || subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: unknown) {
        const statusCode = (err as { statusCode?: number })?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", sub.id);
        }
      }
    })
  );
}

export async function sendReportReadyPush(weeklyRunId: string): Promise<void> {
  const supabase = createServerSupabaseClient();
  const { data: entries } = await supabase
    .from("report_entries")
    .select("summary_text, status")
    .eq("weekly_run_id", weeklyRunId);

  const firstSummary = entries?.find((e) => e.summary_text)?.summary_text ?? "今週のリサーチが完了しました。";
  const errorCount = entries?.filter((e) => e.status === "error").length ?? 0;

  await sendToAllSubscriptions(buildReportReadyPayload(extractLeadSentence(firstSummary), errorCount));
}

export async function sendCategoryErrorPush(category: CategoryRow, message: string): Promise<void> {
  await sendToAllSubscriptions(buildCategoryErrorPayload(category.name, message));
}
