# /eval-security — Standalone Security Scan

> **Locale**: All templates in this spec are written in English. Detect the user's language from the session and translate user-facing text at display time per SKILL.md's Global UX Rules. Dimension labels: see the canonical table in SKILL.md.

## Arguments

- `<path>` (required): Path to the SKILL.md file to scan.
- `--verbose` (optional): Show detailed findings including low severity.

## Steps

### Step 1: Load Target

Parse arguments. Use the **Read** tool to load the target SKILL.md file.

### Step 2: L0 Built-in Scan

Use the **Read** tool to load `{baseDir}/prompts/d3-security.md`. Execute all 7 L0 check categories against the target skill content. Record findings.

### Step 3: L1/L2 External Tools

Use the **Read** tool to load `{baseDir}/shared/tool-instructions.md`. Follow the L1 whitelist detection procedure: for each tool, use the **Bash** tool to check if installed, and invoke if found. Then check `.skill-compass/config.json` for L2 custom tools and invoke those.

### Step 4: Aggregate

Merge all findings from L0 + L1 + L2. Deduplicate by (location, check_type), keeping highest severity. Add `source` field to each finding.

### Step 5: Output

Output the D3 section of the evaluation result (conforming to the security portion of `schemas/eval-result.json`):

```json
{
  "dimension": "D3",
  "dimension_name": "security",
  "score": 8,
  "max": 10,
  "pass": true,
  "findings": [],
  "tools_used": ["builtin"],
  "details": "..."
}
```

If `--verbose` is not set: omit findings with severity `"low"` from display (still count them in score).

After printing the result:

- **Findings exist AND neither `--internal` nor `--ci` is set:** print a status line then present choices:

  ```
  ⚠ {N} security issue(s) found.
  [Fix security issues / View details / Done]
  ```

  - **Fix security issues** — invoke the fix workflow to address reported findings.
  - **View details** — re-display all findings including those hidden by verbosity rules.
  - **Done** — exit with no further action.

- **No findings:** print a single "clean" message and do not show the choice prompt:

  ```
  ✓ Security scan complete, no issues found.
  ```

- **`--internal` or `--ci` flag is set:** skip the choice prompt entirely regardless of findings; exit silently after printing the JSON result.

## Note

This is a standalone command. It does NOT affect version management or create manifest entries. Do not reference raw shell commands in user-facing output; surface all actions through the choices listed above.
