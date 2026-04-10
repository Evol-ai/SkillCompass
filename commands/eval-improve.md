# /eval-improve — Evaluate + Directed Improvement

## Prerequisites

- **Recommended model: Claude Opus 4.6** (`claude-opus-4-6`). Directed improvement requires understanding complex rubric feedback and generating precise, targeted edits. Weaker models may produce unfocused rewrites that fail to address the weakest dimension or introduce regressions in other dimensions.

## Interaction Mode

If `--internal` is passed, skip all interactive prompts — return results silently. This flag is set when eval-improve is called by other commands (e.g., from setup or skill-inbox action queue).

If `--ci` is passed, skip all interactive prompts and output pure JSON.

All user-facing text follows the global locale rule from SKILL.md.

## Arguments

- `<path>` (required): Path to the SKILL.md file to improve.
- `--dimension D{N}` (optional): Override which dimension to target. If omitted, targets the weakest.
- `--feedback <path>` (optional): Passed through to eval-skill.

## Phase 1: Evaluate

Execute the full `/eval-skill` evaluation flow on the target skill. Use the **Read** tool to load `{baseDir}/commands/eval-skill.md` and follow its steps 1-18 with `--scope full`. Capture the complete JSON evaluation result.

**Do NOT duplicate eval-skill logic here.** Delegate entirely.

## Phase 2: Snapshot

Use the **Read** tool to load `{baseDir}/shared/version-management.md`. Follow the snapshot procedure:

1. Read or create the manifest for this skill.
2. Compute the content hash of the current SKILL.md.
3. Save a snapshot copy to `.skill-compass/{skill-name}/snapshots/{current-version}.md` using the **Write** tool.
4. Create a transient self-write lock: use the **Write** tool to create `.skill-compass/.write-lock` with content `{ "until": {unix_timestamp_now + 5} }`. This prevents SkillCompass's own PostToolUse hooks from re-triggering during the confirmed improvement write.

## Phase 3: Diagnose

From the evaluation result:
1. If verdict is FAIL due to security gate: **always target D3 first**, regardless of `--dimension` flag. Security issues must be resolved before other improvements.
2. If `--dimension` was specified: use that dimension as the target.
3. Otherwise: use the `weakest_dimension` field from the eval result.

### Metadata-Layer Grouping (D1 + D2)

If the target dimension is D1 or D2, and the OTHER metadata dimension (D2 or D1 respectively) also scores ≤ 5, group them into a single improvement round:
- Target becomes `["D1", "D2"]` (both)
- Display: "Structure ({score}) and Trigger ({score}) are both weak, improving together" (translate at display time)

This grouping ONLY applies to D1+D2 (both affect frontmatter/description). Do NOT group other dimension combinations — they modify different parts of the skill and could interfere.

Display diagnosis: which dimension(s), current score(s), specific issues from the evaluation.

## Phase 4: Improve

Use the **Read** tool to load `{baseDir}/prompts/improve.md`. Pass:
- `{SKILL_CONTENT}`: current SKILL.md content
- `{EVAL_REPORT}`: full JSON evaluation result
- `{TARGET_DIMENSION}`: the dimension(s) to improve (single key or array for D1+D2 group)

Generate the improved version. Show the diff to the user. **Ask for confirmation before writing.**

If the user declines: stop. Report "Improvement declined by user." and exit.

Before writing the improved SKILL.md, refresh the self-write lock: update `.skill-compass/.write-lock` with `{ "until": {unix_timestamp_now + 5} }`.

## Phase 5: Targeted Verification

After the user confirms and the improved SKILL.md is written:

**Do NOT re-run full 6-dimension evaluation.** Instead, run a targeted re-eval:

1. **Always re-evaluate these dimensions:**
   - The target dimension(s) — to confirm improvement
   - D3 (Security gate) — to ensure no security regression
   - D4 (Functional, 30% weight) — to catch unintended instruction damage
2. **For non-evaluated dimensions:** use cached scores from Phase 1.
3. **Recalculate overall_score** using the formula: re-evaluated scores for target+D3+D4, cached scores for the rest.

