# /eval-evolve — Optional Plugin-Assisted Multi-Round Evolution via Ralph Loop

> **Locale**: All templates in this spec are written in English. Detect the user's language from the session and translate user-facing text at display time per SKILL.md's Global UX Rules. Dimension labels: see the canonical table in SKILL.md.

## Arguments

- `<path>` (required): Path to the SKILL.md file to evolve.
- `--max-iterations <n>` (optional): Max improvement rounds. Default: 6.
- `--target-score <n>` (optional): Stop when overall_score >= n. Default: 70.
- `--internal` (optional): Skip all interactive prompts. Used when this command is
  called programmatically by another command or script.

## Prerequisites

- **Recommended model: Claude Opus 4.6** (`claude-opus-4-6`). Multi-round evolution requires consistent scoring across iterations to detect genuine improvements vs noise. Weaker models may cause the evolution loop to oscillate rather than converge.

- This command requires the **ralph-wiggum** plugin. If not installed, present the
  user with a choice **before** attempting any plugin call:

  ```
  ┌─ Plugin required: ralph-wiggum ───────────────────────┐
  │  This command depends on the ralph-wiggum plugin to  │
  │  run the multi-round evolution loop.                  │
  │                                                        │
  │  [Install ralph-wiggum plugin]  [Cancel]              │
  └────────────────────────────────────────────────────────┘
  ```

  - If the user chooses **Install ralph-wiggum plugin**: run
    `claude plugin install ralph-wiggum@claude-code-plugins` and continue.
  - If the user chooses **Cancel**: stop immediately with no further action.
  - If `--internal` is passed, skip the prompt and run the install command directly.

## What This Command Does

Generates and executes a `/ralph-loop` invocation that chains `/eval-skill` → `/eval-improve` automatically until the skill reaches PASS verdict (or hits the iteration limit). This is a power-user workflow, not the default path for normal evaluations.

**You do not implement the loop yourself.** You build the prompt and hand off to Ralph.

## Step 1: Validate

1. Confirm the target SKILL.md file exists (use **Read**).
2. Check if a Ralph loop is already active (check `.claude/ralph-loop.local.md`). If active, tell the user to `/cancel-ralph` first and stop.

## Step 2: Read Current State

Load `.skill-compass/{skill-name}/manifest.json` if it exists. Extract:
- `current_version`
- Last `overall_score` and `verdict`

If no manifest exists, note: "First evaluation — starting from scratch."

## Step 3: Build the Ralph Prompt

Construct the following prompt text, substituting `{SKILL_PATH}` and `{TARGET_SCORE}`:

```
You are running an autonomous skill evolution loop.

Target: {SKILL_PATH}
Goal: overall_score >= {TARGET_SCORE} with verdict PASS

## Each iteration:

1. Run /eval-skill {SKILL_PATH} --scope full
2. Read the JSON result. Check verdict and overall_score.
3. If verdict is "PASS" and overall_score >= {TARGET_SCORE}:
   → Output: <promise>PASS</promise>
   → Stop.
4. If verdict is not PASS:
   → Run /eval-improve {SKILL_PATH}
   → eval-improve will target the weakest dimension automatically.
5. After eval-improve completes, this iteration is done.
   The next iteration will re-evaluate from step 1.

## Rules:
- Do NOT output <promise>PASS</promise> unless the eval-skill JSON verdict is literally "PASS".
- If eval-improve reports a regression (score dropped), let the next iteration re-evaluate — it may auto-rollback.
- Be concise. No lengthy explanations between steps.
- After outputting <promise>PASS</promise>, you MUST generate the Evolution Report by reading the manifest and following Step 5 of eval-evolve.md.
```

## Step 4: Show Preview and Execute

Display to the user (follow session locale):

```
Evolution plan:
  Skill:        {skill-name}
  Target:       score >= {TARGET_SCORE}, verdict = PASS
  Max rounds:   {MAX_ITERATIONS}
  Estimated tokens: ~{MAX_ITERATIONS × 60}K (worst case)

Starting Ralph loop…
```

Progress messages during the loop also follow the session locale. Examples:

| Event | Message |
|-------|---------|
| Iteration start | `[Round N] Evaluating…` |
| Improvement applied | `[Round N] Improved: {dim_label}` |
| Rollback | `[Round N] Regression detected, rolled back` |
| PASS reached | `✓ PASS reached (Round N)` |
| Max iterations | `⚠ Max iterations reached without PASS` |

