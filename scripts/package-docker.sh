#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

AWS_REGION="${AWS_REGION:-ap-northeast-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"
ECR_REPO="${ECR_REPO:-alexa-ai-lambda}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"

echo "==> Building Docker image..."

# Create ECR repository if not exists
aws ecr describe-repositories --repository-names "$ECR_REPO" --region "$AWS_REGION" 2>/dev/null || \
  aws ecr create-repository --repository-name "$ECR_REPO" --region "$AWS_REGION"

# Login to ECR
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

# Build image
docker build -t "${ECR_REPO}:${IMAGE_TAG}" -f "$PROJECT_DIR/docker/Dockerfile" "$PROJECT_DIR"

# Tag and push
docker tag "${ECR_REPO}:${IMAGE_TAG}" "${ECR_URI}:${IMAGE_TAG}"
docker push "${ECR_URI}:${IMAGE_TAG}"

echo "==> Image pushed: ${ECR_URI}:${IMAGE_TAG}"
echo ""
echo "Use this URI in terraform.tfvars:"
echo "  ecr_image_uri = \"${ECR_URI}:${IMAGE_TAG}\""
