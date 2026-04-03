# /eval-compare — Version Comparison

> **Locale note:** All user-facing prompts, choice labels, and narrative output follow the session locale. Code blocks, field names, and verdict tokens (PASS / CAUTION / FAIL) remain in English.

## Arguments

- `<version-a>` (required): File path or `{skill-name}@{version}` identifier.
- `<version-b>` (required): File path or `{skill-name}@{version}` identifier.
- `--internal` / `--ci` (optional): Skip interactive choice prompts; output results and exit.

## Steps

### Step 1: Resolve Versions

For each argument:
- If it's a file path: use the **Read** tool to load the file directly.
- If it's a `name@version` identifier: look up `.skill-compass/{name}/snapshots/{version}.md` using the **Read** tool.
- If version not found: output `"Version not found: {identifier}"` and stop.

**Cross-skill check:** If both arguments use `name@version` syntax and the skill names differ, warn in the session locale — for example in Chinese: `"正在对比不同的 skill（{name_a} 与 {name_b}），结果可能缺乏参考意义。"` — then present the choice:

```
[继续对比 / 取消]
```

If the user chooses 取消 (or the equivalent in the session locale), stop.

### Step 2: Check Cached Results

For each version, check `.skill-compass/{name}/manifest.json` for cached evaluation results. Use the **Read** tool to load the manifest.

If cached results exist (matching content_hash): use cached scores.
If not: run eval-skill flow on the version to generate fresh results.

### Step 3: Compare

Generate a side-by-side comparison. Dimension names in the table header follow the session locale (English defaults shown; Chinese equivalents in parentheses):

```
Version Comparison: sql-optimizer
| 维度 / Dimension          | v1.0.0 | v1.0.0-evo.2 | 变化 / Delta |
|---------------------------|--------|--------------|--------------|
| D1 结构 Structure         |      6 |            7 | ↑ +1         |
| D2 触发 Trigger           |      3 |            6 | ↑ +3 *       |
| D3 安全 Security          |      2 |            7 | ↑ +5 *       |
| D4 功能 Functional        |      4 |            4 | → 0          |
| D5 对比 Comparative       |      3 |            3 | → 0          |
| D6 独特 Uniqueness        |      7 |            7 | → 0          |
|---------------------------|--------|--------------|--------------|
| 总分 Overall              |     38 |           52 | ↑ +14        |
| 结论 Verdict              |   FAIL |      CAUTION |              |
```

Significance flag (*): delta > 2 points.

### Step 4: Trajectory Assessment

Analyze the pattern of changes:
- Which dimensions improved? Which stagnated?
- Is the skill on an improving trajectory?
- What should be targeted next?

Output assessment as part of the report.

### Step 5: Post-Comparison Choices

Skip this step if `--internal` or `--ci` is set.

After the report is printed, present the following choice in the session locale (English defaults shown; Chinese equivalents in parentheses):

```
下一步 / Next step:
[改进较弱版本 / Improve weaker version]  [回滚 / Roll back]  [完成 / Done]
```

- **改进较弱版本 / Improve weaker version**: Identify the lower-scoring version, then run the eval-skill improvement flow targeting its weakest dimension.
- **回滚 / Roll back**: Restore the previously active snapshot for the skill (confirms before acting).
- **完成 / Done**: Exit with no further action.
