# Ocutrend 読み取り専用 API（Codex 向け説明書）

Ocutrend の週次トレンドリサーチの結果・カテゴリ設定・お気に入りを、Codex が取得するための窓口です。
この説明書に秘密の値（合言葉・Supabase の鍵）は書いていません。

## 1. URL

```
GET https://ocutrend-sa2e.vercel.app/api/context
```

`ocutrend.vercel.app` ではありません（そちらは別物で 404 になります）。

## 2. 完了状況

| 段階 | 状況 |
|---|---|
| ローカル実装 | 完了（2026-09-27）。テスト（`npm run test`）・型チェック・lint・本番ビルドが通過 |
| 公開反映 | 完了（2026-09-27）。Vercel の本番に `OCUTREND_CONTEXT_TOKEN` を登録し、本番反映済み |
| 実接続確認 | 完了（2026-09-27）。本番 URL で、Windows のユーザー環境変数 `OCUTREND_CONTEXT_TOKEN` から合言葉を読んで取得できることを確認 |

利用できる状態です。Windows のユーザー環境変数は、登録より前に起動していたプログラムからは見えません。Codex が合言葉を読めない場合は、Codex を起動し直してください。

## 3. 認証

- ヘッダー `Authorization: Bearer <合言葉>` で送ります。
- 合言葉はサーバー側の環境変数 `OCUTREND_CONTEXT_TOKEN` に登録された値です。Tacotask・Taconote の合言葉とも、Supabase の鍵とも別の値です。
- Codex 側は、合言葉を **Windows のユーザー環境変数 `OCUTREND_CONTEXT_TOKEN`** から読み込んで使ってください。ソースコード・設定ファイル・ログ・出力には書かないでください。
- URL のクエリで合言葉を渡すことはできません（知らないパラメーターが付いていると 400 になります）。
- Supabase に直接つながないでください。作業フォルダの `.env.local` とその中の鍵は読まないでください。

PowerShell での取得例:

```powershell
$h = @{ Authorization = "Bearer $env:OCUTREND_CONTEXT_TOKEN" }
$r = Invoke-RestMethod -Uri "https://ocutrend-sa2e.vercel.app/api/context" -Headers $h
# 期間を指定する場合（週の開始日＝月曜で指定、両端を含む）
$r = Invoke-RestMethod -Uri "https://ocutrend-sa2e.vercel.app/api/context?from=2026-09-01&to=2026-09-30" -Headers $h
```

## 4. パラメーター（期間指定）

| 名前 | 形式 | 意味 |
|---|---|---|
| `from` | `YYYY-MM-DD` | この日以降に始まる週だけを返す（`weekly_runs.week_start >= from`） |
| `to` | `YYYY-MM-DD` | この日以前に始まる週だけを返す（`weekly_runs.week_start <= to`） |

- どちらも省略できます。両方省略すると全期間です。
- 期間で絞られるのは `weekly_runs` と、それにぶら下がる `report_entries` / `report_metrics` / `favorites` です。
- `categories` と `favorite_trend_summary` は、期間に関係なく常に全部返します。
- 同じパラメーターを 2 回付ける、実在しない日付、`from` が `to` より後、はすべて 400 です。
- **レポートは毎週 70〜100KB ずつ増えます（動いているカテゴリの数による）。** 全期間の結果が約 4MB を超えると 413（`too_large`）になるので、そのときは期間を分けて取得してください。

## 5. レスポンス

項目名は DB と同じ snake_case です（ただし最上位の管理項目と `definitions` は camelCase）。

