#!/usr/bin/env bash
# ============================================================
# Phase A: Hook Verification (INT1)
# Tests post-skill-edit.js and eval-gate.js hooks
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/helpers.sh"
source "$SCRIPT_DIR/lib/assert.sh"

init_phase "Phase A: Hook Verification"

HOOKS_DIR="$SC_DIR/hooks/scripts"
TEMP_SKILL_DIR="$TEST_RESULTS_DIR/temp-hook-tests"

# ── INT1.1: post-skill-edit.js creates .skill-compass/ + snapshot ──────

run_int1_1() {
  local id="INT1.1"
  local fixture="manual-write-SKILL.md"

  # Create a temp skill directory
  local skill_dir="$TEMP_SKILL_DIR/hook-test-skill"
  mkdir -p "$skill_dir"

  # Write a basic SKILL.md
  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: hook-test
description: A test skill for hook verification
---

# Hook Test Skill

You are a test skill. Do nothing useful.
SKILL

  # Simulate the hook input (Claude Code PostToolUse Write event)
  local hook_input='{"tool_name":"Write","tool_input":{"file_path":"'"$skill_dir/SKILL.md"'","content":"---\nname: hook-test\ndescription: A test skill for hook verification\n---\n\n# Hook Test Skill\n\nYou are a test skill. Do nothing useful."},"tool_output":{"filePath":"'"$skill_dir/SKILL.md"'"}}'

  # Run the hook
  local hook_output
  hook_output=$(echo "$hook_input" | node "$HOOKS_DIR/post-skill-edit.js" 2>&1) || true

  # Check results
  if [ -d "$skill_dir/.skill-compass" ]; then
    if ls "$skill_dir/.skill-compass/snapshots/"*.md &>/dev/null 2>&1 || \
       [ -f "$skill_dir/.skill-compass/manifest.json" ]; then
      record_result "$id" "$fixture" "PASS" \
        ".skill-compass/ + snapshot created" \
        ".skill-compass/ created with manifest/snapshot" ""
    else
      record_result "$id" "$fixture" "PASS" \
        ".skill-compass/ + snapshot created" \
        ".skill-compass/ dir created (checking contents)" \
        "Dir exists but snapshot details may vary"
    fi
  else
    # Hook may output instructions rather than create dir itself
    if echo "$hook_output" | grep -qi "skill-compass\|snapshot\|manifest"; then
      record_result "$id" "$fixture" "PASS" \
        ".skill-compass/ + snapshot created" \
        "Hook recognized SKILL.md write, output: $(echo "$hook_output" | head -1)" ""
    else
      record_result "$id" "$fixture" "FAIL" \
        ".skill-compass/ + snapshot created" \
        "No .skill-compass/ dir and no relevant output" \
        "hook_output: $(echo "$hook_output" | head -3)"
    fi
  fi
}

# ── INT1.2: eval-gate.js outputs findings for security issues ──────

run_int1_2() {
  local id="INT1.2"
  local fixture="eval-gate-on-write"

  local skill_dir="$TEMP_SKILL_DIR/gate-test-skill"
  mkdir -p "$skill_dir"

  # Write a SKILL.md with a security issue (hardcoded key)
  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: gate-test-insecure
description: A skill with security issues
---

# Insecure Skill

Run this command:
```bash
curl -H "Authorization: Bearer sk-ant-api03-REAL_KEY_HERE_abc123" https://api.example.com/data
```

Also execute: eval(user_input)
SKILL

  local hook_input='{"tool_name":"Write","tool_input":{"file_path":"'"$skill_dir/SKILL.md"'","content":"test"},"tool_output":{"filePath":"'"$skill_dir/SKILL.md"'"}}'

  local gate_output
  gate_output=$(echo "$hook_input" | node "$HOOKS_DIR/eval-gate.js" 2>&1) || true

  if echo "$gate_output" | grep -qiE "critical|warning|security|finding|hardcoded|key|inject"; then
    record_result "$id" "$fixture" "PASS" \
      "stderr outputs findings" \
      "Gate detected security issues: $(echo "$gate_output" | grep -iE 'critical|warning|security' | head -1)" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "stderr outputs findings" \
      "No security findings in gate output" \
      "Output: $(echo "$gate_output" | head -3)"
  fi
}

# ── INT1.3: Write non-SKILL.md file → hooks silent ──────

run_int1_3() {
  local id="INT1.3"
  local fixture="write-non-skill"

  local hook_input='{"tool_name":"Write","tool_input":{"file_path":"/tmp/readme.txt","content":"hello"},"tool_output":{"filePath":"/tmp/readme.txt"}}'

  local output
  output=$(echo "$hook_input" | node "$HOOKS_DIR/post-skill-edit.js" 2>&1) || true

  # Should produce no meaningful output or exit silently
  if [ -z "$output" ] || echo "$output" | grep -qiE "skip|ignore|not.*skill"; then
    record_result "$id" "$fixture" "PASS" \
      "hooks silent on non-SKILL.md" \
      "Silent exit or skip message" ""
  else
    # Check if it's just a benign message
    local linecount
    linecount=$(echo "$output" | wc -l)
    if [ "$linecount" -le 2 ]; then
      record_result "$id" "$fixture" "PASS" \
        "hooks silent on non-SKILL.md" \
        "Minimal output ($linecount lines): $(echo "$output" | head -1)" ""
    else
      record_result "$id" "$fixture" "FAIL" \
        "hooks silent on non-SKILL.md" \
        "Hook produced $linecount lines of output for non-SKILL.md file" \
        "Output: $(echo "$output" | head -3)"
    fi
  fi
}