Then execute:

```
/ralph-loop "{prompt_text}" --max-iterations {MAX_ITERATIONS} --completion-promise "PASS"
```

## Dimension Label Reference

See the canonical **Dimension label mapping** table in SKILL.md (all commands must use it).

Example: instead of "D2 ({score}/10)", write "Trigger D2 ({score}/10)".

## Step 5: Evolution Report (Mandatory)

When the Ralph loop terminates (by PASS or max-iterations), **you must generate the Evolution Report**. This is the most important output of the entire command — it makes the evolution value visible to the user.

### 5.1: Gather Data

Read `.skill-compass/{skill-name}/manifest.json`. Extract the `versions` array. For each version created during this evolution session (filter by `trigger: "eval-improve"` entries after the starting version):
- `version`, `overall_score`, `verdict`, `target_dimension`

Also read `.skill-compass/{skill-name}/corrections.json` if it exists, for changelog details.

### 5.2: Generate Report

Display the following report to the user (follow session locale):

```
═══════════════════════════════════════════════════════
  Evolution Report: {skill-name}
  {start_version} → {final_version}  |  {total_rounds} rounds
═══════════════════════════════════════════════════════

  Score:   {start_score} → {final_score}  ({+delta})
  Verdict: {start_verdict} → {final_verdict}

  ── Score curve ─────────────────────────────────

  Round 0 (baseline):    {score}  {verdict}  ████████░░░░░░░░░░░░
  Round 1 ({dim_label}): {score}  {verdict}  ██████████░░░░░░░░░░
  Round 2 ({dim_label}): {score}  {verdict}  █████████████░░░░░░░
  Round 3 ({dim_label}): {score}  {verdict}  ██████████████████░░
  ...

  ── Changes ─────────────────────────────────────

  Round 1 — {dim_label} ({dim_score_before} → {dim_score_after})
    Problem: {one-sentence plain-language description of what was wrong}
    Fix:     {one-sentence plain-language description of what was changed}
    Effect:  {what the user gains from this fix}

  Round 2 — {dim_label} ({dim_score_before} → {dim_score_after})
    Problem: {description}
    Fix:     {description}
    Effect:  {description}

  ...

  ── Remaining optimization room ────────────────

  {if verdict is PASS:}
    ✓ Evolution complete: PASS reached ({score}/100)
    Current weakest: {dim_label} ({score}/10).

  {if verdict is not PASS (hit max-iterations):}
    ⚠ Max iterations reached, currently {verdict} ({score}/100)
    Current weakest: {dim_label} ({score}/10)
    Recommendation: manually review {dim_label} — automated improvement may have plateaued.

═══════════════════════════════════════════════════════
```

After the report block, present the user with a choice (do **not** print raw commands):

```
┌─ Next step ───────────────────────────────────────────┐
│                                                        │
│  [Keep Polishing]   [View Full Assessment]   [Done]   │
│                                                        │
└────────────────────────────────────────────────────────┘
```

- **Keep Polishing**: run `/eval-improve {SKILL_PATH}` targeting the
  weakest dimension. If `--internal` is passed, skip the prompt and do nothing (caller
  decides next step).
- **View Full Assessment**: run `/eval-skill {SKILL_PATH} --scope full`
  and display the result.
- **Done**: exit with no further action.

### 5.3: Report Rules

- **Score Curve**: Use block characters (█ and ░) to create a simple bar, 20 chars wide, proportional to score/100. This gives an instant visual of progress.
- **Problem/Fix/Impact**: Write in user language, not dimension codes. Translate D3 findings into "hardcoded password removed", D2 issues into "description was too vague to be discovered", etc. Always use the human-readable dimension label from the Dimension label mapping in SKILL.md.
- **Impact line**: Focus on what the user gains — "users can now find this skill by searching for X", "no more security warnings when editing", "clear step-by-step instructions instead of vague hints".
- **Remaining Opportunities**: Always show next steps followed by the choice block — whether PASS or not.
- If a round resulted in rollback (regression detected), note it: "Round N — Attempted {dim_label}, rolled back (regression detected). No net change."
- If `--internal` is passed, omit the choice block entirely and just print the report.
