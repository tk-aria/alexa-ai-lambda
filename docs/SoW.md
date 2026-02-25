# Statement of Work (SoW)

## Alexa AI Lambda - AI会話サービス

| 項目 | 内容 |
|------|------|
| プロジェクト名 | Alexa AI Lambda |
| バージョン | 1.0 |
| 作成日 | 2026-02-25 |
| ステータス | 実装完了 / デプロイ待ち |

---

## 1. プロジェクト概要

AWS Lambda 上で動作する AI 会話サービス。HTTP エンドポイント経由のテキストベース会話と、Amazon Alexa 経由の音声ベース会話の両方に対応する。OpenAI Chat Completion API 形式および Anthropic Messages API 形式の両方をサポートし、バックエンドの AI プロバイダを透過的に利用可能にする。

---

## 2. スコープ

### 2.1 対象範囲 (In Scope)

| # | 機能 | 説明 |
|---|------|------|
| 1 | OpenAI API 互換エンドポイント | `/v1/chat/completions` で OpenAI Chat Completion 形式のリクエスト/レスポンスを処理 |
| 2 | Anthropic API 互換エンドポイント | `/v1/messages` で Anthropic Messages 形式のリクエスト/レスポンスを処理 |
| 3 | API フォーマット自動変換 | OpenAI 形式 → Anthropic バックエンド、Anthropic 形式 → OpenAI バックエンドの自動変換 |
| 4 | モデル自動判定 | モデル名 (`gpt-*`, `claude-*` 等) から適切なバックエンドを自動選択 |
| 5 | Alexa スキル対応 | LaunchRequest, IntentRequest (ChatIntent, Help, Stop, Cancel), SessionEndedRequest を処理 |
| 6 | Alexa 会話履歴 | セッション内で最大10ターンの会話履歴を保持 |
| 7 | Terraform IaC | Lambda Function URL による HTTP エンドポイント構成 (API Gateway/ALB 不使用) |
| 8 | ZIP デプロイ | Node.js ランタイムを使用した ZIP パッケージデプロイ |
| 9 | Docker デプロイ | ECR イメージを使用したコンテナデプロイ |
| 10 | ヘルスチェック | `GET /` でサービスステータスとエンドポイント一覧を返却 |

### 2.2 対象外 (Out of Scope)

| # | 項目 | 理由 |
|---|------|------|
| 1 | ストリーミングレスポンス | Lambda Function URL ではストリーミングの完全サポートが困難 |
| 2 | 認証・認可 | Lambda Function URL は `NONE` 認証。必要に応じて後続フェーズで IAM 認証追加 |
| 3 | DynamoDB 永続化 | 会話履歴はセッション内のみ。永続化は後続フェーズ |
| 4 | Alexa Skills Kit 登録 | AWS 上の Alexa Skill 自体の登録・設定は手動作業 |
| 5 | CI/CD パイプライン | GitHub Actions 等の自動デプロイは後続フェーズ |
| 6 | カスタムドメイン | Lambda Function URL のデフォルトドメインを使用 |

---

## 3. アーキテクチャ

### 3.1 システム構成図

```
[クライアント/Alexa]
        │
        ▼
┌─────────────────────┐
│  Lambda Function URL │  ← API Gateway/ALB 不使用 (安価)
│  (HTTPS endpoint)    │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│   AWS Lambda         │
│   (Node.js 20.x)     │
│                       │
│  ┌─────────────────┐ │
│  │   index.js       │ │  ← リクエストルーティング
│  │   (Router)       │ │
│  └────┬────┬───────┘ │
│       │    │          │
│  ┌────▼─┐ ┌▼───────┐ │
│  │ AI   │ │ Alexa  │ │
│  │Handler│ │Handler │ │
│  └──┬───┘ └──┬─────┘ │
└─────┼────────┼───────┘
      │        │
      ▼        ▼
┌──────────┐ ┌──────────┐
│ Anthropic│ │ OpenAI   │
│ API      │ │ API      │
└──────────┘ └──────────┘
```

### 3.2 コンポーネント一覧

| コンポーネント | ファイル | 役割 |
|---------------|---------|------|
| Router | `src/index.js` | リクエスト種別 (Alexa/AI Chat) を判定しハンドラに振り分け |
| AI Handler | `src/ai-handler.js` | OpenAI/Anthropic 形式の処理、フォーマット変換、バックエンド呼び出し |
| Alexa Handler | `src/alexa-handler.js` | Alexa リクエスト処理、会話履歴管理、音声レスポンス生成 |

### 3.3 インフラストラクチャ

| リソース | 種別 | 説明 |
|----------|------|------|
| Lambda Function | `aws_lambda_function` | メイン関数 (256MB, 30秒タイムアウト) |
| Function URL | `aws_lambda_function_url` | HTTPS エンドポイント (認証なし, CORS 有効) |
| IAM Role | `aws_iam_role` | Lambda 基本実行ロール |
| CloudWatch Logs | `aws_cloudwatch_log_group` | ログ保持 14日間 |
| ECR Repository | 手動/スクリプト | Docker デプロイ時のみ |

---

## 4. API 仕様

### 4.1 ヘルスチェック

```
GET /
```

**レスポンス** (200):
```json
{
  "status": "ok",
  "service": "alexa-ai-lambda",
  "endpoints": {
    "openai": "/v1/chat/completions",
    "anthropic": "/v1/messages",
    "alexa": "/ (POST with Alexa request body)"
  }
}
```

