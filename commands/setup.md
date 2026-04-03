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

> Quick skill inventory (~5 sec) before continuing `{resume_command}`? [OK / Skip]

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

**First run (no previous snapshot):**

Output a one-line inventory summary, quick scan results, context budget, and smart guidance:

```text
{N} 个 skill（Code/Dev: {n}, Deploy/Ops: {n}, Data/API: {n}, Productivity: {n}, Other: {n}）

Quick Scan:
  ✓ Clean: {n}  ⚠ Medium: {n}  ✗ High risk: {n}

上下文占用 {X} KB / 80 KB（{pct}%）

{smart guidance — one choice based on first matching condition below}
```

Smart guidance conditions (first match wins):

1. Any skill has a High-risk quick scan result → offer to run a full evaluation on the flagged skill
2. Context budget exceeds 60% → suggest removing or consolidating lower-value skills
3. Skill count exceeds 8 → suggest reviewing skills for overlap
4. All healthy → congratulate and suggest exploring what the skills can do
5. Fewer than 3 skills → suggest where to find more skills

Do **not** print raw command strings. Describe the action in plain language as a choice (e.g., "Evaluate the flagged skill now? [Yes / Later]").

**Subsequent runs (previous snapshot exists):**

Compute changes since the last snapshot:
- `新增`: skills not present last time
- `移除`: skills no longer present
- `更新`: same skill, version/path/description hash changed

Output:

```text
{N} 个 skill · 新增 {a} · 移除 {r} · 更新 {u}
```

If new skills were found, show the quick scan results for those new skills only (from Step 4.5).

If no changes are detected, output:

```text
skill 清单无变化 ✓
```

## Step 7: Auto-Trigger Exit Path

If setup is running in auto-trigger mode:
- save state immediately after Step 6
- return control to the dispatcher so it can continue `{resume_command}` exactly once

Print a single short note:

```text
Quick inventory saved. Continuing with {resume_command}.
```

## Step 8: Save State

After setup completes in either mode, write `.skill-compass/setup-state.json` with a real snapshot, for example:

```json
{
  "version": 1,
  "completed": true,
  "timestamp": "{ISO}",
  "roots_scanned": [".claude/skills", "~/.claude/skills", "~/.openclaw/skills"],
  "skills_found": 12,
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
