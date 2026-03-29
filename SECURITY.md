# Security & Trust Model

SkillCompass is a **security evaluation tool**. Like antivirus software that must read files to scan them, SkillCompass must read, analyze, and sometimes modify skill files to evaluate and improve their quality. The behaviors described below are intentional product features with built-in safeguards, not security risks.

## Reporting a Vulnerability

If you believe you have found a vulnerability in SkillCompass itself, **do not open a public issue**.

Use GitHub's private vulnerability reporting flow:
- [Report a vulnerability](https://github.com/Evol-ai/SkillCompass/security/advisories/new)
- Include the affected branch or version, reproduction steps, impact, and any proposed mitigation
- We will use the private advisory thread to coordinate triage and remediation updates

If your report is about an insecure third-party skill evaluated by SkillCompass, report it to that skill's maintainer instead of this repository.

## Zero Network Activity

SkillCompass makes **no network calls whatsoever**. All evaluation, validation, and improvement happens entirely on the local machine. No data is transmitted, no remote endpoints are contacted, no telemetry is collected. The only external dependency is Node.js for local JavaScript validators.

## Gate-Bypass (Temporary Hook Suppression)

**What:** `/eval-improve` creates `.skill-compass/.gate-bypass` with a 5-second expiry.

**Why it's necessary:** Without this, writing an improved SKILL.md triggers the eval-gate hook, which re-scans the file and emits warnings, creating an infinite loop. The bypass is a standard debounce mechanism.

**Why it's safe:**
- Auto-expires after 5 seconds and cannot persist indefinitely
- Only suppresses SkillCompass's own hooks, not other plugins
- The improvement is already validated by `output-guard.js` before writing
- This is the same class of suppression used by linters during auto-fix

## File Writing (SKILL.md, Manifests, Snapshots)

**What:** Modifies SKILL.md and writes to the `.skill-compass/` sidecar directory.

**Why it's necessary:** An improvement tool that cannot write improvements is useless. Version management requires saving snapshots for rollback.

**Why it's safe:**
- Every write is preceded by a SHA-256 snapshot so undo is always available
- `output-guard.js` validates all improvements before writing and blocks new URLs, dangerous commands, and size anomalies
- Auto-rollback triggers if any dimension drops by more than 2 points after improvement
- Version history is append-only; snapshots are not deleted automatically

## Local Script Execution (Node.js + Bash)

**What:** Runs `node -e` for JavaScript validators and `node hooks/scripts/pre-eval-scan.js` for static security scanning.

**Why it's necessary:** Local validators handle deterministic checks such as YAML structure, regex-based secret detection, and trigger analysis without consuming LLM tokens. The pre-eval scanner blocks malicious patterns before they reach the LLM context.

**Why it's safe:**
- All scripts are bundled in the package; there are no remote downloads or install scripts
- Scripts perform read-only analysis, aside from writing evaluation outputs where explicitly documented
- Source code is fully inspectable in `lib/` and `hooks/scripts/`

## Batch Auto-Fix and CI Mode

**What:** `--fix` auto-improves failing skills. `--ci` runs without interactive prompts.

**Why it's necessary:** Teams need automated quality gates in CI/CD pipelines, just like `eslint --fix` or `prettier --write`.

**Why it's safe:**
- `--fix` requires an explicit `--budget` parameter to prevent unbounded execution
- `--ci` suppresses prompts but not safety checks
- Exit codes `(0/1/2)` follow normal CI conventions

## Autonomous Multi-Round Evolution

**What:** `/eval-evolve` chains evaluate -> improve -> re-evaluate for up to 6 rounds.

**Why it's necessary:** Complex skills often need improvements across multiple dimensions to reach PASS quality.

**Why it's safe:**
- Only runs when the user explicitly invokes the command
- Hard cap at `--max-iterations` with a default of 6
- Requires a separate plugin (`ralph-wiggum`), which is not bundled
- Each round has full auto-rollback protection

## Reading Installed Skills Directory

**What:** Reads common skill roots such as `~/.claude/skills/`, `.claude/skills/`, `~/.openclaw/skills/`, `.openclaw/skills/`, plus any extra roots configured through the standard OpenClaw config field `skills.load.extraDirs` in `~/.openclaw/openclaw.json`.

**Why it's necessary:** D6 Uniqueness evaluation and `/setup` inventory compare the target skill against installed skills to detect overlap, broken installs, and redundant packages.

**Why it's safe:**
- Strictly read-only; discovery never modifies, deletes, or copies other skills
- Only reads SKILL.md metadata and content needed for local comparison and health checks
- Results are used solely for local scoring and inventory snapshots, never transmitted

## Local Sidecar State

**What:** Reads optional local config from `.skill-compass/config.json` and writes local state only inside `.skill-compass/`, including `setup-state.json`, manifests, snapshots, reports, and compatibility markers.

**Why it's necessary:** SkillCompass needs local configuration, snapshots, and inventory state so evaluations can be resumed, compared, tuned, and rolled back safely without changing other skills or system config.

**Why it's safe:**
- Sidecar config is optional, local, and plaintext
- State is stored next to the evaluated skill or current working copy, not in system directories
- Files are inspectable and scoped to SkillCompass behavior only
