---
name: tech-debt-prioritizer
description: >
  Analyze and prioritize technical debt items in a codebase. Scores each debt item
  by impact (user-facing risk), effort (estimated fix complexity), and spread
  (how many areas are affected). Produces a ranked action list with ROI estimates.
  Not for: automated refactoring, code formatting, or dependency updates.
---

# Tech Debt Prioritizer

## Prerequisites

- Must be in a project with source code
- Works best with git history available (for change frequency analysis)

## How to use

### Step 1: Discover debt signals

Scan the codebase for common tech debt indicators:

1. **Code smells**: Use **Grep** to find TODOs, FIXMEs, HACKs, XXX comments
2. **Large files**: Use **Glob** to find files >500 lines
3. **High churn**: Use `git log` to find files changed >20 times in last 3 months
4. **Complexity hotspots**: Files that are both large AND high-churn (intersection)
5. **Stale dependencies**: Check package.json/requirements.txt for major version gaps
6. **Test gaps**: Find source files with no corresponding test file

### Step 2: Classify debt items

For each discovered item, classify by type:

| Type | Example | Typical Impact |
|------|---------|---------------|
| **Architecture** | Circular dependencies, god classes | High — affects multiple teams |
| **Code quality** | Long methods, duplicated logic | Medium — slows individual changes |
| **Testing** | Missing tests, flaky tests | High — blocks safe refactoring |
| **Dependencies** | Outdated packages, security vulns | Variable — from cosmetic to critical |
| **Documentation** | Stale docs, missing API docs | Low — but compounds over time |

### Step 3: Score each item

Rate each item on three axes (1-5 scale):

- **Impact**: How much does this hurt users or developers?
  - 5: Production incidents, data loss risk
  - 3: Slower development, frequent workarounds
  - 1: Cosmetic, minor inconvenience

- **Effort**: How hard is the fix?
  - 5: Multi-sprint refactoring, high risk
  - 3: A few days, moderate risk
  - 1: Quick fix, low risk

- **Spread**: How many areas does it affect?
  - 5: Entire codebase or architecture
  - 3: Multiple modules
  - 1: Single file or function

**ROI Score** = (Impact × Spread) / Effort

Higher ROI = fix this first (high impact, low effort, wide spread).

### Step 4: Rank and present

Sort items by ROI score descending. Present as an actionable report.

Ask: "Want me to focus on a specific type (architecture/quality/testing/deps/docs), or show the full ranked list?"

## Output Format

```
# Tech Debt Assessment

## Summary
- Total items found: <count>
- Critical (ROI ≥ 8): <count>
- Moderate (ROI 4-7): <count>
- Low priority (ROI < 4): <count>

## Top 10 Action Items

| # | Item | Type | Impact | Effort | Spread | ROI | Suggested Action |
|---|------|------|--------|--------|--------|-----|-----------------|
| 1 | ... | ... | 5 | 2 | 4 | 10.0 | ... |

## Quick Wins (High ROI, Low Effort)
<items with Effort ≤ 2 and ROI ≥ 5>

## Strategic Investments (High Impact, High Effort)
<items with Impact ≥ 4 and Effort ≥ 4>
```

## Edge Cases

- **No TODOs found**: Don't assume clean codebase — run other signals (churn, size, test gaps)
- **Monorepo**: Group results by package/module, score spread within vs across packages
- **No git history**: Skip churn analysis, rely on static signals only, note reduced confidence
- **Very large codebase (>10K files)**: Sample top 200 files by size, warn about partial coverage
- **User disagrees with scoring**: "Adjust the Impact/Effort/Spread for `<item>` and I'll re-rank"

## Limitations

This skill provides a structured assessment framework, not automated fixes. The scoring is heuristic-based and should be validated against team knowledge. Use the output as a starting point for sprint planning discussions, not as a definitive mandate.
