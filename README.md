# alexa-ai-lambda

AWS Lambda function for AI conversation via HTTP and Alexa, supporting both OpenAI and Anthropic API formats. Built with Rust.

## Architecture

- **Rust** binary on `provided.al2023` Lambda runtime
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

### 2. Build

```bash
# Build with Docker (recommended)
bash scripts/build.sh
```

### 3. Deploy (Docker)

```bash
DEPLOY_METHOD=docker bash scripts/deploy.sh
```

### 4. Deploy (ZIP)

```bash
DEPLOY_METHOD=zip bash scripts/deploy.sh
```

### 5. Test

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

## Development

### Prerequisites

- Rust 1.83+ (or Docker for containerized build)
- Terraform >= 1.0
- AWS CLI
- Docker

### Project Structure

```
alexa-ai-lambda/
├── Cargo.toml
├── src/
│   ├── main.rs            # Lambda handler & routing
│   ├── ai_handler.rs      # OpenAI/Anthropic API handling
│   ├── alexa_handler.rs   # Alexa voice conversation
│   └── models.rs          # Request/Response type definitions
├── docker/
│   └── Dockerfile          # Multi-stage Rust build
├── terraform/
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── scripts/
│   ├── build.sh            # Docker-based Rust build
│   ├── package-zip.sh      # ZIP packaging
│   ├── package-docker.sh   # Docker build & ECR push
│   └── deploy.sh           # Full deploy pipeline
└── docs/
    ├── SoW.md
    └── features.md
```
