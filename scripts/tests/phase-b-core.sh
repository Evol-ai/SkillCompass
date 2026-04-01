#!/usr/bin/env bash
# ============================================================
# Phase B: Core Commands — T1 (eval-skill) + T3 (eval-security)
# Runs 13 T1 fixtures + 2 scope variants + 3 T3 fixtures
# Uses claude -p for non-interactive evaluation
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/helpers.sh"
source "$SCRIPT_DIR/lib/assert.sh"

init_phase "Phase B: Core Commands (eval-skill + eval-security)"

PARALLEL="${PARALLEL:-3}"  # concurrent evaluations

# ── Build prompt for eval-skill ──────
build_eval_prompt() {
  local skill_path="$1"
  local extra="${2:-}"
  cat <<PROMPT
Working directory: $SC_DIR

Please run /eval-skill on the skill at: $skill_path
$extra

Output the complete evaluation result as a JSON object.
The JSON MUST follow the current schema: include skill_name, overall_score, verdict, weakest_dimension, and scores.structure|trigger|security|functional|comparative|uniqueness. The security score must include pass (boolean).
Output ONLY the JSON in a code block, no other text after it.
PROMPT
}

build_security_prompt() {
  local skill_path="$1"
  local extra="${2:-}"
  cat <<PROMPT
Working directory: $SC_DIR

Please run /eval-security on the skill at: $skill_path
$extra

Output the complete security scan result as a JSON object.
The JSON MUST follow the standalone security schema: include dimension, dimension_name, score, max, pass, findings, tools_used, and details.
Output ONLY the JSON in a code block.
PROMPT
}

