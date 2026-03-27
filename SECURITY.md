# Security & Trust Model

SkillCompass is a **security evaluation tool** — like antivirus software that must read files to scan them, SkillCompass must read, analyze, and sometimes modify skill files to evaluate and improve their quality. The behaviors described below are **intentional product features with built-in safeguards**, not security risks.

## Reporting a Vulnerability

If you believe you have found a vulnerability in SkillCompass itself, **do not open a public issue**.

Use GitHub's private vulnerability reporting flow:
- [Report a vulnerability](https://github.com/Evol-ai/SkillCompass/security/advisories/new)
- Include the affected branch or version, reproduction steps, impact, and any proposed mitigation
- We will use the private advisory thread to coordinate triage and remediation updates

If your report is about an insecure third-party skill evaluated by SkillCompass, report it to that skill's maintainer instead of this repository.

## Zero Network Activity

SkillCompass makes **no network calls whatsoever**. All evaluation, validation, and improvement happens entirely on the local machine. No data is transmitted, no remote endpoints are contacted, no telemetry is collected. The only external dependency is Node.js (for local JavaScript validators).

## Gate-Bypass (Temporary Hook Suppression)

**What:** `/eval-improve` creates `.skill-compass/.gate-bypass` with a 5-second expiry.

**Why it's necessary:** Without this, writing an improved SKILL.md triggers the eval-gate hook, which re-scans the file and emits warnings — creating an infinite loop (improve → gate fires → re-check → gate fires again). The bypass is a standard debounce mechanism.

**Why it's safe:**
- Auto-expires after 5 seconds (timestamp-based, cannot persist)
- Only suppresses SkillCompass's own hooks, not other plugins
- The improvement is already validated by output-guard before writing
- Identical pattern to how linters suppress re-lint during auto-fix

## File Writing (SKILL.md, Manifests, Snapshots)

**What:** Modifies SKILL.md and writes to `.skill-compass/` sidecar directory.

**Why it's necessary:** An improvement tool that cannot write improvements is useless. Version management requires saving snapshots for rollback.

**Why it's safe:**
- Every write is preceded by a SHA-256 snapshot (undo always available)
- `output-guard.js` validates all improvements before writing — blocks new URLs, dangerous commands, and size anomalies
- Auto-rollback if any dimension drops >2 points after improvement
- Version history is append-only; no snapshots are ever deleted automatically

## Local Script Execution (Node.js + Bash)

**What:** Runs `node -e` for JavaScript validators and `bash pre-eval-scan.sh` for static security scanning.

**Why it's necessary:** Local validators handle deterministic checks (YAML structure, regex-based secret detection, trigger analysis) without consuming LLM tokens — saving ~60% on clear-cut issues. The pre-eval scanner blocks malicious patterns before they reach the LLM context.

**Why it's safe:**
- All scripts are bundled in the package — no remote downloads, no install scripts
- Scripts perform read-only analysis (no side effects beyond writing evaluation results)
- Source code is fully inspectable in `lib/` and `hooks/scripts/`

## Batch Auto-Fix and CI Mode

**What:** `--fix` auto-improves failing skills. `--ci` runs without interactive prompts.

**Why it's necessary:** Teams need automated quality gates in CI/CD pipelines, just like `eslint --fix` or `prettier --write`.

**Why it's safe:**
- `--fix` requires explicit `--budget` parameter — prevents unbounded execution
- `--ci` suppresses prompts but not safety checks (output-guard still validates)
- Exit codes (0/1/2) follow standard CI conventions

## Autonomous Multi-Round Evolution

**What:** `/eval-evolve` chains evaluate → improve → re-evaluate for up to 6 rounds.

**Why it's necessary:** Complex skills often need improvements across multiple dimensions to reach PASS quality.

**Why it's safe:**
- Only runs when user explicitly invokes the command
- Hard cap at `--max-iterations` (default 6)
- Requires separate plugin (ralph-wiggum) — not bundled, user must install independently
- Each round has full auto-rollback protection

## Reading Installed Skills Directory

**What:** Reads `~/.claude/skills/` and `.claude/skills/` for SKILL.md files.

**Why it's necessary:** D6 Uniqueness evaluation compares the target skill against installed skills to detect overlap and redundancy — preventing users from maintaining duplicate skills.

**Why it's safe:**
- Strictly read-only — never modifies, deletes, or copies other skills
- Only reads SKILL.md frontmatter for comparison, ignores all other files
- Results used solely for local scoring, never transmitted
