#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Building Rust Lambda with Docker..."

docker build -t alexa-ai-lambda-builder -f "$PROJECT_DIR/docker/Dockerfile" "$PROJECT_DIR" 2>&1

echo "==> Extracting bootstrap binary..."
CONTAINER_ID=$(docker create alexa-ai-lambda-builder)
mkdir -p "$PROJECT_DIR/dist"
docker cp "$CONTAINER_ID:/var/runtime/bootstrap" "$PROJECT_DIR/dist/bootstrap"
docker rm "$CONTAINER_ID" > /dev/null

chmod +x "$PROJECT_DIR/dist/bootstrap"
ls -lh "$PROJECT_DIR/dist/bootstrap"
echo "==> Build complete."
