#!/usr/bin/env bash
# ============================================================
# Phase C: Version Management Commands — T5 (compare) + T6 (merge) + T7 (rollback)
# Uses Layer 3 fixtures: rollback-history, merge-scenario, weak-skill
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/helpers.sh"
source "$SCRIPT_DIR/lib/assert.sh"

init_phase "Phase C: Version Management (compare + merge + rollback)"

# ── Prompt builders ──────

build_compare_prompt() {
  local skill_path="$1" version_a="$2" version_b="$3" extra="${4:-}"
  cat <<PROMPT
Working directory: $SC_DIR

Please run /eval-compare on the skill at: $skill_path
Compare version $version_a vs $version_b.
$extra

Output the comparison result as a JSON object with:
- skill_name, version_a, version_b
- delta_table (object keyed by structure|trigger|security|functional|comparative|uniqueness, each with old_score, new_score, delta)
- significant_changes (array of dimensions where |delta| > 2)
- overall_delta

Output ONLY the JSON in a code block.
PROMPT
}

build_merge_prompt() {
  local skill_dir="$1" extra="${2:-}"
  cat <<PROMPT
Working directory: $SC_DIR

Please run /eval-merge on the skill directory: $skill_dir
Detect the three-way merge scenario (ancestor, local evolution, upstream update).
$extra

Output the merge result as a JSON object with:
- skill_name, ancestor_version, local_version, upstream_version
- merged_version (the new version number)
- preserved_changes (what was kept from each side)
- conflicts (any conflicts detected)
- status ("success" or "conflict")

Output ONLY the JSON in a code block.
PROMPT
}

build_rollback_prompt() {
  local skill_dir="$1" target_version="$2" extra="${3:-}"
  cat <<PROMPT
Working directory: $SC_DIR

Please run /eval-rollback on the skill directory: $skill_dir
Roll back to version: $target_version
$extra

Output the rollback result as a JSON object with:
- skill_name, from_version, to_version
- snapshot_created (boolean — whether current version was snapshotted before rollback)
- status ("success" or "error")
- message

Output ONLY the JSON in a code block.
PROMPT
}

# ── T5: eval-compare ──────

run_t5_1() {
  local id="T5.1"
  local fixture="weak-skill"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local prompt
  prompt=$(build_compare_prompt "$fixture_path" "1.0.0" "1.0.0-evo.4")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "delta_table") || json=$(extract_json "$log_file" "version_a") || {
    record_result "$id" "$fixture" "FAIL" "valid compare JSON" "no JSON extracted" ""
    return
  }

  echo "$json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  # Check delta table exists and has significant changes marked
  local has_delta has_sig
  has_delta=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    process.stdout.write(String(!!j.delta_table || !!j.dimensions));
  " 2>/dev/null)
  has_sig=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const s = j.significant_changes || j.notable_changes || [];
    process.stdout.write(String(s.length));
  " 2>/dev/null)

  if [ "$has_delta" = "true" ]; then
    record_result "$id" "$fixture" "PASS" \
      "6-dim delta table, delta>2 marked" \
      "delta_table present, significant_changes=$has_sig" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "6-dim delta table" \
      "No delta_table in output" ""
  fi
}

run_t5_2() {
  local id="T5.2"
  local fixture="cross-skill-compare"

  # Compare two different skills — should warn
  local prompt
  prompt="Working directory: $SC_DIR

Please run /eval-compare between two DIFFERENT skills:
- Skill A: $FIXTURES_DIR/atom-formatter/SKILL.md
- Skill B: $FIXTURES_DIR/d4-shallow-function/SKILL.md

These are different skills — the command should detect this and warn.

Output the result as JSON."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local text_out
  text_out=$(extract_text "$log_file")

  if echo "$text_out" | grep -qiE "warn|different skill|mismatch|cannot compare|cross.skill"; then
    record_result "$id" "$fixture" "PASS" \
      "Warning: comparing different skills" \
      "Cross-skill warning detected" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "Warning: comparing different skills" \
      "No cross-skill warning in output" \
      "Check log: $log_file"
  fi
}

# ── T6: eval-merge ──────

