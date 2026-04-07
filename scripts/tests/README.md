# SkillCompass v1.0.0 — Functional Test Harness

Automated end-to-end testing of all 8 SkillCompass commands using 21 test fixtures.

## Quick Start (on Codespace)

```bash
# 1. Copy test scripts to Codespace
cp -r ~/evo-pointer/scripts/tests/ ~/skill-compass-tests/

# 2. Run all tests
SC_DIR=~/skill-compass bash ~/skill-compass-tests/run-all.sh

# 3. Run a single phase
bash ~/skill-compass-tests/run-all.sh --phase a     # Hooks only (~2 min)
bash ~/skill-compass-tests/run-all.sh --phase b     # Core eval (~45 min)
bash ~/skill-compass-tests/run-all.sh --phase a,b   # Hooks + Core

# 4. Resume after interruption
bash ~/skill-compass-tests/run-all.sh --resume
```

## Architecture

```
tests/
├── run-all.sh              # Main orchestrator
├── lib/
│   ├── helpers.sh          # Logging, prompt builders, JSON extraction
│   └── assert.sh           # JSON assertion functions (field_eq, lte, gte, between, etc.)
├── phase-a-hooks.sh        # INT1: post-skill-edit.js + eval-gate.js
├── phase-b-core.sh         # T1 (eval-skill, 13+2 fixtures) + T3 (eval-security, 3 fixtures)
├── phase-c-version.sh      # T5 (compare) + T6 (merge) + T7 (rollback)
├── phase-d-compound.sh     # T2 (eval-improve) + T4 (eval-audit)
├── phase-e-integration.sh  # INT2 (Claudeception) + INT3 (ralph-wiggum) + INT4/INT5 + T8
├── phase-vm.sh             # VM1-VM4 version management assertions
└── collect-results.js      # Aggregates JSON results → test-report.md
```

## Test Coverage

| Phase | Tests | Commands | Estimate |
|-------|-------|----------|----------|
| A: Hooks | 6 | post-skill-edit, eval-gate | 2 min |
| B: Core | 18 | /eval-skill, /eval-security | 45-60 min |
| C: Version | 8 | /eval-compare, /eval-merge, /eval-rollback | 25 min |
| D: Compound | 6 | /eval-improve, /eval-audit | 30 min |
| E: Integration | 12 | INT2-INT5, /eval-evolve | 20 min |
| VM: Versioning | 6 | Manifest/snapshot assertions | 5 min |
| **Total** | **56** | **8 commands** | **~2 hours** |

## How It Works

1. Each test calls `claude -p` with a prompt that invokes a SkillCompass command
2. Claude reads the fixture SKILL.md, loads the command definition, and runs the evaluation
3. The test script extracts JSON from Claude's output
4. Assertions validate the JSON against expected values
5. Results are written as individual JSON files
6. `collect-results.js` aggregates everything into a markdown report

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SC_DIR` | `~/skill-compass` | SkillCompass installation path |
| `TEST_RESULTS_DIR` | `~/skill-compass-test-results` | Where results are written |
| `PARALLEL` | `3` | Concurrent evaluations (not yet used) |

## Output

```
~/skill-compass-test-results/
├── json/
│   ├── T1.1.json        # Individual test result
│   ├── T1.1_raw.json    # Raw eval JSON from Claude
│   ├── _phase_*.json    # Phase summaries
│   └── ...
├── logs/
│   ├── T1.1.log         # Full Claude output
│   └── ...
└── test-report.md       # Aggregated report
```

## Fixture Requirements

All fixtures must be at `$SC_DIR/test-fixtures/`:
- `d1-broken-structure/` through `d6-duplicate/` (dimension weakness)
- `atom-formatter/`, `composite-workflow/` (type/trigger)
- `edge-empty/`, `edge-no-yaml/`, `edge-yaml-only/`, `edge-huge/`, `edge-non-english/`
- `rollback-history/`, `merge-scenario/`, `weak-skill/`, `audit-batch/`

## OpenClaw Event Flow Checks

For CI-friendly OpenClaw end-to-end simulation without a real host runtime:

```bash
npm run build:oc
npm run verify:oc:event
```

What this validates:
- Medium-only D3 does not push a security alert.
- D3 critical/high findings do push a security alert.
- Directory `skillPath` resolves `SKILL.md` correctly.
- Directory without `SKILL.md` does not push.
- `/sc eval` keeps non-security high-risk messaging as quality-only.
