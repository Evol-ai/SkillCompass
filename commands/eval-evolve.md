# /eval-evolve — Optional Plugin-Assisted Multi-Round Evolution via Ralph Loop

> **Locale**: 所有用户可见文本跟随会话语言。中文为默认示例，英文等效表述标注为 `EN:`。维度标签见 SKILL.md。
> EN: `> **Locale**: All user-facing text follows session language. Chinese is the default example; English equivalents are marked with `EN:`. Dimension labels: see SKILL.md.`

## Arguments

- `<path>` (required): Path to the SKILL.md file to evolve.
- `--max-iterations <n>` (optional): Max improvement rounds. Default: 6.
- `--target-score <n>` (optional): Stop when overall_score >= n. Default: 70.
- `--internal` (optional): Skip all interactive prompts. Used when this command is
  called programmatically by another command or script.

## Prerequisites

- **Recommended model: Claude Opus 4.6** (`claude-opus-4-6`). Multi-round evolution requires consistent scoring across iterations to detect genuine improvements vs noise. Weaker models may cause the evolution loop to oscillate rather than converge.

- This command requires the **ralph-wiggum** plugin. If not installed, present the
  user with a choice **before** attempting any plugin call:

  ```
  ┌─ 需要插件 ralph-wiggum ──────────────────────────────┐
  │  此命令依赖 ralph-wiggum 插件才能运行多轮进化循环。  │
  │                                                        │
  │  [安装 ralph-wiggum 插件]  [取消]                      │
  └────────────────────────────────────────────────────────┘
  ```

  - If the user chooses **安装 ralph-wiggum 插件**: run
    `claude plugin install ralph-wiggum@claude-code-plugins` and continue.
  - If the user chooses **取消**: stop immediately with no further action.
  - If `--internal` is passed, skip the prompt and run the install command directly.

## What This Command Does

Generates and executes a `/ralph-loop` invocation that chains `/eval-skill` → `/eval-improve` automatically until the skill reaches PASS verdict (or hits the iteration limit). This is a power-user workflow, not the default path for normal evaluations.

**You do not implement the loop yourself.** You build the prompt and hand off to Ralph.

## Step 1: Validate

1. Confirm the target SKILL.md file exists (use **Read**).
2. Check if a Ralph loop is already active (check `.claude/ralph-loop.local.md`). If active, tell the user to `/cancel-ralph` first and stop.

## Step 2: Read Current State

Load `.skill-compass/{skill-name}/manifest.json` if it exists. Extract:
- `current_version`
- Last `overall_score` and `verdict`

If no manifest exists, note: "首次评估 — 从零开始。" (EN: "First evaluation — starting from scratch.")

## Step 3: Build the Ralph Prompt

Construct the following prompt text, substituting `{SKILL_PATH}` and `{TARGET_SCORE}`:

```
You are running an autonomous skill evolution loop.

Target: {SKILL_PATH}
Goal: overall_score >= {TARGET_SCORE} with verdict PASS

## Each iteration:

1. Run /eval-skill {SKILL_PATH} --scope full
2. Read the JSON result. Check verdict and overall_score.
3. If verdict is "PASS" and overall_score >= {TARGET_SCORE}:
   → Output: <promise>PASS</promise>
   → Stop.
4. If verdict is not PASS:
   → Run /eval-improve {SKILL_PATH}
   → eval-improve will target the weakest dimension automatically.
5. After eval-improve completes, this iteration is done.
   The next iteration will re-evaluate from step 1.

## Rules:
- Do NOT output <promise>PASS</promise> unless the eval-skill JSON verdict is literally "PASS".
- If eval-improve reports a regression (score dropped), let the next iteration re-evaluate — it may auto-rollback.
- Be concise. No lengthy explanations between steps.
- After outputting <promise>PASS</promise>, you MUST generate the Evolution Report by reading the manifest and following Step 5 of eval-evolve.md.
```

## Step 4: Show Preview and Execute

Display to the user (follow session locale):

```
进化计划：                          (EN: Evolution plan:)
  Skill:      {skill-name}
  目标：      分数 >= {TARGET_SCORE}，评级 = PASS
  最大轮数：  {MAX_ITERATIONS}
  预计 token：~{MAX_ITERATIONS × 60}K（最坏情况）

正在启动 Ralph 循环…               (EN: Starting Ralph loop...)
```

Progress messages during the loop also follow the session locale. Examples:

| Event | Chinese | English |
|-------|---------|---------|
| Iteration start | `[第 N 轮] 正在评估…` | `[Round N] Evaluating…` |
| Improvement applied | `[第 N 轮] 已改进维度：{dim_label}` | `[Round N] Improved: {dim_label}` |
| Rollback | `[第 N 轮] 检测到回退，已撤销更改` | `[Round N] Regression detected, rolled back` |
| PASS reached | `✓ 已达到 PASS 评级（第 N 轮）` | `✓ PASS reached (Round N)` |
| Max iterations | `⚠ 已达最大轮数，未能达到 PASS` | `⚠ Max iterations reached without PASS` |

