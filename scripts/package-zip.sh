#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DIST_DIR="$PROJECT_DIR/dist"
BUILD_DIR="$PROJECT_DIR/.build"

echo "==> Packaging Lambda as ZIP..."

# Clean
rm -rf "$BUILD_DIR" "$DIST_DIR"
mkdir -p "$BUILD_DIR" "$DIST_DIR"

# Copy source
cp -r "$PROJECT_DIR/src" "$BUILD_DIR/src"
cp "$PROJECT_DIR/package.json" "$BUILD_DIR/"
cp "$PROJECT_DIR/package-lock.json" "$BUILD_DIR/" 2>/dev/null || true

# Install production dependencies
cd "$BUILD_DIR"
npm install --production --no-optional 2>&1

# Create ZIP
cd "$BUILD_DIR"
zip -r "$DIST_DIR/lambda.zip" . -x "*.git*" "*.md" "terraform/*" "scripts/*" "docker/*" "dist/*" ".build/*"

echo "==> Package created: $DIST_DIR/lambda.zip"
ls -lh "$DIST_DIR/lambda.zip"
