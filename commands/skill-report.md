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

For skills that are disabled (check `InboxStore.getSkillCache(name)?.disabled`) or have `ever_used === false` from `UsageReader.getSignals(name)`, mark them with verdict `never_used` for display purposes (use the `○` symbol).

Display the scan table:

```
Quick Health Scan — {total} skills

  ✓ {name}      D1={d1}  D2={d2}  D3={d3}
  ⚠ {name}      D1={d1}  D2={d2}  D3={d3}  ← {first finding message}
  ✗ {name}      D1={d1}  D2={d2}  D3={d3}  ← {first finding message}
  ○ {name}      D1={d1}  D2={d2}  D3={d3}   (disabled / never used)

  ✓ Clean: {n}    ⚠ Medium: {n}    ✗ High risk: {n}    ○ Skipped: {n}
```

Verdict symbol mapping:
- `clean` → `✓`
- `medium` → `⚠`
- `high_risk` → `✗`
- `never_used` or disabled → `○`

For `⚠` and `✗` rows, append `← {first finding message}` where the message is the `message` field of the first entry in `findings`, trimmed to 60 characters.

If any skill has `high_risk` verdict in the scan results, add a guidance line after the scan summary for the **first** such skill only (max 1 guidance):

```
{name} has security or structural risks; a full 6-dimension evaluation is recommended.
[Evaluate {name} (recommended) / Skip]
```

If `--scan-only` was passed, stop here after displaying this table.

### Step 3: Installed Packages

List all directories in the skill scan roots, distinguishing top-level skills from packages:

```
Installed

  Skills (loaded by Claude Code):
    frontend-design     standalone skill · {activity status}

  Packages (working via hooks/Skill tools):
    superpowers         collection · SessionStart hook · 14 sub-skills
    everything-claude-code  hooks + agents · non-skill collection

  SkillCompass (this tool)
```

Determine package type by checking the directory:
- Has top-level SKILL.md → "standalone skill"
- Has `hooks/hooks.json` with SessionStart → "collection · SessionStart hook"
- Has `hooks/hooks.json` without SessionStart → "hooks + agents"
- Has `.claude-plugin/` but no SKILL.md → "plugin (no skill)"

For packages with sub-skills (SessionStart hook), count sub-skills by scanning `{dir}/skills/*/SKILL.md`.

Sub-skill usage data comes from `usage.jsonl` (passively tracked via PostToolUse Skill hook). If usage data exists, show top sub-skills:
```
    superpowers         collection · 14 sub-skills
      Recently used: writing-plans (12×), subagent-driven (6×), executing-plans (3×)
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

Determine activity tier from usage signals only (`last_used_at` from `UsageReader.getSignals()`). Do NOT fall back to manifest `versions[].timestamp` — those reflect eval/edit history, not actual invocation, and would inflate active counts for never-invoked skills.
- `active`: `last_used_at` within last 7 days
- `idle`: `last_used_at` 7–14 days ago
- `dormant`: `last_used_at` more than 14 days ago
- `never_used`: `ever_used === false` (no usage events)

Group skills by `purpose` field (from setup-state.json inventory). Use existing category labels: `Code/Dev`, `Deploy/Ops`, `Data/API`, `Productivity`, `Other`.

Classify iteration depth:
- `heavy_iteration (≥5 versions)`: version_count >= 5
- `medium_iteration (2-4 versions)`: version_count 2–4
- `no_iteration (1 version)`: version_count == 1

For activity bars (each 10 chars wide): filled = `round((count / total) * 10)` chars of `█`, remainder `░`.

Display:

```
Portfolio Overview

  {n} skills installed

  Category
    {category}  {count}    {category}  {count}    ...

  Activity (7-day window)
    Active       {n}  {bar}  {pct}%
    Idle         {n}  {bar}  {pct}%
    Dormant      {n}  {bar}  {pct}%
    Never used   {n}  {bar}  {pct}%

  Iteration depth
    Heavy (≥5 versions)    {n}    {names of skills in this tier, comma-separated}
    Medium (2-4 versions)  {n}
    None (1 version)       {n}
```

For the "Heavy" row, list skill names only if count <= 5; otherwise show count only.

### Step 5: Quality Summary

For each skill, check whether `.skill-compass/cc/{name}/manifest.json` or `.skill-compass/{name}/manifest.json` exists. Check the `cc/` path first. A skill has an eval record if any entry in `versions[]` has `trigger === 'eval'` and `overall_score != null`.

If zero skills have eval records:

```
Quality Summary

  No evaluation records yet. Run /eval-skill <name> to evaluate a specific skill.
