# SkillCompass

**Your skill could be much better. But better *how*? Which part? In what order?**

> Find the weakest link → fix it → prove it worked → next weakness → repeat.

---

## Why

You installed a skill. It kinda works. But it could be much better — and you don't know **where to start**.

You could tweak randomly: rewrite the description, add examples, adjust parameters. Maybe it gets better. Maybe it gets worse. Maybe you fix one thing and break another. **Without direction, improving a skill is guesswork.**

This is what actually happens today:

- skill-creator optimizes trigger rate — but trigger rate isn't the only thing that matters
- CE / EvoMap fix bugs when they appear — but "no bugs" doesn't mean "good"
- Claudeception extracts skills from sessions — but the extracted skill's quality is unknown
- You manually tweak and hope for the best — **no diagnosis, no verification, no direction**

**SkillCompass changes this.** It tells you exactly what's weakest, fixes it with precision, proves the fix worked, and moves to the next bottleneck. Every step has direction. Every improvement is verified.

## One Command, Know Where to Go

```
/eval-skill ./my-skill/SKILL.md
```

```
╭──────────────────────────────────────────────╮
│  SkillCompass — Skill Quality Report          │
│  sql-optimizer  ·  v1.0.0  ·  atom           │
├──────────────────────────────────────────────┤
│  D1  Structure    ██████░░░░  6/10           │
│  D2  Trigger      ███░░░░░░░  3/10  ← weak  │
│  D3  Security     ██░░░░░░░░  2/10  ⛔ CRIT  │
│  D4  Functional   ████░░░░░░  4/10           │
│  D5  With/Without +0.12                      │
│  D6  Uniqueness   ███████░░░  7/10           │
├──────────────────────────────────────────────┤
│  Overall: 38/100  ·  Verdict: FAIL           │
│  Weakest: D3 Security — user input           │
│           concatenated into instructions     │
│  Action:  /eval-improve to fix               │
╰──────────────────────────────────────────────╯
```

The score isn't the point — **the direction is.** You instantly see which dimension is the bottleneck and what to do about it.

| Dimension | Weight | What it evaluates |
|-----------|--------|-------------------|
| **D1 Structure** | 10% | YAML frontmatter, format compliance, declaration completeness |
| **D2 Trigger** | 15% | Trigger accuracy by type — description matching, slash commands, hooks |
| **D3 Security** | 20% | Hardcoded secrets, injection risks, scope violations (gate: Critical = auto FAIL) |
| **D4 Functional** | 30% | Post-trigger execution quality, edge cases, output stability |
| **D5 With/Without** | 15% | Task quality delta: with skill vs without |
| **D6 Uniqueness** | 10% | Differentiation from similar skills, model supersession risk |

## One Command, Directed Fix

```
/eval-improve ./my-skill/SKILL.md
```

SkillCompass finds the weakest dimension and fixes it — not random patching, but **targeted evolution of the biggest bottleneck**:

```
sql-optimizer: eval-improve complete

  Before (v1.0.0):       38/100  FAIL
  After  (v1.0.0-evo.1): 52/100  CAUTION  (+14)

  Fixed: D3 Security 2→7
    ✓ Parameterized user input handling
    ✓ Added input validation
    ✓ Scoped file access declarations

  Next weakest: D2 Trigger (3/10)
  Run /eval-improve again to continue.
```

Run it again — it targets D2. Then D4. Each run creates a versioned snapshot. Three rounds of `/eval-improve`: 38 → 52 → 62 → 71. **FAIL to PASS.**

This is what no other tool does: **diagnose → targeted fix → verified improvement → next weakness → repeat.**

## It Learns From You

### Correction Tracking *(planned — v1.1)*

You use a skill, then tweak its output. Again. And again. The same fix every time.

SkillCompass will silently watch. When it detects a pattern:

```
Next time you invoke the skill:
  "You adjusted index suggestion format in your last 2 uses of
   sql-optimizer. Update the skill before running? [Update / Skip]"
```

No interruptions while you work. It notices patterns → prompts at next invocation → generates improvement → verifies. **Your skill evolves from your behavior, not just from static analysis.**

> **Status:** The data structure (`corrections.json`) and dimension-mapping design are in place. The observation hook and pattern detection module are planned for v1.1.

### Cross-Language Triggers

