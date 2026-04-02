# /setup - Skill Inventory & Health Check

This command gives users a quick local inventory of installed skills and surfaces only high-signal issues. It supports two modes:

- **Manual mode**: the user explicitly runs `/setup` or `/skill-compass setup`
- **Auto-trigger mode**: first-run helper shown before another command

In auto-trigger mode, setup must never replace or derail the user's original request. Its job is to help briefly, save state, and return control to the dispatcher.

## Step 1: Determine Mode and Load State

1. Detect whether setup was invoked manually or as a first-run auto-trigger.
2. If auto-triggered, preserve the original command name and arguments as `resume_command` and `resume_args`.
3. Use `.skill-compass/setup-state.json` as the primary persisted state file.
4. For backward compatibility, if `.skill-compass/setup-state.json` is missing but `.skill-compass/.setup-done` exists, read the legacy marker and migrate the minimal fields into `setup-state.json`.
5. Load the standard OpenClaw config file `~/.openclaw/openclaw.json` if it exists. If present, read optional extra skill roots from `skills.load.extraDirs`.
6. If setup was auto-triggered and a current setup state already exists, return control to the dispatcher immediately so it can continue the original command.

## Step 2: Confirm Auto-Trigger (auto-trigger mode only)

When auto-triggered, ask the user first:

> Welcome to SkillCompass. I can do a quick local inventory of your installed skills (~5 seconds) before continuing `{resume_command}`. [OK / Skip]

- If the user says `Skip`:
  - Write `.skill-compass/setup-state.json` with `{"version": 1, "skipped": true, "timestamp": "{ISO}"}`
  - Also write `.skill-compass/.setup-done` for compatibility
  - Return control to the dispatcher immediately so it can continue the original command
- If the user agrees:
  - Continue with setup

Manual `/setup` does not need this confirmation.

## Step 3: Discover Skills

Build the scan root list in this priority order:

1. `.claude/skills/` (project-level Claude Code)
2. `.openclaw/skills/` (project-level OpenClaw, if present)
3. Each path listed in `skills.load.extraDirs` from `~/.openclaw/openclaw.json`
4. `~/.claude/skills/` (user-level Claude Code)
5. `~/.openclaw/skills/` (user-level OpenClaw, if present)

Resolve only directories that actually exist.

Scan each root for `*/SKILL.md` and `*/skill.md`.

Exclude:
- paths containing `node_modules/`, `.git/`, `test-fixtures/`, `.skill-compass/`
- SkillCompass's own SKILL.md at `{baseDir}`

Deduplicate by canonical skill identity:
- prefer earlier roots in the priority order above
- if the same skill exists at both project and user level, keep the project-level copy
- if frontmatter `name` is missing, fall back to the skill directory name

Keep the full deduplicated list in memory for persistence and batch actions.

If no skills are found:

```text
No installed skills found in the scanned roots.
If your OpenClaw skills live in a custom path, add it to `skills.load.extraDirs` in `~/.openclaw/openclaw.json`.
```

Save an empty snapshot state, write `.skill-compass/.setup-done`, and:
- in auto-trigger mode: return control to the dispatcher so it can continue the original command
- in manual mode: stop

If more than 20 skills are found:
- sort by file modification time (most recent first) for display only
- show the top 20 in the UI
- keep all discovered skills in memory for saved state and the manual `all` flow

## Step 4: Quick Inventory

For each discovered skill, extract basic info by reading the file and parsing YAML frontmatter only:
- `name`, `description`, `version`
- whether it has `commands`, `hooks`, or `globs`
- source root and last modified time

Group skills by purpose using keyword matching on the `description` field:
- **Code/Dev**: `\b(format|lint|test|review|generate|scaffold|refactor|code)\b`
- **Deploy/Ops**: `\b(deploy|kubernetes|k8s|docker|ci/cd|infra|monitor|devops)\b`
- **Data/API**: `\b(api|data|query|fetch|database|sql|csv|json)\b`
- **Productivity**: `\b(todo|note|doc|translate|search|manage|write|email)\b`
- **Other**: anything that does not match above

## Step 4.5: Quick Scan New Skills (D1+D2+D3)

For any skill that is **newly discovered** in this run (not present in the previous `setup-state.json`), run a lightweight D1+D2+D3 scan:

