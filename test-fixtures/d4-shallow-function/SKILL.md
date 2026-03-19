---
name: git-commit-helper
description: >
  Help users create git commits with conventional commit messages.
  Analyzes staged changes and generates a commit message following
  the Conventional Commits specification (feat, fix, chore, etc.).
  Not for: rebasing, merge conflict resolution, or branch management.
---

# Git Commit Helper

## Prerequisites

- Git must be installed and the current directory must be a git repository

## How to use

### Step 1: Check staged changes

```bash
git diff --cached --stat
```

### Step 2: Generate commit message

Based on the staged changes, generate a conventional commit message:

```
<type>: <description>
```

### Step 3: Commit

```bash
git commit -m "<generated_message>"
```

Done.
