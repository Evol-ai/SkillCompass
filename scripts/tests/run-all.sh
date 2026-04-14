#!/usr/bin/env bash
# ============================================================
# SkillCompass v1.0.0 — Full Functional Test Runner
#
# Executes all test phases in order:
#   Phase A: Hook Verification (INT1)
#   Phase B: Core Commands (T1 + T3)
#   Phase C: Version Management Commands (T5 + T6 + T7)
#   Phase D: Compound Commands (T2 + T4)
#   Phase E: Integration Tests (INT2-INT5, T8)
#   Phase VM: Version Management Assertions (VM1-VM4)
#
# Usage:
#   bash run-all.sh              # Run everything
#   bash run-all.sh --phase a    # Run only Phase A
#   bash run-all.sh --phase b    # Run only Phase B
#   bash run-all.sh --phase a,b  # Run Phases A and B
#   bash run-all.sh --resume     # Skip already-completed phases
#
# Environment variables:
#   SC_DIR              — Path to SkillCompass (default: ~/skill-compass)
#   TEST_RESULTS_DIR    — Where to write results (default: ~/skill-compass-test-results)
#   PARALLEL            — Number of concurrent evaluations (default: 3)
# ============================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parse args
PHASES="a,b,c,d,e,vm"
RESUME=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --phase|-p) PHASES="$2"; shift 2 ;;
    --resume|-r) RESUME=true; shift ;;
    --help|-h)
      echo "Usage: bash run-all.sh [--phase a,b,c,d,e,vm] [--resume]"
      exit 0
      ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

export SC_DIR="${SC_DIR:-$HOME/skill-compass}"
export TEST_RESULTS_DIR="${TEST_RESULTS_DIR:-$HOME/skill-compass-test-results}"
export PARALLEL="${PARALLEL:-3}"

# Validate environment
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  SkillCompass v1.0.0 — Functional Test Suite        ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  SC_DIR:          $SC_DIR"
echo "║  RESULTS_DIR:     $TEST_RESULTS_DIR"
echo "║  Phases:          $PHASES"
echo "║  Resume:          $RESUME"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check prerequisites
if [ ! -d "$SC_DIR" ]; then
  echo "ERROR: SkillCompass not found at $SC_DIR"
  echo "Set SC_DIR environment variable to the correct path."
  exit 1
fi

if ! command -v claude &>/dev/null; then
  echo "ERROR: Claude Code not found. Install with: npm install -g @anthropic-ai/claude-code"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo "ERROR: Node.js not found."
  exit 1
fi

if [ ! -d "$SC_DIR/test-fixtures" ]; then
  echo "Test fixtures not found. Fetching from separate repo..."
  bash "$SC_DIR/scripts/fetch-fixtures.sh" || {
    echo "ERROR: Failed to fetch test fixtures."
    echo "Run: bash scripts/fetch-fixtures.sh"
    exit 1
  }
fi

# Create results directory
mkdir -p "$TEST_RESULTS_DIR/json" "$TEST_RESULTS_DIR/logs"

# Track overall start time
START_TIME=$(date +%s)

# Helper: check if phase should run
should_run() {
  echo ",$PHASES," | grep -qi ",$1,"
}

# Helper: check if phase already completed (for resume)
phase_done() {
  local phase_file="$TEST_RESULTS_DIR/json/_phase_$1.json"
  if [ "$RESUME" = true ] && [ -f "$phase_file" ]; then
    return 0
  fi
  return 1
}

# ── Phase A ──────
if should_run "a"; then
  if phase_done "Phase_A__Hook_Verification"; then
    echo "Phase A: SKIP (already completed, --resume)"
  else
    echo "Starting Phase A: Hook Verification..."
    bash "$SCRIPT_DIR/phase-a-hooks.sh" || echo "Phase A completed with errors"
  fi
fi

# ── Phase B ──────
if should_run "b"; then
  if phase_done "Phase_B__Core_Commands_(eval-skill_+_eval-security)"; then
    echo "Phase B: SKIP (already completed, --resume)"
  else
    echo "Starting Phase B: Core Commands..."
    bash "$SCRIPT_DIR/phase-b-core.sh" || echo "Phase B completed with errors"
  fi
fi

# ── Phase C ──────
if should_run "c"; then
  if phase_done "Phase_C__Version_Management_(compare_+_merge_+_rollback)"; then
    echo "Phase C: SKIP (already completed, --resume)"
  else
    echo "Starting Phase C: Version Management Commands..."
    bash "$SCRIPT_DIR/phase-c-version.sh" || echo "Phase C completed with errors"
  fi
fi

# ── Phase D ──────
if should_run "d"; then
  if phase_done "Phase_D__Compound_Commands_(eval-improve_+_eval-audit)"; then
    echo "Phase D: SKIP (already completed, --resume)"
  else
    echo "Starting Phase D: Compound Commands..."
    bash "$SCRIPT_DIR/phase-d-compound.sh" || echo "Phase D completed with errors"
  fi
fi

# ── Phase E ──────
if should_run "e"; then
  if phase_done "Phase_E__Integration_Tests"; then
    echo "Phase E: SKIP (already completed, --resume)"
  else
    echo "Starting Phase E: Integration Tests..."
    bash "$SCRIPT_DIR/phase-e-integration.sh" || echo "Phase E completed with errors"
  fi
fi

# ── Version Management Tests ──────
if should_run "vm"; then
  if phase_done "Version_Management_(VM1-VM4)"; then
    echo "Phase VM: SKIP (already completed, --resume)"
  else
    echo "Starting Version Management Tests..."
    bash "$SCRIPT_DIR/phase-vm.sh" || echo "Phase VM completed with errors"
  fi
fi

# ── Collect & Report ──────
END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))
ELAPSED_MIN=$((ELAPSED / 60))
ELAPSED_SEC=$((ELAPSED % 60))

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  All phases complete. Generating report...          ║"
echo "║  Total time: ${ELAPSED_MIN}m ${ELAPSED_SEC}s"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

node "$SCRIPT_DIR/collect-results.js"

echo ""
echo "Done. Results at: $TEST_RESULTS_DIR/"
echo "  - Individual results: $TEST_RESULTS_DIR/json/"
echo "  - Claude logs:        $TEST_RESULTS_DIR/logs/"
echo "  - Test report:        $TEST_RESULTS_DIR/test-report.md"