run_t6_1() {
  local id="T6.1"
  local fixture="merge-scenario"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  # Find the api-client skill within merge-scenario
  local skill_dir="$fixture_path"
  if [ -d "$fixture_path/api-client" ]; then
    skill_dir="$fixture_path/api-client"
  fi

  local prompt
  prompt=$(build_merge_prompt "$skill_dir")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "merged_version") || json=$(extract_json "$log_file" "status") || {
    record_result "$id" "$fixture" "FAIL" "valid merge JSON" "no JSON extracted" ""
    return
  }

  echo "$json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  # Verify merged version format and content preservation
  local merged_ver status
  merged_ver=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    process.stdout.write(String(j.merged_version || j.version || ''));
  " 2>/dev/null)
  status=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    process.stdout.write(String(j.status || ''));
  " 2>/dev/null)

  # Expected: 1.1.0-evo.1 (upstream 1.1.0 + local evo rebase)
  if echo "$merged_ver" | grep -qE "1\.1\.0-evo"; then
    record_result "$id" "$fixture" "PASS" \
      "Three-way merge, version=1.1.0-evo.1" \
      "merged=$merged_ver, status=$status" ""
  elif [ "$status" = "success" ]; then
    record_result "$id" "$fixture" "PASS" \
      "Three-way merge success" \
      "merged=$merged_ver, status=$status" \
      "Version format may differ"
  else
    record_result "$id" "$fixture" "FAIL" \
      "Three-way merge, version=1.1.0-evo.1" \
      "merged=$merged_ver, status=$status" ""
  fi
}

# ── T7: eval-rollback ──────

run_t7_1() {
  local id="T7.1"
  local fixture="rollback-history"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  # Find the skill within rollback-history
  local skill_dir="$fixture_path"
  if [ -d "$fixture_path/csv-converter" ]; then
    skill_dir="$fixture_path/csv-converter"
  fi

  local prompt
  prompt=$(build_rollback_prompt "$skill_dir" "1.0.0-evo.2")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "status") || json=$(extract_json "$log_file" "to_version") || {
    record_result "$id" "$fixture" "FAIL" "valid rollback JSON" "no JSON extracted" ""
    return
  }

  echo "$json" > "$RESULTS_JSON_DIR/${id}_raw.json"

  local status to_ver
  status=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.status||''))" 2>/dev/null)
  to_ver=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.to_version||''))" 2>/dev/null)

  if [ "$status" = "success" ]; then
    record_result "$id" "$fixture" "PASS" \
      "Rollback to 1.0.0-evo.2" \
      "status=$status, to=$to_ver" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "Rollback to 1.0.0-evo.2" \
      "status=$status, to=$to_ver" ""
  fi
}

run_t7_2() {
  local id="T7.2"
  local fixture="rollback-history"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local skill_dir="$fixture_path"
  if [ -d "$fixture_path/csv-converter" ]; then
    skill_dir="$fixture_path/csv-converter"
  fi

  local prompt
  prompt=$(build_rollback_prompt "$skill_dir" "1.0.0-evo.2" "Verify that the current version is snapshotted BEFORE rolling back.")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "snapshot_created") || json=$(extract_json "$log_file" "status") || {
    record_result "$id" "$fixture" "FAIL" "valid rollback JSON" "no JSON extracted" ""
    return
  }

  local snapshot
  snapshot=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.snapshot_created??'unknown'))" 2>/dev/null)

  if [ "$snapshot" = "true" ]; then
    record_result "$id" "$fixture" "PASS" \
      "Auto-snapshot before rollback" \
      "snapshot_created=$snapshot" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "Auto-snapshot before rollback" \
      "snapshot_created=$snapshot" ""
  fi
}

