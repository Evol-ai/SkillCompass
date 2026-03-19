# /eval-merge — Three-Way Version Merge

## Arguments

- `<path>` (required): Path to the SKILL.md file (local evo version).
- `--upstream <path-or-url>` (optional): Path to upstream version. If omitted, detect from manifest.

## Pre-conditions

Use the **Read** tool to load `.skill-compass/{skill-name}/manifest.json`. Verify:

1. `upstream_origin` exists in manifest (skill has a known upstream source)
2. At least 1 evo version exists (something to preserve)
3. Upstream version differs from last known upstream (there IS an update)

If any pre-condition fails: explain why the merge cannot proceed and stop.

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

After all conflicts resolved, display the complete merged SKILL.md. Ask user for confirmation.

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
- Warn: "Regression detected in {dimensions} after merge."
- Offer: "Rollback to pre-merge version? [y/n]"
- If yes: restore from snapshot, revert manifest update.
