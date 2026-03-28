# /setup — Skill Inventory & Health Check

This command helps users understand what skills they have installed and surfaces any critical issues. It runs automatically on first invocation of any SkillCompass command, or manually via `/setup` or `/skill-compass setup`.

## Step 1: Detect First-Run

Check if this is the first run:
- Look for the marker file `.skill-compass/.setup-done`
- If marker exists → not first run → skip (unless manually invoked via `/setup`)
- If manually invoked, always run regardless of marker state

**First-run auto-trigger behavior:**
- When auto-triggered, ask the user first:
  > Welcome to SkillCompass. I can do a quick inventory of your installed skills (~5 seconds). [OK / Skip]
- If user says skip → create the marker file `.skill-compass/.setup-done` with `{"skipped": true, "timestamp": "{ISO}"}` → proceed with the original command
- If user agrees → run setup, then proceed with the original command

## Step 2: Discover Skills

Scan for all installed SKILL.md files:
1. Glob `~/.claude/skills/*/SKILL.md` and `~/.claude/skills/*/skill.md` (user-level)
2. Glob `.claude/skills/*/SKILL.md` and `.claude/skills/*/skill.md` (project-level)
3. Exclude: paths containing `node_modules/`, `.git/`, `test-fixtures/`, `.skill-compass/`
4. Exclude: SkillCompass's own SKILL.md (the one in `{baseDir}`)
5. Deduplicate by skill name (if same skill exists at both levels, prefer project-level)

If no skills found:
```
No installed skills found (besides SkillCompass itself).
Run /setup again after installing some skills.
```
Create marker file and stop.

If more than 20 skills found:
- Sort by file modification time (most recent first)
- Take top 20
- Note the remainder count for display

## Step 3: Quick Inventory

For each discovered skill, extract basic info by reading the file and parsing YAML frontmatter (no LLM, no token cost):
- `name`, `description`, `version`
- Whether it has `commands`, `hooks`, or `globs` in frontmatter

Group skills by purpose using keyword matching on the `description` field (word boundary matching):
- **Code/Dev**: `\b(format|lint|test|review|generate|scaffold|refactor|code)\b`
- **Deploy/Ops**: `\b(deploy|kubernetes|k8s|docker|ci/cd|infra|monitor|devops)\b`
- **Data/API**: `\b(api|data|query|fetch|database|sql|csv|json)\b`
- **Productivity**: `\b(todo|note|doc|translate|search|manage|write|email)\b`
- **Other**: anything that doesn't match above

## Step 4: Quick Health Check

Run local checks only (no LLM calls, no token cost):

1. **Security scan** — Execute `node -e` with SecurityValidator on each skill's SKILL.md
   - Only report findings with severity `critical`
   - Ignore: high/medium/low/info findings
2. **Duplicate detection** — Compare skill names and description keywords pairwise
   - Flag if two skills share > 50% of description keywords (after removing stop words)
3. **Structure check** — Execute `node -e` with StructureValidator on each skill
   - Only report if score ≤ 3 (fundamentally broken — missing frontmatter, empty body)
   - Ignore: score > 3

**Threshold rule:** Only surface findings that users would genuinely care about. If nothing meets the thresholds above → report healthy.

## Step 5: Display Results

Output the inventory:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  📦 {N} skills installed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Code/Dev
    1. sql-formatter     Format SQL queries with multi-dialect support
    2. git-commit-helper  Generate conventional commit messages

  Deploy/Ops
    3. deploy-helper      SSH deploy to staging/production
    4. k8s-manager        Kubernetes pod management and logs

  Productivity
    5. api-tester         Test REST API endpoints
    6. data-cleaner       CSV/JSON data cleaning

  ──────────────────────────────────────
```

If findings exist, append:

```
  Quick check found:

  🔒 #3 deploy-helper — contains a plaintext API key
     → anyone who can see this file can access your key

  🔄 #5 api-tester and #6 data-cleaner — ~40% feature overlap
     → you may only need one of these

  ⚠ #7 old-formatter — broken structure, Claude may not load it correctly
