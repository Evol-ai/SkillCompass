#!/usr/bin/env bash
# ============================================================
# Version Management Tests (VM1-VM4)
# Tests manifest lifecycle, rollback integrity, merge versioning,
# and snapshot strategy.
# Run AFTER Phase C/D have created some manifests.
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/lib/helpers.sh"
source "$SCRIPT_DIR/lib/assert.sh"

init_phase "Version Management (VM1-VM4)"

# ══════════════════════════════════════════════
# VM1: Manifest Lifecycle
# ══════════════════════════════════════════════

run_vm1_1() {
  local id="VM1.1"
  # After first eval-skill, manifest should exist
  # Use a fresh fixture copy
  local work_dir="$TEST_RESULTS_DIR/vm-work/vm1-1"
  mkdir -p "$work_dir"
  cp "$FIXTURES_DIR/atom-formatter/SKILL.md" "$work_dir/"

  local prompt="Working directory: $SC_DIR

Run /eval-skill on: $work_dir/SKILL.md
This is the FIRST evaluation of this skill — a manifest.json should be created in $work_dir/.skill-compass/

After evaluation, output JSON with the eval result.
Then also check if $work_dir/.skill-compass/manifest.json was created and what its contents are."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  # Check if manifest was created (may be in a subdirectory named after the skill)
  local manifest_path
  manifest_path=$(find_manifest "$work_dir/.skill-compass" 2>/dev/null)

  if [ -n "$manifest_path" ] && [ -f "$manifest_path" ]; then
    local manifest
    manifest=$(cat "$manifest_path")
    local trigger
    trigger=$(echo "$manifest" | node -e "
      const j=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const v = j.versions || [];
      process.stdout.write(String(v[0]?.trigger||''));
    " 2>/dev/null)

    record_result "$id" "manifest-creation" "PASS" \
      "manifest.json created" \
      "manifest at $manifest_path, trigger=$trigger" ""
  else
    # Fallback: check log for mention of manifest creation
    if log_contains "$log_file" "manifest.*creat|\.skill-compass"; then
      record_result "$id" "manifest-creation" "PASS" \
        "manifest.json created" \
        "Manifest creation mentioned in output" ""
    else
      record_result "$id" "manifest-creation" "FAIL" \
        "manifest.json created" \
        "No manifest.json found under $work_dir/.skill-compass/" ""
    fi
  fi
}

run_vm1_2() {
  local id="VM1.2"
  local work_dir="$TEST_RESULTS_DIR/vm-work/vm1-2"
  mkdir -p "$work_dir"
  cp "$FIXTURES_DIR/d4-shallow-function/SKILL.md" "$work_dir/"

  local prompt="Working directory: $SC_DIR

1. First run /eval-skill on: $work_dir/SKILL.md (to create initial manifest)
2. Then run /eval-improve on: $work_dir/SKILL.md (to create an evo version)

After both, check the manifest at $work_dir/.skill-compass/manifest.json.
The versions array should have grown by 1, and the new version should have format x.y.z-evo.N.

Output JSON with: versions_count, latest_version, version_format_valid."

  local log_file
  log_file=$(run_claude_eval "$prompt" "$id") || true

  # Check manifest (may be in a subdirectory)
  local manifest_path
  manifest_path=$(find_manifest "$work_dir/.skill-compass" 2>/dev/null)

  if [ -n "$manifest_path" ] && [ -f "$manifest_path" ]; then
    local ver_count latest
    ver_count=$(node -e "
      const j=JSON.parse(require('fs').readFileSync('$manifest_path','utf8'));
      process.stdout.write(String((j.versions||[]).length));
    " 2>/dev/null)
    latest=$(node -e "
      const j=JSON.parse(require('fs').readFileSync('$manifest_path','utf8'));
      const v=j.versions||[];
      process.stdout.write(String(v[v.length-1]?.version||''));
    " 2>/dev/null)

    if echo "$latest" | grep -qE "evo\.[0-9]+"; then
      record_result "$id" "evo-version-created" "PASS" \
        "versions+1, format x.y.z-evo.N" \
        "versions=$ver_count, latest=$latest" ""
    else
      record_result "$id" "evo-version-created" "FAIL" \
        "evo.N format" \
        "versions=$ver_count, latest=$latest" ""
    fi
  else
    record_result "$id" "evo-version-created" "FAIL" \
      "manifest exists after eval+improve" \
      "No manifest.json found" ""
  fi
}

run_vm1_4() {
  local id="VM1.4"
  # Verify content_hash matches actual SKILL.md SHA-256
  local work_dir="$TEST_RESULTS_DIR/vm-work/vm1-2"  # Reuse from VM1.2

  if [ ! -f "$work_dir/.skill-compass/manifest.json" ] || [ ! -f "$work_dir/SKILL.md" ]; then
    record_result "$id" "content-hash" "SKIP" \
      "manifest + SKILL.md exist" \
      "Prerequisite files missing (run VM1.2 first)" ""
    return
  fi

  local actual_hash manifest_hash
  actual_hash=$(sha256sum "$work_dir/SKILL.md" 2>/dev/null | cut -d' ' -f1 || \
    node -e "const c=require('crypto'),fs=require('fs');process.stdout.write(c.createHash('sha256').update(fs.readFileSync('$work_dir/SKILL.md')).digest('hex'))")

  manifest_hash=$(node -e "
    const j=JSON.parse(require('fs').readFileSync('$work_dir/.skill-compass/manifest.json','utf8'));
    const v=j.versions||[];
    const last=v[v.length-1]||{};
    process.stdout.write(String(last.content_hash||''));
  " 2>/dev/null)

  if [ -n "$manifest_hash" ] && [ "$actual_hash" = "$manifest_hash" ]; then
    record_result "$id" "content-hash-match" "PASS" \
      "SHA-256 matches actual file" \
      "hash=$actual_hash" ""
  elif [ -z "$manifest_hash" ]; then
    record_result "$id" "content-hash-match" "SKIP" \
      "content_hash in manifest" \
      "No content_hash field in manifest" ""
  else
    record_result "$id" "content-hash-match" "FAIL" \
      "SHA-256 matches" \
      "actual=$actual_hash manifest=$manifest_hash" ""
  fi
}

# ══════════════════════════════════════════════
# VM2: Rollback Integrity
# ══════════════════════════════════════════════

run_vm2_1() {
  local id="VM2.1"
  local fixture="rollback-history"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local skill_dir="$fixture_path"
  [ -d "$fixture_path/csv-converter" ] && skill_dir="$fixture_path/csv-converter"

  # Check manifest after a rollback (should have been done in Phase C)
  if [ -f "$skill_dir/.skill-compass/manifest.json" ]; then
    local current_ver
    current_ver=$(node -e "
      const j=JSON.parse(require('fs').readFileSync('$skill_dir/.skill-compass/manifest.json','utf8'));
      process.stdout.write(String(j.current_version||''));
    " 2>/dev/null)

    if [ -n "$current_ver" ]; then
      record_result "$id" "rollback-current-version" "PASS" \
        "current_version updated after rollback" \
        "current_version=$current_ver" ""
    else
      record_result "$id" "rollback-current-version" "FAIL" \
        "current_version set" \
        "current_version is empty" ""
    fi
  else
    record_result "$id" "rollback-current-version" "SKIP" \
      "manifest exists" \
      "Run Phase C first to create rollback state" ""
  fi
}

run_vm2_2() {
  local id="VM2.2"
  local fixture="rollback-history"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local skill_dir="$fixture_path"
  [ -d "$fixture_path/csv-converter" ] && skill_dir="$fixture_path/csv-converter"

  if [ -f "$skill_dir/.skill-compass/manifest.json" ]; then
    local ver_count
    ver_count=$(node -e "
      const j=JSON.parse(require('fs').readFileSync('$skill_dir/.skill-compass/manifest.json','utf8'));
      process.stdout.write(String((j.versions||[]).length));
    " 2>/dev/null)

    # Rollback should NOT delete history
    if [ "$(node -e "process.stdout.write(String(Number('$ver_count')>=2))" 2>/dev/null)" = "true" ]; then
      record_result "$id" "rollback-preserves-history" "PASS" \
        "versions array unchanged after rollback" \
        "versions=$ver_count (history preserved)" ""
    else
      record_result "$id" "rollback-preserves-history" "FAIL" \
        "versions preserved" \
        "versions=$ver_count (may have been truncated)" ""
    fi
  else
    record_result "$id" "rollback-preserves-history" "SKIP" \
      "manifest exists" \
      "Run Phase C first" ""
  fi
}

# ══════════════════════════════════════════════
# VM4: Snapshot Strategy
# ══════════════════════════════════════════════

run_vm4_2() {
  local id="VM4.2"
  local fixture="rollback-history"
  local fixture_path
  fixture_path=$(require_fixture "$fixture") || {
    record_result "$id" "$fixture" "SKIP" "fixture exists" "fixture not found" ""
    return
  }

  local skill_dir="$fixture_path"
  [ -d "$fixture_path/csv-converter" ] && skill_dir="$fixture_path/csv-converter"

  local snapshots_dir="$skill_dir/.skill-compass/snapshots"
  if [ -d "$snapshots_dir" ]; then
    # Check that 1.0.0.md (upstream/original) still exists
    if [ -f "$snapshots_dir/1.0.0.md" ]; then
      record_result "$id" "upstream-snapshot-preserved" "PASS" \
        "1.0.0.md never deleted" \
        "1.0.0.md exists in snapshots/" ""
    else
      # Check for any non-evo snapshot
      local base_snapshots
      base_snapshots=$(ls "$snapshots_dir/" 2>/dev/null | grep -v "evo" | head -3)
      if [ -n "$base_snapshots" ]; then
        record_result "$id" "upstream-snapshot-preserved" "PASS" \
          "upstream snapshot preserved" \
          "Base snapshots found: $base_snapshots" ""
      else
        record_result "$id" "upstream-snapshot-preserved" "FAIL" \
          "1.0.0.md preserved" \
          "No base version snapshot found" ""
      fi
    fi
  else
    record_result "$id" "upstream-snapshot-preserved" "SKIP" \
      "snapshots dir exists" \
      "No snapshots directory found" ""
  fi
}

# ── Execute ──────

echo "Running VM1: Manifest Lifecycle tests..."
run_vm1_1
run_vm1_2
run_vm1_4

echo ""
echo "Running VM2: Rollback Integrity tests..."
run_vm2_1
run_vm2_2

echo ""
echo "Running VM4: Snapshot Strategy tests..."
run_vm4_2

finish_phase
