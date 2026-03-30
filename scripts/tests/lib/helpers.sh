#!/usr/bin/env bash
# ============================================================
# SkillCompass Test Harness — Common Helpers
# ============================================================

# Paths
SC_DIR="${SC_DIR:-$HOME/skill-compass}"
FIXTURES_DIR="$SC_DIR/test-fixtures"
TEST_RESULTS_DIR="${TEST_RESULTS_DIR:-$HOME/skill-compass-test-results}"
RESULTS_JSON_DIR="$TEST_RESULTS_DIR/json"
RESULTS_LOG_DIR="$TEST_RESULTS_DIR/logs"

# Counters (per-phase)
_PASS=0
_FAIL=0
_SKIP=0
_TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

init_phase() {
  local phase_name="$1"
  _PASS=0; _FAIL=0; _SKIP=0; _TOTAL=0
  _PHASE_NAME="$phase_name"
  mkdir -p "$RESULTS_JSON_DIR" "$RESULTS_LOG_DIR"
  echo ""
  echo -e "${BOLD}════════════════════════════════════════════════${NC}"
  echo -e "${BOLD}  Phase: ${CYAN}$phase_name${NC}"
  echo -e "${BOLD}════════════════════════════════════════════════${NC}"
  echo ""
}

finish_phase() {
  echo ""
  echo -e "${BOLD}────────────────────────────────────────────────${NC}"
  echo -e "  ${_PHASE_NAME} Results: ${GREEN}${_PASS} PASS${NC} / ${RED}${_FAIL} FAIL${NC} / ${YELLOW}${_SKIP} SKIP${NC}  (total: ${_TOTAL})"
  echo -e "${BOLD}────────────────────────────────────────────────${NC}"
  echo ""
  # Write phase summary
  cat > "$RESULTS_JSON_DIR/_phase_$(echo "$_PHASE_NAME" | tr ' ' '_').json" <<PEOF
{
  "phase": "$_PHASE_NAME",
  "pass": $_PASS,
  "fail": $_FAIL,
  "skip": $_SKIP,
  "total": $_TOTAL
}
PEOF
}

# Record a test result
# Usage: record_result "T1.3" "d3-insecure" "PASS|FAIL|SKIP" "expected" "actual" "notes"
record_result() {
  local id="$1" fixture="$2" status="$3" expected="$4" actual="$5" notes="${6:-}"
  _TOTAL=$((_TOTAL + 1))

  case "$status" in
    PASS) _PASS=$((_PASS + 1)); color="$GREEN" ;;
    FAIL) _FAIL=$((_FAIL + 1)); color="$RED" ;;
    SKIP) _SKIP=$((_SKIP + 1)); color="$YELLOW" ;;
  esac

  echo -e "  [${color}${status}${NC}] ${BOLD}$id${NC} ($fixture) — $actual"

  # Write individual result JSON
  cat > "$RESULTS_JSON_DIR/${id}.json" <<REOF
{
  "id": "$id",
  "fixture": "$fixture",
  "status": "$status",
  "expected": $(json_escape "$expected"),
  "actual": $(json_escape "$actual"),
  "notes": $(json_escape "$notes")
}
REOF
}

# JSON-escape a string for safe embedding
json_escape() {
  local s="$1"
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/}"
  s="${s//$'\t'/\\t}"
  echo "\"$s\""
}

# Run a claude -p command, capture output, return the log file path
# Usage: run_claude_eval "prompt" "test_id" [extra_args...]
run_claude_eval() {
  local prompt="$1"
  local test_id="$2"
  shift 2
  local log_file="$RESULTS_LOG_DIR/${test_id}.log"

  # Run claude in non-interactive mode
  if claude -p "$prompt" \
    --allowedTools "Read,Glob,Grep,Bash,Skill,Write,Edit" \
    --max-turns 40 \
    "$@" \
    > "$log_file" 2>&1; then
    echo "$log_file"
    return 0
  else
    echo "$log_file"
    return 1
  fi
}