Then execute:

```
/ralph-loop "{prompt_text}" --max-iterations {MAX_ITERATIONS} --completion-promise "PASS"
```

## Dimension Label Reference

见 SKILL.md 的 **Dimension label mapping** 表（canonical，所有命令均以该表为准）。

Example: instead of "D2 ({score}/10)", write "触发 D2 ({score}/10)" (or "Trigger D2 ({score}/10)" in English).

## Step 5: Evolution Report (Mandatory)

When the Ralph loop terminates (by PASS or max-iterations), **you must generate the Evolution Report**. This is the most important output of the entire command — it makes the evolution value visible to the user.

### 5.1: Gather Data

Read `.skill-compass/{skill-name}/manifest.json`. Extract the `versions` array. For each version created during this evolution session (filter by `trigger: "eval-improve"` entries after the starting version):
- `version`, `overall_score`, `verdict`, `target_dimension`

Also read `.skill-compass/{skill-name}/corrections.json` if it exists, for changelog details.

### 5.2: Generate Report

Display the following report to the user (follow session locale):

```
═══════════════════════════════════════════════════════
  进化报告：{skill-name}           (EN: Evolution Report)
  {start_version} → {final_version}  |  {total_rounds} 轮
═══════════════════════════════════════════════════════

  分数：{start_score} → {final_score}  ({+delta})
  评级：{start_verdict} → {final_verdict}

  ── 分数曲线 ──────────────────────────────────────────
  (EN: Score Curve)

  第 0 轮（基线）：    {score}  {verdict}  ████████░░░░░░░░░░░░
  第 1 轮（{dim_label}）：{score}  {verdict}  ██████████░░░░░░░░░░
  第 2 轮（{dim_label}）：{score}  {verdict}  █████████████░░░░░░░
  第 3 轮（{dim_label}）：{score}  {verdict}  ██████████████████░░
  ...

  ── 具体改动 ──────────────────────────────────────────
  (EN: What Changed)

  第 1 轮 — {dim_label} ({dim_score_before} → {dim_score_after})
    问题：  {one-sentence plain-language description of what was wrong}
    修复：  {one-sentence plain-language description of what was changed}
    效果：  {what the user gains from this fix}

  第 2 轮 — {dim_label} ({dim_score_before} → {dim_score_after})
    问题：  {description}
    修复：  {description}
    效果：  {description}

  ...

  ── 剩余优化空间 ──────────────────────────────────────
  (EN: Remaining Opportunities)

  {if verdict is PASS:}
    ✓ Skill 已达到质量标准。当前最弱项：{dim_label} ({score}/10)。

  {if verdict is not PASS (hit max-iterations):}
    ✗ 经过 {max_iterations} 轮后仍未达到 PASS。
    当前最弱项：{dim_label} ({score}/10)
    建议：手动检查 {dim_label} — 自动化改进可能已到瓶颈。

═══════════════════════════════════════════════════════
```

After the report block, present the user with a choice (do **not** print raw commands):

```
┌─ 下一步 ──────────────────────────────────────────────┐
│                                                         │
│  [继续打磨]   [查看完整评估]   [完成]                   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

- **继续打磨** (EN: Keep Polishing): run `/eval-improve {SKILL_PATH}` targeting the
  weakest dimension. If `--internal` is passed, skip the prompt and do nothing (caller
  decides next step).
- **查看完整评估** (EN: View Full Assessment): run `/eval-skill {SKILL_PATH} --scope full`
  and display the result.
- **完成** (EN: Done): exit with no further action.

### 5.3: Report Rules

- **Score Curve**: Use block characters (█ and ░) to create a simple bar, 20 chars wide, proportional to score/100. This gives an instant visual of progress.
- **Problem/Fix/Impact**: Write in user language, not dimension codes. Translate D3 findings into "hardcoded password removed", D2 issues into "description was too vague to be discovered", etc. Always use the human-readable dimension label from the Dimension label mapping in SKILL.md.
- **Impact line**: Focus on what the user gains — "users can now find this skill by searching for X", "no more security warnings when editing", "clear step-by-step instructions instead of vague hints".
- **Remaining Opportunities**: Always show next steps followed by the choice block — whether PASS or not.
- If a round resulted in rollback (regression detected), note it: "第 N 轮 — 尝试改进 {dim_label}，已回滚（检测到回退）。无净变化。" (EN: "Round N — Attempted {dim_label}, rolled back (regression detected). No net change.")
- If `--internal` is passed, omit the choice block entirely and just print the report.
