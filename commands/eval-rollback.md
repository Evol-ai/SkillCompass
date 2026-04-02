# /eval-rollback — Version Rollback

## Arguments

- `<skill-name>` (required): Name of the skill to rollback.
- `--to <version>` (optional): Target version to restore. If omitted, show version list.

## Steps

### Step 1: Load Manifest

Use the **Read** tool to load `.skill-compass/{skill-name}/manifest.json`.

If not found: output `"No version history for '{skill-name}'. Run /eval-skill first to begin tracking."` and stop.

### Step 2: Display Version Timeline

Show all tracked versions:

```
Version History: sql-optimizer
| # | Version      | Score | Verdict | Trigger      | Dimension | Date       |
|---|--------------|-------|---------|--------------|-----------|------------|
| 1 | 1.0.0        |    38 | FAIL    | initial      | —         | 2026-01-15 |
| 2 | 1.0.0-evo.1  |    52 | CAUTION | eval-improve | security  | 2026-01-16 |
| 3 | 1.0.0-evo.2  |    62 | CAUTION | eval-improve | trigger   | 2026-01-17 |
| 4 | 1.0.0-evo.3  |    71 | PASS    | eval-improve | functional| 2026-01-18 | ← current
```

If `--to` was specified: proceed to Step 3 with that version.
If not: ask user to choose a version number from the list.

### Step 3: Safety Snapshot

Before rollback, snapshot the current version:
1. Compute content hash of current SKILL.md
2. If not already in snapshots: save using the **Write** tool

### Step 4: Restore

Use the **Read** tool to load the target version from `.skill-compass/{skill-name}/snapshots/{version}.md`.

If snapshot not found: output `"Snapshot missing for version {version}. Cannot rollback."` and stop.

Use the **Write** tool to overwrite the SKILL.md file with the snapshot content.

### Step 5: Update Manifest

Update `current_version` in manifest to the restored version. Do NOT delete later version records (they remain in history for future reference).

Use the **Write** tool to save the updated manifest.

### Step 5.5: Write Audit Log

Log the rollback event to the audit chain so that the Skill Inbox R6 rule (undo-2x) can detect repeated rollbacks:

Using Node.js (or instruct Claude to execute):

```javascript
const { AuditChain } = require('./lib/audit-chain');
const crypto = require('node:crypto');
const auditChain = new AuditChain(skillName, 'cc');
auditChain.log({
  type: 'rollback',
  severity: 'WARN',
  message: `Rolled back from ${currentVersion} to ${targetVersion}`,
  skillHash: crypto.createHash('sha256').update(restoredContent).digest('hex'),
  findings: []
});
```

The second argument `'cc'` routes the audit log to `.skill-compass/cc/{skill-name}/audit.jsonl` (platform-specific path). If `lib/audit-chain.js` is not accessible from the command context, manually write a JSON line to `.skill-compass/cc/{skill-name}/audit.jsonl` with `type: "rollback"` and the current timestamp.

### Step 6: Confirm

Output: `"Rolled back {skill-name} to version {version}. Previous version preserved in history."`

## Edge Cases

- **Single version**: "Only one version exists. Nothing to rollback to."
- **Missing snapshot**: "Snapshot missing. The version record exists but the file was not preserved."
- **Untracked modifications**: If current SKILL.md content hash doesn't match any known version, warn: "Current file has untracked modifications. Snapshot saved before rollback."