### 4.2 OpenAI Chat Completion 形式

```
POST /v1/chat/completions
```

**リクエスト**:
```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "Hello"}
  ],
  "temperature": 0.7,
  "max_tokens": 1024
}
```

**レスポンス** (200):
```json
{
  "id": "chatcmpl-xxx",
  "object": "chat.completion",
  "created": 1700000000,
  "model": "claude-sonnet-4-20250514",
  "choices": [
    {
      "index": 0,
      "message": {"role": "assistant", "content": "Hello!"},
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 10,
    "completion_tokens": 5,
    "total_tokens": 15
  }
}
```

### 4.3 Anthropic Messages 形式

```
POST /v1/messages
```

**リクエスト**:
```json
{
  "model": "claude-sonnet-4-20250514",
  "messages": [
    {"role": "user", "content": "Hello"}
  ],
  "system": "You are a helpful assistant.",
  "max_tokens": 1024,
  "temperature": 0.7
}
```

**レスポンス** (200):
```json
{
  "id": "msg_xxx",
  "type": "message",
  "role": "assistant",
  "content": [{"type": "text", "text": "Hello!"}],
  "model": "claude-sonnet-4-20250514",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 10,
    "output_tokens": 5
  }
}
```

### 4.4 Alexa リクエスト

```
POST / (Alexa request body)
```

自動判定: `version`, `session`, `request.type` フィールドが存在する場合に Alexa リクエストとして処理。

---

## 5. 環境変数

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `ANTHROPIC_API_KEY` | *1 | - | Anthropic API キー |
| `OPENAI_API_KEY` | *1 | - | OpenAI API キー |
| `DEFAULT_MODEL` | No | `claude-sonnet-4-20250514` | デフォルト AI モデル |
| `ALEXA_SYSTEM_PROMPT` | No | (組み込みプロンプト) | Alexa 会話用システムプロンプト |

*1: 少なくとも1つの API キーが必要

---

## 6. デプロイ手順

### 6.1 前提条件

- AWS CLI 設定済み (認証情報)
- Terraform >= 1.0
- Node.js >= 18 (ZIP デプロイ時)
- Docker (Docker デプロイ時)

### 6.2 ZIP デプロイ

```bash
# 1. 設定ファイル作成
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# terraform.tfvars を編集し API キーを設定

# 2. デプロイ
npm run deploy:zip
```

### 6.3 Docker デプロイ

```bash
# 1. 設定ファイル作成
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# terraform.tfvars を編集 (deploy_method = "docker", ecr_image_uri を設定)

# 2. デプロイ
npm run deploy:docker
```

---

## 7. テスト

### 7.1 ローカルテスト

```bash
node scripts/test-local.js
```

| テストケース | 内容 |
|-------------|------|
| Health check GET / | ヘルスチェックの正常レスポンス |
| OpenAI format - missing messages | バリデーションエラー (400) |
| Anthropic format - missing messages | バリデーションエラー (400) |
| Alexa Launch Request | 起動レスポンスの正常生成 |
| Alexa Stop Intent | セッション終了レスポンス |
| Method not allowed PUT | 405 レスポンス |
| Streaming not supported | ストリーミング拒否 (400) |
| Unknown path | 不明パスのエラー (400) |

**結果**: 8/8 合格

### 7.2 エンドポイントテスト

```bash
LAMBDA_URL=https://xxx.lambda-url.ap-northeast-1.on.aws node scripts/test-endpoint.js
```

---

## 8. コスト見積

| リソース | 料金体系 | 概算 (月1万リクエスト想定) |
|----------|---------|--------------------------|
| Lambda | $0.20/100万リクエスト + コンピュート | ~$0.10 |
| Lambda Function URL | 無料 (Lambda 料金に含む) | $0.00 |
| CloudWatch Logs | $0.50/GB | ~$0.05 |
| **合計** | | **~$0.15/月** |

※ API Gateway ($3.50/100万リクエスト) や ALB ($16.20/月 固定) と比較して大幅にコスト削減

---

## 9. リスクと軽減策

| # | リスク | 影響度 | 軽減策 |
|---|--------|--------|--------|
| 1 | Lambda コールドスタート遅延 | 中 | Provisioned Concurrency の導入を検討 |
| 2 | 30秒タイムアウト超過 | 中 | max_tokens を制限、タイムアウト値の調整 |
| 3 | API キー漏洩 | 高 | 環境変数管理、AWS Secrets Manager への移行検討 |
| 4 | Alexa セッションタイムアウト | 低 | 8秒以内のレスポンスを目標、エラー時の再試行案内 |
| 5 | Function URL 認証なし | 中 | IAM 認証の有効化、またはリクエスト内のトークン検証を検討 |

---

## 10. 今後の拡張 (Phase 2 以降)

| # | 項目 | 説明 |
|---|------|------|
| 1 | DynamoDB 会話履歴永続化 | セッション跨ぎの会話継続 |
| 2 | ストリーミング対応 | Lambda Response Streaming を活用 |
| 3 | IAM 認証 | Function URL の認証有効化 |
| 4 | Secrets Manager 統合 | API キーのセキュア管理 |
| 5 | CI/CD パイプライン | GitHub Actions によるデプロイ自動化 |
| 6 | 複数モデル切り替え UI | Alexa から利用モデルを切り替え |
| 7 | 使用量モニタリング | CloudWatch ダッシュボード、コストアラート |
