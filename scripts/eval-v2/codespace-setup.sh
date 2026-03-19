#!/usr/bin/env bash
# ============================================================
# SkillCompass v2 Evaluation — Codespace Setup
# Run this ONCE after opening the Codespace.
# ============================================================
set -euo pipefail

echo "═══════════════════════════════════════════════════════"
echo "  SkillCompass v2 — Codespace Environment Setup"
echo "═══════════════════════════════════════════════════════"

# 1. Check Node.js
echo ""
echo "[1/5] Checking Node.js..."
if command -v node &>/dev/null; then
  echo "  ✓ Node.js $(node --version)"
else
  echo "  ✗ Node.js not found. Installing..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# 2. Install clawhub CLI
echo ""
echo "[2/5] Installing clawhub CLI..."
if command -v clawhub &>/dev/null; then
  echo "  ✓ clawhub $(clawhub --cli-version 2>/dev/null || echo 'installed')"
else
  npm install -g clawhub
  echo "  ✓ clawhub installed"
fi

# 3. Install Claude Code
echo ""
echo "[3/5] Checking Claude Code..."
if command -v claude &>/dev/null; then
  echo "  ✓ Claude Code installed"
else
  echo "  Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code
  echo "  ✓ Claude Code installed"
  echo ""
  echo "  ⚠ You need to authenticate. Run:"
  echo "    claude login"
  echo "  Or set ANTHROPIC_API_KEY environment variable."
fi

# 4. Clone SkillCompass (if not already present)
echo ""
echo "[4/5] Setting up SkillCompass..."
EVAL_DIR="$HOME/eval-workspace"
mkdir -p "$EVAL_DIR"

if [ ! -d "$EVAL_DIR/skill-compass" ]; then
  echo "  Cloning SkillCompass..."
  git clone https://github.com/Evol-ai/SkillCompass.git "$EVAL_DIR/skill-compass"
else
  echo "  ✓ SkillCompass already present"
  cd "$EVAL_DIR/skill-compass" && git pull --ff-only 2>/dev/null || true
fi

# 5. Create evaluation workspace
echo ""
echo "[5/5] Creating evaluation workspace..."
SKILLS_DIR="$EVAL_DIR/clawhub-skills"
RESULTS_DIR="$EVAL_DIR/results"
mkdir -p "$SKILLS_DIR" "$RESULTS_DIR"

# Copy sample list and scripts
cp -f "$EVAL_DIR/skill-compass/scripts/download-skills.sh" "$EVAL_DIR/" 2>/dev/null || true
cp -f "$EVAL_DIR/skill-compass/scripts/batch-eval.sh" "$EVAL_DIR/" 2>/dev/null || true
cp -f "$EVAL_DIR/skill-compass/scripts/analyze-results.js" "$EVAL_DIR/" 2>/dev/null || true

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Workspace:    $EVAL_DIR"
echo "  Skills dir:   $SKILLS_DIR"
echo "  Results dir:  $RESULTS_DIR"
echo ""
echo "  Next steps:"
echo "    1. cd $EVAL_DIR"
echo "    2. bash download-skills.sh    # Download 45 skills"
echo "    3. bash batch-eval.sh         # Run evaluations"
echo "    4. node analyze-results.js    # Statistical analysis"
echo "═══════════════════════════════════════════════════════"