```

If no findings:

```
  Quick check: all healthy. No security risks or duplicates found.
```

If skills were truncated (> 20):

```
  {M} older skills not shown. Run /eval-audit for a full report.
```

## Step 6: Prompt for Action

```
Enter the skill number(s) you'd like to evaluate and improve (e.g., 3 or 3,5,7).
Or enter "all" to start a batch evaluation.
```

Wait for user response.

## Step 7: Route to Evaluation

Based on user input:

**Single or multiple numbers (e.g., "3" or "3,5,7"):**

For each selected skill:
1. Run `/eval-skill {skill_path} --scope full`
2. After evaluation completes, translate the result into scenario-based language (Step 8)
3. Ask: "Fix this? ~2 minutes. [Fix / Skip]"
4. If user says fix → run `/eval-improve {skill_path}` → show before/after (Step 8)
5. If user says skip → move to next selected skill

**"all" / "全部":**

Inform user of time estimate:
```
Batch evaluation of {N} skills, ~2 minutes each, estimated total ~{N*2} minutes. Start?
```
If confirmed:
- For user-level skills: run `/eval-audit ~/.claude/skills/`
- For project-level skills: run `/eval-audit .claude/skills/`
- If both exist, run sequentially

**Anything else (skip, done, empty, or unrecognized):**
```
OK. Run /setup anytime to check again, or /skill-compass evaluate {skill} for a single skill.
```
Stop.

## Step 8: Scenario-Based Output

When presenting evaluation results in setup context, **do NOT use dimension codes (D1-D6) or numeric scores**. Translate findings into plain language that non-experts can understand.

### Issue Translation

Read the `issues` array from each dimension in the eval result. Pick the top 3 most impactful issues and translate:

**Security issues:**
- Hardcoded secret → "Contains a plaintext key/password — anyone with access to this file can see it"
- Pipe-to-shell → "Downloads and runs remote code with no safety checks"
- Prompt injection → "Contains content that could be exploited to alter Claude's behavior"

**Discoverability issues:**
- Vague description → "Description is too generic — Claude may not know when to use this skill"
- No trigger mechanism → "No clear activation method — Claude may not find it when you need it"

**Stability issues:**
- No edge handling → "May crash or produce wrong results on unexpected input (empty files, large files, etc.)"
- No error handling → "Fails silently without telling you what went wrong"

**Value issues:**
- Negative delta → "Asking Claude directly actually produces better results than using this skill"

**Uniqueness issues:**
- High overlap → "You already have a similar skill: {similar_skill_name}"

### Evaluation Display

```
  {skill_name} evaluation:

  🔒 Security
     {translated issue}

  🎯 Discoverability
     {translated issue}

  📋 Stability
     {translated issue}

  💡 Value
     {translated issue}

  🔄 Uniqueness
     {translated issue}

  Fix this? ~2 minutes. [Fix / Skip]
```

Only show categories that have issues (skip categories with no findings). If all good:
```
  {skill_name} looks good — no issues to fix.
```

### After Fix Display

```
  ✓ {skill_name} fixed

  🔒 Security
     Before: {plain-language before}
     After:  {plain-language after}

  🎯 Discoverability
     Before: {plain-language before}
     After:  {plain-language after}

  📋 Stability
     Before: {plain-language before}
     After:  {plain-language after}
```

Only show categories where something changed. Maximum 3 categories.

## Step 9: Save & Follow-Up

After setup completes (whether user evaluated skills or not):
1. Write marker file `.skill-compass/.setup-done`:
   ```json
   {"completed": true, "timestamp": "{ISO}", "skills_found": {N}, "skills_evaluated": [{list}]}
   ```
2. The inventory results are saved — next `/setup` run will show updates since last check.

If there are remaining unevaluated skills:
```
{remaining} more skills available to evaluate.
Enter another number to continue, or run /eval-audit for a full batch.
```

If user continues selecting numbers, loop back to Step 7. If user stops, end with:
```
Inventory complete. Run /setup anytime to check again.
```
