# /skill-compass — Natural Language Dispatcher

This command accepts free-form natural language and routes to the appropriate SkillCompass command.

## Arguments

- `<message>` (required): Natural language description of what the user wants to do.

## Step 1: Parse Intent

Analyze the user's message and match to one of these intents:

| Intent keywords | Maps to | Command file |
|-----------------|---------|-------------|
| evaluate, score, review, check, assess, rate, diagnose | eval-skill | `commands/eval-skill.md` |
| improve, fix, upgrade, enhance, optimize, evolve (single round) | eval-improve | `commands/eval-improve.md` |
| security, scan, audit security, vulnerability, safe | eval-security | `commands/eval-security.md` |
| audit, batch, scan all, check all, evaluate all | eval-audit | `commands/eval-audit.md` |
| compare, diff, versus, vs, side by side | eval-compare | `commands/eval-compare.md` |
| merge, upstream, update from, sync with | eval-merge | `commands/eval-merge.md` |
| rollback, revert, restore, undo, go back | eval-rollback | `commands/eval-rollback.md` |
| evolve, auto-improve, loop, keep improving, until pass | eval-evolve | `commands/eval-evolve.md` |

If no intent matches, list all available commands with one-line descriptions and ask the user to clarify.

## Step 2: Extract Arguments

From the user's message, extract:
- **Path**: any file path or directory path mentioned (e.g., `./my-skill/SKILL.md`, `.claude/skills/`)
- **Flags**: any explicit flags (e.g., `--scope gate`, `--security-only`, `--ci`)
- **Skill name**: if referencing a skill by name without path, look for it in `.claude/skills/` and `~/.claude/skills/`
- **Version references**: version numbers like `1.0.0`, `1.0.0-evo.2`, or words like "previous", "last"

If a path is required but not provided, ask: "Which skill? Provide a path to SKILL.md or a skill name."

## Step 3: Dispatch

Use the **Read** tool to load `{baseDir}/commands/{matched-command}.md` and execute it with the extracted arguments.