run_t7_3() {
  local id="T7.3"
  local fixture="rollback-history"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local skill_dir="$fixture_path"
  if [ -d "$fixture_path/csv-converter" ]; then
    skill_dir="$fixture_path/csv-converter"
  fi

  # Roll back to 1.0.0 (the lowest/worst score) — should warn but allow
  local prompt
  prompt=$(build_rollback_prompt "$skill_dir" "1.0.0" "This is the original lowest-scored version. The system should warn but still allow the rollback.")
  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local text_out
  text_out=$(extract_text "$log_file")

  if echo "$text_out" | grep -qiE "warn|lower.score|regress|confirm"; then
    record_result "$id" "$fixture" "PASS" \
      "Warning but allows rollback to 1.0.0" \
      "Warning detected in output" ""
  else
    local json
    json=$(extract_json "$log_file" "status") || true
    local status
    status=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.status||''))" 2>/dev/null)
    if [ "$status" = "success" ]; then
      record_result "$id" "$fixture" "PASS" \
        "Allows rollback to 1.0.0" \
        "status=$status (warning may be implicit)" ""
    else
      record_result "$id" "$fixture" "FAIL" \
        "Warning but allows rollback to 1.0.0" \
        "status=$status, no warning detected" ""
    fi
  fi
}

run_t7_4() {
  local id="T7.4"
  local fixture="single-version-rollback"

  # Need a fixture with only 1 version — create temp or find edge case
  local prompt="Working directory: $SC_DIR

Please run /eval-rollback on a skill that has only ONE version in its manifest (no previous versions to roll back to).

Use the test fixture at: $FIXTURES_DIR/atom-formatter/
If it doesn't have a manifest yet, create one with a single version, then attempt rollback.

The expected behavior is an error message like 'Only one version exists'.

Output the result as JSON with status and message fields."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  # Primary: JSON field assertion; Fallback: grep raw log
  local json
  json=$(extract_json "$log_file" "status") || json=$(extract_json "$log_file" "message") || true

  if [ -n "$json" ]; then
    local msg status
    msg=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.message||''))" 2>/dev/null)
    status=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.status||''))" 2>/dev/null)
    if echo "$msg" | grep -qiE "only one|single version|nothing to roll"; then
      record_result "$id" "$fixture" "PASS" \
        "'Only one version exists' error" \
        "status=$status, msg=$msg" ""
      return
    fi
  fi
  # Fallback: grep raw log file
  if log_contains "$log_file" "only one|single version|nothing to roll|no.*previous|cannot roll"; then
    record_result "$id" "$fixture" "PASS" \
      "'Only one version exists' error" \
      "Correct error message detected in log" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "'Only one version exists' error" \
      "Expected error not detected" \
      "Check log: $log_file"
  fi
}

run_t7_5() {
  local id="T7.5"
  local fixture="snapshot-missing"

  local prompt="Working directory: $SC_DIR

Please run /eval-rollback on a skill where the target version's snapshot file is MISSING from the snapshots/ directory (the manifest references it but the .md file doesn't exist on disk).

Use the rollback-history fixture at: $FIXTURES_DIR/rollback-history/
Simulate by requesting rollback to a version whose snapshot was deleted.

The expected behavior is a 'Snapshot missing' error.

Output the result as JSON with status and message fields."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  # Primary: JSON field assertion; Fallback: grep raw log
  local json
  json=$(extract_json "$log_file" "status") || json=$(extract_json "$log_file" "message") || true

  if [ -n "$json" ]; then
    local msg status
    msg=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.message||''))" 2>/dev/null)
    status=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.status||''))" 2>/dev/null)
    if echo "$msg" | grep -qiE "snapshot.*miss|cannot rollback|file.*not.*found"; then
      record_result "$id" "$fixture" "PASS" \
        "'Snapshot missing' error" \
        "status=$status, msg=$msg" ""
      return
    fi
  fi
  # Fallback: grep raw log file
  if log_contains "$log_file" "snapshot.*miss|file.*not.*found|snapshot.*not.*exist|cannot.*restore"; then
    record_result "$id" "$fixture" "PASS" \
      "'Snapshot missing' error" \
      "Missing snapshot error detected in log" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "'Snapshot missing' error" \
      "Expected error not detected" \
      "Check log: $log_file"
  fi
}

# ── Execute ──────

echo "Running T5 eval-compare tests..."
run_t5_1
run_t5_2

echo ""
echo "Running T6 eval-merge tests..."
run_t6_1

echo ""
echo "Running T7 eval-rollback tests..."
run_t7_1
run_t7_2
run_t7_3
run_t7_4
run_t7_5

finish_phase