```json
{
  "ok": true,
  "schemaVersion": 1,
  "generatedAt": "2026-09-28T12:00:00+09:00",
  "timezone": "Asia/Tokyo",
  "scope": {
    "type": "full",
    "from": null,
    "to": null,
    "rangeAppliesTo": "weekly_runs.week_start（両端を含む）",
    "alwaysFull": ["categories", "favorite_trend_summary"],
    "includesPausedCategories": true,
    "includesFailedEntries": true
  },
  "complete": true,
  "counts": { "categories": 10, "weekly_runs": 8, "report_entries": 59, "report_metrics": 647, "favorites": 3 },
  "categories": [ ... ],
  "weekly_runs": [ ... ],
  "report_entries": [ ... ],
  "report_metrics": [ ... ],
  "favorites": [ ... ],
  "favorite_trend_summary": { ... },
  "definitions": { ... }
}
```

期間を指定すると `scope.type` が `"range"` になり、`from` / `to` に指定値が入ります。

### categories（カテゴリ）

停止中も含めてすべて。並びは `sort_order` → `id` の昇順（アプリの表示順）。

| 項目 | 意味 |
|---|---|
| `id` / `slug` / `name` | カテゴリの ID・英字の識別名・表示名 |
| `group_type` | `main`（メインカテゴリ）/ `sub`（制作お役立ち）/ `custom`（本人が追加）。表示名は `definitions.groupTypes` |
| `description` | 調査の狙い。Claude への指示にも使われている文章 |
| `search_query_hint` | YouTube 検索の語句（`search_queries` が無いカテゴリで使う） |
| `source_type` | `youtube_bilibili`（再生数ランキングで調べる）/ `web_search_only`（Web 検索で調べる。費用が高いので現在は全部停止中） |
| `bilibili_partition` | bilibili の分区番号。`null` は分区を使わない |
| `search_queries` | YouTube で複数の語句を検索するカテゴリの語句一覧（`q` / `relevanceLanguage` / `regionCode`）。無ければ `null` |
| `youtube_only` | `true` なら YouTube だけを調べる（制作お役立ちの 3 カテゴリ） |
| `bilibili_only` | `true` なら bilibili だけを調べる（メインカテゴリ 5 つ） |
| `status` | `active`（毎週調べる）/ `paused`（停止中。費用はかからず、過去のレポートは残る） |
| `sort_order` | 表示順 |
| `created_at` / `updated_at` | 作成・最終更新の日時 |

### weekly_runs（週次実行）

並びは `week_start` → `id` の昇順。

| 項目 | 意味 |
|---|---|
| `id` | 週次実行の ID |
| `week_start` | その週の月曜日（日本時間）`YYYY-MM-DD`。1 週につき 1 行 |
| `status` | `pending` / `running` / `completed` / `completed_with_errors`（一部カテゴリが失敗） |
| `triggered_by` | `cron`（毎週月曜の自動実行）/ `manual`（画面の「今すぐリサーチ」でその週の行が初めて作られた） |
| `started_at` / `completed_at` / `created_at` | 開始・完了・作成の日時。未完了は `null` |

### report_entries（カテゴリごとの週次レポート）

返した週次実行に属するものだけ。並びは `created_at` → `id` の昇順。1 つの週 × 1 つのカテゴリにつき 1 行。

| 項目 | 意味 |
|---|---|
| `id` | レポートの ID |
| `weekly_run_id` | 週次実行の ID（必ず `weekly_runs` に含まれます） |
| `category_id` | カテゴリの ID（必ず `categories` に含まれます） |
| `status` | `ok` / `fallback_used`（片方のサイトが取れず、もう片方だけで分析した）/ `error`（失敗。`summary_text` と `pickups` は空）/ `pending` / `running` |
| `summary_text` | そのカテゴリの今週の傾向（Claude が書いた日本語）。失敗時は `null` |
| `pickups` | Claude が選んだ注目動画 3〜5 本（下記）。**保存されたまま**返します |
| `source_used` | `youtube` / `bilibili` / `claude_web_search` |
| `fallback_reason` | 片方のサイトが取れなかった理由（例: `bilibili_endpoint_failed`）。無ければ `null` |
| `error_message` | 失敗の理由。成功時は `null` |
| `started_at` / `completed_at` / `created_at` / `updated_at` | 日時 |

