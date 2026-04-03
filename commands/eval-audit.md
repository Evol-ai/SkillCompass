# /eval-audit — Batch Skill Evaluation

> **Locale note:** All user-facing text (prompts, confirmations, error messages, progress, summaries) MUST match the locale detected from the user's first message in the session. Technical terms (PASS, CAUTION, FAIL, SKILL.md, skill names, file paths) are never translated. Dimension codes translate: D1→结构/Structure, D2→触发/Trigger, D3→安全/Security, D4→功能/Functional, D5→比较/Comparative, D6→独特/Uniqueness.

## Arguments

- `<directory>` (optional, default: `.claude/skills/`): Directory to scan for skills.
- `--security-only` (optional): Only run D3 security scan per skill.
- `--format [json|md|all]` (optional, default: `json`): Output format.
- `--fix` (optional): After evaluation, improve each FAIL skill. Requires `--budget`.
- `--budget <number>` (required with `--fix`): Maximum total token estimate for improvements. Example: `--budget 200000`.
- `--fix-caution` (optional): Also improve CAUTION skills (only with `--fix`).
- `--ci` (optional): CI-friendly mode. Suppresses interactive prompts, outputs JSON only, sets exit code (0=all PASS, 1=any CAUTION, 2=any FAIL).
- `--internal` (optional): Called by another command. Skip all interactive prompts and return results only.

## Steps

### Step 1: Discover Skills

Use the **Glob** tool to find all `**/SKILL.md` files recursively under the specified directory. Also check `~/.claude/skills/` if scanning project-level.

Exclude: `test-fixtures/`, `node_modules/`, `archive/`, `.git/`, `.skill-compass/`.

If no SKILL.md files found: display a locale-appropriate message, then — unless `--internal` or `--ci` is set — offer:

```
[locale: zh] 未在 {directory} 中找到 skill。
  [运行 /setup 检查全局] [指定其他目录] [取消]

[locale: en] No skills found in {directory}.
  [Run /setup to check global] [Specify another directory] [Cancel]
```

If `--internal` or `--ci`: output the error message only (no choices) and stop.

### Step 2: Evaluate Each Skill

For each discovered SKILL.md, display locale-appropriate progress — unless `--internal` is set, in which case output minimal machine-readable progress only:

```
[locale: zh] [{N}/{total}] 正在评测：{skill-name}...
[locale: en] [{N}/{total}] Evaluating: {skill-name}...
```

- **Full mode** (default): use the **Read** tool to load `{baseDir}/commands/eval-skill.md` and follow its evaluation flow for each skill, passing `--internal`.
- **Security-only mode** (`--security-only`): use the **Read** tool to load `{baseDir}/commands/eval-security.md` and follow its flow for each skill, passing `--internal`.

### Step 3: Aggregate Results

Collect all results into an array. Compute summary counts:
- Total skills evaluated
- PASS count
- CAUTION count
- FAIL count

### Step 4: Output

Sort results worst-first (lowest overall_score at top).

Display locale-appropriate summary table — unless `--internal` is set:

```
[locale: zh]
Skill 批量评测汇总：
| # | Skill           | 分数  | 结果    | 最弱维度   |
|---|-----------------|-------|---------|------------|
| 1 | deploy-helper   |    28 | FAIL    | 安全       |
| 2 | my-formatter    |    55 | CAUTION | 触发       |
| 3 | sql-optimizer   |    71 | PASS    | 结构       |

总计：3 个 skill | 1 PASS | 1 CAUTION | 1 FAIL

[locale: en]
Skill Audit Summary:
| # | Skill           | Score | Verdict | Weakest    |
|---|-----------------|-------|---------|------------|
| 1 | deploy-helper   |    28 | FAIL    | Security   |
| 2 | my-formatter    |    55 | CAUTION | Trigger    |
| 3 | sql-optimizer   |    71 | PASS    | Structure  |

Total: 3 skills | 1 PASS | 1 CAUTION | 1 FAIL
```

Output full JSON array for programmatic use. If `--format md`: write summary report.

After the summary — unless `--internal` or `--ci` is set — offer:

```
[locale: zh] [查看详细报告] [完成]
[locale: en] [View detailed report] [Done]
```

### Security-Only Mode Output

