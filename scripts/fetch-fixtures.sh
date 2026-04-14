#!/usr/bin/env bash
# ============================================================
# Fetch test fixtures from the separate repo.
# Usage: bash scripts/fetch-fixtures.sh
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SC_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
FIXTURES_DIR="$SC_DIR/test-fixtures"
REPO_URL="https://github.com/Evol-ai/SkillCompass-test-fixtures.git"

if [ -d "$FIXTURES_DIR" ]; then
  echo "test-fixtures/ already exists. Pulling latest..."
  cd "$FIXTURES_DIR" && git pull origin main
else
  echo "Cloning test fixtures..."
  git clone "$REPO_URL" "$FIXTURES_DIR"
fi

echo "Done. Test fixtures available at $FIXTURES_DIR"