# Extract JSON from claude output log
# Looks for the last valid JSON object with expected keys
extract_json() {
  local log_file="$1"
  local key="${2:-overall_score}"  # Key to look for in JSON

  node -e "
    const fs = require('fs');
    const log = fs.readFileSync('$log_file', 'utf8');
    // Find all JSON blocks
    const re = /\`\`\`(?:json)?\s*(\{[\s\S]*?\})\s*\`\`\`/g;
    let match, last = null;
    while ((match = re.exec(log)) !== null) {
      try {
        const obj = JSON.parse(match[1]);
        if ('$key' in obj || Object.keys(obj).length > 2) last = obj;
      } catch {}
    }
    // Also try bare JSON (no code fences)
    if (!last) {
      const bare = log.match(/\{[\s\S]*\"$key\"[\s\S]*\}/);
      if (bare) {
        try { last = JSON.parse(bare[0]); } catch {}
      }
    }
    if (last) {
      process.stdout.write(JSON.stringify(last));
    } else {
      process.exit(1);
    }
  " 2>/dev/null
}

# Normalize eval-skill JSON for bash assertions.
# Keeps the public `scores.*` contract intact while adding internal D1-D6 aliases
# under `dimensions` for compatibility with older assertion helpers.
# Usage: json=$(extract_json "$log" "overall_score" | normalize_eval_json)
#   or:  json=$(normalize_eval_json <<< "$raw_json")
normalize_eval_json() {
  node -e "
    const input = require('fs').readFileSync('/dev/stdin', 'utf8').trim();
    if (!input) { process.exit(1); }
    const j = JSON.parse(input);

    const dimMap = {
      structure:'D1', structural:'D1', d1:'D1', d1_structure:'D1',
      trigger:'D2', activation:'D2', d2:'D2', d2_trigger:'D2',
      security:'D3', safety:'D3', d3:'D3', d3_security:'D3',
      functional:'D4', function:'D4', functionality:'D4', d4:'D4', d4_functional:'D4',
      comparative:'D5', comparison:'D5', value:'D5', d5:'D5', d5_comparative:'D5',
      uniqueness:'D6', unique:'D6', originality:'D6', d6:'D6', d6_uniqueness:'D6',
    };

    // Normalize a dimension string: 'D5 (comparative, score: 1)' → 'D5', 'functional' → 'D4'
    function normDim(s) {
      if (!s || typeof s !== 'string') return s;
      // Strip everything after first space or parenthesis: 'D5 (comparative, score: 1)' → 'D5'
      let clean = s.replace(/\\s*[\\(,].*$/, '').trim();
      const key = clean.toLowerCase().replace(/[^a-z0-9_]/g, '');
      return dimMap[key] || (key.match(/^d[1-6]$/) ? key.toUpperCase() : s);
    }

    // Mirror public scores into legacy dimensions aliases when present.
    if (j.scores && !j.dimensions) {
      j.dimensions = j.scores;
    }

    // Normalize weakest_dimension
    if (j.weakest_dimension) {
      j.weakest_dimension = normDim(j.weakest_dimension);
    }

    // Normalize dimensions object keys
    if (j.dimensions && typeof j.dimensions === 'object') {
      const newDims = {};
      for (const [k, v] of Object.entries(j.dimensions)) {
        const nk = normDim(k);
        newDims[nk] = v;
        // Also normalize dimension/dimension_name inside the value
        if (v && typeof v === 'object') {
          if (v.dimension) v.dimension = normDim(v.dimension);
          if (v.dimension_name) v.dimension_name = normDim(v.dimension_name);
        }
      }
      j.dimensions = newDims;
    }

    // Normalize improved_dimensions array
    if (Array.isArray(j.improved_dimensions)) {
      j.improved_dimensions = j.improved_dimensions.map(d => normDim(String(d)));
    }

    process.stdout.write(JSON.stringify(j));
  " 2>/dev/null
}

# Extract text output (non-JSON) from claude log
extract_text() {
  local log_file="$1"
  cat "$log_file" 2>/dev/null || echo ""
}

# Find manifest.json recursively under a directory
# Usage: find_manifest "/path/to/.skill-compass"
find_manifest() {
  local search_dir="$1"
  find "$search_dir" -name "manifest.json" -type f 2>/dev/null | head -1
}

# Search log file for pattern (searches the raw log, not extract_text)
# More reliable than extract_text + grep because it handles code blocks
# Usage: log_contains <log_file> <pattern>
log_contains() {
  local log_file="$1" pattern="$2"
  grep -qiE "$pattern" "$log_file" 2>/dev/null
}

# Try JSON field assertion first, fall back to log grep
# Usage: assert_output <log_file> <json_key> <json_field> <expected_value> <grep_pattern>
# Returns 0 if either JSON field matches OR log grep matches
assert_output() {
  local log_file="$1" json_key="$2" json_field="$3" expected="$4" grep_pattern="$5"
  local json
  json=$(extract_json "$log_file" "$json_key") 2>/dev/null
  if [ -n "$json" ]; then
    local actual
    actual=$(echo "$json" | node -e "
      const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
      const path = '$json_field'.split('.').filter(Boolean);
      let v = j;
      for (const p of path) { v = v?.[p]; }
      process.stdout.write(String(v ?? ''));
    " 2>/dev/null)
    if echo "$actual" | grep -qiE "$expected" 2>/dev/null; then
      return 0
    fi
  fi
  # Fallback: grep the raw log file
  log_contains "$log_file" "$grep_pattern"
}

# Check if a fixture directory exists
require_fixture() {
  local fixture="$1"
  local fixture_path="$FIXTURES_DIR/$fixture"
  if [ ! -d "$fixture_path" ] && [ ! -f "$fixture_path/SKILL.md" ]; then
    echo "MISSING"
    return 1
  fi
  echo "$fixture_path"
  return 0
}

# Wait for background jobs with timeout
wait_with_timeout() {
  local pid="$1"
  local timeout="${2:-300}"  # default 5 min
  local elapsed=0
  while kill -0 "$pid" 2>/dev/null; do
    if [ "$elapsed" -ge "$timeout" ]; then
      kill "$pid" 2>/dev/null
      return 1  # timeout
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done
  wait "$pid"
  return $?
}
