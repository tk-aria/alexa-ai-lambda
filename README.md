# alexa-ai-lambda

AWS Lambda function for AI conversation via HTTP and Alexa, supporting both OpenAI and Anthropic API formats.

## Architecture

- **Lambda Function URL** (no API Gateway/ALB) for cost-effective HTTP endpoint
- Supports OpenAI Chat Completion and Anthropic Messages API formats
- Alexa skill integration for voice-based AI conversation
- Deployable via ZIP or Docker

## Endpoints

| Path | Method | Description |
|------|--------|-------------|
| `/` | GET | Health check |
| `/v1/chat/completions` | POST | OpenAI Chat Completion format |
| `/v1/messages` | POST | Anthropic Messages format |
| `/` | POST | Alexa skill (auto-detected) |

## Quick Start

### 1. Configure

```bash
cp terraform/terraform.tfvars.example terraform/terraform.tfvars
# Edit terraform.tfvars with your API keys
```

### 2. Deploy (ZIP)

```bash
npm run deploy:zip
```

### 3. Deploy (Docker)

```bash
npm run deploy:docker
```

### 4. Test

```bash
# Health check
curl https://YOUR_LAMBDA_URL/

# OpenAI format
curl -X POST https://YOUR_LAMBDA_URL/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"Hello"}]}'

# Anthropic format
curl -X POST https://YOUR_LAMBDA_URL/v1/messages \
  -H 'Content-Type: application/json' \
  -d '{"model":"claude-sonnet-4-20250514","messages":[{"role":"user","content":"Hello"}],"max_tokens":1024}'
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | Yes* | Anthropic API key |
| `OPENAI_API_KEY` | Yes* | OpenAI API key |
| `DEFAULT_MODEL` | No | Default model (default: claude-sonnet-4-20250514) |
| `ALEXA_SYSTEM_PROMPT` | No | System prompt for Alexa conversations |

*At least one API key is required.