`pickups` の 1 件:

| 項目 | 意味 |
|---|---|
| `ref` | ピックアップの ID。`favorites.pickup_ref` がこれを指す |
| `title` | 動画タイトル（原語のまま、翻訳していない） |
| `channelTitle` | チャンネル名。**2026-08-14 以降のレポートにだけ**ある |
| `platform` | `youtube` / `bilibili` / `web` |
| `url` | 動画の URL。無ければ `null` |
| `whyTrending` | なぜ伸びているか（日本語） |
| `howToReplicate` | 作り方・編集手法・タイトルやサムネの傾向（日本語） |
| `viewCount` / `publishedAt` | 再生数・公開日時。**Claude が書き写した値で、形式は揃っていません**（`publishedAt` は UTC のことが多い）。正確な数値は `report_metrics` を使ってください |

### report_metrics（Claude に渡した候補動画の数値）

返したレポートに属するものだけ。レポートごとに最大 12 本（直近 10 日の動画から、伸びが速い順に選んだもの）。
並びは `report_entry_id` → `growth_rate` の降順（`null` は最後）→ `id`。

| 項目 | 意味 |
|---|---|
| `id` | 行の ID |
| `report_entry_id` | レポートの ID（必ず `report_entries` に含まれます） |
| `platform` | `youtube` / `bilibili` / `other` |
| `item_title` / `item_url` | 動画タイトル・URL |
| `view_count` / `like_count` / `comment_count` | 取得時点の再生数・いいね数・コメント数。不明は `null` |
| `published_at` | 公開日時（日本時間）。不明は `null` |
| `growth_rate` | 公開からの 1 時間あたり再生数（24 時間未満は 24 時間として計算）。ランキングの基準。不明は `null` |
| `created_at` | 記録した日時 |

ピックアップ（`pickups`）とこの表の行を結ぶ ID はありません。対応させるときは URL かタイトルで突き合わせてください。

### favorites（お気に入り）

返したレポートに属するものだけ。並びは `created_at` → `id` の昇順。

| 項目 | 意味 |
|---|---|
| `id` | お気に入りの ID |
| `report_entry_id` | レポートの ID（必ず `report_entries` に含まれます） |
| `pickup_ref` | お気に入りにしたピックアップの `ref` |
| `pickup` | そのピックアップの中身（`report_entries[].pickups` から写したもの）。**見つからなければ `null`** — 同じ週に「今すぐリサーチ」をやり直すとピックアップが作り直され、古いお気に入りが宙に浮くことがあるため |
| `note` | メモ。無ければ `null` |
| `created_at` | 登録した日時 |

### favorite_trend_summary（お気に入り傾向の月次要約）

毎月 1 日に、メインカテゴリのお気に入りから Claude が作る「本人の好みの傾向」。まだ無ければ `null`。

| 項目 | 意味 |
|---|---|
| `summary` | 要約本文（日本語）。週次分析のたびに Claude への指示に添えられている |
| `month_start` | 対象月の 1 日 `YYYY-MM-DD` |
| `generated_at` | 作成日時 |

### definitions（定義）

- `groupTypes` — `group_type` の表示名。アプリの画面と同じ定義（`src/lib/category-labels.ts`）を返しています
- `weekStartConvention` / `pickupsNote` — 上記の補足

## 6. 全件取得・削除・日時の扱い

### 全件取得

- サーバー内部でページングしています。表ごとの総数を確認し、総数に届くまで読みます。
- 期間を指定しても、サーバーは**全件を読んで検証してから**絞り込みます。
- `ok: true` と `complete: true` が返るのは、すべての表の取得と検証に成功したときだけです。一部の取得に失敗した場合は、空の配列で成功を装わず、必ずエラーを返します。
- 検証する内容: ID の重複／件数が総数と一致するか／関連先があるか（レポート → 週次実行・カテゴリ、候補動画 → レポート、お気に入り → レポート）／日付・日時の形式／数値の列が数値か／`pickups` が配列で `ref` が重複していないか