```

Skip the rest of this step.

If at least one skill has eval records, read from each manifest's most recent eval version entry (the last `versions[]` entry where `trigger === 'eval'` and `overall_score != null`). Compute:
- `mean`: average `overall_score` across skills with records, rounded to one decimal
- Count of verdicts using the `verdict` field from each version entry (values: `PASS`, `CAUTION`, `FAIL`). If `verdict` is absent, derive from `overall_score`: PASS (≥70), CAUTION (50–69), FAIL (<50)
- Dimension means for D1–D6: read `dimension_scores` object (keys `D1`–`D6`) from each version entry; average each dimension across all skills that have it, rounded to one decimal
- Weakest dimension: the dimension with the lowest mean score. On ties, use priority: D3 > D4 > D2 > D1 > D6 > D5
- For the weakest dimension, count how many skills scored <= 6 on it

Use the canonical Dimension label mapping from SKILL.md for all dimension names in the output. Never invent alternatives.

For each dimension bar (10 chars wide): filled = `round((avg / 10) * 10)` chars of `█`, remainder `░`.

Display:

```
Quality Summary — {n} skills have eval records

  Mean score {mean} · PASS {p} · CAUTION {c} · FAIL {f}

  Dimension averages
    D1 Structure    {avg}  {bar}
    D2 Trigger      {avg}  {bar}
    D3 Security     {avg}  {bar}
    D4 Functional   {avg}  {bar}
    D5 Comparative  {avg}  {bar}
    D6 Uniqueness   {avg}  {bar}  ← weakest (if this is the weakest dimension)

  Weakest dimension: {dim_name} — {n} skill(s) with {dim} ≤ 6
```

Mark the weakest dimension row with `← weakest` at the end of its bar line.

### Step 5.5: Usage Profile

Read usage data using `lib/usage-reader.js`:

```javascript
const { UsageReader } = require('./lib/usage-reader');
const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
const reader = new UsageReader('cc', baseDir);
const allSignals = reader.getAllSignals();
```

Execute with `node -e` via the **Bash** tool. `allSignals` is a map keyed by skill name containing fields: `use_count_7d`, `use_count_14d`, `total_use_count`, `ever_used`, `last_used_at`, `sessions_used_7d`, `children_usage`. Note: `total_size` is NOT in usage signals — read it from the `inventory` array in `setup-state.json` instead.

If no usage data exists at all (usage.jsonl empty or missing, or `allSignals` is `{}`):

```
Skill Usage Overview

  No usage data yet. SkillCompass will track automatically once skills are used.
```

Skip the rest of this step.

Otherwise, categorize skills by usage pattern and display:

**Most used** — top 5 by `use_count_14d`, only those with `use_count_14d > 0`. ASCII bar is 12 chars wide, proportional to the max `use_count_14d` in this group (`█` filled, `░` empty). For collection (composite) skills, show the most-used child in parentheses if available.

**Never used** — skills where `ever_used = false`, sorted by `total_size` descending (read `total_size` from the inventory entry in `setup-state.json`, not from usage signals).

**One-and-done** — skills where `total_use_count = 1` and `last_used_at` is more than 14 days ago.

**Declining** — skills where `use_count_7d = 0` but `use_count_14d >= 3`.

Display:

```
Skill Usage Overview

  Most used (last 14 days)
    {name}       {bar 12 chars}  {count} uses
    {name}       {bar 12 chars}  {count} uses (inside collection: {top_child} {child_count} uses)

  Never used
    {name}       installed {days} days ago  0 invocations  {size}KB

  One-time use
    {name}       used once on {date}

  Declining usage
    {name}       {count} uses in prior 2 weeks → 0 this week
```

Omit any sub-section that has no entries.

### Step 6: Action Guide

Always display this section at the end, regardless of arguments.

Display a conversational prompt with choices:

```
──────────────────────────────────
If you want to take further action on a specific skill, just tell me, for example:
  "evaluate code-review"
  "optimize k8s-deploy"
  "show me the suggestions"

Or choose:
  [Evaluate a skill]
  [View suggestions]
  [Done]
──────────────────────────────────
```

## Error Handling

- **setup-state.json missing**: run `/setup` automatically and continue, or stop with a message if the user declines.
- **SKILL.md file missing for a skill in inventory**: show `(file missing)` in the scan table and skip it in size calculations.
- **manifest.json missing**: treat version_count as 1, last_used_at as absent, scores as absent.
- **QuickScanner node error**: output the stderr and continue with remaining steps using `D1=? D2=? D3=?` placeholders for affected skills.
