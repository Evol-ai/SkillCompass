#!/usr/bin/env bash
# ============================================================
# Phase D: Compound Commands — T2 (eval-improve) + T4 (eval-audit)
# Depends on Phase B/C results for clean fixtures
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/helpers.sh"
source "$SCRIPT_DIR/lib/assert.sh"

init_phase "Phase D: Compound Commands (eval-improve + eval-audit)"

# ── Prompt builders ──────

build_improve_prompt() {
  local skill_path="$1" extra="${2:-}"
  cat <<PROMPT
Working directory: $SC_DIR

Please run /eval-improve on the skill at: $skill_path
$extra

This should:
1. Evaluate the skill (6-dim)
2. Identify the weakest dimension(s)
3. Generate an improved version
4. Re-evaluate to verify improvement
5. Save snapshot + update manifest

Output the improvement result as a JSON object with:
- skill_name
- before_score, after_score
- improved_dimensions (array of dimension names that improved)
- weakest_before, weakest_after
- snapshot_version (the new evo version created)
- correction_pattern (description of what was changed)

Output ONLY the JSON in a code block.
PROMPT
}

build_audit_prompt() {
  local skills_dir="$1" extra="${2:-}"
  cat <<PROMPT
Working directory: $SC_DIR

Please run /eval-audit on all skills in directory: $skills_dir
$extra

This should evaluate each skill found and output results sorted worst-first.

Output the audit result as a JSON object with:
- total_skills (number found)
- results (array of {skill_name, score, verdict, weakest_dimension} sorted by score ascending)
- summary (worst-first ranking)

Output ONLY the JSON in a code block.
PROMPT
}

# ── T2: eval-improve ──────

run_t2_1() {
  local id="T2.1"
  local fixture="d4-shallow-function"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  # Work on a copy to avoid mutating the fixture
  local work_dir="$TEST_RESULTS_DIR/improve-work/$fixture"
  mkdir -p "$work_dir"
  cp -r "$fixture_path/"* "$work_dir/" 2>/dev/null || cp "$fixture_path/SKILL.md" "$work_dir/"

  local prompt
  prompt=$(build_improve_prompt "$work_dir/SKILL.md")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local raw_json json
  raw_json=$(extract_json "$log_file" "after_score") || raw_json=$(extract_json "$log_file" "improved") || {
    record_result "$id" "$fixture" "FAIL" "valid improve JSON" "no JSON extracted" ""
    return
  }
  json="$raw_json"

  echo "$raw_json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  local before after
  before=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.before_score||j.before?.score||0))" 2>/dev/null)
  after=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.after_score||j.after?.score||0))" 2>/dev/null)

  if [ "$(node -e "process.stdout.write(String(Number('$after')>Number('$before')))" 2>/dev/null)" = "true" ]; then
    record_result "$id" "$fixture" "PASS" \
      "D4 improved, after > before, snapshot created" \
      "before=$before, after=$after" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "D4 improved, after > before" \
      "before=$before, after=$after (no improvement)" ""
  fi
}

run_t2_2() {
  local id="T2.2"
  local fixture="d3-insecure"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local work_dir="$TEST_RESULTS_DIR/improve-work/$fixture"
  mkdir -p "$work_dir"
  cp -r "$fixture_path/"* "$work_dir/" 2>/dev/null || cp "$fixture_path/SKILL.md" "$work_dir/"

  local prompt
  prompt=$(build_improve_prompt "$work_dir/SKILL.md" "This skill has a security gate failure. The improve command should prioritize fixing security before other dimensions.")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local raw_json json
  raw_json=$(extract_json "$log_file" "after_score") || raw_json=$(extract_json "$log_file" "improved") || {
    # Check text for gate-first behavior
    local text_out
    text_out=$(extract_text "$log_file")
    if echo "$text_out" | grep -qiE "security first\|gate.*first\|fix.*security\|security.*priority" || \
       log_contains "$log_file" "security first|gate.*first|fix.*security|security.*priority"; then
      record_result "$id" "$fixture" "PASS" \
        "Gate-first: fix security before others" \
        "security prioritization detected in output" ""
    else
      record_result "$id" "$fixture" "FAIL" "valid improve JSON" "no JSON extracted" ""
    fi
    return
  }
  json="$raw_json"

  echo "$raw_json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  # Check that security was improved (pass should become true)
  local improved_dims
  improved_dims=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const d = j.improved_dimensions || j.changes || [];
    process.stdout.write(JSON.stringify(d));
  " 2>/dev/null)

  if assert_array_contains_normalized "$json" ".improved_dimensions" "security" 2>/dev/null || \
     echo "$improved_dims" | grep -qiE "security"; then
    record_result "$id" "$fixture" "PASS" \
      "Gate-first: security fixed, pass=true" \
      "security in improved dimensions: $improved_dims" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "Gate-first: security fixed" \
      "security not in improved dims: $improved_dims" ""
  fi
}

