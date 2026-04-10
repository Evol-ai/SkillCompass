# /skill-update — Check and Update Skills

> **Locale**: All templates in this spec are written in English. Detect the user's language from the session and translate user-facing text at display time per SKILL.md's Global UX Rules. Dimension labels: see the canonical table in SKILL.md.

Check installed skills for remote updates and guide the user through updating and evaluating them.

## Arguments

- (no args): list all skills that need checking and let the user choose
- `<skill-name>`: check the specified skill for updates
- `all`: check all git-repo-backed skills

## Step 1: Load Inventory and Check Git Status

Use `lib/update-checker.js` to scan all skills:

```javascript
const { UpdateChecker } = require('./lib/update-checker');
const checker = new UpdateChecker();
const stale = checker.getStale(inventory, 7); // not checked in last 7 days
const allGit = checker.checkAll(inventory);    // all git-repo-backed skills
```

Execute via **Bash** `node -e`.

If no git-based skills found:
```
No git-repo-backed skills found; cannot check for updates.
For manually installed skills, check the source page for new versions.
```

Stop.

## Step 2: Display and Select

**If called with `all`**: skip selection, check all git skills.

**If called with `<skill-name>`**: skip selection, check that skill only.

**If called with no args**: show the list and let user choose. Follow gstack's AskUserQuestion pattern — re-ground context, simplify, recommend, show options with effort scale.

```
{N} skills available to check for updates (git repo-backed):

  1. code-review     last checked: 12 days ago   github.com/user/code-review
  2. superpowers     last checked: 9 days ago    github.com/obra/superpowers
  3. doc-writer      last checked: 15 days ago   github.com/user/doc-writer
  4. ecc             last checked: 8 days ago    github.com/affaan-m/everything-claude-code

Checking updates requires network (git fetch), about 5 seconds each.

Enter a number, a name, or comma-separated list (e.g. 1,3), or type "all".
You can also type any other skill name directly.

[Check all / Select / Skip]
```

User can respond:
- "1,3" or "code-review, doc-writer" → check selected
- "all" → check all
- "superpowers" → check just superpowers
- Any natural-language phrase like "the first two" → parse intent (accept equivalent input in any language)

## Step 3: Fetch and Report

For each selected skill, run `checker.fetchAndCheck(skillPath)` via **Bash** `node -e`. Show results one by one:

**Has updates:**
```
Checking code-review...
  ✓ fetch done · 2 new commits found (v1.2.0 → v1.3.0)

  [Update and evaluate (recommended) / View changes / Skip]
```

If user chooses "View changes", run `git log HEAD..FETCH_HEAD --oneline` and show, then re-offer the choice.

**Already up to date:**
```
Checking superpowers...
  ✓ Already up to date
```

**Fetch failed (network error):**
```
Checking doc-writer...
  ⚠ Cannot reach remote (network issue or repo removed)
```

## Step 4: Apply Update

When user chooses "Update and evaluate":

1. **Snapshot before pull**: Ensure the current version has a snapshot file in the version management system, so `/eval-rollback` can restore it if the update causes regressions.

   a. Use the **Read** tool to load `.skill-compass/{skill-name}/manifest.json`.

   b. **If manifest doesn't exist**: create one per `shared/version-management.md` § Creating manifest (version = current upstream version extracted from SKILL.md frontmatter, or `1.0.0`; trigger = `"initial"`). Save the current SKILL.md to `.skill-compass/{skill-name}/snapshots/{version}.md`.

   c. **If manifest exists**: read `current_version` from it. Check whether `.skill-compass/{skill-name}/snapshots/{current_version}.md` exists. If not, save the current SKILL.md there. No new manifest entry needed — the version is already tracked; we're just ensuring its snapshot file is present.

   d. Pull:

   ```javascript
   const { UpdateChecker } = require('./lib/update-checker');
   const checker = new UpdateChecker();
   const result = checker.pullUpdate(skillPath);
   ```

2. If pull fails — dirty tree:
   ```
   ⚠ Working tree has uncommitted changes. Commit or stash local edits before updating.
   [View changes / Handle manually]
   ```

3. If pull fails — not fast-forwardable (diverged history):
   ```
   ⚠ Update conflict — local branch has independent commits; cannot auto-merge.
   [View diff / Abandon update / Handle manually]
   ```

4. If pull succeeds:
   - Run a manual D1+D2+D3 quick scan on the updated SKILL.md using `lib/quick-scan.js` via **Bash** `node -e`.
     (Note: `git pull` is a shell operation, not a Write/Edit tool call, so `eval-gate.js` does NOT auto-trigger.)
   - Show result:
   ```
   ✓ code-review updated to v1.3.0
     D1=9 D2=8 D3=9 ✓ Quick scan passed

   Last full eval: 82 points (v1.2.0). Version changed; recommend re-evaluating to confirm quality.
   [Full evaluation (recommended) / Skip]
   ```

5. If user chooses "Full evaluation":
   - Load and execute `commands/eval-skill.md` with `--internal` on the skill
   - Show result + follow-up choices

## Step 5: Summary

After all selected skills are checked:

```
✓ Update check complete
  Checked {N} · updated available {U} · updated {A} · skipped {S}

[Back to /skillcompass / Done]
```

## Error Handling

- **git not installed**: "git CLI is required." Stop.
- **Network timeout**: Show per-skill warning, continue with next.
- **Pull conflict**: Offer resolve/abort/manual options.
- **SKILL.md missing after update**: "SKILL.md is missing after update; the repo structure may have changed. [Rollback / Inspect manually]"