Your skill has an English description. You work in Chinese. Does it still trigger correctly? When `user_locale` is configured, SkillCompass tests trigger accuracy in your language via D2's cross-locale evaluation — fixing the gap most skill authors never think about.

## Is Your Skill Still Needed?

Models get smarter every month. That SQL optimization skill you installed six months ago — does Claude now handle those queries natively?

**D6 Uniqueness** answers this:

- Compares skill output vs base model output on the same tasks
- Tracks whether the delta shrinks over model updates
- Flags skills at risk of obsolescence: "Base model now handles 90% of this skill's use cases"

No other tool in the ecosystem does this. Without it, your skill library accumulates dead weight you never notice.

## Quick Start

```bash
# Install to user-level skills
cp -r SkillCompass/ ~/.claude/skills/SkillCompass/

# Or project-level
cp -r SkillCompass/ .claude/skills/SkillCompass/
```

Requires Node.js (for local validators and hooks). Works inside Claude Code or OpenClaw.

> **First run note:** `/eval-skill` uses local JavaScript validators to reduce token consumption. On first run, Claude Code will request permission for `node -e` and `bash` commands. Select **"Allow always"** to avoid repeated prompts.

## Commands

| Command | What it does | Version |
|---------|-------------|---------|
| `/eval-skill <path>` | Six-dimension quality evaluation | v1 |
| `/eval-improve <path>` | Evaluate + diagnose + fix + verify (**star feature**) | v1 |
| `/eval-security <path>` | Security-only scan (D3) | v1 |
| `/eval-merge <path>` | Merge local evolution with upstream updates | v1 |
| `/eval-rollback <name>` | View version history and rollback | v1 |
| `/eval-audit <dir>` | Batch scan all skills in a directory | v1 |
| `/eval-compare <a> <b>` | Side-by-side version comparison | v1 |
| `/eval-evolve <path>` | Multi-round auto-evolution (requires `ralph-wiggum` plugin) | v1.1 |

## Version Management

Every change creates a snapshot. Your SKILL.md stays clean — all metadata lives in `.skill-compass/`:

```
.skill-compass/
  sql-optimizer/
    manifest.json            ← version lineage + eval scores
    snapshots/
      1.0.0.md               ← original upstream
      1.0.0-evo.1.md         ← security fix
      1.0.0-evo.2.md         ← trigger improvement
      1.0.0-evo.3.md         ← manual edit
      1.1.0.md               ← upstream update
      1.1.0-evo.1.md         ← merged: local evolution + upstream
    corrections.json         ← correction tracking data
```

**Rollback anytime:**

```
/eval-rollback sql-optimizer

  1.0.0-evo.3 (current)  — 71  PASS    — D4 functional fix
  1.0.0-evo.2            — 62  CAUTION — D2 trigger fix
  1.0.0-evo.1            — 52  CAUTION — D3 security fix
  1.0.0 (upstream)        — 38  FAIL    — original

  Select version to restore: _
```

**Upstream merge:** When upstream publishes a new version, `/eval-merge` does three-way semantic merge — preserving your local improvements while absorbing new features. Post-merge evaluation ensures nothing regresses.

## Tiered Verification

Not every edit needs full re-evaluation:

| Level | When | What happens |
|-------|------|--------------|
| **L0** | Typo, formatting | Silent pass |
| **L1** | Parameter tweak | Quick sanity check |
| **L2** | Logic change | Targeted tests on affected paths |
| **L3** | Major rewrite | Full six-dimension evaluation |

Auto-classified via diff analysis. Cumulative drift detection catches gradual quality erosion.

## How It Fits In

**Where your skill comes from doesn't matter.** Wrote it yourself, extracted via Claudeception, installed from ClawHub — SkillCompass picks it up from there:

```
You have a skill (from anywhere)
    ↓
/eval-improve
    ↓
Weakest link found → fixed → verified → next weakness
    ↓
Your skill becomes the best version of itself — for you
```

### Pre-Accept Gate — Always-On Protection

SkillCompass automatically watches every SKILL.md edit. No configuration needed — if any tool (or you) writes to a SKILL.md, the gate runs:

```
Any Write/Edit to SKILL.md
    → D1 structure check (frontmatter, required fields)
    → D3 security scan (secrets, dangerous commands, injection)
    → Baseline comparison (did quality drop?)
    → Warnings to your terminal (never blocks)
```