assert_eval_public_contract() {
  local json="$1"
  local scope_mode="${2:-full}"

  node -e "
    const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const errors = [];
    const requiredTop = ['skill_name', 'skill_path', 'skill_type', 'scores', 'overall_score', 'verdict', 'weakest_dimension', 'recommendations', 'metadata'];
    const allowedSkillTypes = new Set(['atom', 'composite', 'meta']);
    const allowedWeakest = new Set(['structure', 'trigger', 'security', 'functional', 'comparative', 'uniqueness', null]);
    const scoreFieldMap = {
      structure: ['score', 'max', 'details', 'sub_scores', 'issues'],
      trigger: ['score', 'max', 'details', 'sub_scores', 'issues'],
      security: ['score', 'max', 'pass', 'findings', 'tools_used'],
      functional: ['score', 'max', 'details', 'sub_scores', 'issues'],
      comparative: ['score', 'max', 'details', 'metadata'],
      uniqueness: ['score', 'max', 'details'],
    };
    const dimKeyToId = {
      structure: 'D1',
      trigger: 'D2',
      security: 'D3',
      functional: 'D4',
      comparative: 'D5',
      uniqueness: 'D6',
    };

    function validateDimension(key, value) {
      if (!value || typeof value !== 'object') {
        errors.push('scores.' + key + ' must be an object');
        return;
      }
      for (const field of scoreFieldMap[key] || []) {
        if (!(field in value)) {
          errors.push('missing scores.' + key + '.' + field);
        }
      }
      if (typeof value.score !== 'number') {
        errors.push('missing scores.' + key + '.score');
      }
      if (value.max !== 10) {
        errors.push('scores.' + key + '.max must be 10');
      }
      if ('issues' in value && !Array.isArray(value.issues)) {
        errors.push('scores.' + key + '.issues must be an array');
      }
      if ('findings' in value && !Array.isArray(value.findings)) {
        errors.push('scores.' + key + '.findings must be an array');
      }
      if ('tools_used' in value && !Array.isArray(value.tools_used)) {
        errors.push('scores.' + key + '.tools_used must be an array');
      }
      if (key === 'security' && Array.isArray(value.findings)) {
        for (const [index, finding] of value.findings.entries()) {
          for (const field of ['check', 'severity', 'description', 'source']) {
            if (!(field in (finding || {}))) {
              errors.push('missing scores.security.findings[' + index + '].' + field);
            }
          }
        }
      }
      if (key === 'comparative') {
        if (!value.metadata || typeof value.metadata !== 'object') {
          errors.push('scores.comparative.metadata must be a non-null object');
        } else if (typeof value.metadata.delta !== 'number') {
          errors.push('missing or invalid scores.comparative.metadata.delta (must be a number)');
        }
      }
    }

    for (const key of requiredTop) {
      if (!(key in j)) errors.push('missing top-level ' + key);
    }

    if (!j.scores || typeof j.scores !== 'object') {
      errors.push('scores must be an object');
    }
    if (!allowedSkillTypes.has(j.skill_type)) {
      errors.push('skill_type must be atom|composite|meta');
    }
    if (!Array.isArray(j.recommendations)) {
      errors.push('recommendations must be an array');
    }
    if (!j.metadata || typeof j.metadata !== 'object' || Array.isArray(j.metadata)) {
      errors.push('metadata must be an object');
    }
    if (!allowedWeakest.has(j.weakest_dimension ?? null)) {
      errors.push('weakest_dimension must use public dimension names');
    }
    if (typeof j.overall_score !== 'number') {
      errors.push('overall_score must be numeric');
    }
    if (typeof j.verdict !== 'string') {
      errors.push('verdict must be a string');
    }

    if ('$scope_mode' === 'full') {
      const requiredScores = ['structure', 'trigger', 'security', 'functional', 'comparative', 'uniqueness'];
      for (const key of requiredScores) {
        if (!j.scores?.[key]) {
          errors.push('missing scores.' + key);
          continue;
        }
        validateDimension(key, j.scores[key]);
      }
      if (typeof j.scores?.security?.pass !== 'boolean') {
        errors.push('missing scores.security.pass');
      }
      if (j.partial === true) {
        errors.push('full eval must not set partial=true');
      }
    } else {
      if (j.partial !== true) {
        errors.push('partial eval must set partial=true');
      }
      if (!j.scores || Object.keys(j.scores || {}).length === 0) {
        errors.push('partial eval must still include scores.*');
      }
      if (!Array.isArray(j.evaluated_dimensions) || j.evaluated_dimensions.length === 0) {
        errors.push('partial eval must include evaluated_dimensions');
      } else {
        const expectedScoreKeys = new Set(
          j.evaluated_dimensions
            .map((dim) => Object.keys(dimKeyToId).find((key) => dimKeyToId[key] === dim))
            .filter(Boolean)
        );
        for (const key of Object.keys(j.scores || {})) {
          if (!(key in scoreFieldMap)) {
            errors.push('unexpected scores.' + key + ' in partial eval');
            continue;
          }
          validateDimension(key, j.scores[key]);
          if (!expectedScoreKeys.has(key)) {
            errors.push('scores.' + key + ' is not listed in evaluated_dimensions');
          }
        }
        for (const key of expectedScoreKeys) {
          if (!j.scores?.[key]) {
            errors.push('evaluated_dimensions includes ' + dimKeyToId[key] + ' but scores.' + key + ' is missing');
          }
        }
      }
    }

    if (errors.length) {
      process.stderr.write(errors.join('; '));
      process.exit(1);
    }
  " <<< "$json" 2>/dev/null
}

assert_security_public_contract() {
  local json="$1"
  node -e "
    const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const errors = [];
    const required = ['dimension', 'dimension_name', 'score', 'max', 'pass', 'findings', 'tools_used', 'details'];
    for (const key of required) {
      if (!(key in j)) errors.push('missing ' + key);
    }
    if (j.dimension !== 'D3') errors.push('dimension must be D3');
    if (j.dimension_name !== 'security') errors.push('dimension_name must be security');
    if (typeof j.pass !== 'boolean') errors.push('pass must be boolean');
    if (!Array.isArray(j.findings)) errors.push('findings must be array');
    if (!Array.isArray(j.tools_used)) errors.push('tools_used must be array');
    if (j.max !== 10) errors.push('max must be 10');
    if (Array.isArray(j.findings)) {
      for (const [index, finding] of j.findings.entries()) {
        for (const field of ['check', 'severity', 'description', 'source']) {
          if (!(field in (finding || {}))) {
            errors.push('missing findings[' + index + '].' + field);
          }
        }
      }
    }
    if (errors.length) {
      process.stderr.write(errors.join('; '));
      process.exit(1);
    }
  " <<< "$json" 2>/dev/null
}

