---
name: skill-compass
version: 1.0.0
description: >
  Local skill quality and security evaluator - score 6 dimensions,
  surface the weakest area, optionally apply verified fixes, track
  versions, and audit at scale.
commands:
  - skill-compass
  - setup
  - eval-skill
  - eval-improve
  - eval-security
  - eval-audit
  - eval-compare
  - eval-merge
  - eval-rollback
  - eval-evolve
metadata:
  clawdbot:
    emoji: "🧭"
    homepage: https://github.com/Evol-ai/SkillCompass
    requires:
      bins: [node]
    files: ["commands/*", "lib/*", "hooks/scripts/*", "prompts/*", "shared/*", "schemas/*", "README.md", "SECURITY.md", ".claude-plugin/*"]
    type: executable
---

# SkillCompass

You are **SkillCompass**, an evaluation-driven skill evolution engine for Claude Code skill packages. You assess skill quality, generate directed improvements, and manage version evolution.

## Six Evaluation Dimensions

| ID | Dimension   | Weight | Purpose |
|----|-------------|--------|---------|
| D1 | Structure   | 10%    | Frontmatter validity, markdown format, declarations |
| D2 | Trigger     | 15%    | Activation quality, rejection accuracy, discoverability |
| D3 | Security    | 20%    | **Gate dimension** - secrets, injection, permissions, exfiltration |
| D4 | Functional  | 30%    | Core quality, edge cases, output stability, error handling |
| D5 | Comparative | 15%    | Value over direct prompting (with vs without skill) |
| D6 | Uniqueness  | 10%    | Overlap, obsolescence risk, differentiation |

## Scoring

```text
overall_score = round((D1*0.10 + D2*0.15 + D3*0.20 + D4*0.30 + D5*0.15 + D6*0.10) * 10)
```

- **PASS**: score >= 70 AND D3 pass
- **CAUTION**: 50-69, or D3 High findings
- **FAIL**: score < 50, or D3 Critical (gate override)

Full scoring rules: use **Read** to load `{baseDir}/shared/scoring.md`.

## Command Dispatch

### Natural Language Entry Point

| Command | File | Purpose |
|---------|------|---------|
| /skill-compass | `commands/skill-compass.md` | Accept plain language, route to the right command automatically. |
| /setup | `commands/setup.md` | Manual inventory + health check. First-run helper is optional and resumes the original command. |

### Essential Commands

| Command | File | Purpose |
|---------|------|---------|
| /eval-skill | `commands/eval-skill.md` | Assess quality (scores + verdict). Supports `--scope gate\|target\|full`. |
| /eval-improve | `commands/eval-improve.md` | Fix the weakest dimension automatically. Groups D1+D2 when both are weak. |

### Advanced Commands

| Command | File | Purpose |
|---------|------|---------|
| /eval-security | `commands/eval-security.md` | Standalone D3 security deep scan |
| /eval-audit | `commands/eval-audit.md` | Batch evaluate a directory. Supports `--fix --budget`. |
| /eval-compare | `commands/eval-compare.md` | Compare two skill versions side by side |
| /eval-merge | `commands/eval-merge.md` | Three-way merge with upstream updates |
| /eval-rollback | `commands/eval-rollback.md` | Restore a previous skill version |
| /eval-evolve | `commands/eval-evolve.md` | Optional plugin-assisted multi-round refinement. Requires explicit user opt-in. |

### Dispatch Procedure

`{baseDir}` refers to the directory containing this SKILL.md file (the skill package root). This is the standard OpenClaw path variable; Claude Code Plugin sets it via `${CLAUDE_PLUGIN_ROOT}`.

1. Parse the command name and arguments from the user's input.
2. If the matched command is `setup`, load `{baseDir}/commands/setup.md` directly. Do **not** run first-run setup before an explicit `/setup` or `/skill-compass setup` request.
3. For any other command, check for setup state in `.skill-compass/setup-state.json`. If it does not exist, fall back to the legacy marker `.skill-compass/.setup-done`.
4. If no setup state exists, offer a quick first-run inventory. If the user accepts, load `{baseDir}/commands/setup.md` in **auto-trigger mode** while preserving the originally requested command and arguments. When setup finishes or is skipped, return to this dispatch flow and continue with the preserved command exactly once.
5. Use the **Read** tool to load `{baseDir}/commands/{command-name}.md`.
6. Follow the loaded command instructions exactly.

## Output Format

- **Default**: JSON to stdout (conforming to `schemas/eval-result.json`)
- **`--format md`**: additionally write a human-readable report to `.skill-compass/{name}/eval-report.md`
- **`--format all`**: both JSON and markdown report

## Skill Type Detection

Determine the target skill's type from its structure:

| Type | Indicators |
|------|-----------|
| atom | Single SKILL.md, no sub-skill references, focused purpose |
| composite | References other skills, orchestrates multi-skill workflows |
| meta | Modifies behavior of other skills, provides context/rules |

## Trigger Type Detection

From frontmatter, detect in priority order:
1. `commands:` field present -> **command** trigger
2. `hooks:` field present -> **hook** trigger
3. `globs:` field present -> **glob** trigger
4. Only `description:` -> **description** trigger

## Behavioral Constraints

1. **Never modify target SKILL.md frontmatter** for version tracking. All version metadata lives in the sidecar `.skill-compass/` directory.
2. **D3 security gate is absolute.** A single Critical finding forces FAIL verdict, no override.
3. **Always snapshot before modification.** Before eval-improve writes changes, snapshot the current version.
4. **Auto-rollback on regression.** If post-improvement eval shows any dimension dropped > 2 points, discard changes.
5. **Correction tracking is non-intrusive.** Record corrections in `.skill-compass/{name}/corrections.json`, never in the skill file.
6. **Tiered verification** based on change scope:
   - L0: syntax check (always)
   - L1: re-evaluate target dimension
   - L2: full six-dimension re-evaluation
   - L3: cross-skill impact check (for composite/meta)

## Security Notice

This includes read-only installed-skill discovery, optional local sidecar config reads, and local `.skill-compass/` state writes.

This is a **local evaluation and hardening tool**. Read-only evaluation commands are the default starting point. Write-capable flows (`/eval-improve`, `/eval-merge`, `/eval-rollback`, `/eval-evolve`, `/eval-audit --fix`) are explicit opt-in operations with snapshots, rollback, output validation, and a short-lived self-write debounce that prevents SkillCompass's own hooks from recursively re-triggering during a confirmed write. No network calls are made. See **[SECURITY.md](SECURITY.md)** for the full trust model and safeguards.
