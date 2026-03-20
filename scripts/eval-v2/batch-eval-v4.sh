#!/usr/bin/env bash
# ============================================================
# Batch evaluation v4 — deterministic validators + LLM
# Runs D1/D2/D3 validators first, injects results into prompt
# ============================================================
set -euo pipefail

EVAL_DIR="${EVAL_DIR:-$HOME/eval-workspace}"
SKILLS_DIR="$EVAL_DIR/clawhub-skills"
SC_DIR="$EVAL_DIR/skill-compass"
RESULTS_TAG="${1:-v4}"
RESULTS_DIR="$EVAL_DIR/results-${RESULTS_TAG}"
MAX_PARALLEL="${2:-5}"

mkdir -p "$RESULTS_DIR/json" "$RESULTS_DIR/logs" "$RESULTS_DIR/timing" "$RESULTS_DIR/validators"

SKILL_SLUGS=($(ls "$SKILLS_DIR"))
TOTAL=${#SKILL_SLUGS[@]}

echo '======================================================='
echo "  SkillCompass — Batch Evaluation (${RESULTS_TAG})"
echo "  Skills: $TOTAL | Parallelism: $MAX_PARALLEL"
echo "  Mode: Deterministic validators + LLM"
echo '======================================================='
echo ''

START_ALL=$(date +%s)

eval_one() {
  local slug="$1"
  local skill_path="$SKILLS_DIR/$slug/SKILL.md"
  local result_file="$RESULTS_DIR/json/${slug}.json"
  local log_file="$RESULTS_DIR/logs/${slug}.log"
  local timing_file="$RESULTS_DIR/timing/${slug}.json"
  local validator_file="$RESULTS_DIR/validators/${slug}.json"

  local start_ts=$(date +%s%3N)

  # ---- Phase 1: Run deterministic validators ----
  local d1_result d2_result d3_result
  d1_result=$(node -e "
    const {StructureValidator} = require('$SC_DIR/lib/structure-validator.js');
    const r = new StructureValidator().validate('$skill_path');
    console.log(JSON.stringify(r));
  " 2>/dev/null || echo '{"score":5,"error":"validator_failed"}')

  d2_result=$(node -e "
    const {TriggerValidator} = require('$SC_DIR/lib/trigger-validator.js');
    const r = new TriggerValidator().validate('$skill_path');
    console.log(JSON.stringify(r));
  " 2>/dev/null || echo '{"score":5,"error":"validator_failed"}')

  d3_result=$(node -e "
    const {SecurityValidator} = require('$SC_DIR/lib/security-validator.js');
    const r = new SecurityValidator().validate('$skill_path');
    console.log(JSON.stringify(r));
  " 2>/dev/null || echo '{"score":5,"pass":true,"error":"validator_failed"}')

  # Save validator results
  echo "{\"slug\":\"$slug\",\"d1\":$d1_result,\"d2\":$d2_result,\"d3\":$d3_result}" > "$validator_file"

  # Extract scores for the prompt
  local d1_score d2_score d3_score d3_pass d1_issues d2_issues d3_findings
  d1_score=$(echo "$d1_result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).score||5))" 2>/dev/null || echo 5)
  d2_score=$(echo "$d2_result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).score||5))" 2>/dev/null || echo 5)
  d3_score=$(echo "$d3_result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).score||5))" 2>/dev/null || echo 5)
  d3_pass=$(echo "$d3_result" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).pass!==false))" 2>/dev/null || echo true)

  # Get issue summaries (truncated for prompt size)
  d1_issues=$(echo "$d1_result" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const r=JSON.parse(d);
      const issues=[];
      for(const [k,v] of Object.entries(r.checks||{})){
        (v.issues||[]).forEach(i=>issues.push('['+i.severity+'] '+i.description));
      }
      console.log(issues.slice(0,8).join('; ')||'No issues');
    });" 2>/dev/null || echo 'validator error')

  d3_findings=$(echo "$d3_result" | node -e "
    let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{
      const r=JSON.parse(d);
      const f=(r.findings||[]).map(f=>'['+f.severity+'] '+f.description);
      console.log(f.slice(0,8).join('; ')||'No findings');
    });" 2>/dev/null || echo 'validator error')

  # ---- Phase 2: LLM evaluation with validator results injected ----
  EVAL_PROMPT="You are running SkillCompass evaluation.

Working directory: $SC_DIR

Please evaluate the following skill using /eval-skill with --scope full --format json.

The skill is located at: $skill_path

## DETERMINISTIC VALIDATOR RESULTS (MANDATORY)

The following scores were produced by deterministic rule-based validators.
These are FLOOR scores — your final D1/D2/D3 scores MUST NOT be higher than these.
You MAY lower them further if you find additional issues the validators missed.

### D1 Structure (validator score: ${d1_score}/10)
Issues found: ${d1_issues}

### D2 Trigger (validator score: ${d2_score}/10)
(Validator checks trigger type detection, naming, description quality)

### D3 Security (validator score: ${d3_score}/10, pass: ${d3_pass})
Findings: ${d3_findings}
IMPORTANT: If validator found critical findings (pass=false), D3 pass MUST be false.

## EVALUATION INSTRUCTIONS

Steps:
1. Read the SkillCompass SKILL.md at $SC_DIR/SKILL.md to understand the framework
2. Read $skill_path to see the target skill
3. For D1/D2/D3: Start from the validator scores above. Only LOWER them if you find additional issues. Do NOT raise them.
4. For D4/D5/D6: Evaluate using the prompts in $SC_DIR/prompts/ (full LLM evaluation)
5. Use scoring formula from $SC_DIR/shared/scoring.md
6. Output ONLY the final JSON result

IMPORTANT: Output the JSON result and nothing else after the evaluation is complete.
The JSON must include: skill_name, overall_score, verdict, scores (structure/trigger/security/functional/comparative/uniqueness each with score, details), and weakest_dimension."

  claude -p "$EVAL_PROMPT" \
    --allowedTools "Read,Glob,Grep,Bash" \
    --max-turns 30 \
    > "$log_file" 2>&1

  local exit_code=$?
  local end_ts=$(date +%s%3N)
  local duration_ms=$((end_ts - start_ts))

  # Extract JSON result
  node -e "
    const fs = require('fs');
    const log = fs.readFileSync('$log_file', 'utf8');
    const jsonMatch = log.match(/\{[\s\S]*\"overall_score\"[\s\S]*\"verdict\"[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        fs.writeFileSync('$result_file', JSON.stringify(parsed, null, 2));
      } catch(e) {
        fs.writeFileSync('$result_file', JSON.stringify({error:'parse_failed',slug:'$slug'},null,2));
      }
    } else {
      fs.writeFileSync('$result_file', JSON.stringify({error:'no_json',slug:'$slug'},null,2));
    }
  " 2>/dev/null

  local log_bytes=$(wc -c < "$log_file" 2>/dev/null || echo 0)

  local has_score="false"
  local score=0
  if [ -f "$result_file" ] && grep -q overall_score "$result_file" 2>/dev/null; then
    has_score="true"
    score=$(node -e "console.log(JSON.parse(require('fs').readFileSync('$result_file','utf8')).overall_score)" 2>/dev/null || echo 0)
  fi

  cat > "$timing_file" << TJSON
{
  "slug": "$slug",
  "eval_duration_ms": $duration_ms,
  "eval_exit_code": $exit_code,
  "log_bytes": $log_bytes,
  "success": $has_score,
  "score": $score,
  "validator_scores": {"d1": $d1_score, "d2": $d2_score, "d3": $d3_score},
  "timestamp": "$(date -Iseconds)"
}
TJSON

  echo "  [$(date +%H:%M:%S)] $slug — score=$score (validators: d1=$d1_score d2=$d2_score d3=$d3_score) time=$((duration_ms/1000))s"
}

# Launch in parallel batches
RUNNING=0
for slug in "${SKILL_SLUGS[@]}"; do
  eval_one "$slug" &
  RUNNING=$((RUNNING + 1))

  if [ "$RUNNING" -ge "$MAX_PARALLEL" ]; then
    wait -n 2>/dev/null || wait
    RUNNING=$((RUNNING - 1))
  fi
done

wait

END_ALL=$(date +%s)
TOTAL_TIME=$((END_ALL - START_ALL))

SUCCESS=$(ls "$RESULTS_DIR/json/"*.json 2>/dev/null | xargs grep -l overall_score 2>/dev/null | wc -l)
FAIL=$((TOTAL - SUCCESS))

echo ''
echo '======================================================='
echo '  Evaluation Complete'
echo "  Total wall time: ${TOTAL_TIME}s"
echo "  Success: $SUCCESS | Failed: $FAIL"
echo "  Results: $RESULTS_DIR/json/"
echo '======================================================='
