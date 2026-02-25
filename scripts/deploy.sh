#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TF_DIR="$PROJECT_DIR/terraform"

DEPLOY_METHOD="${DEPLOY_METHOD:-zip}"

echo "============================================"
echo "  Deploying alexa-ai-lambda ($DEPLOY_METHOD)"
echo "============================================"

# Step 1: Package
if [ "$DEPLOY_METHOD" = "zip" ]; then
  echo ""
  echo "==> Step 1: Packaging as ZIP..."
  bash "$SCRIPT_DIR/package-zip.sh"
elif [ "$DEPLOY_METHOD" = "docker" ]; then
  echo ""
  echo "==> Step 1: Building and pushing Docker image..."
  bash "$SCRIPT_DIR/package-docker.sh"
fi

# Step 2: Terraform
echo ""
echo "==> Step 2: Running Terraform..."
cd "$TF_DIR"

# Init if needed
if [ ! -d ".terraform" ]; then
  terraform init
fi

# Plan and apply
terraform plan -var="deploy_method=${DEPLOY_METHOD}" -out=tfplan
terraform apply tfplan

# Step 3: Get output
echo ""
echo "==> Deployment complete!"
echo ""
FUNCTION_URL=$(terraform output -raw lambda_function_url 2>/dev/null || echo "N/A")
echo "Lambda Function URL: $FUNCTION_URL"
echo ""
echo "Test with:"
echo "  # Health check"
echo "  curl $FUNCTION_URL"
echo ""
echo "  # OpenAI format"
echo "  curl -X POST ${FUNCTION_URL}v1/chat/completions \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"model\":\"claude-sonnet-4-20250514\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}'"
echo ""
echo "  # Anthropic format"
echo "  curl -X POST ${FUNCTION_URL}v1/messages \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"model\":\"claude-sonnet-4-20250514\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}],\"max_tokens\":1024}'"
