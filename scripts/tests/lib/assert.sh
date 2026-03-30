#!/usr/bin/env bash
# ============================================================
# SkillCompass Test Harness — JSON Assertion Helpers
# All functions take a JSON string as first arg.
# Return 0 = assertion passes, 1 = fails.
# On failure, prints reason to stderr.
# ============================================================

# json_get_field <json> <field_path>
# Resolves a jq-style path and maps legacy .dimensions.D{N} assertions to the
# public .scores.{name} contract when scores are present.
json_get_field() {
  local json="$1" path="$2"
  echo "$json" | node -e "
    const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const rawPath = '$path';
    const parts = rawPath.split('.').filter(Boolean);
    const dimMap = { D1:'structure', D2:'trigger', D3:'security', D4:'functional', D5:'comparative', D6:'uniqueness' };

    let resolved = parts.slice();
    if (parts[0] === 'dimensions' && dimMap[parts[1]] && j.scores) {
      resolved = ['scores', dimMap[parts[1]], ...parts.slice(2)];
    }

    let v = j;
    for (const p of resolved) {
      v = v?.[p];
    }

    if (v === undefined || v === null) {
      process.stdout.write('');
    } else if (typeof v === 'object') {
      process.stdout.write(JSON.stringify(v));
    } else {
      process.stdout.write(String(v));
    }
  " 2>/dev/null
}

# assert_field_eq <json> <field_path> <expected_value>
# Uses jq-style dot notation: .overall_score, .scores.security.pass, .scores.uniqueness.details, etc.
assert_field_eq() {
  local json="$1" path="$2" expected="$3"
  local actual
  actual=$(json_get_field "$json" "$path")
  if [ "$actual" = "$expected" ]; then
    return 0
  else
    echo "ASSERT_EQ FAIL: $path expected=$expected actual=$actual" >&2
    return 1
  fi
}

# assert_field_lte <json> <field_path> <max_value>
assert_field_lte() {
  local json="$1" path="$2" max="$3"
  local actual
  actual=$(json_get_field "$json" "$path")
  actual=$(node -e "process.stdout.write(String(Number(process.argv[1] || 'NaN')))" "$actual" 2>/dev/null)
  if [ "$(echo "$actual <= $max" | bc -l 2>/dev/null || node -e "process.stdout.write(String($actual <= $max))")" = "1" ] || \
     [ "$(node -e "process.stdout.write(String(Number('$actual') <= Number('$max')))" 2>/dev/null)" = "true" ]; then
    return 0
  else
    echo "ASSERT_LTE FAIL: $path=$actual > $max" >&2
    return 1
  fi
}

# assert_field_gte <json> <field_path> <min_value>
assert_field_gte() {
  local json="$1" path="$2" min="$3"
  local actual
  actual=$(json_get_field "$json" "$path")
  actual=$(node -e "process.stdout.write(String(Number(process.argv[1] || 'NaN')))" "$actual" 2>/dev/null)
  if [ "$(node -e "process.stdout.write(String(Number('$actual') >= Number('$min')))" 2>/dev/null)" = "true" ]; then
    return 0
  else
    echo "ASSERT_GTE FAIL: $path=$actual < $min" >&2
    return 1
  fi
}

# assert_field_between <json> <field_path> <min> <max>
assert_field_between() {
  local json="$1" path="$2" min="$3" max="$4"
  local actual
  actual=$(json_get_field "$json" "$path")
  actual=$(node -e "process.stdout.write(String(Number(process.argv[1] || 'NaN')))" "$actual" 2>/dev/null)
  if [ "$(node -e "process.stdout.write(String(Number('$actual') >= Number('$min') && Number('$actual') <= Number('$max')))" 2>/dev/null)" = "true" ]; then
    return 0
  else
    echo "ASSERT_BETWEEN FAIL: $path=$actual not in [$min, $max]" >&2
    return 1
  fi
}

