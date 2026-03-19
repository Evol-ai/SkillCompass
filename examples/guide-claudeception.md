# SkillCompass + Claudeception

> **Quality control for skill extraction.**
> Claudeception turns good debugging sessions into reusable skills. SkillCompass makes sure they're actually good.

---

## The Problem

Claudeception is powerful — it watches your debugging sessions and automatically extracts reusable skills. But extraction quality varies wildly:

- **Session-specific artifacts**: hardcoded file paths, user-specific config references
- **Security holes**: API keys from the session, unrestricted shell access patterns
- **Redundancy**: extracted skill duplicates one you already have (or a public skill on ClawHub)
- **Incomplete logic**: the debugging session solved one case, but the extracted skill doesn't generalize

Without quality control, your `skills/` directory grows into a pile of untested drafts. Some are gems. Some are liabilities. **You can't tell which is which.**

## The Solution

Install both. SkillCompass automatically evaluates every new skill Claudeception creates:

```
You debug a tricky deployment issue in a session
    → Claudeception extracts the pattern
    → Writes skills/deploy-fixer/SKILL.md

SkillCompass detects new SKILL.md (first-creation trigger)
    → Automatic six-dimension evaluation:

  ╭──────────────────────────────────────────────╮
  │  SkillCompass — Skill Quality Report          │
  │  deploy-fixer  ·  v1.0.0  ·  atom            │
  ├──────────────────────────────────────────────┤
  │  D1  Structure    ████████░░  8/10           │
  │  D2  Trigger      █████░░░░░  5/10           │
  │  D3  Security     ██░░░░░░░░  2/10  ⛔ CRIT  │
  │  D4  Functional   ██████░░░░  6/10           │
  │  D5  With/Without +0.18                      │
  │  D6  Uniqueness   ████░░░░░░  4/10           │
  ├──────────────────────────────────────────────┤
  │  Overall: 44/100  ·  Verdict: FAIL           │
  │  Weakest: D3 Security — hardcoded path to    │
  │           /Users/dev/.ssh/config              │
  │  D6 flag: 85% overlap with shell-helper      │
  ╰──────────────────────────────────────────────╯
```

## What Happens Next

The evaluation tells you exactly what to fix and in what order:

```bash
# Fix the security issue first (D3 is gate dimension)
/eval-improve ./skills/deploy-fixer/SKILL.md

  → Removes hardcoded path, adds user confirmation step
  → D3: 2 → 7 ✓
  → v1.0.0-evo.1 saved

# Address the redundancy (D6)
/eval-compare ./skills/deploy-fixer/SKILL.md ./skills/shell-helper/SKILL.md

  → Side-by-side comparison shows 85% overlap
  → Unique value: deploy-fixer handles pm2 restart + health check
  → Recommendation: merge deploy-specific logic into shell-helper,
    or narrow deploy-fixer scope to deployment-only tasks
```

## The Extraction → Quality Pipeline

```
Claudeception extracts skill
    ↓
Pre-Accept Gate (immediate)
    → D1 + D3 lightweight check
    → Critical issues flagged instantly
    ↓
First-creation evaluation (automatic)
    → Full six-dimension assessment
    → Redundancy check against existing skills
    ↓
/eval-improve (your decision)
    → Fix weakest dimension
    → Verify improvement
    → Snapshot saved
    ↓
Production-ready skill
```

## Common Patterns

| Claudeception extracts... | SkillCompass catches... | Fix |
|--------------------------|----------------------|-----|
| Skill with hardcoded paths | D3: hardcoded file system paths | `/eval-improve` parameterizes paths |
| Skill that duplicates existing | D6: high overlap with installed skill | Merge or discard |
| Skill with vague description | D2: low trigger accuracy | `/eval-improve` sharpens description |
| Skill that only handles one case | D4: poor edge case coverage | `/eval-improve` generalizes logic |
| Actually good skill | All dimensions green | Silent pass, snapshot saved |

## Setup

```bash
# 1. Install SkillCompass
clawhub install skill-compass
# or: cp -r skill-compass/ ~/.claude/skills/skill-compass/

# 2. Install Claudeception (if not already)
# Follow Claudeception's own install instructions

# 3. Done. SkillCompass watches the skills/ directory.
# Every new SKILL.md triggers automatic evaluation.
```

No integration config. Claudeception writes files, SkillCompass watches files. They don't need to know about each other.
