# /eval-evolve — Autonomous Multi-Round Evolution via Ralph Loop

## Arguments

- `<path>` (required): Path to the SKILL.md file to evolve.
- `--max-iterations <n>` (optional): Max improvement rounds. Default: 6.
- `--target-score <n>` (optional): Stop when overall_score >= n. Default: 70.

## Prerequisites

This command requires the **ralph-wiggum** plugin. If not installed:

```
claude plugin install ralph-wiggum@claude-code-plugins
```

## What This Command Does

Generates and executes a `/ralph-loop` invocation that chains `/eval-skill` → `/eval-improve` automatically until the skill reaches PASS verdict (or hits the iteration limit).

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

Display to the user:

```
Evolution plan:
  Skill:      {skill-name}
  Target:     score >= {TARGET_SCORE}, verdict = PASS
  Max rounds: {MAX_ITERATIONS}
  Estimated tokens: ~{MAX_ITERATIONS × 60}K (worst case)

Starting Ralph loop...
```

Then execute:

```
/ralph-loop "{prompt_text}" --max-iterations {MAX_ITERATIONS} --completion-promise "PASS"
```

## Step 5: Evolution Report (Mandatory)

When the Ralph loop terminates (by PASS or max-iterations), **you must generate the Evolution Report**. This is the most important output of the entire command — it makes the evolution value visible to the user.

### 5.1: Gather Data

Read `.skill-compass/{skill-name}/manifest.json`. Extract the `versions` array. For each version created during this evolution session (filter by `trigger: "eval-improve"` entries after the starting version):
- `version`, `overall_score`, `verdict`, `target_dimension`

Also read `.skill-compass/{skill-name}/corrections.json` if it exists, for changelog details.

### 5.2: Generate Report

Display the following report to the user:

```
═══════════════════════════════════════════════════════
  Evolution Report: {skill-name}
  {start_version} → {final_version}  |  {total_rounds} rounds
═══════════════════════════════════════════════════════

  Score: {start_score} → {final_score}  ({+delta})
  Verdict: {start_verdict} → {final_verdict}

  ── Score Curve ──────────────────────────────────────

  Round 0 (baseline):  {score}  {verdict}  ████████░░░░░░░░░░░░
  Round 1 ({dim}):     {score}  {verdict}  ██████████░░░░░░░░░░
  Round 2 ({dim}):     {score}  {verdict}  █████████████░░░░░░░
  Round 3 ({dim}):     {score}  {verdict}  ██████████████████░░
  ...

  ── What Changed ────────────────────────────────────

  Round 1 — {target_dimension_name} ({dim_score_before} → {dim_score_after})
    Problem:  {one-sentence plain-language description of what was wrong}
    Fix:      {one-sentence plain-language description of what was changed}
    Impact:   {what the user gains from this fix}

  Round 2 — {target_dimension_name} ({dim_score_before} → {dim_score_after})
    Problem:  {description}
    Fix:      {description}
    Impact:   {description}

  ...

  ── Remaining Opportunities ─────────────────────────

  {if verdict is PASS:}
    ✓ Skill meets quality standards. Weakest area is {dim} ({score}/10).
    Optional: run /eval-improve --dimension {dim} for further polish.

  {if verdict is not PASS (hit max-iterations):}
    ✗ Did not reach PASS after {max_iterations} rounds.
    Current weakest: {dim} ({score}/10)
    Suggested: review {dim} manually — automated improvement may have plateaued.
    Run /eval-skill to see full current assessment.

═══════════════════════════════════════════════════════
```

### 5.3: Report Rules

- **Score Curve**: Use block characters (█ and ░) to create a simple bar, 20 chars wide, proportional to score/100. This gives an instant visual of progress.
- **Problem/Fix/Impact**: Write in user language, not dimension codes. Translate D3 findings into "hardcoded password removed", D2 issues into "description was too vague to be discovered", etc.
- **Impact line**: Focus on what the user gains — "users can now find this skill by searching for X", "no more security warnings when editing", "clear step-by-step instructions instead of vague hints".
- **Remaining Opportunities**: Always show next steps, whether PASS or not.
- If a round resulted in rollback (regression detected), note it: "Round N — Attempted {dim}, rolled back (regression detected). No net change."
