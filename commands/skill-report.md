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

If any skill has `high_risk` verdict in the scan results, add a guidance line after the scan summary for the **first** such skill only (max 1 guidance):

```
{name} 有安全或结构风险，建议做完整 6 维度评测。
[评测 {name}（推荐）/ 跳过]
```

If `--scan-only` was passed, stop here after displaying this table.

### Step 3: Installed Packages

List all directories in the skill scan roots, distinguishing top-level skills from packages:

```
已安装

  Skills（Claude Code 已加载）：
    frontend-design     独立 skill · {activity status}

  Packages（通过 hooks/Skill 工具工作）：
    superpowers         集合 · SessionStart hook · 14 子 skill
    everything-claude-code  hooks + agents · 非 skill 集合

  SkillCompass（本工具）
```
EN: "Installed — Skills (loaded by Claude Code) / Packages (work via hooks/Skill tool) / SkillCompass (this tool)"

Determine package type by checking the directory:
- Has top-level SKILL.md → "独立 skill" / "standalone skill"
- Has `hooks/hooks.json` with SessionStart → "集合 · SessionStart hook" / "collection · SessionStart hook"
- Has `hooks/hooks.json` without SessionStart → "hooks + agents" / "hooks & agents"
- Has `.claude-plugin/` but no SKILL.md → "plugin (无 skill)"

For packages with sub-skills (SessionStart hook), count sub-skills by scanning `{dir}/skills/*/SKILL.md`.

Sub-skill usage data comes from `usage.jsonl` (passively tracked via PostToolUse Skill hook). If usage data exists, show top sub-skills:
```
    superpowers         集合 · 14 子 skill
      最近使用：writing-plans(12次), subagent-driven(6次), executing-plans(3次)
```

**Skill count health check:**

Count the total number of top-level skills (type = standalone, with SKILL.md loaded by Claude Code). Then:

- **30 or fewer**: No warning. Healthy range.
- **31–50**: Show note (follow locale):
  ```
  ⚠ {N} skills installed. Users on non-Opus models (200K context) may experience description truncation, reducing Claude's accuracy in selecting the right skill.
  ```
- **Over 50**: Show warning with choices (follow locale):
  ```
  ⚠ {N} skills installed. Consider cleaning up idle skills — Claude's accuracy in matching the right skill may decrease.
  [View idle skills / View usage ranking]
  ```

### Step 4: Portfolio Overview

Read version count from `.skill-compass/{name}/manifest.json` for each skill (count entries in `versions` array, or use field `version_count` if present). Also check `.skill-compass/cc/{name}/manifest.json` first (new path takes priority). If manifest is missing, treat version count as 1.

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

For each skill, check whether `.skill-compass/cc/{name}/manifest.json` or `.skill-compass/{name}/manifest.json` exists and contains a `scores` object with `overall` defined (full evaluation record). Check the `cc/` path first.

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

### Step 5.5: Usage Profile

Read usage data using `lib/usage-reader.js`:

```javascript
const { UsageReader } = require('./lib/usage-reader');
const reader = new UsageReader('cc');
const allSignals = reader.getAllSignals();
```

Execute with `node -e` via the **Bash** tool. `allSignals` is a map keyed by skill name containing fields: `use_count_7d`, `use_count_14d`, `total_use_count`, `ever_used`, `last_used`, `total_size`.

If no usage data exists at all (usage.jsonl empty or missing, or `allSignals` is `{}`):

```
Skill 使用画像

  暂无使用数据。使用 skill 后 SkillCompass 会自动追踪。
```

Skip the rest of this step.

Otherwise, categorize skills by usage pattern and display:

**Most used** — top 5 by `use_count_14d`, only those with `use_count_14d > 0`. ASCII bar is 12 chars wide, proportional to the max `use_count_14d` in this group (`█` filled, `░` empty). For collection (composite) skills, show the most-used child in parentheses if available.

**Never used** — skills where `ever_used = false`, sorted by `total_size` descending.

**One-and-done** — skills where `total_use_count = 1` and `last_used` is more than 14 days ago.

**Declining** — skills where `use_count_7d = 0` but `use_count_14d >= 3`.

Display:

```
Skill 使用画像

  最常使用（最近 14 天）
    {name}       {bar 12 chars}  {count} 次
    {name}       {bar 12 chars}  {count} 次（集合内 {top_child} {child_count} 次）

  从未使用
    {name}       安装 {days} 天  0 次调用  占 {size}KB

  一次性使用
    {name}       仅 {date} 使用 1 次

  使用量下降
    {name}       前两周 {count} 次 → 本周 0 次
```

Omit any sub-section that has no entries.

### Step 6: Action Guide

Always display this section at the end, regardless of arguments.

Display a conversational prompt with choices:

```
──────────────────────────────────
如果你想对某个 skill 做进一步操作，直接告诉我，比如：
  "帮我评测 code-review"
  "优化一下 k8s-deploy"
  "看看有什么建议"

或选择：
  [评测某个 skill]
  [查看建议]
  [结束]
──────────────────────────────────
```

EN: "If you'd like to take action on any skill, just tell me, or choose an option below."

## Error Handling

- **setup-state.json missing**: run `/setup` automatically and continue, or stop with a message if the user declines.
- **SKILL.md file missing for a skill in inventory**: show `(file missing)` in the scan table and skip it in size calculations.
- **manifest.json missing**: treat version_count as 1, last_activity_at as absent, scores as absent.
- **QuickScanner node error**: output the stderr and continue with remaining steps using `D1=? D2=? D3=?` placeholders for affected skills.