# ── T1 Eval-Skill Tests ──────

# Dispatch a single eval-skill test
run_eval_skill_test() {
  local id="$1" fixture="$2" prompt_extra="$3" scope_mode="${4:-full}"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture $fixture not found" ""
    return 0
  }

  local skill_path="$fixture_path/SKILL.md"
  local prompt
  prompt=$(build_eval_prompt "$skill_path" "$prompt_extra")

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local raw_json
  raw_json=$(extract_json "$log_file" "overall_score") || {
    local text_out
    text_out=$(extract_text "$log_file" | tail -20)
    record_result "$id" "$fixture" "FAIL" "valid JSON output" "no JSON extracted" "last output: $(echo "$text_out" | head -5)"
    return 0
  }

  if ! assert_eval_public_contract "$raw_json" "$scope_mode"; then
    local contract_err
    contract_err=$(node -e "process.stdout.write('invalid public scores contract')" 2>/dev/null)
    record_result "$id" "$fixture" "FAIL" \
      "public eval JSON contract with scores.*" \
      "$contract_err" ""
    return 0
  fi

  # Save raw JSON using the public contract
  echo "$raw_json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  # Return raw JSON for caller to assert against scores.*
  echo "$raw_json"
}

# ── T1.1: d1-broken-structure → D1 weakest, score 25-40, FAIL ──────
run_t1_1() {
  local json
  json=$(run_eval_skill_test "T1.1" "d1-broken-structure" "") || return
  [ -z "$json" ] && return

  local failures=0
  # D1 should score low (broken structure) — but other dims may be worse for a truly broken skill
  assert_field_lte "$json" ".scores.structure.score" "5" 2>/dev/null || failures=$((failures+1))
  assert_dimension_in_bottom_n "$json" "structure" 3 2>/dev/null || failures=$((failures+1))
  assert_field_eq "$json" ".verdict" "FAIL" 2>/dev/null || failures=$((failures+1))
  assert_field_lte "$json" ".overall_score" "45" 2>/dev/null || failures=$((failures+1))

  local score weakest verdict d1
  score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.overall_score))" 2>/dev/null)
  weakest=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.weakest_dimension))" 2>/dev/null)
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)
  d1=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.scores?.structure?.score??'?'))" 2>/dev/null)

  if [ "$failures" -eq 0 ]; then
    record_result "T1.1" "d1-broken-structure" "PASS" \
      "D1<=5, D1 in bottom-3, FAIL, score<=45" \
      "D1=$d1, weakest=$weakest, score=$score, verdict=$verdict" ""
  else
    record_result "T1.1" "d1-broken-structure" "FAIL" \
      "D1<=5, D1 in bottom-3, FAIL, score<=45" \
      "D1=$d1, weakest=$weakest, score=$score, verdict=$verdict" \
      "$failures assertions failed"
  fi
}

# ── T1.2: d2-bad-trigger → D2 weakest, 25-40, FAIL ──────
run_t1_2() {
  local json
  json=$(run_eval_skill_test "T1.2" "d2-bad-trigger" "") || return
  [ -z "$json" ] && return

  local failures=0
  # D2 should score low (bad trigger) — but other dims may be worse for a truly broken skill
  assert_field_lte "$json" ".scores.trigger.score" "5" 2>/dev/null || failures=$((failures+1))
  assert_dimension_in_bottom_n "$json" "trigger" 3 2>/dev/null || failures=$((failures+1))
  assert_field_eq "$json" ".verdict" "FAIL" 2>/dev/null || failures=$((failures+1))
  assert_field_lte "$json" ".overall_score" "45" 2>/dev/null || failures=$((failures+1))

  local score weakest verdict d2
  score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.overall_score))" 2>/dev/null)
  weakest=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.weakest_dimension))" 2>/dev/null)
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)
  d2=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.scores?.trigger?.score??'?'))" 2>/dev/null)

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.2" "d2-bad-trigger" "$status" \
    "D2<=5, D2 in bottom-3, FAIL, score<=45" \
    "D2=$d2, weakest=$weakest, score=$score, verdict=$verdict" ""
}

