# /eval-compare — Version Comparison

## Arguments

- `<version-a>` (required): File path or `{skill-name}@{version}` identifier.
- `<version-b>` (required): File path or `{skill-name}@{version}` identifier.

## Steps

### Step 1: Resolve Versions

For each argument:
- If it's a file path: use the **Read** tool to load the file directly.
- If it's a `name@version` identifier: look up `.skill-compass/{name}/snapshots/{version}.md` using the **Read** tool.
- If version not found: output `"Version not found: {identifier}"` and stop.

**Cross-skill check:** If both arguments use `name@version` syntax and the skill names differ, warn: `"Comparing different skills ({name_a} vs {name_b}). Results may not be meaningful. Continue? [y/n]"`. If the user declines, stop.

### Step 2: Check Cached Results

For each version, check `.skill-compass/{name}/manifest.json` for cached evaluation results. Use the **Read** tool to load the manifest.

If cached results exist (matching content_hash): use cached scores.
If not: run eval-skill flow on the version to generate fresh results.

### Step 3: Compare

Generate a side-by-side comparison:

```
Version Comparison: sql-optimizer
| Dimension   | v1.0.0 | v1.0.0-evo.2 | Delta  |
|-------------|--------|--------------|--------|
| Structure   |      6 |            7 | ↑ +1   |
| Trigger     |      3 |            6 | ↑ +3 * |
| Security    |      2 |            7 | ↑ +5 * |
| Functional  |      4 |            4 | → 0    |
| Comparative |      3 |            3 | → 0    |
| Uniqueness  |      7 |            7 | → 0    |
|-------------|--------|--------------|--------|
| Overall     |     38 |           52 | ↑ +14  |
| Verdict     |   FAIL |      CAUTION |        |
```

Significance flag (*): delta > 2 points.

### Step 4: Trajectory Assessment

Analyze the pattern of changes:
- Which dimensions improved? Which stagnated?
- Is the skill on an improving trajectory?
- What should be targeted next?

Output assessment as part of the report.
