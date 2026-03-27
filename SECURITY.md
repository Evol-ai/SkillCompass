# Security & Trust Model

SkillCompass is a security-aware evaluation tool. Some of its behaviors may appear suspicious to automated scanners but are necessary for its core function. This document explains each one.

## Gate-Bypass Mechanism

**What:** Creates `.skill-compass/.gate-bypass` with a 5-second expiry timestamp.

**Why:** When `/eval-improve` writes an improved SKILL.md, the PostToolUse hook (`eval-gate.js`) would immediately re-scan the write and emit warnings — creating a noisy loop. The bypass suppresses this for 5 seconds, then auto-expires.

**Safeguards:**
- Expires automatically (timestamp-based, not permanent)
- Only suppresses SkillCompass's own hooks, not other plugins
- The improvement itself is validated by `output-guard.js` before writing

## File Writing

**What:** Writes to SKILL.md, `.skill-compass/` manifests, snapshots, and corrections.

**Why:** `/eval-improve` must modify the skill to fix weaknesses. `/eval-rollback` restores previous versions. Version management requires saving snapshots.

**Safeguards:**
- All writes are preceded by SHA-256 snapshots (rollback always available)
- Auto-rollback triggers if any dimension drops >2 points after improvement
- `output-guard.js` validates every improvement for URL injection, dangerous commands, and size anomalies before writing

## Local Script Execution

**What:** Runs `node -e` to invoke JavaScript validators and `bash hooks/scripts/pre-eval-scan.sh` for static security scanning.

**Why:** Local validators (D1 Structure, D2 Trigger, D3 Security) reduce LLM token consumption by ~60% on clear-cut issues. The pre-eval scanner blocks malicious content before it reaches the LLM.

**Safeguards:**
- All scripts are bundled in the package (no remote downloads)
- No network calls — all validation is local
- Scripts are read-only analysis tools, not installers

## Batch & CI Modes

**What:** `--fix` auto-improves FAIL skills. `--ci` runs without interactive prompts.

**Why:** Teams need automated quality gates in CI/CD pipelines. Batch audit enables evaluating all skills in a directory.

**Safeguards:**
- `--fix` requires explicit `--budget` parameter (prevents unbounded execution)
- `--ci` only suppresses prompts, not safety checks
- All auto-fixes still go through output-guard validation

## Autonomous Evolution

**What:** `/eval-evolve` chains eval → improve → re-eval for multiple rounds.

**Why:** Some skills need 3-6 rounds of improvement across different dimensions to reach PASS.

**Safeguards:**
- Requires user to explicitly invoke the command
- Default max 6 iterations, configurable via `--max-iterations`
- Requires external plugin (ralph-wiggum) — not bundled
- Each round has the same auto-rollback protection as single-round improve

## Reading User Skill Directories

**What:** Globs `~/.claude/skills/` and `.claude/skills/` for SKILL.md files.

**Why:** D6 Uniqueness evaluation needs to compare against installed skills to detect overlap and redundancy.

**Safeguards:**
- Read-only — never modifies other skills
- Only reads SKILL.md files, ignores all other file types
- Results are used solely for scoring, not transmitted anywhere

## No Network Activity

SkillCompass makes zero network calls. All evaluation, validation, and improvement happens locally. The only external dependency is Node.js (for JavaScript validators).