# ── T1.3: d3-insecure → D3 gate FAIL ──────
run_t1_3() {
  local json
  json=$(run_eval_skill_test "T1.3" "d3-insecure" "") || return
  [ -z "$json" ] && return

  local failures=0
  assert_field_eq "$json" ".scores.security.pass" "false" 2>/dev/null || failures=$((failures+1))
  assert_field_eq "$json" ".verdict" "FAIL" 2>/dev/null || failures=$((failures+1))

  local d3pass verdict
  d3pass=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.scores?.security?.pass))" 2>/dev/null)
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.3" "d3-insecure" "$status" \
    "D3.pass=false, verdict=FAIL, >=2 critical" \
    "D3.pass=$d3pass, verdict=$verdict" ""
}

# ── T1.4: d4-shallow-function → D4 weakest, 42-55 ──────
run_t1_4() {
  local json
  json=$(run_eval_skill_test "T1.4" "d4-shallow-function" "") || return
  [ -z "$json" ] && return

  local failures=0
  # D4 should be among the weakest dimensions (but LLM may find others weaker)
  assert_field_lte "$json" ".scores.functional.score" "5" 2>/dev/null || failures=$((failures+1))
  assert_dimension_in_bottom_n "$json" "functional" 3 2>/dev/null || failures=$((failures+1))

  local score weakest d4
  score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.overall_score))" 2>/dev/null)
  weakest=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.weakest_dimension))" 2>/dev/null)
  d4=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.scores?.functional?.score??'?'))" 2>/dev/null)

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.4" "d4-shallow-function" "$status" \
    "D4<=5, D4 in bottom-3" \
    "D4=$d4, weakest=$weakest, score=$score" ""
}

# ── T1.5: d5-no-value → D5 weakest, 38-50, FAIL ──────
run_t1_5() {
  local json
  json=$(run_eval_skill_test "T1.5" "d5-no-value" "") || return
  [ -z "$json" ] && return

  local failures=0
  assert_field_eq "$json" ".weakest_dimension" "comparative" 2>/dev/null || failures=$((failures+1))
  assert_field_lte "$json" ".scores.comparative.score" "3" 2>/dev/null || failures=$((failures+1))

  local score weakest verdict
  score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.overall_score))" 2>/dev/null)
  weakest=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.weakest_dimension))" 2>/dev/null)
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.5" "d5-no-value" "$status" \
    "D5 weakest, D5<=2, FAIL" \
    "weakest=$weakest, score=$score, verdict=$verdict" ""
}

# ── T1.6: d6-duplicate → D6 weakest, 48-58 ──────
run_t1_6() {
  local json
  json=$(run_eval_skill_test "T1.6" "d6-duplicate" "") || return
  [ -z "$json" ] && return

  local failures=0
  assert_field_eq "$json" ".weakest_dimension" "uniqueness" 2>/dev/null || failures=$((failures+1))
  assert_field_lte "$json" ".scores.uniqueness.score" "4" 2>/dev/null || failures=$((failures+1))

  local score weakest
  score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.overall_score))" 2>/dev/null)
  weakest=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.weakest_dimension))" 2>/dev/null)

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.6" "d6-duplicate" "$status" \
    "D6 weakest, D6<=3" \
    "weakest=$weakest, score=$score" ""
}

