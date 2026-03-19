# /eval-audit — Batch Skill Evaluation

## Arguments

- `<directory>` (optional, default: `.claude/skills/`): Directory to scan for skills.
- `--security-only` (optional): Only run D3 security scan per skill.
- `--format [json|md|all]` (optional, default: `json`): Output format.
- `--fix` (optional): After evaluation, improve each FAIL skill. Requires `--budget`.
- `--budget <number>` (required with `--fix`): Maximum total token estimate for improvements. Example: `--budget 200000`.
- `--fix-caution` (optional): Also improve CAUTION skills (only with `--fix`).
- `--ci` (optional): CI-friendly mode. Suppresses interactive prompts, outputs JSON only, sets exit code (0=all PASS, 1=any CAUTION, 2=any FAIL).

## Steps

### Step 1: Discover Skills

Use the **Glob** tool to find all `**/SKILL.md` files recursively under the specified directory. Also check `~/.claude/skills/` if scanning project-level.

Exclude: `test-fixtures/`, `node_modules/`, `archive/`, `.git/`, `.skill-compass/`.

If no SKILL.md files found: output `"No skills found in {directory}"` and stop.

### Step 2: Evaluate Each Skill

For each discovered SKILL.md, display progress: `[N/total] Evaluating: {skill-name}...`

- **Full mode** (default): use the **Read** tool to load `{baseDir}/commands/eval-skill.md` and follow its evaluation flow for each skill.
- **Security-only mode** (`--security-only`): use the **Read** tool to load `{baseDir}/commands/eval-security.md` and follow its flow for each skill.

### Step 3: Aggregate Results

Collect all results into an array. Compute summary counts:
- Total skills evaluated
- PASS count
- CAUTION count
- FAIL count

### Step 4: Output

Sort results worst-first (lowest overall_score at top).

Display summary table:

```
Skill Audit Summary:
| # | Skill           | Score | Verdict | Weakest    |
|---|-----------------|-------|---------|------------|
| 1 | deploy-helper   |    28 | FAIL    | security   |
| 2 | my-formatter    |    55 | CAUTION | trigger    |
| 3 | sql-optimizer   |    71 | PASS    | structure  |

Total: 3 skills | 1 PASS | 1 CAUTION | 1 FAIL
```

Output full JSON array for programmatic use. If `--format md`: write summary report.

### Security-Only Mode Output

When `--security-only` is active, each result contains only the D3 security evaluation (conforming to the security portion of `schemas/eval-result.json`). The summary table replaces Score/Verdict/Weakest with D3-specific columns:

```
Security Audit Summary:
| # | Skill           | D3 Score | Pass  | Critical | High |
|---|-----------------|----------|-------|----------|------|
| 1 | deploy-helper   |        0 | false |        2 |    1 |
| 2 | my-formatter    |        8 | true  |        0 |    0 |

Total: 2 skills | 1 pass | 1 fail
```

### Step 5: Fix Mode (--fix)

Only when `--fix` is passed. Requires `--budget`.

If `--fix` is passed without `--budget`: output `"Error: --fix requires --budget <number> to limit token consumption. Example: --fix --budget 200000"` and stop.

**Procedure:**

1. Collect FAIL skills (worst-first). If `--fix-caution` is also set, include CAUTION skills after all FAIL skills.
2. Initialize `tokens_spent = 0`. Estimate ~60K tokens per improvement round.
3. For each skill to fix:
   a. Check budget: if `tokens_spent + 60000 > budget`, display `"Budget limit reached ({tokens_spent}/{budget}). Stopping fixes."` and break.
   b. Display: `[{i}/{total_to_fix}] Improving {skill-name}: targeting {weakest_dimension} ({score}/10)...`
   c. Unless `--ci` is set: show the proposed diff and **ask user to confirm** before writing. If declined, skip this skill.
   d. Run eval-improve flow (load `{baseDir}/commands/eval-improve.md`) for this skill.
   e. Update `tokens_spent += 60000`.
   f. Display result: `{skill-name}: {old_score} → {new_score} ({old_verdict} → {new_verdict})`

4. Display fix summary:
```
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
