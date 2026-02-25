# Features TODO

## Alexa AI Lambda - 機能一覧・進捗管理

**Runtime: Rust** (lambda_http + reqwest + serde)

---

## Phase 1: コア機能

### 1.1 Lambda 関数本体 (`src/main.rs`)

- [x] リクエストルーティング
- [x] リクエストボディのパース (JSON)
- [x] Alexa リクエスト自動検出
- [x] エラーハンドリング
- [x] 構造化ログ (tracing + JSON)

### 1.2 AI チャット API (`src/ai_handler.rs`)

- [x] OpenAI Chat Completion 形式 (`POST /v1/chat/completions`)
- [x] Anthropic Messages 形式 (`POST /v1/messages`)
- [x] API フォーマット自動検出 (パス未指定時)
- [x] OpenAI → Anthropic バックエンド変換
- [x] Anthropic → OpenAI バックエンド変換
- [x] モデル名による自動バックエンド判定 (`gpt-*` → OpenAI, `claude-*` → Anthropic)
- [x] ヘルスチェックエンドポイント (`GET /`)
- [x] ストリーミングリクエスト拒否 (400)
- [x] 不正メソッド拒否 (405)
- [x] バリデーション (messages 必須チェック等)

### 1.3 型定義 (`src/models.rs`)

- [x] OpenAI リクエスト/レスポンス型
- [x] Anthropic リクエスト/レスポンス型
- [x] API ペイロード型 (送信用)

### 1.4 Alexa スキル対応 (`src/alexa_handler.rs`)

- [x] LaunchRequest ハンドリング (起動メッセージ)
- [x] ChatIntent - ユーザー発話をAIに送信
- [x] AMAZON.FallbackIntent 対応
- [x] AMAZON.HelpIntent 対応
- [x] AMAZON.StopIntent / AMAZON.CancelIntent 対応
- [x] SessionEndedRequest 対応
- [x] セッション内会話履歴保持 (最大10ターン)
- [x] Anthropic バックエンド呼び出し (Alexa用)
- [x] OpenAI バックエンド呼び出し (Alexa用)
- [x] 音声用システムプロンプト (簡潔な応答指示)
- [x] 日本語 / 英語レスポンス対応

### 1.5 Terraform インフラ構成

- [x] Lambda Function (ZIP デプロイ / `provided.al2023`)
- [x] Lambda Function (Docker デプロイ)
- [x] Lambda Function URL (HTTP エンドポイント)
- [x] IAM Role / Policy 定義
- [x] CloudWatch Log Group 定義
- [x] CORS 設定
- [x] 環境変数設定 (API キー, モデル, システムプロンプト)
- [x] 変数定義 (`variables.tf`)
- [x] 出力定義 (`outputs.tf`)
- [x] `terraform.tfvars.example` サンプル設定

### 1.6 デプロイ・パッケージング

- [x] Docker マルチステージビルド (`docker/Dockerfile`)
- [x] Docker ビルドスクリプト (`scripts/build.sh`)
- [x] ZIP パッケージングスクリプト (`scripts/package-zip.sh`)
- [x] Docker ビルド・ECR プッシュスクリプト (`scripts/package-docker.sh`)
- [x] 統合デプロイスクリプト (`scripts/deploy.sh`)

### 1.7 ドキュメント

- [x] README.md
- [x] SoW.md (Statement of Work)
- [x] features.md (本ファイル)

### 1.8 デプロイ実行

- [ ] AWS 認証情報の設定
- [ ] `terraform.tfvars` の作成 (API キー設定)
- [ ] `terraform apply` による AWS デプロイ
- [ ] Lambda Function URL の取得・動作確認
- [ ] エンドポイントテスト実行・全パス

---

## Phase 2: セキュリティ強化

- [ ] Lambda Function URL の IAM 認証有効化
- [ ] API キーを AWS Secrets Manager に移行
- [ ] リクエスト内トークン検証の追加
- [ ] レートリミットの実装
- [ ] 入力サニタイズ強化 (プロンプトインジェクション対策)

---

## Phase 3: 永続化・ステート管理

- [ ] DynamoDB テーブル作成 (Terraform)
- [ ] 会話履歴の DynamoDB 永続化
- [ ] セッション跨ぎの会話継続
- [ ] ユーザー別の会話管理
- [ ] 会話履歴の TTL (自動削除) 設定

---

## Phase 4: パフォーマンス改善

- [ ] Lambda Response Streaming 対応
- [ ] Provisioned Concurrency 設定 (コールドスタート対策)
- [ ] レスポンスキャッシュ (同一クエリの短期キャッシュ)
- [ ] Alexa レスポンス 8秒制限の最適化

---

## Phase 5: 運用・監視

- [ ] CloudWatch ダッシュボード作成 (Terraform)
- [ ] エラー率・レイテンシーアラート設定
- [ ] コストアラート設定 (AWS Budgets)
- [ ] 使用量メトリクス収集・可視化
- [x] ログの構造化 (JSON ログフォーマット) — tracing-subscriber json

---

## Phase 6: CI/CD

- [ ] GitHub Actions ワークフロー (テスト / cargo check)
- [ ] GitHub Actions ワークフロー (ZIP デプロイ)
- [ ] GitHub Actions ワークフロー (Docker デプロイ)
- [ ] ブランチ保護ルール・PR 必須設定
- [ ] 環境分離 (dev / staging / prod)

---

## Phase 7: 機能拡張

- [ ] Alexa からの利用モデル切り替え (音声コマンド)
- [ ] マルチターンコンテキスト長の動的調整
- [ ] 画像生成 API 対応 (DALL-E / Stable Diffusion)
- [ ] Alexa APL (Alexa Presentation Language) によるビジュアル応答
- [ ] カスタムドメイン設定 (Route 53 + Certificate Manager)
- [ ] Alexa Skills Kit への正式登録・公開

---

## Phase 8: 多言語・国際化

- [ ] レスポンス言語の自動検出強化
- [ ] Alexa 多言語スキル設定 (en-US, ja-JP, etc.)
- [ ] システムプロンプトの言語別テンプレート
- [ ] エラーメッセージの国際化
