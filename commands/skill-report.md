# /skill-report — Skill Portfolio Report

Generate a comprehensive report of all installed skills: quick health scan, context budget, portfolio overview, and quality summary.

## Arguments

- `--skip-scan`: Skip Quick Health Scan, only show Parts 2-4
- `--scan-only`: Only show Quick Health Scan (Part 1)

## Steps

### Step 1: Load Skill Inventory

Use the **Read** tool to load `.skill-compass/setup-state.json`. If the file does not exist, run `/setup` first and then continue from Step 2.

Extract the skill list from the `inventory` array. Each entry provides: `name`, `path`, `version`, `purpose` (category), `modified_at`. Keep the full list in memory.

If `inventory` is empty or missing, output:

```
No skills found in inventory. Run /setup to discover installed skills.
```

Then stop.

### Step 2: Quick Health Scan (D1+D2+D3)

Skip this step entirely if `--skip-scan` was passed.

Build a `skillEntries` array from the inventory: `[{ name, path, modified_at }, ...]`.

Run the QuickScanner using the **Bash** tool:

```javascript
const { QuickScanner } = require('./lib/quick-scan');
const scanner = new QuickScanner('cc');
const skillEntries = /* array from inventory */;
const { results, summary } = scanner.scanAll(skillEntries);
```

Execute with `node -e` passing the constructed skillEntries inline, for example:

```bash
node -e "
const { QuickScanner } = require('./lib/quick-scan');
const scanner = new QuickScanner('cc');
const entries = {ENTRIES_JSON};
const out = scanner.scanAll(entries);
console.log(JSON.stringify(out));
"
```

Replace `{ENTRIES_JSON}` with the actual JSON array. Run this from the SkillCompass base directory (`{baseDir}`).

Sort results: `high_risk` first, then `medium`, then `clean`. Within each group, sort alphabetically by `skill_name`.

For skills that are disabled or have no `last_activity_at` in their manifest (never used), mark them with verdict `never_used` for display purposes (use the `○` symbol).

Display the scan table:

```
Quick Health Scan — {total} skills

  ✓ {name}      D1={d1}  D2={d2}  D3={d3}
  ⚠ {name}      D1={d1}  D2={d2}  D3={d3}  ← {first finding message}
  ✗ {name}      D1={d1}  D2={d2}  D3={d3}  ← {first finding message}
  ○ {name}      D1={d1}  D2={d2}  D3={d3}   （已停用/从未使用）

  ✓ Clean: {n}    ⚠ Medium: {n}    ✗ High risk: {n}    ○ 未参与: {n}
```

Verdict symbol mapping:
- `clean` → `✓`
- `medium` → `⚠`
- `high_risk` → `✗`
- `never_used` or disabled → `○`

For `⚠` and `✗` rows, append `← {first finding message}` where the message is the `message` field of the first entry in `findings`, trimmed to 60 characters.

If `--scan-only` was passed, stop here after displaying this table.

### Step 3: Context Budget

Calculate the total file size of all `SKILL.md` files from the inventory by reading each file path using the **Bash** tool:

```bash
node -e "
const fs = require('fs');
const paths = {PATHS_JSON};
const sizes = paths.map(p => { try { return { p, kb: fs.statSync(p).size / 1024 }; } catch(_) { return { p, kb: 0 }; } });
console.log(JSON.stringify(sizes));
"
```

Compute:
- `total_kb`: sum of all sizes, rounded to one decimal
- `pct`: `(total_kb / 80) * 100`, capped at 100 for the bar, rounded to integer
- For each skill, determine `status` based on `last_activity_at` from `.skill-compass/{name}/manifest.json` if available:
  - `活跃`: `last_activity_at` within the last 7 days
  - `闲置`: `last_activity_at` 7–14 days ago
  - `已停用`: skill has `disabled: true` in manifest
  - `从未使用`: no `last_activity_at` recorded
  - Default: `闲置`

Sort all skills by size descending. Show top 5.

ASCII bar (20 chars wide): filled portion = `round(pct / 100 * 20)` chars of `█`, remainder `░`.
Per-skill bar (10 chars wide): filled = `round((skill_kb / total_kb) * 10)` chars of `█`, remainder `░`.

Calculate `idle_kb`: sum of sizes for skills with status `闲置`, `已停用`, or `从未使用`.
`idle_pct`: `(idle_kb / total_kb) * 100`, rounded to integer.

Display:

```
Context Budget

  总计 {total_kb} KB / 推荐上限 80 KB（{pct}% 使用）

  {ASCII bar 20 chars}  {pct}%

  Top 5 by size:
    {name:<20}  {size} KB  {bar 10 chars}  {status}
    ...

  闲置 + 从未使用的 skill 占 {idle_kb} KB（{idle_pct}%）
```

### Step 4: Portfolio Overview

Read version count from `.skill-compass/{name}/manifest.json` for each skill (field `version_count` or count of entries in `history` array). If manifest is missing, treat version count as 1.

Read `last_activity_at` from each manifest to determine activity tier:
- `活跃`: within last 7 days
- `闲置`: 7–14 days ago
- `沉睡`: more than 14 days ago
- `从未使用`: no `last_activity_at`

Group skills by `purpose` field (from setup-state.json inventory). Use existing category labels: `Code/Dev`, `Deploy/Ops`, `Data/API`, `Productivity`, `Other`.

Classify iteration depth:
- `高频迭代 (≥5 版本)`: version_count >= 5
- `中度迭代 (2-4 版本)`: version_count 2–4
- `未迭代 (1 版本)`: version_count == 1

For activity bars (each 10 chars wide): filled = `round((count / total) * 10)` chars of `█`, remainder `░`.

Display:

```
Portfolio Overview

  {n} skills installed

  分类
    {category}  {count}    {category}  {count}    ...

  活跃度（以 7 天为窗口）
    活跃     {n}  {bar}  {pct}%
    闲置     {n}  {bar}  {pct}%
    沉睡     {n}  {bar}  {pct}%
    从未使用  {n}  {bar}  {pct}%

  迭代深度
    高频迭代 (≥5 版本)   {n}    {names of skills in this tier, comma-separated}
    中度迭代 (2-4 版本)  {n}
    未迭代 (1 版本)      {n}
```

For the `高频迭代` row, list skill names only if count <= 5; otherwise show count only.

### Step 5: Quality Summary

For each skill, check whether `.skill-compass/{name}/manifest.json` exists and contains a `scores` object with `overall` defined (full evaluation record).

If zero skills have eval records:

```
Quality Summary

  暂无 eval 记录。运行 /eval-skill <name> 对单个 skill 评测。
```

Skip the rest of this step.

If at least one skill has eval records, read the scores from each manifest. Compute:
- `mean`: average `overall` score across skills with records, rounded to one decimal
- Count of `PASS` (overall >= 70), `CAUTION` (50–69), `FAIL` (< 50) verdicts
- Dimension means for D1–D6: average each dimension score across all skills that have it, rounded to one decimal
- Weakest dimension: the dimension with the lowest mean score. On ties, use priority: D3 > D4 > D2 > D1 > D6 > D5
- For the weakest dimension, count how many skills scored <= 6 on it

Dimension labels:
- D1 → `D1 结构`
- D2 → `D2 触发`
- D3 → `D3 安全`
- D4 → `D4 功能`
- D5 → `D5 比较`
- D6 → `D6 独特`

For each dimension bar (10 chars wide): filled = `round((avg / 10) * 10)` chars of `█`, remainder `░`.

Display:

```
Quality Summary — {n} skills have eval records

  均分 {mean} · PASS {p} · CAUTION {c} · FAIL {f}

  维度均值
    D1 结构    {avg}  {bar}
    D2 触发    {avg}  {bar}
    D3 安全    {avg}  {bar}
    D4 功能    {avg}  {bar}
    D5 比较    {avg}  {bar}
    D6 独特    {avg}  {bar}  ← 最弱（if this is the weakest dimension）

  最弱维度：{dim_name} — {n} 个 skill 的 {dim} ≤ 6
```

Mark the weakest dimension row with `← 最弱` at the end of its bar line.

### Step 6: Action Guide

Always display this section at the end, regardless of arguments:

```
──────────────────────────────────
下一步

  完整评测单个 skill：  /eval-skill <skill-name>
  自动优化单个 skill：  /eval-improve <skill-name>
  查看建议和管理：      /skill-inbox
  查看全部 skill：      /skill-inbox all
──────────────────────────────────
```

## Error Handling

- **setup-state.json missing**: run `/setup` automatically and continue, or stop with a message if the user declines.
- **SKILL.md file missing for a skill in inventory**: show `(file missing)` in the scan table and skip it in size calculations.
- **manifest.json missing**: treat version_count as 1, last_activity_at as absent, scores as absent.
- **QuickScanner node error**: output the stderr and continue with remaining steps using `D1=? D2=? D3=?` placeholders for affected skills.
