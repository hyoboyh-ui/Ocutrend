# Ocutrend

YouTube / bilibili の週刊トレンドをリサーチし、「なぜ伸びているか」「作り方」まで分析して提案する個人用PWA。

## セットアップ(初回のみ)

### 1. 必要なアカウント・APIキー

| サービス | 用途 | 取得先 |
|---|---|---|
| Supabase | DB(Postgres) | https://supabase.com でプロジェクト作成 |
| Anthropic | 分析・Web検索 | https://console.anthropic.com でAPIキー発行 |
| YouTube Data API v3 | トレンド動画取得 | https://console.cloud.google.com で有効化+APIキー発行 |
| Vercel | ホスティング・Cron | https://vercel.com でGitHubリポジトリをImport |
| Voyage AI(任意) | お気に入りベースのembeddingリランキング(段階2) | https://www.voyageai.com でアカウント作成+APIキー発行。未設定でも他機能に影響なし |

### 2. DBスキーマの適用

Supabaseプロジェクト作成後、SQL Editorで`supabase/migrations/`配下のファイルを番号順に実行し、最後に`seed.sql`を実行する。

### 3. 環境変数

`.env.local`(ローカル開発用、git管理外)を編集し、`NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` / `ANTHROPIC_API_KEY` / `YOUTUBE_API_KEY` / `APP_PASSWORD` を埋める。`SESSION_SECRET` / `CRON_SECRET` / VAPIDキーは生成済みのものがすでに入っている。

Vercelにデプロイする場合は、Vercelプロジェクトの Environment Variables に同じ内容を設定する(`CRON_SECRET` は Vercel Cron が自動的に `Authorization: Bearer <値>` ヘッダーとして送るための値としても使われる)。

### 4. ローカル動作確認

```bash
npm install
npm run dev
```

`http://localhost:3000` にアクセスし、`APP_PASSWORD` でログインできることを確認する。

## 運用

- 週次リサーチは Vercel Cron が毎日 22:00 UTC(=JST朝7時前後)に `/api/cron/weekly-research` を叩き、`app_settings.research_schedule` の設定に基づいて実際に実行するかを判定する(既定: 毎週月曜)。
- 各カテゴリは「カテゴリ管理」画面から個別に「今すぐリサーチ」で即時実行できる。
- バグ修正や機能追加は、このリポジトリで作業しているClaude Codeセッションに「pushして欲しい」と伝えるだけで、ビルドチェック→`main`へのpush→Vercel自動デプロイまで完了する。

## 開発コマンド

```bash
npm run dev      # 開発サーバー
npm run build    # 本番ビルド(型チェック含む)
npm run lint     # ESLint
npm run test     # vitest (パイプラインの純粋関数のユニットテスト)
npm run generate-icons  # public/icons/logo-source.svg からPWAアイコン一式を再生成
```