# assert_field_exists <json> <field_path>
assert_field_exists() {
  local json="$1" path="$2"
  local exists
  exists=$(node -e "process.stdout.write(String(process.argv[1] !== ''))" "$(json_get_field "$json" "$path")" 2>/dev/null)
  if [ "$exists" = "true" ]; then
    return 0
  else
    echo "ASSERT_EXISTS FAIL: $path is missing" >&2
    return 1
  fi
}

# assert_field_contains <json> <field_path> <substring>
# Works on string fields or stringified values
assert_field_contains() {
  local json="$1" path="$2" substr="$3"
  local contains
  contains=$(node -e "
    const s = (process.argv[1] || '').toLowerCase();
    const needle = (process.argv[2] || '').toLowerCase();
    process.stdout.write(String(s.includes(needle)));
  " "$(json_get_field "$json" "$path")" "$substr" 2>/dev/null)
  if [ "$contains" = "true" ]; then
    return 0
  else
    echo "ASSERT_CONTAINS FAIL: $path does not contain '$substr'" >&2
    return 1
  fi
}

# assert_text_contains <text> <substring>
assert_text_contains() {
  local text="$1" substr="$2"
  if echo "$text" | grep -qi "$substr" 2>/dev/null; then
    return 0
  else
    echo "ASSERT_TEXT FAIL: output does not contain '$substr'" >&2
    return 1
  fi
}

# assert_file_exists <path>
assert_file_exists() {
  if [ -f "$1" ] || [ -d "$1" ]; then
    return 0
  else
    echo "ASSERT_FILE FAIL: $1 does not exist" >&2
    return 1
  fi
}

# assert_json_valid <json>
assert_json_valid() {
  echo "$1" | node -e "
    try { JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); process.exit(0); }
    catch(e) { console.error('ASSERT_JSON FAIL: invalid JSON — ' + e.message); process.exit(1); }
  " 2>/dev/null
}

# assert_array_length_gte <json> <field_path> <min_length>
assert_array_length_gte() {
  local json="$1" path="$2" min="$3"
  local len
  len=$(echo "$json" | node -e "
    const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const path = '$path'.split('.').filter(Boolean);
    let v = j;
    for (const p of path) { v = v?.[p]; }
    process.stdout.write(String(Array.isArray(v) ? v.length : 0));
  " 2>/dev/null)
  if [ "$(node -e "process.stdout.write(String(Number('$len') >= Number('$min')))" 2>/dev/null)" = "true" ]; then
    return 0
  else
    echo "ASSERT_ARRAY_LEN FAIL: $path length=$len < $min" >&2
    return 1
  fi
}

# normalize_dimension <dim_string>
# Converts public names and legacy aliases into a shared canonical form for comparisons
normalize_dimension() {
  local dim="$1"
  local lower
  lower=$(echo "$dim" | tr '[:upper:]' '[:lower:]')
  case "$lower" in
    d1|structure|structural) echo "D1" ;;
    d2|trigger|activation) echo "D2" ;;
    d3|security|safety) echo "D3" ;;
    d4|functional|function|functionality) echo "D4" ;;
    d5|comparative|comparison|value) echo "D5" ;;
    d6|uniqueness|unique|originality) echo "D6" ;;
    *) echo "$dim" ;;
  esac
}

# assert_dimension_eq <json> <field_path> <expected_dim>
# Like assert_field_eq but normalizes dimension names before comparing
assert_dimension_eq() {
  local json="$1" path="$2" expected="$3"
  local actual raw
  raw=$(json_get_field "$json" "$path")
  actual=$(normalize_dimension "$raw")
  expected=$(normalize_dimension "$expected")
  if [ "$actual" = "$expected" ]; then
    return 0
  else
    echo "ASSERT_DIM_EQ FAIL: $path expected=$expected actual=$actual (raw=$raw)" >&2
    return 1
  fi
}