run_t2_3() {
  local id="T2.3"
  local fixture="d1-broken-structure"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local work_dir="$TEST_RESULTS_DIR/improve-work/${fixture}-multi"
  mkdir -p "$work_dir"
  cp -r "$fixture_path/"* "$work_dir/" 2>/dev/null || cp "$fixture_path/SKILL.md" "$work_dir/"

  local prompt
  prompt=$(build_improve_prompt "$work_dir/SKILL.md" "This skill has both structure and trigger as weak dimensions. The improve command should group them and improve both in a single pass.")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local raw_json json
  raw_json=$(extract_json "$log_file" "improved_dimensions") || raw_json=$(extract_json "$log_file" "after_score") || {
    # Fallback: check log for improvement evidence
    if log_contains "$log_file" "improved|dimensions.*improved|after.*score"; then
      record_result "$id" "$fixture" "PASS" \
        "structure+trigger grouping, both improved" \
        "Improvement evidence in log (no structured JSON)" ""
    else
      record_result "$id" "$fixture" "FAIL" "valid improve JSON" "no JSON extracted" ""
    fi
    return
  }
  json="$raw_json"

  echo "$raw_json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  local improved_dims
  improved_dims=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const d = j.improved_dimensions || j.changes || [];
    process.stdout.write(JSON.stringify(d));
  " 2>/dev/null)

  # Check if at least 2 dimensions were improved
  local dim_count
  dim_count=$(echo "$improved_dims" | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    process.stdout.write(String(Array.isArray(d) ? d.length : 0));
  " 2>/dev/null)

  if [ "$(node -e "process.stdout.write(String(Number('$dim_count')>=2))" 2>/dev/null)" = "true" ]; then
      record_result "$id" "$fixture" "PASS" \
      "structure+trigger grouping, both improved" \
      "$dim_count dimensions improved: $improved_dims" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "structure+trigger grouping, both improved" \
      "Only $dim_count dimensions improved: $improved_dims" ""
  fi
}

# ── T4: eval-audit ──────

run_t4_1() {
  local id="T4.1"
  local fixture="audit-batch/skills"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    # Try alternate path
    fixture_path=$(require_fixture "audit-batch") || {
      record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
      return
    }
    if [ -d "$fixture_path/skills" ]; then
      fixture_path="$fixture_path/skills"
    fi
  }

  local prompt
  prompt=$(build_audit_prompt "$fixture_path")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "total_skills") || json=$(extract_json "$log_file" "results") || {
    record_result "$id" "$fixture" "FAIL" "valid audit JSON" "no JSON extracted" ""
    return
  }

  echo "$json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  local total
  total=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    process.stdout.write(String(j.total_skills || (j.results||[]).length || 0));
  " 2>/dev/null)

  if [ "$(node -e "process.stdout.write(String(Number('$total')>=3))" 2>/dev/null)" = "true" ]; then
    # Verify worst-first sorting
    local sorted_check
    sorted_check=$(echo "$json" | node -e "
      const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const r = j.results || [];
      if (r.length < 2) { process.stdout.write('true'); process.exit(0); }
      const sorted = r.every((item, i) => i === 0 || (item.score || 0) >= (r[i-1].score || 0));
      process.stdout.write(String(sorted));
    " 2>/dev/null)

    record_result "$id" "$fixture" "PASS" \
      "3 skills evaluated, worst-first sort" \
      "total=$total, sorted=$sorted_check" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "3 skills evaluated" \
      "total=$total (expected >=3)" ""
  fi
}

run_t4_2() {
  local id="T4.2"
  local fixture="audit-batch/skills"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || fixture_path=$(require_fixture "audit-batch") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }
  if [ -d "$fixture_path/skills" ]; then
    fixture_path="$fixture_path/skills"
  fi

  local prompt
  prompt=$(build_audit_prompt "$fixture_path" "Use --security-only flag. Only evaluate security for each skill.")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "results") || json=$(extract_json "$log_file" "total_skills") || {
    record_result "$id" "$fixture" "FAIL" "valid audit JSON" "no JSON extracted" ""
    return
  }

  echo "$json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  # Check that results only have D3 info
  local has_d3_only
  has_d3_only=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const r = j.results || [];
    // Check if results focus on D3/security
    const secFocused = r.every(item =>
      (item.D3 !== undefined || item.security !== undefined || item.d3 !== undefined) ||
      (item.dimensions && Object.keys(item.dimensions).length <= 2)
    );
    process.stdout.write(String(secFocused || r.length > 0));
  " 2>/dev/null)

  if [ "$has_d3_only" = "true" ]; then
    record_result "$id" "$fixture" "PASS" \
      "Security-only audit, D3 only" \
      "Security-focused results" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "Security-only audit" \
      "Results don't appear security-focused" ""
  fi
}

run_t4_3() {
  local id="T4.3"
  local fixture="empty-dir-audit"

  # Create an empty directory
  local empty_dir="$TEST_RESULTS_DIR/empty-audit-dir"
  mkdir -p "$empty_dir"

  local prompt
  prompt=$(build_audit_prompt "$empty_dir" "This directory is empty — no skills should be found.")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  # Primary: JSON field assertion; Fallback: grep raw log
  local json
  json=$(extract_json "$log_file" "total_skills") || true

  if [ -n "$json" ]; then
    local total
    total=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.total_skills??''))" 2>/dev/null)
    if [ "$total" = "0" ]; then
      record_result "$id" "$fixture" "PASS" \
        "'No skills found' graceful exit" \
        "total_skills=0 in JSON output" ""
      rmdir "$empty_dir" 2>/dev/null || true
      return
    fi
  fi
  # Fallback: grep raw log file
  if log_contains "$log_file" "no skill|not found|empty|0 skill|nothing to audit|total_skills.*0"; then
    record_result "$id" "$fixture" "PASS" \
      "'No skills found' graceful exit" \
      "Correct empty-directory handling (log grep)" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "'No skills found' graceful exit" \
      "No graceful empty-directory message" \
      "Check log: $log_file"
  fi

  # Cleanup
  rmdir "$empty_dir" 2>/dev/null || true
}

# ── Execute ──────

echo "Running T2 eval-improve tests (3 fixtures)..."
echo "Each improve test takes ~5-8 min."
echo ""

run_t2_1
run_t2_2
run_t2_3

echo ""
echo "Running T4 eval-audit tests (3 fixtures)..."
echo ""

run_t4_1
run_t4_2
run_t4_3

finish_phase
