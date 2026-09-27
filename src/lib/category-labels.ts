import type { GroupType } from "./supabase/types";

/** カテゴリのグループ名。画面と AI 向け API（/api/context）の両方がここを使う。 */
export const GROUP_LABELS: Record<GroupType, string> = {
  main: "メインカテゴリ",
  sub: "制作お役立ち",
  custom: "カスタム",
};