# assert_dimension_in_bottom_n <json> <target_dim> <n>
# Checks that target dimension is among the N lowest-scoring dimensions
assert_dimension_in_bottom_n() {
  local json="$1" target="$2" n="${3:-2}"
  local result
  result=$(echo "$json" | node -e "
    const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const dims = j.scores || j.dimensions || {};
    const normalize = (d) => {
      const m = {structure:'D1',trigger:'D2',security:'D3',functional:'D4',comparative:'D5',uniqueness:'D6'};
      return m[d.toLowerCase()] || d.toUpperCase();
    };
    const target = normalize('$target');
    const scores = [];
    for (const [k, v] of Object.entries(dims)) {
      const nk = normalize(k);
      const score = typeof v === 'object' ? (v.score ?? 0) : Number(v);
      scores.push({ dim: nk, score });
    }
    scores.sort((a, b) => a.score - b.score);
    const bottomN = scores.slice(0, $n).map(s => s.dim);
    process.stdout.write(bottomN.includes(target) ? 'true' : 'false');
  " 2>/dev/null)
  if [ "$result" = "true" ]; then
    return 0
  else
    echo "ASSERT_DIM_BOTTOM FAIL: $target not in bottom $n dimensions" >&2
    return 1
  fi
}

# assert_array_contains_normalized <json> <field_path> <target_dim>
# Checks if an array field contains the target dimension (with name normalization)
assert_array_contains_normalized() {
  local json="$1" path="$2" target="$3"
  local result
  result=$(echo "$json" | node -e "
    const j = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const path = '$path'.split('.').filter(Boolean);
    let v = j;
    for (const p of path) { v = v?.[p]; }
    const normalize = (d) => {
      const m = {structure:'D1',trigger:'D2',security:'D3',functional:'D4',comparative:'D5',uniqueness:'D6',
                 d1:'D1',d2:'D2',d3:'D3',d4:'D4',d5:'D5',d6:'D6'};
      return m[d.toLowerCase()] || d;
    };
    const target = normalize('$target');
    const arr = Array.isArray(v) ? v : [];
    const found = arr.some(item => normalize(String(item)) === target);
    process.stdout.write(found ? 'true' : 'false');
  " 2>/dev/null)
  if [ "$result" = "true" ]; then
    return 0
  else
    echo "ASSERT_ARRAY_CONTAINS FAIL: $path does not contain $target (normalized)" >&2
    return 1
  fi
}

# Composite: run multiple assertions, collect results
# Usage: run_assertions "json_string" assertion1 assertion2 ...
# Each assertion is a string like "field_eq .verdict FAIL"
# Returns number of failures
run_assertions() {
  local json="$1"
  shift
  local failures=0
  local details=""

  for assertion in "$@"; do
    local type arg1 arg2 arg3
    read -r type arg1 arg2 arg3 <<< "$assertion"
    local result=0

    case "$type" in
      field_eq)      assert_field_eq "$json" "$arg1" "$arg2" 2>/dev/null || result=1 ;;
      field_lte)     assert_field_lte "$json" "$arg1" "$arg2" 2>/dev/null || result=1 ;;
      field_gte)     assert_field_gte "$json" "$arg1" "$arg2" 2>/dev/null || result=1 ;;
      field_between) assert_field_between "$json" "$arg1" "$arg2" "$arg3" 2>/dev/null || result=1 ;;
      field_exists)  assert_field_exists "$json" "$arg1" 2>/dev/null || result=1 ;;
      field_contains) assert_field_contains "$json" "$arg1" "$arg2" 2>/dev/null || result=1 ;;
      *) echo "Unknown assertion: $type" >&2; result=1 ;;
    esac

    if [ "$result" -ne 0 ]; then
      failures=$((failures + 1))
      details="${details}${type} ${arg1} ${arg2} ${arg3}; "
    fi
  done

  if [ -n "$details" ]; then
    echo "$details" >&2
  fi
  return $failures
}
