#!/usr/bin/env bash
set -euo pipefail

# Resolve the directory containing this script, regardless of where it's called from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "Installing marketplace-content..."
echo ""

echo "→ Removing node_modules..."
rm -rf node_modules

echo "→ Installing dependencies..."
npm install

echo ""
echo "→ Running setup (ClickUp token configuration)..."
npm run setup

echo ""
echo "✓ Installation complete."
