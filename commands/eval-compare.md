# /eval-compare — Version Comparison

> **Locale**: All templates in this spec are written in English. Detect the user's language from the session and translate user-facing text at display time per SKILL.md's Global UX Rules. Dimension labels: see the canonical table in SKILL.md.

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

**Cross-skill check:** If both arguments use `name@version` syntax and the skill names differ, warn the user that they are comparing different skills ({name_a} vs {name_b}) and the result may lack meaningful reference value, then present the choice:

```
[Continue comparing / Cancel]
```

If the user chooses Cancel, stop.

### Step 2: Check Cached Results

For each version, check `.skill-compass/{name}/manifest.json` for cached evaluation results. Use the **Read** tool to load the manifest.

If cached results exist (matching content_hash): use cached scores.
If not: run eval-skill flow on the version to generate fresh results.

### Step 3: Compare

Generate a side-by-side comparison:

```
Version Comparison: sql-optimizer
| Dimension       | v1.0.0 | v1.0.0-evo.2 | Delta  |
|-----------------|--------|--------------|--------|
| D1 Structure    |      6 |            7 | ↑ +1   |
| D2 Trigger      |      3 |            6 | ↑ +3 * |
| D3 Security     |      2 |            7 | ↑ +5 * |
| D4 Functional   |      4 |            4 | → 0    |
| D5 Comparative  |      3 |            3 | → 0    |
| D6 Uniqueness   |      7 |            7 | → 0    |
|-----------------|--------|--------------|--------|
| Overall         |     38 |           52 | ↑ +14  |
| Verdict         |   FAIL |      CAUTION |        |
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

After the report is printed, output a status line then present the following choice:

```
✓ Comparison complete.
Next step:
[Improve weaker version (recommended) / Roll back / Done]
```

- **Improve weaker version (recommended)**: Identify the lower-scoring version, then run the eval-skill improvement flow targeting its weakest dimension.
- **Roll back**: Restore the previously active snapshot for the skill (confirms before acting).
- **Done**: Exit with no further action.
