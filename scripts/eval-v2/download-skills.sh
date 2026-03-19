#!/usr/bin/env bash
# ============================================================
# Download 45 sampled ClawHub skills for evaluation
# Uses `clawhub inspect --file` (no install, no code execution)
# AND `clawhub install` for full package (in isolated dir)
# ============================================================
set -euo pipefail

EVAL_DIR="${EVAL_DIR:-$HOME/eval-workspace}"
SKILLS_DIR="$EVAL_DIR/clawhub-skills"
FULL_DIR="$EVAL_DIR/clawhub-skills-full"
RESULTS_DIR="$EVAL_DIR/results"

mkdir -p "$SKILLS_DIR" "$FULL_DIR" "$RESULTS_DIR"

# All 45 sampled skill slugs
SKILLS=(
  # T1: Top 50 (5 skills)
  "notion"
  "mcporter"
  "self-improving"
  "model-usage"
  "ordercli"
  # T2: Rank 51-192 (15 skills)
  "capability-evolver"
  "browser-automation"
  "claw-shell"
  "clawdbot-filesystem"
  "agent-reach"
  "coding"
  "tencentcloud-lighthouse-skill"
  "sql-toolkit"
  "skill-scanner"
  "pdf-extract"
  "moltbook-interact"
  "powerpoint-pptx"
  "qveris"
  "ai-humanizer"
  "gcalcli-calendar"
  # T3: Rank 200+ (25 skills)
  "pr-reviewer"
  "docker"
  "devops"
  "quack-code-review"
  "openclaw-security-audit"
  "k8s"
  "explain-code"
  "python-dataviz"
  "security-audit-toolkit"
  "clean-code-review"
  "data-anomaly-detector"
  "shadcn-ui"
  "docker-compose"
  "agentic-security-audit"
  "kubectl"
  "personal-notes"
  "ai-seo-writer"
  "designer"
  "seo-content-writer"
  "seo-competitor-analysis"
  "iot"
  "meetings"
  "geo-optimization"
  "ui-ux-design"
  "homey-cli"
)

TIERS=(
  # T1
  "T1" "T1" "T1" "T1" "T1"
  # T2
  "T2" "T2" "T2" "T2" "T2" "T2" "T2" "T2" "T2" "T2" "T2" "T2" "T2" "T2" "T2"
  # T3
  "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3"
  "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3" "T3"
)

TOTAL=${#SKILLS[@]}
SUCCESS=0
FAIL=0

echo "═══════════════════════════════════════════════════════"
echo "  Downloading $TOTAL skills from ClawHub"
echo "═══════════════════════════════════════════════════════"
echo ""

# Phase A: Download SKILL.md only (safe, no execution)
echo "── Phase A: SKILL.md content (safe, read-only) ──"
echo ""

for i in "${!SKILLS[@]}"; do
  slug="${SKILLS[$i]}"
  tier="${TIERS[$i]}"
  num=$((i + 1))

  skill_dir="$SKILLS_DIR/$slug"
  mkdir -p "$skill_dir"

  printf "[%2d/%d] %-35s %s ... " "$num" "$TOTAL" "$slug" "$tier"

  # Get SKILL.md content
  if clawhub inspect "$slug" --file SKILL.md > "$skill_dir/SKILL.md" 2>/dev/null; then
    # Remove the "- Fetching skill" prefix line if present
    sed -i '1{/^- Fetching/d}' "$skill_dir/SKILL.md" 2>/dev/null || true

    # Get metadata
    clawhub inspect "$slug" --json 2>/dev/null | \
      grep -v "^- " | \
      node -e "
        let r='';
        process.stdin.on('data',d=>r+=d);
        process.stdin.on('end',()=>{
          try {
            const j=r.indexOf('{');
            const d=JSON.parse(r.slice(j));
            const meta={
              slug:'$slug',
              tier:'$tier',
              displayName:d.skill?.displayName||'$slug',
              installsCurrent:d.skill?.stats?.installsCurrent||0,
              installsAllTime:d.skill?.stats?.installsAllTime||0,
              downloads:d.skill?.stats?.downloads||0,
              stars:d.skill?.stats?.stars||0,
              owner:d.owner?.handle||'unknown',
            };
            require('fs').writeFileSync('$skill_dir/meta.json',JSON.stringify(meta,null,2));
          } catch(e) {}
        });
      " 2>/dev/null

    lines=$(wc -l < "$skill_dir/SKILL.md")
    echo "✓ ($lines lines)"
    SUCCESS=$((SUCCESS + 1))
  else
    echo "✗ FAILED"
    FAIL=$((FAIL + 1))
    echo "$slug" >> "$RESULTS_DIR/download-failures.txt"
  fi
done

echo ""
echo "Phase A complete: $SUCCESS success, $FAIL failed"
echo ""

# Phase B: Full package install (contains scripts, hooks, etc.)
echo "── Phase B: Full package install (sandboxed) ──"
echo "This downloads all skill files including scripts."
echo ""

read -p "Run full install? (y/N) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
  for i in "${!SKILLS[@]}"; do
    slug="${SKILLS[$i]}"
    num=$((i + 1))
    printf "[%2d/%d] %-35s ... " "$num" "$TOTAL" "$slug"

    if clawhub install "$slug" --dir "$FULL_DIR" --no-input 2>/dev/null; then
      echo "✓"
    else
      echo "✗ (SKILL.md-only fallback available)"
    fi
  done
  echo ""
  echo "Full packages saved to: $FULL_DIR"
else
  echo "Skipped. Using SKILL.md-only mode for evaluation."
fi

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Download Summary"
echo "  SKILL.md files: $SKILLS_DIR/{slug}/SKILL.md"
echo "  Full packages:  $FULL_DIR/{slug}/"
echo "  Metadata:       $SKILLS_DIR/{slug}/meta.json"
echo ""
echo "  Next: bash batch-eval.sh"
echo "═══════════════════════════════════════════════════════"