When `--security-only` is active, each result contains only the D3 security evaluation (conforming to the security portion of `schemas/eval-result.json`). The summary table replaces Score/Verdict/Weakest with D3-specific columns. Display locale-appropriate text — unless `--internal` is set:

```
[locale: zh]
安全审计汇总：
| # | Skill           | D3 安全分 | 通过   | 严重     | 高危 |
|---|-----------------|-----------|--------|----------|------|
| 1 | deploy-helper   |         0 | 否     |        2 |    1 |
| 2 | my-formatter    |         8 | 是     |        0 |    0 |

总计：2 个 skill | 1 通过 | 1 失败

[locale: en]
Security Audit Summary:
| # | Skill           | D3 Score | Pass  | Critical | High |
|---|-----------------|----------|-------|----------|------|
| 1 | deploy-helper   |        0 | false |        2 |    1 |
| 2 | my-formatter    |        8 | true  |        0 |    0 |

Total: 2 skills | 1 pass | 1 fail
```

### Step 5: Fix Mode (--fix)

Only when `--fix` is passed. Requires `--budget`.

If `--fix` is passed without `--budget`: display a locale-appropriate error and stop. Do not show raw command strings:

```
[locale: zh] 错误：--fix 需要 --budget <数字> 来限制 token 消耗。
  示例预算：200,000 token。请重新运行并加上 --budget 参数。

[locale: en] Error: --fix requires --budget <number> to limit token consumption.
  Example budget: 200,000 tokens. Re-run and add the --budget argument.
```

**Procedure:**

1. Collect FAIL skills (worst-first). If `--fix-caution` is also set, include CAUTION skills after all FAIL skills.
2. Initialize `tokens_spent = 0`. Estimate ~60K tokens per improvement round.
3. For each skill to fix:
   a. **Budget check:** if `tokens_spent + 60000 > budget`, do NOT silently skip. Unless `--internal` or `--ci` is set, offer:
      ```
      [locale: zh] 预算已用尽（已用 {tokens_spent} / 上限 {budget} token）。
        [增加预算继续] [停止]

      [locale: en] Budget exhausted ({tokens_spent}/{budget} tokens used).
        [Increase budget and continue] [Stop]
      ```
      If `--internal` or `--ci`: output a machine-readable budget-exhausted message and break.
   b. Display locale-appropriate fix progress — unless `--internal` is set:
      ```
      [locale: zh] [{i}/{total_to_fix}] 正在改进 {skill-name}：目标维度 {weakest_dimension_label}（{score}/10）...
      [locale: en] [{i}/{total_to_fix}] Improving {skill-name}: targeting {weakest_dimension_label} ({score}/10)...
      ```
      Dimension label uses translated form (e.g., D4→功能/Functional) matching detected locale.
   c. Unless `--internal` or `--ci` is set: show the proposed diff and **ask user to confirm** before writing. If declined, skip this skill.
   d. Run eval-improve flow (load `{baseDir}/commands/eval-improve.md`) for this skill, passing `--internal`.
   e. Update `tokens_spent += 60000`.
   f. Display locale-appropriate result — unless `--internal` is set:
      ```
      [locale: zh] {skill-name}：{old_score} → {new_score}（{old_verdict} → {new_verdict}）
      [locale: en] {skill-name}: {old_score} → {new_score} ({old_verdict} → {new_verdict})
      ```
   g. Unless `--internal` or `--ci` is set: after each skill fix, offer:
      ```
      [locale: zh] [继续] [停止]
      [locale: en] [Continue] [Stop]
      ```
      If the user chooses Stop, break out of the fix loop.

4. Display locale-appropriate fix summary — unless `--internal` is set:

```
[locale: zh]
修复汇总：
  已改进：2 个 skill
  已跳过（预算）：1 个 skill
  已跳过（用户拒绝）：0 个 skill
  预估 token 消耗：~120K

[locale: en]
Fix Summary:
  Improved: 2 skills
  Skipped (budget): 1 skill
  Skipped (declined): 0 skills
  Estimated tokens used: ~120K
```

### Step 6: CI Exit Code

If `--ci` flag is set, exit with:
- `0` if all skills are PASS (after fixes, if --fix was used)
- `1` if any skill is CAUTION
- `2` if any skill is FAIL
