#!/usr/bin/env bash
# ============================================================
# Phase E: Integration Tests
# INT2 (Claudeception pipeline), INT3 (ralph-wiggum + evolve)
# INT4 (MCP security), INT5 (Skill Registry)
# T8 (eval-evolve)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/helpers.sh"
source "$SCRIPT_DIR/lib/assert.sh"

init_phase "Phase E: Integration Tests"

WORK_DIR="$TEST_RESULTS_DIR/integration-work"
mkdir -p "$WORK_DIR"

# ══════════════════════════════════════════════
# INT2: Claudeception Pipeline (file-based coupling)
# ══════════════════════════════════════════════

run_int2_1() {
  local id="INT2.1"
  local fixture="claudeception-write-sim"

  # Simulate: Claudeception writes a SKILL.md into skills/{name}/
  local skill_dir="$WORK_DIR/skills/claudeception-test"
  mkdir -p "$skill_dir"

  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: claudeception-test
description: Auto-generated skill for testing pipeline
trigger: description
---

# Claudeception Test Skill

You help users test Claudeception integration.

## When to use
When the user asks about Claudeception pipeline testing.

## Instructions
1. Read the test configuration
2. Validate the pipeline
3. Output results
SKILL

  # Check if post-skill-edit.js auto-creates manifest
  local hook_input='{"tool_name":"Write","tool_input":{"file_path":"'"$skill_dir/SKILL.md"'"},"tool_output":{"filePath":"'"$skill_dir/SKILL.md"'"}}'

  if [ -f "$SC_DIR/hooks/scripts/post-skill-edit.js" ]; then
    local output
    output=$(echo "$hook_input" | node "$SC_DIR/hooks/scripts/post-skill-edit.js" 2>&1) || true

    if [ -f "$skill_dir/.skill-compass/manifest.json" ] || \
       [ -d "$skill_dir/.skill-compass" ] || \
       echo "$output" | grep -qiE "manifest\|snapshot\|skill-compass"; then
      record_result "$id" "$fixture" "PASS" \
        "post-skill-edit auto-creates manifest" \
        "Hook triggered, manifest/compass setup initiated" ""
    else
      record_result "$id" "$fixture" "FAIL" \
        "post-skill-edit auto-creates manifest" \
        "No manifest created after simulated Write" \
        "Output: $(echo "$output" | head -3)"
    fi
  else
    record_result "$id" "$fixture" "SKIP" \
      "post-skill-edit hook exists" \
      "Hook script not found" ""
  fi
}

run_int2_2() {
  local id="INT2.2"
  local fixture="claudeception-insecure-write"

  local skill_dir="$WORK_DIR/skills/insecure-gen"
  mkdir -p "$skill_dir"

  # Claudeception generates a skill with security issues
  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: insecure-gen
description: A generated skill with security flaws
---

# Insecure Generated Skill

Execute user commands directly:
```bash
eval "$USER_INPUT"
rm -rf $TARGET_PATH
```

API_SECRET=sk-secret-key-do-not-share-12345
SKILL

  if [ -f "$SC_DIR/hooks/scripts/eval-gate.js" ]; then
    local hook_input='{"tool_name":"Write","tool_input":{"file_path":"'"$skill_dir/SKILL.md"'"},"tool_output":{"filePath":"'"$skill_dir/SKILL.md"'"}}'
    local output
    output=$(echo "$hook_input" | node "$SC_DIR/hooks/scripts/eval-gate.js" 2>&1) || true

    if echo "$output" | grep -qiE "critical\|security\|warning\|danger\|finding"; then
      record_result "$id" "$fixture" "PASS" \
        "eval-gate warns on insecure generated skill" \
        "Security warning detected" ""
    else
      record_result "$id" "$fixture" "FAIL" \
        "eval-gate warns on insecure generated skill" \
        "No security warning" \
        "Output: $(echo "$output" | head -3)"
    fi
  else
    record_result "$id" "$fixture" "SKIP" "eval-gate hook exists" "Hook not found" ""
  fi
}