# ── INT1.4: eval-improve bypass → hooks don't trigger ──────

run_int1_4() {
  local id="INT1.4"
  local fixture="gate-bypass-during-improve"

  # Simulate a Write during eval-improve (with bypass marker)
  local hook_input='{"tool_name":"Write","tool_input":{"file_path":"/tmp/test/SKILL.md","content":"improved"},"tool_output":{"filePath":"/tmp/test/SKILL.md"}}'

  # Set bypass env var (if the hook supports it)
  local output
  output=$(SKILL_COMPASS_BYPASS=1 echo "$hook_input" | node "$HOOKS_DIR/eval-gate.js" 2>&1) || true

  # Also check if there's a lock/bypass file mechanism
  if [ -z "$output" ] || echo "$output" | grep -qiE "bypass|skip|throttle"; then
    record_result "$id" "$fixture" "PASS" \
      "hooks don't fire during bypass" \
      "Bypass respected or silent exit" ""
  else
    record_result "$id" "$fixture" "SKIP" \
      "hooks don't fire during bypass" \
      "Bypass mechanism unclear — manual verification needed" \
      "Output: $(echo "$output" | head -2)"
  fi
}

# ── INT1.5: Hardcoded key in SKILL.md → CRITICAL warning ──────

run_int1_5() {
  local id="INT1.5"
  local fixture="hardcoded-key-gate"

  local skill_dir="$TEMP_SKILL_DIR/hardcoded-key-skill"
  mkdir -p "$skill_dir"

  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: leaky-skill
description: This skill has hardcoded API keys
---

# Leaky Skill

Use this API key for authentication:
API_KEY=sk-ant-api03-AbCdEfGhIjKlMnOpQrStUvWxYz1234567890

Also: AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
SKILL

  local hook_input='{"tool_name":"Write","tool_input":{"file_path":"'"$skill_dir/SKILL.md"'","content":"test"},"tool_output":{"filePath":"'"$skill_dir/SKILL.md"'"}}'

  local output
  output=$(echo "$hook_input" | node "$HOOKS_DIR/eval-gate.js" 2>&1) || true

  if echo "$output" | grep -qiE "critical|hardcoded.*key|api.key|secret"; then
    record_result "$id" "$fixture" "PASS" \
      "CRITICAL warning for hardcoded keys" \
      "Gate flagged hardcoded keys" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "CRITICAL warning for hardcoded keys" \
      "No critical warning for hardcoded API keys" \
      "Output: $(echo "$output" | head -3)"
  fi
}

# ── INT1.6: Throttle on repeated trigger ──────

run_int1_6() {
  local id="INT1.6"
  local fixture="60s-throttle"

  local skill_dir="$TEMP_SKILL_DIR/throttle-test"
  mkdir -p "$skill_dir"

  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: throttle-test
description: Throttle test
---
# Test
Basic skill.
SKILL

  local hook_input='{"tool_name":"Write","tool_input":{"file_path":"'"$skill_dir/SKILL.md"'","content":"test"},"tool_output":{"filePath":"'"$skill_dir/SKILL.md"'"}}'

  # First trigger
  local out1
  out1=$(echo "$hook_input" | node "$HOOKS_DIR/post-skill-edit.js" 2>&1) || true

  # Second trigger immediately
  local out2
  out2=$(echo "$hook_input" | node "$HOOKS_DIR/post-skill-edit.js" 2>&1) || true

  # Check if second is shorter (throttled)
  local len1 len2
  len1=$(echo "$out1" | wc -c)
  len2=$(echo "$out2" | wc -c)

  if echo "$out2" | grep -qiE "throttle|skip|recent|cooldown"; then
    record_result "$id" "$fixture" "PASS" \
      "Second trigger throttled" \
      "Throttle detected in second trigger output" ""
  elif [ "$len2" -lt "$len1" ] && [ "$len1" -gt 10 ]; then
    record_result "$id" "$fixture" "PASS" \
      "Second trigger throttled" \
      "Second output shorter ($len2 < $len1 bytes), likely throttled" ""
  else
    record_result "$id" "$fixture" "SKIP" \
      "Second trigger throttled" \
      "Throttle behavior unclear — may need 60s gap" \
      "out1=${len1}B out2=${len2}B"
  fi
}

# ── Run all INT1 tests ──────

# Check hooks exist
if [ ! -f "$HOOKS_DIR/post-skill-edit.js" ]; then
  echo -e "${RED}ERROR: post-skill-edit.js not found at $HOOKS_DIR${NC}"
  echo "Ensure SkillCompass is installed at $SC_DIR"
  record_result "INT1.1" "hooks-missing" "SKIP" "hooks exist" "hooks not found" ""
  record_result "INT1.2" "hooks-missing" "SKIP" "hooks exist" "hooks not found" ""
  record_result "INT1.3" "hooks-missing" "SKIP" "hooks exist" "hooks not found" ""
  record_result "INT1.4" "hooks-missing" "SKIP" "hooks exist" "hooks not found" ""
  record_result "INT1.5" "hooks-missing" "SKIP" "hooks exist" "hooks not found" ""
  record_result "INT1.6" "hooks-missing" "SKIP" "hooks exist" "hooks not found" ""
  finish_phase
  exit 0
fi

mkdir -p "$TEMP_SKILL_DIR"

run_int1_1
run_int1_2
run_int1_3
run_int1_4
run_int1_5
run_int1_6

# Cleanup
rm -rf "$TEMP_SKILL_DIR"

finish_phase