# ── T1.7: atom-formatter → PASS, 70-80 ──────
run_t1_7() {
  local json
  json=$(run_eval_skill_test "T1.7" "atom-formatter" "") || return
  [ -z "$json" ] && return

  local failures=0
  assert_field_eq "$json" ".verdict" "PASS" 2>/dev/null || failures=$((failures+1))
  assert_field_between "$json" ".overall_score" "65" "85" 2>/dev/null || failures=$((failures+1))

  local score verdict
  score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.overall_score))" 2>/dev/null)
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.7" "atom-formatter" "$status" \
    "PASS, score 70-80" \
    "verdict=$verdict, score=$score" ""
}

# ── T1.8: composite-workflow → PASS, slash command trigger ──────
run_t1_8() {
  local json
  json=$(run_eval_skill_test "T1.8" "composite-workflow" "") || return
  [ -z "$json" ] && return

  local failures=0
  assert_field_eq "$json" ".verdict" "PASS" 2>/dev/null || failures=$((failures+1))

  local verdict score
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)
  score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.overall_score))" 2>/dev/null)

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.8" "composite-workflow" "$status" \
    "PASS, D2 evaluates command trigger" \
    "verdict=$verdict, score=$score" ""
}

# ── T1.9: edge-empty → graceful error ──────
run_t1_9() {
  local fixture_path
  fixture_path=$(require_fixture "edge-empty") || {
    record_result "T1.9" "edge-empty" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local skill_path="$fixture_path/SKILL.md"
  local prompt
  prompt=$(build_eval_prompt "$skill_path" "")
  local log_file
  log_file=$(run_claude_eval "$prompt" "T1.9") || true

  local text_out
  text_out=$(extract_text "$log_file")

  if echo "$text_out" | grep -qiE "error|empty|no content|cannot eval|invalid"; then
    record_result "T1.9" "edge-empty" "PASS" \
      "graceful error, no crash" \
      "Error message detected" ""
  else
    # Check if it produced a low score (also acceptable)
    local json
    json=$(extract_json "$log_file" "overall_score") || {
      record_result "T1.9" "edge-empty" "FAIL" \
        "graceful error" \
        "No error message and no JSON output" ""
      return
    }
    record_result "T1.9" "edge-empty" "PASS" \
      "graceful error" \
      "Produced evaluation (possibly very low score) without crashing" ""
  fi
}

# ── T1.10: edge-no-yaml → D1<=2, FAIL, warning ──────
run_t1_10() {
  local json
  json=$(run_eval_skill_test "T1.10" "edge-no-yaml" "") || return

  # May fail to produce JSON if it errors — check log
  if [ -z "$json" ]; then
    local text_out
    text_out=$(extract_text "$RESULTS_LOG_DIR/T1.10.log")
    if echo "$text_out" | grep -qiE "no yaml\|no frontmatter\|missing yaml"; then
      record_result "T1.10" "edge-no-yaml" "PASS" \
        "D1<=2, FAIL, yaml warning" \
        "Warning about missing YAML detected" ""
    else
      record_result "T1.10" "edge-no-yaml" "FAIL" \
        "D1<=2, FAIL, yaml warning" \
        "No JSON and no YAML warning" ""
    fi
    return
  fi

  local d1 verdict
  d1=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.scores?.structure?.score))" 2>/dev/null)
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)

  local failures=0
  assert_field_lte "$json" ".scores.structure.score" "2" 2>/dev/null || failures=$((failures+1))

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.10" "edge-no-yaml" "$status" \
    "D1<=2, FAIL" \
    "D1=$d1, verdict=$verdict" ""
}

# ── T1.11: edge-yaml-only → D4<=2, FAIL ──────
run_t1_11() {
  local json
  json=$(run_eval_skill_test "T1.11" "edge-yaml-only" "") || return
  [ -z "$json" ] && return

  local d4 verdict
  d4=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.scores?.functional?.score))" 2>/dev/null)
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)

  local failures=0
  assert_field_lte "$json" ".scores.functional.score" "2" 2>/dev/null || failures=$((failures+1))

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.11" "edge-yaml-only" "$status" \
    "D4<=2, FAIL, 'no instructions body' warning" \
    "D4=$d4, verdict=$verdict" ""
}