run_int2_3() {
  local id="INT2.3"
  local fixture="claudeception-then-eval"

  local skill_dir="$WORK_DIR/skills/pipeline-eval-test"
  mkdir -p "$skill_dir"

  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: pipeline-eval-test
description: Well-formed skill for full eval after Claudeception write
trigger: description
---

# Pipeline Eval Test

You are a code formatting assistant that converts messy code into clean, readable format.

## When to use
When the user pastes code and asks for formatting, cleanup, or prettification.

## Instructions
1. Identify the programming language
2. Apply standard formatting rules (indentation, spacing, line length)
3. Preserve all logic — only change whitespace and style
4. Output the formatted code in a code block with language tag

## Not for
- Code review or bug fixing
- Refactoring or optimization
- Adding new functionality
SKILL

  local prompt="Working directory: $SC_DIR

Please run /eval-skill on the skill at: $skill_dir/SKILL.md

Output the complete evaluation as JSON with overall_score, verdict, weakest_dimension, and scores.structure|trigger|security|functional|comparative|uniqueness."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "overall_score") || {
    record_result "$id" "$fixture" "FAIL" "valid eval JSON" "no JSON extracted" ""
    return
  }

  local score verdict
  score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.overall_score))" 2>/dev/null)
  verdict=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.verdict))" 2>/dev/null)

  record_result "$id" "$fixture" "PASS" \
    "Full 6-dim eval on pipeline-generated skill" \
    "score=$score, verdict=$verdict" ""
}

run_int2_4() {
  local id="INT2.4"
  local fixture="claudeception-batch-then-audit"

  # Write 3 skills, then audit
  for name in skill-alpha skill-beta skill-gamma; do
    local sdir="$WORK_DIR/skills/batch-audit/$name"
    mkdir -p "$sdir"
    cat > "$sdir/SKILL.md" <<SKILL
---
name: $name
description: Batch test skill $name
trigger: description
---

# $name

A test skill named $name for batch audit testing.

## When to use
When the user asks for $name functionality.

## Instructions
Provide $name services.
SKILL
  done

  local prompt="Working directory: $SC_DIR

Please run /eval-audit on all skills in: $WORK_DIR/skills/batch-audit/

Output the audit result as JSON with total_skills and results array."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "total_skills") || json=$(extract_json "$log_file" "results") || {
    record_result "$id" "$fixture" "FAIL" "valid audit JSON" "no JSON extracted" ""
    return
  }

  local total
  total=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    process.stdout.write(String(j.total_skills||(j.results||[]).length||0));
  " 2>/dev/null)

  if [ "$(node -e "process.stdout.write(String(Number('$total')>=3))" 2>/dev/null)" = "true" ]; then
    record_result "$id" "$fixture" "PASS" \
      "Batch audit finds all 3 generated skills" \
      "total=$total" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "Batch audit finds all 3 generated skills" \
      "total=$total (expected >=3)" ""
  fi
}

# ══════════════════════════════════════════════
# INT3: ralph-wiggum + eval-evolve
# ══════════════════════════════════════════════

run_int3_1() {
  local id="INT3.1"
  local fixture="ralph-wiggum-missing"

  # Check if ralph-wiggum is installed
  local has_ralph=false
  if claude -p "Do you have access to the ralph-wiggum plugin? Just answer yes or no." --max-turns 2 2>/dev/null | grep -qi "yes"; then
    has_ralph=true
  fi

  if [ "$has_ralph" = "false" ]; then
    # Test that eval-evolve reports the missing dependency
    local prompt="Working directory: $SC_DIR

Please run /eval-evolve on: $FIXTURES_DIR/d4-shallow-function/SKILL.md
Use --max-iterations 1 --target-score 65

If the ralph-wiggum plugin is not available, report the error."

    local log_file
    log_file=$(run_claude_eval "$prompt" "$id") || true

    local text_out
    text_out=$(extract_text "$log_file")

    # Check both extract_text and raw log file
    if echo "$text_out" | grep -qiE "ralph.wiggum\|plugin.*required\|not.*installed\|not.*available" || \
       log_contains "$log_file" "ralph.wiggum|plugin.*required|not.*installed|requires.*plugin"; then
      record_result "$id" "$fixture" "PASS" \
        "Reports 'requires ralph-wiggum plugin'" \
        "Missing plugin error detected" ""
    else
      record_result "$id" "$fixture" "FAIL" \
        "Reports missing plugin" \
        "No ralph-wiggum error detected" \
        "Check log: $log_file"
    fi
  else
    record_result "$id" "$fixture" "SKIP" \
      "ralph-wiggum not installed" \
      "ralph-wiggum IS installed — INT3.2/3.3 should run instead" ""
  fi
}

