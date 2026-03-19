---
name: code-reviewer
description: >
  Review code changes for quality, bugs, and best practices.
  Analyzes git diffs, identifies potential issues, suggests improvements,
  and checks for common patterns like unused variables, missing error handling,
  and style inconsistencies.
  Not for: automated testing, code formatting, or CI/CD configuration.
---

# Code Reviewer

## Prerequisites

- Must be in a git repository with uncommitted or staged changes

## How to use

### Step 1: Get the diff

```bash
git diff
```

Or for staged changes:

```bash
git diff --cached
```

### Step 2: Analyze

Review the diff for:

1. **Bugs**: Null pointer risks, off-by-one errors, race conditions
2. **Quality**: Code duplication, overly complex logic, naming conventions
3. **Best practices**: Error handling, input validation, logging
4. **Security**: Hardcoded secrets, injection risks, unsafe operations
5. **Performance**: N+1 queries, unnecessary loops, missing indexes

### Step 3: Report

Present findings in this format:

```
## Code Review Report

### Critical
- [file:line] Description of critical issue

### Warnings
- [file:line] Description of warning

### Suggestions
- [file:line] Suggestion for improvement

### Summary
- Files reviewed: <count>
- Issues found: <count> critical, <count> warnings, <count> suggestions
- Overall: APPROVE | REQUEST_CHANGES | COMMENT
```

## Edge Cases

- If no changes detected, report "No changes to review"
- If diff is very large (>500 lines), focus on the most impactful files first
- For merge commits, review only the merge resolution, not the full branch diff

## Advanced

### Review against standards

If the project has a `.eslintrc`, `pyproject.toml`, or similar config, reference those standards in the review.

### Review PR from GitHub

```bash
gh pr diff <number>
```

Analyze the PR diff and post review comments.
