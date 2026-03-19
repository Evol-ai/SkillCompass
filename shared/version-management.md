# Version Management Rules

> Loaded by: eval-improve, eval-merge, eval-rollback.
> Single source of truth for version numbering, sidecar structure, manifest operations, and snapshot policy.

## Sidecar Directory Structure

Each tracked skill gets a sidecar directory:

```
.skill-compass/{skill-name}/
  manifest.json          # Version history + metadata
  snapshots/             # SKILL.md copies by version
    1.0.0.md
    1.0.0-evo.1.md
    1.0.0-evo.2.md
  corrections.json       # Correction tracking (optional)
```

## Directory Location

- **Project-level** (default): `.skill-compass/` in the project root
- **User-level**: `~/.skill-compass/` for skills installed globally
- Determination: if skill path is under a git repo, use project-level. Otherwise user-level.

## Version Numbering

- Upstream version: standard semver (e.g., `1.2.3`)
- Evo version: `{upstream}-evo.{N}` suffix (e.g., `1.2.3-evo.1`, `1.2.3-evo.2`)
- After merge with new upstream: reset to `{new-upstream}-evo.1`
- Pattern: `^\d+\.\d+\.\d+(-evo\.\d+)?$`

## Manifest Operations

### Reading manifest

Use the **Read** tool to load `.skill-compass/{skill-name}/manifest.json`. If the file doesn't exist, create a new manifest (see Creating below).

### Creating manifest

Use the **Write** tool to create `.skill-compass/{skill-name}/manifest.json` with:

```json
{
  "skill_name": "{name}",
  "current_version": "1.0.0",
  "versions": [
    {
      "version": "1.0.0",
      "parent": null,
      "timestamp": "2026-01-01T00:00:00Z",
      "trigger": "initial",
      "content_hash": "sha256:{hash}",
      "overall_score": null,
      "verdict": null,
      "dimension_scores": null,
      "target_dimension": null,
      "correction_pattern": null
    }
  ],
  "upstream_origin": {
    "source": "unknown",
    "slug": null,
    "last_known_version": "1.0.0",
    "content_hash": "sha256:{hash}"
  }
}
```

### Updating manifest

After each eval-improve cycle, append a new version entry:
- `version`: next evo number (increment N in `-evo.N`)
- `parent`: previous version string
- `timestamp`: current ISO 8601 timestamp
- `trigger`: `"eval-improve"`, `"eval-merge"`, `"manual"`, or `"upstream"`
- `content_hash`: SHA-256 of the new SKILL.md content, prefixed with `sha256:`
- `overall_score`: integer 0-100 from eval result
- `verdict`: `"PASS"`, `"CAUTION"`, or `"FAIL"`
- `dimension_scores`: object with per-dimension scores, e.g. `{"D1":7,"D2":5,"D3":8,"D4":6,"D5":5,"D6":7}`. Required for full evaluations. For targeted verification, include only re-evaluated dimensions.
- `target_dimension`: which dimension was targeted (e.g., `"security"`) or null
- `correction_pattern`: human-readable description of the problem and fix (e.g., "Removed hardcoded database password, replaced with $DATABASE_URL environment variable"). Should be understandable without reading the diff. Null for non-improvement entries.

Update `current_version` to the new version string.

## Snapshot Policy

- **Maximum**: 20 evo snapshots per skill (configurable via `.skill-compass/config.json` field `snapshot_limit`)
- **Upstream snapshots**: never deleted
- **Cleanup**: when limit exceeded, delete oldest evo snapshots (FIFO)
- **Storage**: use the **Write** tool to save snapshot to `.skill-compass/{skill-name}/snapshots/{version}.md`

## Content Hash

Compute SHA-256 of the SKILL.md file content for version identification:

Use the **Bash** tool to run: `sha256sum "{skill_path}"` (Unix) or `certutil -hashfile "{skill_path}" SHA256` (Windows).

Prefix with `sha256:` when storing in manifest.

## Upstream Detection

When a SKILL.md changes outside of skill-compass:
- If content diff > 50% from last known version → prompt user: "This looks like an upstream update. Is this a new upstream version?"
- If diff ≤ 50% → default to treating as user edit
- User can override either way
