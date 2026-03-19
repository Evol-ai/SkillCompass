# SkillCompass + Self-Improving Agent

> **It records problems. SkillCompass solves them.**
> Self-Improving Agent logs errors and corrections. SkillCompass turns those logs into targeted skill improvements.

---

## The Problem

Self-Improving Agent is great at detecting and recording issues:

- Bash command failures → logged to `.learnings/errors/`
- User corrections → logged to `.learnings/corrections/`
- Feature requests → logged to `.learnings/feature_requests/`

But it **never fixes your skills**. The `.learnings/` directory grows with useful data that just... sits there. You have a detailed record of everything that went wrong, but no tool reads it and acts on it.

## The Solution

SkillCompass defines an open `feedback-signal.schema.json` standard. Self-Improving Agent's `.learnings/` data can be converted to this format and fed into SkillCompass as improvement signals.

### Step 1: Convert Learnings to Feedback Signals

Create a simple adapter script (or do it manually) that maps `.learnings/` entries to feedback signals:

```json
[
  {
    "skill_name": "sql-optimizer",
    "signal_type": "error",
    "source": "self-improving-agent",
    "timestamp": "2026-03-12T10:30:00Z",
    "description": "JOIN query failed with syntax error on complex subquery",
    "context": {
      "error_type": "execution_failure",
      "frequency": 3,
      "pattern": "complex-join-subquery"
    }
  },
  {
    "skill_name": "sql-optimizer",
    "signal_type": "correction",
    "source": "self-improving-agent",
    "timestamp": "2026-03-12T14:00:00Z",
    "description": "User manually added LIMIT clause to every generated query",
    "context": {
      "correction_type": "output_format",
      "frequency": 5,
      "pattern": "missing-limit-clause"
    }
  }
]
```

### Step 2: Feed Signals Into SkillCompass

```bash
/eval-improve ./sql-optimizer/SKILL.md --feedback ./feedback-signals.json
```

SkillCompass reads the signals and maps them to dimensions:

```
Feedback signals loaded: 2 signals from self-improving-agent

  Signal 1: "JOIN query failed" (3×)
    → Mapped to D4 Functional — query complexity handling
    → Priority: HIGH (recurring execution failure)

  Signal 2: "User adds LIMIT clause" (5×)
    → Mapped to D4 Functional — output template
    → Priority: MEDIUM (user correction pattern)

Combined with standard evaluation:
  D4 is the clear bottleneck (external signals confirm static analysis)

  Improvement applied:
    → Added JOIN/subquery handling patterns
    → Added default LIMIT clause to output template
    → D4: 4 → 7 ✓
    → v1.0.0-evo.1 saved
```

## The Data Pipeline

```
Self-Improving Agent                    SkillCompass
┌──────────────────────┐               ┌──────────────────────┐
│                      │               │                      │
│ PostToolUse(Bash)    │               │ Six-dimension eval   │
│   ↓                  │               │   ↓                  │
│ Detect errors        │   feedback    │ Map signals to       │
│ Log to .learnings/   │──────────────→│ dimensions           │
│                      │  signals.json │   ↓                  │
│ Detect corrections   │               │ Prioritize fixes     │
│ Log to .learnings/   │               │   ↓                  │
│                      │               │ Apply + verify       │
│ ✗ Never fixes skills │               │ ✓ Targeted evolution │
└──────────────────────┘               └──────────────────────┘
```

## No Conflicts

The two tools use **different hooks on different events**:

| | Self-Improving Agent | SkillCompass |
|---|---|---|
| **Hook** | `PostToolUse(Bash)` | `PostToolUse(Write\|Edit)` |
| **Watches** | Command execution errors | File modifications |
| **Writes to** | `.learnings/` | `.skill-compass/` |
| **Modifies skills?** | Never | Only via `/eval-improve` |

Different event matchers, different storage, no write conflicts. Both can be installed simultaneously without interference.

## Setup

```bash
# 1. Install SkillCompass
clawhub install skill-compass
# or: cp -r skill-compass/ ~/.claude/skills/skill-compass/

# 2. Install Self-Improving Agent (if not already)
clawhub install self-improving-agent

# 3. Both work independently. To connect them:
#    Convert .learnings/ data to feedback-signal format
#    Feed into SkillCompass via --feedback flag

# Manual conversion example:
# Look at .learnings/errors/ → create feedback-signals.json
# Then: /eval-improve ./my-skill/SKILL.md --feedback ./feedback-signals.json
```

### Future: Automatic Adapter

A future version of SkillCompass may include a built-in adapter that reads `.learnings/` directly — eliminating the manual conversion step. The `feedback-signal.schema.json` standard is designed to make this easy: any tool that writes structured error/correction data can become a signal source.

For now, the manual step is intentional — it lets you review and filter which signals are relevant before feeding them into improvement.
