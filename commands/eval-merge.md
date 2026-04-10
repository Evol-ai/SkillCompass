# /eval-merge — Three-Way Version Merge

> **Locale**: All templates in this spec are written in English. Detect the user's language from the session and translate user-facing text at display time per SKILL.md's Global UX Rules. Dimension labels: see the canonical table in SKILL.md.

## Arguments

- `<path>` (required): Path to the SKILL.md file (local evo version).
- `--upstream <path-or-url>` (optional): Path to upstream version. If omitted, detect from manifest.
- `--internal` (optional): Skip interactive prompts; use defaults for automated pipelines.
- `--ci` (optional): Alias for `--internal`.

## Pre-conditions

Use the **Read** tool to load `.skill-compass/{skill-name}/manifest.json`. Verify:

1. `upstream_origin` exists in manifest (skill has a known upstream source)
2. At least 1 evo version exists (something to preserve)
3. Upstream version differs from last known upstream (there IS an update)

If any pre-condition fails: display the failure reason in the session locale and stop. Do not show raw error codes or internal field names — describe the problem and, where possible, suggest what the user can do next.

## Steps

### Step 1: Identify Three Versions

- **Base**: the last known upstream version from manifest (`upstream_origin.last_known_version`). Load from snapshots.
- **Local**: the current evo version (the file at `<path>`).
- **Upstream**: the new upstream version (from `--upstream` flag or auto-detected).

Use the **Read** tool to load all three versions.

### Step 2: Execute Merge

Use the **Read** tool to load `{baseDir}/prompts/merge.md`. Pass:
- `{BASE_VERSION}`: base content
- `{LOCAL_VERSION}`: local content
- `{UPSTREAM_VERSION}`: upstream content

Follow the merge prompt's region-by-region strategy. Present conflicts to the user for resolution.

### Step 3: Write Merged Version

After all conflicts resolved, display the complete merged SKILL.md. Ask user for confirmation before writing.

If confirmed: use the **Write** tool to save the merged version.

### Step 4: Version Management

Use the **Read** tool to load `{baseDir}/shared/version-management.md`. Follow merge versioning rules:
- New version: `{upstream-version}-evo.1`
- Update manifest: trigger = `eval-merge`
- Update `upstream_origin.last_known_version` to the new upstream version
- Save snapshot of merged version

### Step 5: Post-Merge Verification

Run eval-skill flow on the merged version. Compare against pre-merge local scores.

If regression detected (any dimension dropped > 2 points):
- Warn the user in the session locale: describe which dimensions regressed and by how much.
- Unless `--internal` or `--ci` is active, print a status line then present this choice:

  ```
  ⚠ Post-merge regression detected.
  The merged version scored lower than the pre-merge version. Choose:
  › Rollback to pre-merge
    Keep merged result
    Compare the two versions
  ```

  - **Rollback to pre-merge**: restore SKILL.md from pre-merge snapshot and revert the manifest update. Confirm rollback completed.
  - **Keep merged result**: keep the merged version as-is and continue. Note the regression in the audit log.
  - **Compare the two versions**: display a side-by-side diff of the pre-merge and merged versions for each regressed dimension, then re-present the choice above.

  If `--internal` or `--ci` is active: keep the merged result, log the regression, and continue without prompting.

### Step 6: Flow Continuity

After the merge (and any regression handling) completes successfully, present the following choice unless `--internal` or `--ci` is active:

```
✓ Merge complete. Recommend re-evaluating to confirm quality.
Next step?
› Re-evaluate (recommended)
  Done
```

- **Re-evaluate (recommended)**: immediately run `/eval-skill <path> --scope full` on the merged version.
- **Done**: exit the command and return control to the user.

If `--internal` or `--ci` is active: exit silently after writing results.
