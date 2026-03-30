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

native_path() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then
    cygpath -w "$p"
  else
    printf '%s' "$p"
  fi
}

native_homedrive() {
  local native="$1"
  printf '%s' "$native" | sed -E 's#^([A-Za-z]:).*#\1#'
}

native_homepath() {
  local native="$1"
  printf '%s' "$native" | sed -E 's#^[A-Za-z]:(.*)#\1#'
}

build_hook_input() {
  local file_path="$1"
  local content="${2:-test}"
  node -e "process.stdout.write(JSON.stringify({tool_name:'Write',tool_input:{file_path:process.argv[1],content:process.argv[2]},tool_output:{filePath:process.argv[1]}}))" "$file_path" "$content"
}

run_hook() {
  local script_path="$1"
  local payload="$2"
  local home_dir="${3:-}"

  if [ -n "$home_dir" ]; then
    local home_native
    home_native=$(native_path "$home_dir")
    local -a env_args
    env_args=(HOME="$home_dir" USERPROFILE="$home_native")
    if printf '%s' "$home_native" | grep -qE '^[A-Za-z]:'; then
      env_args+=(HOMEDRIVE="$(native_homedrive "$home_native")")
      env_args+=(HOMEPATH="$(native_homepath "$home_native")")
    fi
    printf '%s' "$payload" | env "${env_args[@]}" node "$script_path" 2>&1
  else
    printf '%s' "$payload" | node "$script_path" 2>&1
  fi
}

run_int1_1() {
  local id="INT1.1"
  local fixture="manual-write-SKILL.md"
  local skill_dir="$TEMP_SKILL_DIR/hook-test-skill"
  local hook_home="$TEMP_SKILL_DIR/hook-home"
  mkdir -p "$skill_dir" "$hook_home"

  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: hook-test
description: A test skill for hook verification
---

# Hook Test Skill

You are a test skill. Do nothing useful, but this body is long enough to
avoid "too short" warnings in structure checks.
SKILL

  local hook_input hook_output local_manifest user_manifest user_snapshot
  hook_input=$(build_hook_input "$skill_dir/SKILL.md" "$(cat "$skill_dir/SKILL.md")")
  hook_output=$(run_hook "$HOOKS_DIR/post-skill-edit.js" "$hook_input" "$hook_home") || true

  local_manifest=$(find_manifest "$skill_dir/.skill-compass" 2>/dev/null || true)
  user_manifest=$(find_manifest "$hook_home/.skill-compass" 2>/dev/null || true)
  user_snapshot="$hook_home/.skill-compass/hook-test-skill/snapshots/1.0.0.md"

  if [ -n "$user_manifest" ] && [ -f "$user_snapshot" ]; then
    record_result "$id" "$fixture" "PASS" \
      "user-level sidecar manifest + snapshot created" \
      "manifest at $user_manifest, snapshot at $user_snapshot" ""
  elif [ -n "$local_manifest" ]; then
    record_result "$id" "$fixture" "FAIL" \
      "user-level sidecar manifest + snapshot created" \
      "manifest incorrectly created under skill dir: $local_manifest" \
      "non-git skills should write sidecar state under hook home"
  else
    record_result "$id" "$fixture" "FAIL" \
      "sidecar manifest + snapshot created" \
      "No manifest found under skill dir or hook home sidecar" \
      "hook_output: $(echo "$hook_output" | head -3)"
  fi
}

run_int1_2() {
  local id="INT1.2"
  local fixture="eval-gate-on-write"
  local skill_dir="$TEMP_SKILL_DIR/gate-test-skill"
  mkdir -p "$skill_dir"

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

  local hook_input gate_output
  hook_input=$(build_hook_input "$skill_dir/SKILL.md" "$(cat "$skill_dir/SKILL.md")")
  gate_output=$(run_hook "$HOOKS_DIR/eval-gate.js" "$hook_input") || true

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

run_int1_3() {
  local id="INT1.3"
  local fixture="write-non-skill"
  local hook_input output
  hook_input=$(build_hook_input "/tmp/readme.txt" "hello")
  output=$(run_hook "$HOOKS_DIR/post-skill-edit.js" "$hook_input") || true

  if [ -z "$output" ] || echo "$output" | grep -qiE "skip|ignore|not.*skill"; then
    record_result "$id" "$fixture" "PASS" \
      "hooks silent on non-SKILL.md" \
      "Silent exit or skip message" ""
  else
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

run_int1_4() {
  local id="INT1.4"
  local fixture="write-lock-during-improve"
  local skill_dir="$TEMP_SKILL_DIR/bypass-test"
  local hook_home="$TEMP_SKILL_DIR/bypass-home"
  mkdir -p "$skill_dir" "$hook_home/.skill-compass"

  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: bypass-test
description: bypass smoke test
---

# Bypass Test

API_KEY=sk-ant-api03-BypassKeyForTesting1234567890
SKILL

  printf '{"until": %s}\n' "$(( $(date +%s) + 60 ))" > "$hook_home/.skill-compass/.write-lock"

  local hook_input output
  hook_input=$(build_hook_input "$skill_dir/SKILL.md" "$(cat "$skill_dir/SKILL.md")")
  output=$(run_hook "$HOOKS_DIR/eval-gate.js" "$hook_input" "$hook_home") || true

  if [ -z "$output" ]; then
    record_result "$id" "$fixture" "PASS" \
      "hooks don't fire during transient self-write lock" \
      "Write lock suppressed output" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "hooks don't fire during transient self-write lock" \
      "Write lock did not suppress eval-gate output" \
      "Output: $(echo "$output" | head -2)"
  fi
}

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

  local hook_input output
  hook_input=$(build_hook_input "$skill_dir/SKILL.md" "$(cat "$skill_dir/SKILL.md")")
  output=$(run_hook "$HOOKS_DIR/eval-gate.js" "$hook_input") || true

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

run_int1_6() {
  local id="INT1.6"
  local fixture="60s-throttle"
  local skill_dir="$TEMP_SKILL_DIR/throttle-test"
  local hook_home="$TEMP_SKILL_DIR/throttle-home"
  mkdir -p "$skill_dir" "$hook_home"

  cat > "$skill_dir/SKILL.md" <<'SKILL'
---
name: throttle-test
description: Throttle test
---
# Test
Short body.
SKILL

  local hook_input out1 out2
  hook_input=$(build_hook_input "$skill_dir/SKILL.md" "$(cat "$skill_dir/SKILL.md")")
  out1=$(run_hook "$HOOKS_DIR/eval-gate.js" "$hook_input" "$hook_home") || true
  out2=$(run_hook "$HOOKS_DIR/eval-gate.js" "$hook_input" "$hook_home") || true

  if echo "$out2" | grep -qiE "repeat, run /eval-skill for details"; then
    record_result "$id" "$fixture" "PASS" \
      "Second trigger throttled" \
      "Second eval-gate output used throttled summary" ""
  else
    record_result "$id" "$fixture" "FAIL" \
      "Second trigger throttled" \
      "Throttle summary not detected on repeated eval-gate run" \
      "out1: $(echo "$out1" | head -2) | out2: $(echo "$out2" | head -2)"
  fi
}

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

rm -rf "$TEMP_SKILL_DIR"

finish_phase