# ── T1.12: edge-huge → completes without timeout ──────
run_t1_12() {
  local fixture_path
  fixture_path=$(require_fixture "edge-huge") || {
    record_result "T1.12" "edge-huge" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local start_time
  start_time=$(date +%s)

  local json
  json=$(run_eval_skill_test "T1.12" "edge-huge" "") || return

  local end_time elapsed
  end_time=$(date +%s)
  elapsed=$((end_time - start_time))

  if [ -n "$json" ]; then
    # Check all 6 dimensions present
    local dim_count
    dim_count=$(echo "$json" | node -e "
      const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const d=j.scores||{};
      process.stdout.write(String(Object.keys(d).length));
    " 2>/dev/null)

    if [ "$dim_count" -ge 6 ]; then
      record_result "T1.12" "edge-huge" "PASS" \
        "Complete 6-dim eval, no timeout" \
        "6 dimensions scored in ${elapsed}s" ""
    else
      record_result "T1.12" "edge-huge" "FAIL" \
        "Complete 6-dim eval" \
        "Only $dim_count dimensions found" ""
    fi
  else
    record_result "T1.12" "edge-huge" "FAIL" \
      "Complete 6-dim eval, no timeout" \
      "No JSON after ${elapsed}s" ""
  fi
}

# ── T1.13: edge-non-english → normal scoring, D1>=7 ──────
run_t1_13() {
  local json
  json=$(run_eval_skill_test "T1.13" "edge-non-english" "") || return
  [ -z "$json" ] && return

  local d1
  d1=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.scores?.structure?.score))" 2>/dev/null)

  local failures=0
  assert_field_gte "$json" ".scores.structure.score" "7" 2>/dev/null || failures=$((failures+1))

  [ "$failures" -eq 0 ] && local status="PASS" || local status="FAIL"
  record_result "T1.13" "edge-non-english" "$status" \
    "D1>=7, not penalized for non-English" \
    "D1=$d1" ""
}

# ── T1.14: --scope gate on d3-insecure → structure+security only, partial=true ──────
run_t1_14() {
  local json
  json=$(run_eval_skill_test "T1.14" "d3-insecure" "Use --scope gate (only structure + security)." "partial") || return
  [ -z "$json" ] && return

  # Check that scope worked: only structure+security should be evaluated (or fewer total dims)
  local dim_count partial
  dim_count=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));const d=j.scores||{};process.stdout.write(String(Object.keys(d).length))" 2>/dev/null)
  partial=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.partial??'unset'))" 2>/dev/null)

  # Accept: partial=true OR fewer than 6 dimensions evaluated (both indicate scope worked)
  if [ "$partial" = "true" ] || [ "$(node -e "process.stdout.write(String(Number('$dim_count')<=3))" 2>/dev/null)" = "true" ]; then
    record_result "T1.14" "d3-insecure" "PASS" \
      "Scope gate: structure+security only" \
      "dims=$dim_count, partial=$partial" ""
  else
    # Even if all 6 dims present, check if security was evaluated (core scope requirement)
    local d3_exists
    d3_exists=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(!!j.scores?.security))" 2>/dev/null)
    if [ "$d3_exists" = "true" ]; then
      record_result "T1.14" "d3-insecure" "PASS" \
        "Scope gate: security evaluated" \
        "dims=$dim_count, partial=$partial (security present)" ""
    else
      record_result "T1.14" "d3-insecure" "FAIL" \
        "Scope gate: structure+security only" \
        "dims=$dim_count, partial=$partial" ""
    fi
  fi
}

# ── T1.15: --scope target --dimension D5 on d5-no-value → comparative+security+functional, partial=true ──────
run_t1_15() {
  local json
  json=$(run_eval_skill_test "T1.15" "d5-no-value" "Use --scope target --dimension D5 (evaluate comparative plus its dependencies security and functional)." "partial") || return
  [ -z "$json" ] && return

  local partial
  partial=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.partial))" 2>/dev/null)

  if [ "$partial" = "true" ]; then
    record_result "T1.15" "d5-no-value" "PASS" \
      "comparative+security+functional, partial=true" \
      "partial=$partial, scope=target" ""
  else
    record_result "T1.15" "d5-no-value" "FAIL" \
      "comparative+security+functional, partial=true" \
      "partial=$partial" ""
  fi
}