1. Use `lib/quick-scan.js` `QuickScanner.scanOne(filePath, skillName)` on the new skill's SKILL.md path
2. Display the result inline immediately after the skill's inventory entry:

For clean results:
```text
[setup] 新 skill: {name}
[quick scan] D1={d1} D2={d2} D3={d3} ✓ Clean
```

For issues found:
```text
[setup] 新 skill: {name}
[quick scan] D1={d1} D2={d2} D3={d3} ⚠ {verdict}
  → {first finding description}
  → 建议运行 /eval-skill {name} 做完整评测
```

3. Write scan results to `.skill-compass/cc/quick-scan-cache.json` via `QuickScanner`
4. Do not block the setup flow — this is informational output only

If `lib/quick-scan.js` cannot be loaded (e.g., missing dependency), skip this step silently and continue setup.

## Step 5: Quick Health Check

Run local checks only. No LLM calls.

1. **Security scan**: execute `node -e` with `SecurityValidator` on each discovered SKILL.md
   - only surface findings with severity `critical`
   - ignore `high`, `medium`, `low`, and `info` in setup context
2. **Duplicate detection**: compare skill names and description keywords pairwise
   - flag pairs that share more than 50% of meaningful description keywords after stop-word removal
3. **Structure check**: execute `node -e` with `StructureValidator` on each skill
   - only surface skills with structure score `<= 3`

Threshold rule: only surface findings users are likely to act on immediately. If nothing crosses the thresholds above, report the inventory as healthy.

## Step 6: Display Results and Changes Since Last Check

Output the inventory:

```text
--------------------------------------------
  {N} skills installed
--------------------------------------------

  Code/Dev
    1. sql-formatter      Format SQL queries with multi-dialect support
    2. git-commit-helper  Generate conventional commit messages

  Deploy/Ops
    3. deploy-helper      SSH deploy to staging/production
    4. k8s-manager        Kubernetes pod management and logs

  Productivity
    5. api-tester         Test REST API endpoints
    6. data-cleaner       CSV/JSON data cleaning
```

If findings exist, append:

```text
  Quick check found:

  Security: #3 deploy-helper contains a plaintext API key
    -> anyone who can read this file can use that key

  Duplicate: #5 api-tester and #6 data-cleaner have substantial feature overlap
    -> you may only need one of these

  Structure: #7 old-formatter is fundamentally broken
    -> Claude may not load it correctly
```

If no findings:

```text
  Quick check: healthy. No critical security issues, hard duplicates, or broken structures found.
```

If a previous snapshot exists, compute and display changes since the last check:
- `Added`: skills not present last time
- `Removed`: skills no longer present
- `Updated`: same skill, but version, path, or description hash changed

If there is no previous snapshot, say:

```text
  Baseline saved. Future /setup runs will show changes since this snapshot.
```

If no changes are detected on a later run, say:

```text
  No inventory changes since the last check.
```

If the display was truncated because there are more than 20 skills, append:

```text
  {M} older skills not shown here. The saved snapshot still includes all {N} discovered skills.
```

## Step 7: Auto-Trigger Exit Path

If setup is running in auto-trigger mode:
- save state immediately after Step 6
- do **not** ask the user to pick skills to evaluate
- return control to the dispatcher so it can continue `{resume_command}` exactly once

Optionally add a short note:

```text
Quick inventory saved. Continuing with {resume_command}.
Run /setup anytime for the interactive inventory and evaluation flow.
```

## Step 8: Prompt for Action (manual mode only)

In manual mode, prompt the user:

```text
Enter the skill number(s) you'd like to evaluate and improve (for example: 3 or 3,5,7).
Enter "all" to evaluate the full deduplicated inventory.
Press Enter or type "done" to stop.
```

Wait for the response.

## Step 9: Route to Evaluation (manual mode only)

Based on the user's response:

**Single or multiple numbers (for example `3` or `3,5,7`):**

For each selected skill:
1. Run `/eval-skill {skill_path} --scope full`
2. Translate the result into scenario-based language (Step 10)
3. Ask: `Fix this? ~2 minutes. [Fix / Skip]`
4. If the user says `Fix`, run `/eval-improve {skill_path}` and show before/after using Step 10
5. If the user says `Skip`, move to the next selected skill

