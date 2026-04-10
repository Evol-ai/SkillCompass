# /skillcompass — Natural Language Dispatcher

This command accepts free-form natural language and routes to the appropriate SkillCompass command. Also accessible as `/skill-compass`.

> **Locale**: All templates in this spec are written in English. Detect the user's language from the session and translate user-facing text at display time per SKILL.md's Global UX Rules. Dimension labels: see the canonical table in SKILL.md.

## Arguments

- `<message>` (required): Natural language description of what the user wants to do.

## Step 0: Setup-State Check

Before dispatching, check whether `.skill-compass/setup-state.json` exists.

- **If NOT exist**: inform the user and guide to `/inbox` (which auto-initializes):
  - "SkillCompass is not set up yet. Type /inbox to get started."
- **If exists**: proceed to Step 1.

## Step 1: Skill Name Detection

Before keyword matching, check if the user's message contains a **known skill name**.

Read `.skill-compass/setup-state.json` → `inventory` array. Build a list of all skill names (including collection children's `qualified` names like `superpowers:writing-plans`).

Scan the user's message for any exact match against this list. If a known skill name is found, extract it as `target_skill` and proceed to intent inference.

**Semantic intents — accept equivalent natural-language input in any language** (match by meaning, not literal keyword):

| Intent | Inferred route | Notes |
|--------|---------------|-------|
| evaluate, check quality, assess, score | eval-skill `target_skill` | Evaluate the skill |
| improve, optimize, fix, upgrade | eval-improve `target_skill` | Improve the skill |
| remove, delete, drop, discard | skill-inbox (locate `target_skill`) | Guide to deletion |
| mute, stop tracking, ignore | skill-inbox (mute `target_skill`) | Mark as muted |
| rollback, revert, restore | eval-rollback `target_skill` | Roll back version |
| security, vulnerability scan | eval-security `target_skill` | Security scan |
| compare, diff versions | eval-compare `target_skill` | Version comparison |
| update, check for new version | skill-update `target_skill` | Check skill for updates |
| (no action verb, name only) | skill-inbox (show `target_skill` details) | Show details + action options |

Examples:
- "evaluate superpowers" → eval-skill superpowers
- "remove old-formatter" → skill-inbox locate old-formatter
- "code-review" → skill-inbox show code-review details
- "update superpowers" → skill-update superpowers
- "how is superpowers:writing-plans" → eval-skill superpowers (rolled up to parent)

**Collection sub-skill handling:** If the match is a qualified name (e.g. `superpowers:writing-plans`), extract the parent name (`superpowers`) as `target_skill`. Evaluations and operations target the parent collection.

If a skill name is detected and a route is inferred → skip Step 2 and go straight to Step 3 Dispatch.

## Step 2: Keyword Intent Matching

If Step 1 did not match a skill name, infer intent from keywords. **All intent tokens are "skill"-scoped to avoid collisions with normal coding conversation.** Accept equivalent natural-language input in any language — match by semantic meaning, not literal English tokens.

| Intent (semantic) | Maps to | Command file |
|-------------------|---------|-------------|
| setup, skill inventory, skill health check, scan my skills, what skills do I have | setup | `commands/setup.md` |
| evaluate skill, score skill, assess skill, rate skill, diagnose skill | eval-skill | `commands/eval-skill.md` |
| improve skill, optimize skill, fix skill, upgrade skill | eval-improve | `commands/eval-improve.md` |
| skill security, skill vulnerability | eval-security | `commands/eval-security.md` |
| audit skills, batch evaluate, evaluate all skills | eval-audit | `commands/eval-audit.md` |
| compare skill versions, skill diff | eval-compare | `commands/eval-compare.md` |
| skill merge, merge skill with upstream | eval-merge | `commands/eval-merge.md` |
| rollback skill, revert skill, restore skill version | eval-rollback | `commands/eval-rollback.md` |
| evolve skill, auto-improve skill, keep improving until pass | eval-evolve | `commands/eval-evolve.md` |
| inbox, skill suggestions, pending skill actions, manage skills | skill-inbox | `commands/skill-inbox.md` |
| status line, bottom hint, pending count, 🧭 | skill-inbox | `commands/skill-inbox.md` |
| what skills do I have, show all skills, list skills | skill-inbox | `commands/skill-inbox.md` (arg: all) |
| unused skills, idle skills, never-used skills | skill-inbox | `commands/skill-inbox.md` (arg: all, filter unused) |
| remove skill, delete skill, drop skill | skill-inbox | `commands/skill-inbox.md` (locate skill) |
| skill report, skill portfolio, skill health report | skill-report | `commands/skill-report.md` |
| context pressure, too many skills, skills taking too much space | skill-report | `commands/skill-report.md` |
| skill usage, which skills are used the most | skill-report | `commands/skill-report.md` |
| check for updates, update skill, is there a new version | skill-update | `commands/skill-update.md` |
| rescan skills, refresh skill inventory, installed a new skill | setup | `commands/setup.md` |

**Match priority:** Step 1 (skill name + action) > Step 2 (keyword matching).

**If no intent matches:**

```
Not sure what you'd like to do. You can mention a specific skill name, or choose:
[View skill suggestions / View skill report / Evaluate a skill]
```

## Step 3: Extract Arguments

From the user's message, extract:
- **Skill name / path**: from Step 1 detection or explicit path in message
- **Flags**: any explicit flags (e.g., `--scope gate`, `--ci`)
- **Version references**: version numbers or words like "previous", "last"

If the matched command requires a skill path but none was found (and Step 1 didn't detect a name):
- "Please specify a skill name, or choose from the list. [Show all skills]"

## Step 4: Dispatch

Use the **Read** tool to load `{baseDir}/commands/{matched-command}.md` and execute it with the extracted arguments.
