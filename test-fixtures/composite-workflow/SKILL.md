---
name: release-manager
description: >
  Orchestrate a software release: bump version, update changelog, create git tag,
  build artifacts, and publish to npm/PyPI. Supports semver with conventional commits
  analysis for automatic version bump detection.
  Not for: Docker image publishing, GitHub Actions CI/CD setup, or Kubernetes deployments.
commands:
  - name: release
    description: Start a new release workflow
    args:
      - name: version
        description: "Version bump type: major, minor, patch, or explicit version (e.g., 2.1.0)"
        required: false
---

# Release Manager

## Prerequisites

- Git repository with clean working tree (no uncommitted changes)
- `package.json` or `pyproject.toml` for version tracking
- Environment variable `NPM_TOKEN` or `PYPI_TOKEN` for publishing (optional)

## How to use

### Phase 1: Pre-flight checks

1. Verify clean working tree:
```bash
git status --porcelain
```
If output is non-empty: "Working tree is dirty. Commit or stash changes first."

2. Verify on the correct branch:
```bash
git branch --show-current
```
Ask: "You're on branch `<branch>`. Release from this branch? [y/n]"

3. Pull latest:
```bash
git pull --ff-only
```
If fails: "Cannot fast-forward. Resolve divergence before releasing."

### Phase 2: Version determination

If user provided explicit version, use it. Otherwise:

1. Analyze commits since last tag:
```bash
git log $(git describe --tags --abbrev=0 2>/dev/null || echo "")..HEAD --oneline
```

2. Apply conventional commits rules:
   - Any `feat!:` or `BREAKING CHANGE:` → **major**
   - Any `feat:` → **minor**
   - Only `fix:`, `chore:`, `docs:` → **patch**

3. Confirm with user: "Based on commits, suggesting **`<type>`** bump: `<old>` → `<new>`. Proceed? [y/n]"

### Phase 3: Version bump

Detect project type and update version:

**Node.js** (`package.json` exists):
```bash
npm version <new_version> --no-git-tag-version
```

**Python** (`pyproject.toml` exists):
Update `version = "<new_version>"` in pyproject.toml using the **Edit** tool.

If both exist, ask which is the source of truth.

### Phase 4: Changelog

1. Read existing `CHANGELOG.md` (or create if missing)
2. Generate entry from commits since last tag, grouped by type:
   - **Features**: `feat:` commits
   - **Bug Fixes**: `fix:` commits
   - **Other**: remaining commits
3. Prepend new section with version header and date
4. Write using the **Edit** tool (prepend, don't overwrite)

Ask: "Review the changelog entry before committing? [y/n]"

### Phase 5: Commit, tag, push

```bash
git add -A
git commit -m "release: v<new_version>"
git tag -a "v<new_version>" -m "Release v<new_version>"
```

Ask: "Push release commit and tag to remote? [y/n]"

If confirmed:
```bash
git push && git push --tags
```

### Phase 6: Publish (optional)

Only if user requests or project has publish config:

**npm**:
```bash
npm publish
```

**PyPI**:
```bash
python -m build && twine upload dist/*
```

Ask before publishing: "Publish v`<new_version>` to `<registry>`? This is irreversible. [y/n]"

## Output Format

```
Release Report:
- Project: <name>
- Version: <old> → <new>
- Bump type: major | minor | patch
- Changelog: updated (N new entries)
- Tag: v<new_version>
- Published: yes (<registry>) | no | skipped
- Status: COMPLETE | PARTIAL (see errors below)
```

## Edge Cases

- **No previous tags**: Treat as first release, suggest `1.0.0`
- **Monorepo**: Ask which package to release if multiple `package.json` found
- **Pre-release versions**: Support `--pre` flag for alpha/beta/rc suffixes
- **Publish failure**: Report error but don't rollback git tag (user can retry publish)
- **Protected branch**: If push fails due to branch protection, suggest creating a PR instead
- **Missing tokens**: If `NPM_TOKEN`/`PYPI_TOKEN` not set but publish requested, warn and skip publish step