### 読み取り中の変更（一貫性の保証範囲）

表は別々の読み取りで取得しています。代わりに、**全部を 2 回続けて読み、中身が完全に一致したときだけ**返します。一致しなければ読み直し（最大 4 回）、それでも揃わなければ `unstable` を返します。

- **毎週月曜の朝 7 時ごろ（日本時間）は週次リサーチが数分間書き込み続けるため、`unstable` になりやすい時間帯です。** その時間は避けるか、少し待って再試行してください。
- 2 回の読み取りの間（通常 1〜2 秒）に変更が起きて、すぐ元に戻った場合は検知できません。

### 削除の扱い

前回取得したデータにあった ID が、**同じ範囲の**今回の結果に無ければ、削除されたものとして扱ってください。期間を変えて取得した結果どうしを比べて削除と判断しないでください。

| 表 | 今回の結果から消える理由 |
|---|---|
| categories | カテゴリが削除された。停止は削除ではなく、`status: "paused"` で返し続けます |
| weekly_runs | 通常は消えません |
| report_entries | カテゴリが削除された（レポートも一緒に消えます） |
| report_metrics | 同じ週に「今すぐリサーチ」をやり直した（その週・カテゴリの候補動画は作り直され、ID が変わります）、またはカテゴリが削除された |
| favorites | お気に入りが外された、またはカテゴリが削除された |

同じ週に「今すぐリサーチ」をやり直すと、`report_entries` の行は同じ ID のまま中身（`summary_text`・`pickups`）が上書きされます。

### 日時

- DB の日時の列は、すべて日本時間の ISO 8601 形式で返します。例: `2026-09-21T00:30:00.123+09:00`。精度はミリ秒までです。
- `week_start` と `month_start` は `YYYY-MM-DD` の日付のまま返します。
- **例外:** `pickups` の中身は保存されたまま返すので、その中の `publishedAt` は日本時間に直していません。
- `null` は `null` のまま返します。
- タイトル・分析文は、DB に保存されているとおりに返します。要約・推測・補正はしていません。

## 7. エラー

エラーはすべて次の形の JSON です。秘密の値や DB 内部の詳細は含みません。

```json
{ "ok": false, "error": { "code": "unauthorized", "message": "認証できません。" } }
```

| HTTP | `code` | 意味 | 対処 |
|---|---|---|---|
| 401 | `unauthorized` | 合言葉が無い、または違う | 環境変数 `OCUTREND_CONTEXT_TOKEN` を確認する。何度も試さない |
| 400 | `bad_request` | 対応していないパラメーター、日付の形式違い、`from` > `to` | パラメーターを直す |
| 404 | `not_found` | 窓口が意図的に閉じられている（サーバー側で合言葉が未設定） | 本人に知らせる |
| 405 | `method_not_allowed` | GET 以外のメソッドで呼んだ | GET で呼ぶ |
| 413 | `too_large` | 結果が大きすぎて一度に返せない | `from` / `to` で期間を分ける |
| 500 | `unstable` | 取得中にデータが更新され、全件を揃えられなかった | 少し待って再試行する（月曜朝は特に） |
| 500 | `incomplete` | 総数との不一致や関連先の欠落など、整合性を確認できなかった | 再試行し、続くようなら本人に知らせる |
| 500 | `server_error` | サーバーの設定不備、または取得失敗 | 再試行し、続くようなら本人に知らせる |

**エラーのときは、手元の資料を削除・更新しないでください。** 削除の判定に使ってよいのは、`ok: true` かつ `complete: true` の結果だけです。

## 8. 返さないもの