```
[SkillCompass Gate] sql-optimizer/SKILL.md — 2 finding(s)

  CRITICAL:
    ⛔ Hardcoded API key (line ~42)
  HIGH:
    ⚠️ Pipe remote script to shell (line ~67)

  Action: Run /eval-security to get full analysis and fix recommendations.
```

This is what makes SkillCompass work with **everything** — it doesn't need to know which tool made the edit.

### Works With Everything

**Relationship with other tools:**

- **Runtime bug?** CE / EvoMap fixes it. That's reactive — fixing what broke.
- **Want proactive improvement?** SkillCompass. That's directed — finding and fixing what's weak before it breaks.
- **Extracted a skill from a session?** Claudeception got you a draft. SkillCompass turns the draft into something solid.

They solve different problems. No conflict.

#### Integration Guides

SkillCompass works with other tools automatically — no point-to-point integration needed. The Pre-Accept Gate intercepts all SKILL.md edits regardless of source.

| Tool | How it works together | Guide |
|------|----------------------|-------|
| **Auto-Updater** | Pulls new version → Gate auto-checks for security regressions → you decide to keep or rollback | [guide-auto-updater.md](examples/guide-auto-updater.md) |
| **Claudeception** | Extracts skill from session → auto-evaluation catches security holes + redundancy → directed fix | [guide-claudeception.md](examples/guide-claudeception.md) |
| **Self-Improving Agent** | Logs errors to `.learnings/` → feed as signals → SkillCompass maps to dimensions and fixes | [guide-self-improving-agent.md](examples/guide-self-improving-agent.md) |

### vs Skill Evolution / Optimization Tools

Every existing tool that "evolves" or "improves" skills does it **without seeing the full picture**:

| | CE / EvoMap | Claudeception | Homunculus | skill-creator 2.0 | SkillCompass |
|---|---|---|---|---|---|
| **When does it act?** | Runtime bug | Good session | Behavior patterns | Manual invocation | Anytime — proactive |
| **Knows what's weakest?** | Only what broke | No | No | User-defined evals | Yes — six dimensions, weighted |
| **Direction** | Fix the bug | Extract what worked | Summarize rules | Improve via A/B test | Target the bottleneck dimension |
| **Verifies improvement?** | "Bug gone?" | No | No | Eval pass rate + A/B | Before/after blind test, all dimensions |
| **Catches regression?** | No | No | No | Eval-tied versions | Auto-rollback if score drops |
| **Detects obsolescence?** | No | No | No | No | D6: is base model catching up? |
| **Version management?** | No | No | No | Eval-tied only | Sidecar snapshots + rollback + merge |
| **Security gate?** | No | No | No | No | D3: multi-layer (local + LLM), Critical = auto FAIL |
| **Learns from user edits?** | No | No | Partially | No | Correction tracking *(v1.1)* |

**The core difference: direction.**

```
Without direction:
  "Something's off" → tweak description → tweak prompt → add examples
  → maybe better? → maybe worse? → try again → going in circles

With SkillCompass:
  Eval → D4 = 3/10 (bottleneck) → targeted D4 fix → verified: 3→7 ✓
  → D2 = 5/10 (next) → targeted D2 fix → verified: 5→8 ✓
  → every step forward, never in circles
```

## Real-World Cases

### Case 1: Going in Circles vs Going Forward

**Without direction — a developer tries to improve `sql-optimizer` by hand:**

```
Attempt 1: "Query outputs are sometimes wrong"
  → Rewrites description to be more specific
  → Trigger rate drops (fewer queries matched), wrong outputs unchanged
  → Net result: worse

Attempt 2: "Maybe the instructions are too vague"
  → Rewrites core prompt, adds more detail
  → JOINs now work, but subqueries broke
  → Net result: sideways

Attempt 3: "Let me add more examples"
  → Adds 8 few-shot examples to instructions
  → Prompt too long, output quality drops across the board
  → Net result: worse

After 3 attempts: frustrated, back to square one.
The skill "works" so CE never touches it. Claudeception has nothing to extract.
```

**With SkillCompass — same skill, same starting point:**