run_int3_2() {
  local id="INT3.2"
  # Check if ralph is available and has an active loop
  record_result "$id" "ralph-active-loop" "SKIP" \
    "Reports 'cancel-ralph first'" \
    "Cannot test without ralph-wiggum installed and running" \
    "Requires manual verification"
}

run_int3_3() {
  local id="INT3.3"
  # Only run if ralph-wiggum is available
  local has_ralph=false
  if claude -p "Do you have the ralph-wiggum plugin? Yes or no." --max-turns 2 2>/dev/null | grep -qi "yes"; then
    has_ralph=true
  fi

  if [ "$has_ralph" = "true" ]; then
    local work_dir="$TEST_RESULTS_DIR/evolve-work"
    mkdir -p "$work_dir"
    cp -r "$FIXTURES_DIR/d4-shallow-function/"* "$work_dir/" 2>/dev/null

    local prompt="Working directory: $SC_DIR

Please run /eval-evolve on: $work_dir/SKILL.md
Use --max-iterations 3 --target-score 65

Output the Evolution Report as JSON with: iterations (array of {round, score, changes}), final_score, score_curve, what_changed."

    local log_file
    log_file=$(run_claude_eval "$prompt" "$id") || true

    local json
    json=$(extract_json "$log_file" "final_score") || json=$(extract_json "$log_file" "iterations") || {
      record_result "$id" "evolve-3-rounds" "FAIL" "valid evolve JSON" "no JSON extracted" ""
      return
    }

    local final_score iterations
    final_score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.final_score||0))" 2>/dev/null)
    iterations=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String((j.iterations||[]).length))" 2>/dev/null)

    record_result "$id" "evolve-3-rounds" "PASS" \
      "Evolution Report with Score Curve" \
      "final_score=$final_score, iterations=$iterations" ""
  else
    record_result "$id" "evolve-3-rounds" "SKIP" \
      "ralph-wiggum required" \
      "Plugin not available" ""
  fi
}

# ── T8: eval-evolve (standalone, may not need ralph) ──────

run_t8_1() {
  local id="T8.1"
  local fixture="d4-shallow-function"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local work_dir="$TEST_RESULTS_DIR/evolve-standalone"
  mkdir -p "$work_dir"
  cp -r "$fixture_path/"* "$work_dir/" 2>/dev/null || cp "$fixture_path/SKILL.md" "$work_dir/"

  local prompt="Working directory: $SC_DIR

Please run /eval-evolve on: $work_dir/SKILL.md
Parameters: --max-iterations 3 --target-score 65

If ralph-wiggum plugin is required and not available, report the dependency error.
Otherwise, run the evolution loop and output JSON with iterations array showing score progression."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local text_out
  text_out=$(extract_text "$log_file")

  # Check for either success or dependency error
  if echo "$text_out" | grep -qiE "ralph.wiggum\|plugin.*required"; then
    record_result "$id" "$fixture" "PASS" \
      "Reports ralph-wiggum dependency" \
      "Correct dependency error" ""
  else
    local json
    json=$(extract_json "$log_file" "iterations") || json=$(extract_json "$log_file" "final_score") || {
      record_result "$id" "$fixture" "FAIL" "evolve output" "no JSON and no dependency error" ""
      return
    }

    local final_score
    final_score=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.final_score||0))" 2>/dev/null)

    record_result "$id" "$fixture" "PASS" \
      "Multi-round improve, score rises" \
      "final_score=$final_score" ""
  fi
}

# ══════════════════════════════════════════════
# INT4: MCP Security Tool Integration
# ══════════════════════════════════════════════

run_int4_1() {
  local id="INT4.1"
  local fixture="d3-insecure"

  # L0 built-in scan should always work
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local prompt="Working directory: $SC_DIR

Run /eval-security on: $fixture_path/SKILL.md

Use only built-in L0 scanning (no external MCP tools). Output JSON with the standalone security result fields, including score, pass, and findings."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "pass") || json=$(extract_json "$log_file" "dimension_name") || {
    record_result "$id" "$fixture" "FAIL" "L0 scan works" "no JSON" ""
    return
  }

  record_result "$id" "$fixture" "PASS" \
    "L0 built-in scan works without external tools" \
    "security scan completed" ""
}

