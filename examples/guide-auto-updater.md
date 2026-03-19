# SkillCompass + Auto-Updater

> **The safety net for blind updates.**
> Auto-Updater keeps your skills current. SkillCompass makes sure "current" doesn't mean "broken."

---

## The Problem

Auto-Updater pulls new skill versions automatically — daily, silently. Most of the time this is great. But sometimes upstream publishes a version that:

- Introduces a security vulnerability (new `eval()` call, hardcoded token)
- Breaks functionality that worked before (restructured instructions, removed edge cases)
- Adds dependencies you didn't approve (new environment variables, external API calls)

**You won't know until something goes wrong.** There's no quality check between "upstream published" and "your agent uses it."

## The Solution

Install both. Zero configuration needed — they work together automatically via the Pre-Accept Gate:

```
Auto-Updater cron runs
    → Pulls v1.2.0 of sql-optimizer from ClawHub
    → Writes updated SKILL.md

SkillCompass Pre-Accept Gate fires (PostToolUse hook on Write)
    → D1 structure check: frontmatter valid? required fields present?
    → D3 security scan: secrets? dangerous commands? injection patterns?
    → Baseline comparison: previous version scored 71/100 PASS

Gate output (to your terminal):
    [SkillCompass Gate] sql-optimizer/SKILL.md — 1 finding(s)

      HIGH:
        ⚠️ eval() usage (line ~34)

      ℹ Previous version scored 71/100 (PASS). Run /eval-skill to verify
        this edit maintains quality.
```

## What Happens Next

**If the gate finds issues**, you see warnings immediately. Your options:

```bash
# Option 1: Full evaluation to understand the impact
/eval-skill ./sql-optimizer/SKILL.md

# Option 2: Roll back to the previous version
/eval-rollback sql-optimizer

# Option 3: Deep security analysis
/eval-security ./sql-optimizer/SKILL.md
```

**If the gate finds nothing**, it stays silent. The update goes through and your snapshot is saved automatically — so you can always roll back later if you notice problems in practice.

## Why This Matters

| Scenario | Without SkillCompass | With SkillCompass |
|----------|---------------------|-------------------|
| Upstream adds `eval()` | Silently accepted, runs in your agent | Immediate warning, you decide |
| Upstream restructures instructions | Quality drops, you notice days later | Baseline comparison flags the change |
| Upstream removes edge case handling | Specific tasks start failing | `/eval-skill` shows D4 regression |
| Upstream is fine | Nothing happens | Nothing happens (gate is silent) |

## Setup

```bash
# 1. Install SkillCompass (if not already)
clawhub install skill-compass
# or: cp -r skill-compass/ ~/.claude/skills/skill-compass/

# 2. Install Auto-Updater (if not already)
clawhub install auto-updater

# 3. Done. No configuration needed.
# Pre-Accept Gate automatically intercepts all SKILL.md writes.
```

The gate works because both tools operate on the same file (`SKILL.md`) through the same mechanism (`Write` tool). SkillCompass doesn't need to know about Auto-Updater — it watches the file, not the tool.