```
/eval-improve ./sql-optimizer/SKILL.md

  D1  Structure    ██████░░░░  6/10
  D2  Trigger      ██████░░░░  6/10
  D3  Security     ██░░░░░░░░  2/10
  D4  Functional   ███░░░░░░░  3/10  ← bottleneck
  D5  With/Without +0.08
  D6  Uniqueness   ███████░░░  7/10

  Diagnosis: D4 is the bottleneck. The skill only handles simple
  SELECT. JOINs, subqueries, CTEs — all unhandled.
  The developer was tweaking D2 (trigger/description) because
  that's visible. But D4 (functional) was the real problem.
```

```
Round 1 → D4 targeted fix: expand JOIN/subquery/CTE handling
  D4: 3 → 7 ✓  |  Side effect: D5 +0.08 → +0.25 (skill now genuinely useful)

Round 2 → D3 targeted fix: parameterize user input
  D3: 2 → 7 ✓  |  Security gate cleared

Round 3 → D2 fine-tuning: add not_for examples, sharpen trigger
  D2: 6 → 8 ✓  |  Now D2 tuning actually helps because underlying quality is solid

Result: 38 → 71. Every round moved forward. Zero wasted effort.
```

**Why it matters:** The developer's manual attempts kept optimizing the wrong dimension. Without knowing D4 was the bottleneck, they spent effort on D2 — which can't help if the skill doesn't *work* properly after triggering. **Direction is the difference between going in circles and going forward.**

---

### Case 2: The Skill That Quietly Became Useless — Until Direction Saves It

A `json-formatter` skill, installed 8 months ago when Claude struggled with nested JSON. It still "works." Nobody questions it.

**Without direction**, the user might:
- Notice output quality seems similar to base Claude → shrug, keep the skill
- Try to "improve" it by adding more formatting rules → wasted effort on a skill that's 92% redundant
- Never think to check if the skill is still needed

**With SkillCompass — evaluation gives a clear direction:**

```
/eval-skill ./json-formatter/SKILL.md

  D6  Uniqueness   ██░░░░░░░░  2/10
      ⚠ Supersession risk: HIGH
      "Base model now handles 92% of this skill's test cases
       with equivalent or better quality."
  D5  With/Without +0.03
      "Marginal improvement. Only edge case:
       >5 levels of nesting with mixed arrays."

  Direction: D6 is the bottleneck — not functionality, not trigger,
  not security. The skill's problem is that it's redundant.
  Two options:
    a) Remove it — reclaim context window, reduce noise
    b) Narrow scope to deep nesting edge cases (the 8% where it still wins)
```

The user chooses (b). `/eval-improve` narrows the description and instructions to deep nesting only:

```
After narrowing:
  D6: 2 → 7 ✓  (now clearly differentiated — deep nesting specialist)
  D2: 6 → 8 ✓  (tighter trigger = fewer false matches on simple JSON)
  D5: +0.03 → +0.28 ✓  (smaller scope, but much higher value in that scope)
```

**Without direction**, the user either wastes effort improving a redundant skill, or never notices it's dead weight. **With direction**, the evaluation told them *exactly* what the problem was — not quality, not security, but redundancy — and pointed to two concrete paths forward.

---

### Case 3: "I Fix the Same Thing Every Time" — Direction From Your Behavior *(v1.1)*

A developer uses `test-generator` daily. Every time:
1. Skill generates tests
2. Developer changes `assertEquals` → `assertThat` (team convention)
3. Adds missing `@DisplayName` annotations

Same two fixes. Every single time. The skill doesn't know. CE doesn't notice — there's no "error."

**Without direction**, the developer might eventually snap and rewrite the whole skill from scratch — touching trigger logic, restructuring instructions, maybe even changing the tool declarations. A huge effort when the actual problem is just the output template.

**With SkillCompass correction tracking — direction from behavior:**

```
Day 1-3: Silent observation. Records: "same region edited,
         same type of change, 3 occurrences."

Day 4, next invocation:
  "You adjusted test-generator output in your last 3 uses:
   - Assertion style (3×): assertEquals → assertThat
   - Missing annotations (3×): @DisplayName
   Update the skill? [Update / Skip]"

User: Update
```

Here's where direction matters. SkillCompass doesn't just patch blindly:

```
Correction analysis:
  Pattern: output format corrections (not logic, not trigger)
  Mapped to: D4 Functional — output template subsection
  Scope: L1 (format change, not logic change)

  → Only patches the output template in instructions
  → Does NOT touch trigger, prompt logic, or tool config
  → L1 verification: 2 quick test cases pass
  → v1.0.0-evo.1 saved
```

**The key:** The correction tracking doesn't just detect *that* you're fixing things — it diagnoses *what dimension* the problem belongs to and *how big* the change should be. Output format fix → D4 output template → L1 scope. Not a full rewrite. Not a trigger change. **Precisely scoped, directed evolution from your natural behavior.**

## Output Format

```bash
/eval-skill ./my-skill/SKILL.md                  # JSON + terminal summary
/eval-skill ./my-skill/SKILL.md --format md       # + Markdown report
/eval-skill ./my-skill/SKILL.md --format all      # JSON + Markdown + terminal
```

<details>
<summary>Example JSON output</summary>

```json
{
  "skill_path": "path/to/SKILL.md",
  "eval_timestamp": "2026-03-11T14:30:00Z",
  "skill_type": "atom",
  "scores": {
    "structure":    { "score": 7, "max": 10 },
    "trigger":      { "score": 5, "max": 10, "trigger_type": "description" },
    "security":     { "score": 8, "max": 10, "pass": true, "findings": [] },
    "functional":   { "score": 6, "max": 10, "assertions_passed": 4, "assertions_total": 5 },
    "comparative":  { "score": 7, "max": 10, "delta": 0.23 },
    "uniqueness":   { "score": 7, "max": 10, "supersession_risk": "low" }
  },
  "overall_score": 65,
  "verdict": "CAUTION",
  "weakest_dimension": "trigger",
  "recommendations": [
    "Add not_for examples to reduce false triggers",
    "Specify that CTE queries are not handled"
  ],
  "version": "1.0.0-evo.1",
  "manifest_path": ".skill-compass/sql-optimizer/manifest.json"
}
```

</details>

## Feedback Signal Standard

SkillCompass defines an open `feedback-signal.schema.json` for any tool to report skill usage data:

```bash
/eval-skill ./my-skill/SKILL.md --feedback ./feedback-signals.json
```

Claudeception, AutoSkill, ClawHub, or your own pipeline — any tool can produce or consume this format.

## Architecture: Local Validators + LLM Prompts

Each dimension is evaluated by two complementary layers working together:

```
lib/ local validators (deterministic)     prompts/d{N}.md (LLM semantic)
  regex, YAML parsing, pattern matching     decision trees, few-shot calibration,
  fast, free, certain                       contextual judgment, novel risk detection
            ↓                                          ↓
     "validated facts"  ──── injected into ────→  LLM prompt
            ↓                                          ↓
     baseline score + confirmed findings     semantic analysis on top of confirmed facts
                          ↓
                   combined final score
```

| Layer | What it does | Why it matters |
|-------|-------------|----------------|
| `lib/` validators | Checks what CAN be verified deterministically — YAML fields, regex patterns, code structure | Reduces LLM token cost, increases scoring certainty, provides a deterministic floor |
| `prompts/` LLM | Analyzes what REQUIRES semantic understanding — instruction quality, trigger specificity, security context | Catches what regex misses, applies rubric nuance, handles novel patterns |
| `hooks/` gate | Pre-screens SKILL.md edits in real-time via PostToolUse hooks | Always-on protection, zero config, works with any tool |

The local validators are extracted from the LLM prompt rubrics — they implement the subset of checks that don't need language understanding. The LLM then focuses its analysis on the semantic layer, using validator results as confirmed facts rather than re-analyzing basics.

This dual-layer design also provides **defense in depth** for security (D3): `pre-eval-scan.sh` blocks malicious content before it enters the LLM prompt, `security-validator.js` provides deterministic pattern matching, and the D3 LLM prompt applies severity decision trees and catches novel risks. Any single layer being bypassed doesn't compromise the overall assessment.

## Contributing

- **Evaluation prompts** — improve D1-D6 assessment accuracy
- **Domain-specific criteria** — coding/data/devops evaluation checklists
- **Test cases** — real skill evaluation ground truth
- **Platform compatibility** — cross-environment testing

## License

**AGPL-3.0** — Use, modify, distribute freely. Modifications must be open-sourced under the same license.