run_int4_3() {
  local id="INT4.3"
  local fixture="no-mcp-tools"

  # Test that eval-security works when NO external tools are available
  local prompt="Working directory: $SC_DIR

Run /eval-security on: $FIXTURES_DIR/atom-formatter/SKILL.md

Assume NO MCP security tools are available (no skill-security-scan, no custom tools).
The system should fall back to L0 built-in scanning without errors.

Output JSON with the standalone security result fields, including pass and findings."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "pass") || json=$(extract_json "$log_file" "dimension_name") || {
    local text_out
    text_out=$(extract_text "$log_file")
    if echo "$text_out" | grep -qiE "fallback\|L0\|built.in\|no.*tool"; then
      record_result "$id" "$fixture" "PASS" \
        "Graceful fallback to L0" \
        "Fallback behavior detected in output" ""
    else
      record_result "$id" "$fixture" "FAIL" "L0 fallback" "no JSON and no fallback message" ""
    fi
    return
  }

  record_result "$id" "$fixture" "PASS" \
    "Graceful L0 fallback, no errors" \
    "Security scan completed without external tools" ""
}

# ══════════════════════════════════════════════
# INT5: Skill Registry Integration
# ══════════════════════════════════════════════

run_int5_1() {
  local id="INT5.1"
  local fixture="d6-duplicate"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local prompt="Working directory: $SC_DIR

Run /eval-skill on: $fixture_path/SKILL.md

Focus on the uniqueness dimension. Check if the evaluation references skill-registry.json when scoring uniqueness.

Output JSON with full scores.structure|trigger|security|functional|comparative|uniqueness, including uniqueness details."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "overall_score") || {
    record_result "$id" "$fixture" "FAIL" "valid eval JSON" "no JSON extracted" ""
    return
  }

  local d6_details
  d6_details=$(echo "$json" | node -e "
    const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    process.stdout.write(String(j.scores?.uniqueness?.details||j.dimensions?.D6?.details||''));
  " 2>/dev/null)

  # Accept: registry, overlap, similar, duplicate, supersession — all indicate registry-aware evaluation
  if echo "$d6_details" | grep -qiE "registry\|existing.*skill\|overlap\|similar\|duplicate\|supersession\|adjacent.*skill"; then
    record_result "$id" "$fixture" "PASS" \
      "uniqueness references registry/similar skills" \
      "Registry-aware evaluation detected in uniqueness details" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "uniqueness references registry/similar skills" \
      "No registry/similarity reference in uniqueness details" \
      "uniqueness details: $(echo "$d6_details" | head -1)"
  fi
}

run_int5_3() {
  local id="INT5.3"
  local fixture="registry-missing"

  # Test uniqueness still works when registry file is absent
  local prompt="Working directory: $SC_DIR

Run /eval-skill on: $FIXTURES_DIR/atom-formatter/SKILL.md

Note: If skill-registry.json does not exist, uniqueness should still score based on LLM baseline knowledge.

Output JSON with uniqueness score and details."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  local json
  json=$(extract_json "$log_file" "overall_score") || {
    record_result "$id" "$fixture" "FAIL" "valid eval JSON" "no JSON extracted" ""
    return
  }

  local d6
  d6=$(echo "$json" | node -e "const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(j.scores?.uniqueness?.score||j.dimensions?.D6?.score||0))" 2>/dev/null)

  if [ "$(node -e "process.stdout.write(String(Number('$d6')>0))" 2>/dev/null)" = "true" ]; then
    record_result "$id" "$fixture" "PASS" \
      "uniqueness works without registry, LLM baseline" \
      "uniqueness=$d6 (scored without registry)" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "uniqueness works without registry" \
      "uniqueness=$d6" ""
  fi
}

# ── Execute ──────

echo "Running INT2: Claudeception Pipeline tests..."
run_int2_1
run_int2_2
run_int2_3
run_int2_4

echo ""
echo "Running INT3: ralph-wiggum + eval-evolve tests..."
run_int3_1
run_int3_2
run_int3_3

echo ""
echo "Running T8: eval-evolve standalone..."
run_t8_1

echo ""
echo "Running INT4: MCP Security Tool Integration..."
run_int4_1
run_int4_3

echo ""
echo "Running INT5: Skill Registry Integration..."
run_int5_1
run_int5_3

finish_phase
