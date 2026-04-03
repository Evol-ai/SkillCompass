# /skill-compass — Natural Language Dispatcher

This command accepts free-form natural language and routes to the appropriate SkillCompass command.

> **Locale**: 所有用户可见文本跟随会话语言。中文为默认示例，英文等效表述标注为 `EN:`。维度标签见 SKILL.md。
> EN: `> **Locale**: All user-facing text follows session language. Chinese is the default example; English equivalents are marked with `EN:`. Dimension labels: see SKILL.md.`

## Arguments

- `<message>` (required): Natural language description of what the user wants to do.

## Step 0: Setup-State Check

Before dispatching, check whether `.skill-compass/setup-state.json` exists in the current working directory.

- **If the file does NOT exist**: do not dispatch to any command. Instead, inform the user that SkillCompass has not been set up yet and guide them to run `/setup` first:
  - English: "SkillCompass is not set up yet. Please run `/setup` to initialize your skill inventory before using other commands."
  - Chinese: "SkillCompass 尚未初始化。请先运行 `/setup` 建立 skill 清单，然后再使用其他命令。"
  - (Follow the detected locale.)
- **If the file exists**: proceed to Step 1.

## Step 1: Parse Intent

Analyze the user's message and match to one of these intents:

| Intent keywords | Maps to | Command file |
|-----------------|---------|-------------|
| setup, inventory, health check, scan my skills, what skills do I have | setup | `commands/setup.md` |
| evaluate, score, review, check, assess, rate, diagnose | eval-skill | `commands/eval-skill.md` |
| improve, fix, upgrade, enhance, optimize, evolve (single round) | eval-improve | `commands/eval-improve.md` |
| security, scan, audit security, vulnerability, safe | eval-security | `commands/eval-security.md` |
| audit, batch, scan all, check all, evaluate all | eval-audit | `commands/eval-audit.md` |
| compare, diff, versus, vs, side by side | eval-compare | `commands/eval-compare.md` |
| merge, upstream, update from, sync with | eval-merge | `commands/eval-merge.md` |
| rollback, revert, restore, undo, go back | eval-rollback | `commands/eval-rollback.md` |
| evolve, auto-improve, loop, keep improving, until pass | eval-evolve | `commands/eval-evolve.md` |
| inbox, suggestions, manage skills, 建议, 管理 | skill-inbox | `commands/skill-inbox.md` |
| report, portfolio, health, 报告, 体检 | skill-report | `commands/skill-report.md` |

If no intent matches, show the top 3 most common operations in natural language and ask the user to clarify. Follow the detected locale:

- English: "Not sure what you'd like to do. Here are the most common operations: [Evaluate a skill / View skill suggestions / View skill report]. What would you like to do?"
- Chinese: "没有匹配到操作。以下是最常用的功能：[评测某个 skill / 查看 skill 建议 / 查看 skill 报告]。请问您想做什么？"

## Step 2: Extract Arguments

From the user's message, extract:
- **Path**: any file path or directory path mentioned (e.g., `./my-skill/SKILL.md`, `.claude/skills/`)
- **Flags**: any explicit flags (e.g., `--scope gate`, `--security-only`, `--ci`)
- **Skill name**: if referencing a skill by name without path, look for it in `.claude/skills/` and `~/.claude/skills/`
- **Version references**: version numbers like `1.0.0`, `1.0.0-evo.2`, or words like "previous", "last"

If a path is required but not provided, ask in the detected locale:
- English: "Which skill? Provide a path to SKILL.md or a skill name."
- Chinese: "请指定 skill 名称或 SKILL.md 路径。"

## Step 3: Dispatch

Use the **Read** tool to load `{baseDir}/commands/{matched-command}.md` and execute it with the extracted arguments.