To run the targeted re-eval, follow the eval-skill Steps 1-4 (load target, types, config, scoring), then only the Steps for the dimensions listed above. Use `{baseDir}/prompts/d{N}-*.md` for each.

Check verification criteria:
- **Target dimension improved?** (score increased by ≥ 1 point)
- **No major regression?** (D3 and D4 did not drop by > 2 points)
- **Security gate still passes?** (if it passed before, it must still pass)

Mark the verification in output: `"verification": "targeted", "re_evaluated": ["D2", "D3", "D4"]`.

## Phase 6: Save or Rollback

### If verification passes:

1. Save as new evo version. Follow version-management.md rules:
   - Increment `-evo.N` suffix
   - Update manifest with new version entry:
     - `trigger`: `"eval-improve"`
     - `target_dimension`: the dimension(s) targeted
     - `overall_score` and `verdict`: from targeted verification result
     - `dimension_scores`: merge re-evaluated dimension scores with cached scores from Phase 1 into a single `{"D1":n,...,"D6":n}` object
     - `correction_pattern`: one plain-language sentence combining the problem and fix (e.g., "Description was too vague to discover; rewrote with specific keywords and scope boundaries")
   - Save new snapshot
2. Clean up: delete `.skill-compass/.write-lock` if it exists.
3. Display the **Improvement Summary** (mandatory, always show):

```
## Improvement Summary: {skill-name}

{version_before} → {version_after}  |  Overall: {score_before} → {score_after} ({verdict_before} → {verdict_after})

### What was wrong
{target_dimension} scored {score_before_dim}/10:
- {issue_1 from eval report, in plain language}
- {issue_2 ...}

### What was fixed
- {changelog.changes[0].what}: {changelog.changes[0].why}
- {changelog.changes[1].what}: {changelog.changes[1].why}
- ...

### Impact
- {target_dimension}: {score_before_dim} → {score_after_dim} ({delta with + sign})
- {any other dimension that changed}: {before} → {after}
- Verdict: {verdict_before} → {verdict_after}
{if verdict changed to PASS: "✓ This skill now passes quality standards."}
```

**Rules for this summary:**
- Use the evaluation `details` and `issues` fields to explain problems in plain language, not dimension codes.
- Translate dimension codes to names using the canonical Dimension label mapping table in SKILL.md (apply per locale at display time).
- Translate technical findings into user-understandable impact (e.g., "hardcoded database password" not "D3 Critical finding in category secret").
- Keep each bullet to one sentence.
- If D1+D2 were grouped, show both dimensions in the summary.

### Flow Continuity (after Improvement Summary)

Skip this section entirely if `--internal` was passed.

After displaying the Improvement Summary, check the new verdict and present a follow-up choice. All templates below are English — translate at display time to the session locale.

**If verdict is still CAUTION or FAIL:**
```
{Dimension name} improved from {old} to {new}, but verdict is still not PASS. Further improvement is possible.
[Keep improving this skill (recommended) / View other suggestions / Stop]
```

**If verdict improved to PASS:**
```
✓ Improved to PASS ✓ There is still room to polish ({Dimension name} {score}/10).
[Keep polishing / Stop (recommended)]
```

**If target dimension did not improve** (score did not increase by ≥ 1):
```
This dimension may be near its ceiling. [Try another dimension / Stop]
```

### If verification fails:

1. Restore the original SKILL.md from the snapshot taken in Phase 2.
2. Explain what went wrong. All templates are English — translate at display time:

   - **Target dimension did not improve:** show `[Try another dimension / Stop]`

   - **Regression detected:** report using the dimension name (not code) — e.g., "Functional ({score_before} → {score_after}) regressed" — then show:
     `[Rollback / Keep current result]`

   - **Security gate failed:** report e.g. "Security gate failed after improvement, rolled back" — then show:
     `[Fix security issues / Rollback]`

3. Suggest alternatives: try a different approach, target a different dimension, or manual edit.
4. Clean up: delete `.skill-compass/.write-lock` if it exists.

   Skip the interactive choices above if `--internal` was passed — just return the failure reason in the result JSON.