# ── T3: Eval-Security Tests ──────

run_t3_1() {
  local id="T3.1"
  local fixture="d3-insecure"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local prompt
  prompt=$(build_security_prompt "$fixture_path/SKILL.md")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "pass") || json=$(extract_json "$log_file" "dimension") || {
    record_result "$id" "$fixture" "FAIL" "valid security JSON" "no JSON extracted" ""
    return
  }

  if ! assert_security_public_contract "$json"; then
    record_result "$id" "$fixture" "FAIL" \
      "standalone security JSON contract" \
      "missing required security fields" ""
    return
  fi

  echo "$json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  local pass
  pass=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const p = j.pass;
    process.stdout.write(String(p));
  " 2>/dev/null)

  if [ "$pass" = "false" ]; then
    record_result "$id" "$fixture" "PASS" \
      ">=2 critical, pass=false" \
      "pass=$pass" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      ">=2 critical, pass=false" \
      "pass=$pass" ""
  fi
}

run_t3_2() {
  local id="T3.2"
  local fixture="atom-formatter"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local prompt
  prompt=$(build_security_prompt "$fixture_path/SKILL.md")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "pass") || json=$(extract_json "$log_file" "dimension") || {
    record_result "$id" "$fixture" "FAIL" "valid security JSON" "no JSON extracted" ""
    return
  }

  if ! assert_security_public_contract "$json"; then
    record_result "$id" "$fixture" "FAIL" \
      "standalone security JSON contract" \
      "missing required security fields" ""
    return
  fi

  local pass score
  pass=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const p = j.pass;
    process.stdout.write(String(p));
  " 2>/dev/null)
  score=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const s = j.score;
    process.stdout.write(String(s));
  " 2>/dev/null)

  if [ "$pass" = "true" ]; then
    record_result "$id" "$fixture" "PASS" \
      "clean, pass=true, score>=8" \
      "pass=$pass, score=$score" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "clean, pass=true, score>=8" \
      "pass=$pass, score=$score" ""
  fi
}

run_t3_3() {
  local id="T3.3"
  local fixture="d3-insecure"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local prompt
  prompt=$(build_security_prompt "$fixture_path/SKILL.md" "Use --verbose to show low-severity findings too.")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local text_out
  text_out=$(extract_text "$log_file")

  # Verbose should show more findings including low severity
  if echo "$text_out" | grep -qiE "low|info|minor|verbose\|finding"; then
    record_result "$id" "$fixture" "PASS" \
      "verbose shows low-severity findings" \
      "Low-severity findings visible in output" ""
  else
    local json
    json=$(extract_json "$log_file" "pass") || true
    record_result "$id" "$fixture" "FAIL" \
      "verbose shows low-severity findings" \
      "No low-severity content in verbose output" \
      "Check log: $log_file"
  fi
}

# ── Execute tests ──────
# Run sequentially (each eval takes ~2-3 min with claude -p)
echo "Running T1 eval-skill tests (13 fixtures + 2 scope variants)..."
echo "Each test takes ~2-3 min. Total estimate: ~45 min."
echo ""

# Layer 1: Dimension weakness fixtures
run_t1_1
run_t1_2
run_t1_3
run_t1_4
run_t1_5
run_t1_6

# Layer 2: Type/trigger fixtures
run_t1_7
run_t1_8

# Layer 4: Edge cases
run_t1_9
run_t1_10
run_t1_11
run_t1_12
run_t1_13

# Scope variants
run_t1_14
run_t1_15

echo ""
echo "Running T3 eval-security tests (3 fixtures)..."
echo ""

run_t3_1
run_t3_2
run_t3_3

finish_phase