ログイン履歴、Web Push の購読情報、エラーログ、お気に入りの embedding（数値の並び）、アプリ内部の設定（リサーチの曜日設定）、カテゴリの連続失敗回数と通知の休止期限、`report_metrics` の `keywords`（常に空）と `rank_in_pickups`（ピックアップとは無関係に上から番号が振られているだけで、誤解を招くため）。

## 9. テスト結果と残っている制限

### テスト（2026-09-27）

- `npm run test`（`src/lib/context/snapshot.test.ts`、24 項目）— 偽物の DB で全項目合格。本番のデータには触れていません。
  - 停止中カテゴリ・失敗したレポートを返すこと、日本時間への変換、並び順
  - お気に入りにピックアップの中身を添えること、見つからないときは `null` にすること
  - お気に入り傾向の要約を返すこと、内部設定・返してはいけない列を含めないこと
  - 期間指定で関連する表を一緒に絞ること、カテゴリと要約は常に全部返すこと、両端を含むこと
  - 取得上限（1000 件）を超える 2,504 件を、サーバーの上限が 7 件でも全部返すこと
  - 取得失敗・総数との不一致・関連先の欠落 4 種・ID の重複・実在しない日付・`pickups` の破損 2 種・数値列の型違いが、すべてエラーになること
  - 読むたびに中身が変わると `unstable`、1 度だけ変わった場合は揃ったあとの内容を返すこと
  - 窓口のコードに DB への書き込み処理と `select("*")` が無いこと
- 自分の PC 上で本番 DB を読み取り、動作を確認しました。
  - 合言葉なし・違う合言葉 → 401。知らないパラメーター・実在しない日付・`from` > `to`・同じパラメーターの重複 → 400。POST・DELETE → 405
  - 正常時は 200 で、`Cache-Control: no-store` と `X-Robots-Tag: noindex` が付くこと
  - 全期間: カテゴリ 10・週次実行 8・レポート 59・候補動画 647・お気に入り 3、約 725KB、約 1.9 秒
  - `from=2026-09-21`: 週次実行 1・レポート 8・候補動画 96・お気に入り 0、約 117KB
  - 関連先がすべて揃っていること、お気に入り 3 件すべてにピックアップの中身が付くこと
  - 窓口を呼ぶ前と後で、10 の表（上記 5 表・エラーログ・アプリ設定・embedding・ログイン履歴・通知の購読）の件数と最終更新日時が変わっていないこと（書き込みが無いこと）
  - 応答にもサーバーのログにも合言葉が出ないこと
- 既存のアプリ: 未ログインのホームと既存 API はログイン画面へ転送されること。ログイン状態（手元で署名したクッキー）でホーム・カテゴリ・アーカイブ詳細が表示されること。ログインの操作そのものは本番のログイン履歴に記録が残るので行っていません
- 型チェック・lint・本番ビルドが通過
- 本番 URL での確認（2026-09-27）:
  - 合言葉を登録する前は 404（窓口が閉じていること）
  - 合言葉なし・違う合言葉 → 401。クエリ付き・実在しない日付 → 400。POST → 405
  - 正常時は 200・`Cache-Control: no-store`・`ok: true`・`complete: true`。件数はローカルでの確認と同じ（カテゴリ 10・週次実行 8・レポート 59・候補動画 647・お気に入り 3）、約 710KB、約 3 秒
  - `from=2026-09-21` で週次実行 1・レポート 8・候補動画 96
  - 応答に合言葉が含まれないこと
  - 呼ぶ前と後で、10 の表の件数と最終更新日時が変わっていないこと
  - 既存のアプリ: ログイン画面が 200、未ログインのホームと既存 API はログイン画面へ転送

### 残っている制限

- 一貫性は「2 回続けて同じ中身が読めたこと」で確認しています。瞬間の写しそのものは保証していません。
- 全期間の結果はいずれ約 4MB を超え、期間指定が必要になります（今のペースで 1 年前後先）。
- 差分取得（前回以降に変わったものだけ）には対応していません。