**`all` / `全部`:**

Use the already-discovered deduplicated inventory from Step 3. Do **not** re-scan roots and do **not** call `/eval-audit` on raw directories from setup mode.

Inform the user of the estimate:

```text
Batch evaluation of {N} discovered skills, ~2 minutes each, estimated total ~{N*2} minutes. Start?
```

If confirmed:
- evaluate the full deduplicated inventory list sequentially with `/eval-skill {skill_path} --scope full`
- keep SkillCompass itself excluded
- preserve the inventory order already chosen for setup

**Anything else (`skip`, `done`, empty, or unrecognized):**

```text
OK. Run /setup anytime to check again, or /skill-compass evaluate {skill} for a single skill.
```

Stop.

## Step 10: Scenario-Based Output

When presenting evaluation results in setup context, do **not** use dimension codes (`D1-D6`) or raw numeric dimension scores. Translate findings into plain language that non-experts can understand.

Read the `issues` arrays from the evaluation result. Pick the top 3 most impactful issues and translate them:

**Security**
- hardcoded secret -> `Contains a plaintext key or password - anyone with access to this file can see it`
- pipe-to-shell -> `Downloads and runs remote code with no safety checks`
- prompt injection -> `Contains content that could be used to alter Claude's behavior`

**Discoverability**
- vague description -> `Description is too generic - Claude may not know when to use this skill`
- no trigger mechanism -> `No clear activation method - Claude may not find it when you need it`

**Stability**
- no edge handling -> `May fail or produce bad results on unexpected input`
- no error handling -> `Fails without clearly telling you what went wrong`

**Value**
- negative comparative delta -> `Asking Claude directly is likely to work better than using this skill`

**Uniqueness**
- high overlap -> `You already have a similar skill: {similar_skill_name}`

Display only categories that actually have issues:

```text
  {skill_name} evaluation:

  Security
    {translated issue}

  Discoverability
    {translated issue}

  Stability
    {translated issue}

  Value
    {translated issue}

  Uniqueness
    {translated issue}

  Fix this? ~2 minutes. [Fix / Skip]
```

If all good:

```text
  {skill_name} looks good - no issues to fix.
```

After a fix, only show categories where something materially changed, maximum 3 categories:

```text
  {skill_name} fixed

  Security
    Before: {plain-language before}
    After:  {plain-language after}
```

## Step 11: Save State and Follow-Up

After setup completes in either mode, write `.skill-compass/setup-state.json` with a real snapshot, for example:

```json
{
  "version": 1,
  "completed": true,
  "timestamp": "{ISO}",
  "roots_scanned": [".claude/skills", "~/.claude/skills", "~/.openclaw/skills"],
  "skills_found": 12,
  "skills_evaluated": ["deploy-helper", "api-tester"],
  "inventory": [
    {
      "name": "deploy-helper",
      "version": "1.2.0",
      "path": "~/.claude/skills/deploy-helper/SKILL.md",
      "source_root": "~/.claude/skills",
      "purpose": "Deploy/Ops",
      "modified_at": "{ISO}",
      "description_hash": "{sha256}"
    }
  ]
}
```

For each skill in the inventory, apply the `first_seen_at` preservation algorithm:

1. Load the **previous** `setup-state.json` (before overwriting) and build a lookup map: `prevMap[skill.name] = skill`
2. For each skill in the **current** inventory:
   - If `prevMap[skill.name]` exists and has a `first_seen_at` value → **preserve it**: `skill.first_seen_at = prevMap[skill.name].first_seen_at`
   - Otherwise → **set it now**: `skill.first_seen_at = new Date().toISOString()`
3. Write the updated inventory to `setup-state.json`

This field enables the Skill Inbox R1 and R2 rules to calculate how long a skill has been installed. Without it, all skills appear as "just installed" on every setup run.

Also write `.skill-compass/.setup-done` as a compatibility marker.

Future `/setup` runs must read this snapshot first and show changes relative to it.

If manual mode ends with unevaluated skills still available, say:

```text
{remaining} more skills are available to evaluate.
Enter another number to continue, or stop here and come back with /setup later.
```

If the user stops, end with:

```text
Inventory complete. Run /setup anytime to check again.
```
