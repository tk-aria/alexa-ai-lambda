#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"

echo "==> Packaging Lambda as ZIP..."

# Build if bootstrap doesn't exist
if [ ! -f "$DIST_DIR/bootstrap" ]; then
  bash "$SCRIPT_DIR/build.sh"
fi

# Create ZIP
cd "$DIST_DIR"
zip -j "$DIST_DIR/lambda.zip" bootstrap

echo "==> Package created: $DIST_DIR/lambda.zip"
ls -lh "$DIST_DIR/lambda.zip"
