#!/usr/bin/env bash
# ============================================================
# Batch evaluation of downloaded ClawHub skills
# Uses Claude Code in non-interactive mode (claude -p)
# ============================================================
set -euo pipefail

EVAL_DIR="${EVAL_DIR:-$HOME/eval-workspace}"
SKILLS_DIR="$EVAL_DIR/clawhub-skills"
RESULTS_DIR="$EVAL_DIR/results"
SC_DIR="$EVAL_DIR/skill-compass"

mkdir -p "$RESULTS_DIR/json" "$RESULTS_DIR/logs"

# Check Claude Code is available and authenticated
if ! command -v claude &>/dev/null; then
  echo "ERROR: Claude Code not found. Run codespace-setup.sh first."
  exit 1
fi

# Count skills
SKILL_DIRS=($(ls -d "$SKILLS_DIR"/*/SKILL.md 2>/dev/null | sort))
TOTAL=${#SKILL_DIRS[@]}

if [ "$TOTAL" -eq 0 ]; then
  echo "ERROR: No skills found in $SKILLS_DIR. Run download-skills.sh first."
  exit 1
fi

echo "═══════════════════════════════════════════════════════"
echo "  SkillCompass v2 — Batch Evaluation"
echo "  Skills: $TOTAL"
echo "  SkillCompass: $SC_DIR"
echo "═══════════════════════════════════════════════════════"
echo ""

# Mode selection
echo "Evaluation modes:"
echo "  1) Full (6 dimensions, ~3min/skill, ~$((TOTAL * 3))min total)"
echo "  2) Pilot (first 15 skills only, ~45min)"
echo "  3) Resume (skip already-evaluated skills)"
echo ""
read -p "Select mode [1/2/3]: " MODE
echo ""

case "$MODE" in
  2) MAX_SKILLS=15 ;;
  *) MAX_SKILLS=$TOTAL ;;
esac

SUCCESS=0
FAIL=0
SKIP=0
IDX=0

for skill_path in "${SKILL_DIRS[@]}"; do
  IDX=$((IDX + 1))
  if [ "$IDX" -gt "$MAX_SKILLS" ]; then
    break
  fi

  slug=$(basename "$(dirname "$skill_path")")
  result_file="$RESULTS_DIR/json/${slug}.json"

  # Resume mode: skip if result exists
  if [ "$MODE" = "3" ] && [ -f "$result_file" ]; then
    echo "[$IDX/$MAX_SKILLS] $slug — SKIP (already evaluated)"
    SKIP=$((SKIP + 1))
    continue
  fi

  echo "[$IDX/$MAX_SKILLS] $slug — evaluating..."

  # Build the evaluation prompt
  # We ask Claude to act as SkillCompass and evaluate the skill
  EVAL_PROMPT="You are running SkillCompass evaluation.

Working directory: $SC_DIR

Please evaluate the following skill using /eval-skill with --scope full --format json.

The skill is located at: $skill_path

Steps:
1. Read the SkillCompass SKILL.md at $SC_DIR/SKILL.md to understand the framework
2. Read $skill_path to see the target skill
3. Follow the eval-skill.md command procedure (load from $SC_DIR/commands/eval-skill.md)
4. Evaluate all 6 dimensions using the prompts in $SC_DIR/prompts/
5. Output ONLY the final JSON result (conforming to $SC_DIR/schemas/eval-result.json)

IMPORTANT: Output the JSON result and nothing else after the evaluation is complete.
The JSON must include: skill_name, overall_score, verdict, dimensions (D1-D6 with score, weight, details), and weakest_dimension."

  # Run evaluation via Claude Code non-interactive mode
  if claude -p "$EVAL_PROMPT" \
    --allowedTools "Read,Glob,Grep,Bash,WebSearch" \
    --max-turns 30 \
    > "$RESULTS_DIR/logs/${slug}.log" 2>&1; then

    # Extract JSON from output (find last JSON block)
    node -e "
      const fs = require('fs');
      const log = fs.readFileSync('$RESULTS_DIR/logs/${slug}.log', 'utf8');
      // Find JSON blocks in output
      const jsonMatch = log.match(/\{[\s\S]*\"overall_score\"[\s\S]*\"verdict\"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          fs.writeFileSync('$result_file', JSON.stringify(parsed, null, 2));
          console.log('  → Score: ' + parsed.overall_score + ' | Verdict: ' + parsed.verdict);
        } catch(e) {
          console.log('  → JSON parse error, saving raw log');
          fs.writeFileSync('$result_file', JSON.stringify({error:'parse_failed',slug:'$slug'},null,2));
        }
      } else {
        console.log('  → No JSON found in output, saving error marker');
        fs.writeFileSync('$result_file', JSON.stringify({error:'no_json',slug:'$slug'},null,2));
      }
    " 2>/dev/null

    if [ -f "$result_file" ] && grep -q "overall_score" "$result_file" 2>/dev/null; then
      SUCCESS=$((SUCCESS + 1))
    else
      FAIL=$((FAIL + 1))
    fi
  else
    echo "  → Claude Code error"
    echo "{\"error\":\"claude_error\",\"slug\":\"$slug\"}" > "$result_file"
    FAIL=$((FAIL + 1))
  fi

  # Rate limiting: pause between evaluations
  sleep 2
done

echo ""
echo "═══════════════════════════════════════════════════════
"
echo "  Batch Evaluation Complete"
echo "  Success: $SUCCESS | Failed: $FAIL | Skipped: $SKIP"
echo "  Results: $RESULTS_DIR/json/"
echo "  Logs:    $RESULTS_DIR/logs/"
echo ""
echo "  Next: node analyze-results.js"
echo "═══════════════════════════════════════════════════════"
