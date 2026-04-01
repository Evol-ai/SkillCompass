<h1 align="center">SkillCompass</h1>

<p align="center">
  <strong>Your skill could be much better. But better <em>how</em>? Which part? In what order?</strong>
</p>

<p align="center">
  <a href="https://github.com/Evol-ai/SkillCompass">GitHub</a> &middot;
  <a href="SKILL.md">SKILL.md</a> &middot;
  <a href="schemas/">Schemas</a> &middot;
  <a href="CHANGELOG.md">Changelog</a>
</p>

<p align="center">
  <a href="https://clawhub.ai/skill/skill-compass"><img src="https://img.shields.io/badge/ClawHub-skill--compass-orange.svg" alt="ClawHub" /></a>
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  <img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg" alt="Node >= 18" />
  <img src="https://img.shields.io/badge/model-Claude%20Opus%204.6-purple.svg" alt="Claude Opus 4.6" />
</p>

---

|  |  |
|--|--|
| **What it is** | A local skill quality and security evaluator for Claude Code / OpenClaw – six-dimension scoring, guided improvement, version management. |
| **Pain it solves** | Turns "tweak and hope" into diagnose → targeted fix → verified improvement. |
| **Use in 30 seconds** | `/skill-compass evaluate {skill}` — instant quality report showing exactly what's weakest and what to improve next. |

> **Find the weakest link → fix it → prove it worked → next weakness → repeat.**

---

> Start read-only with `/eval-skill` or `/eval-security`. Write-capable flows are explicit opt-in.

## Who This Is For

<table>
<tr><td width="50%">

**For**
- Anyone maintaining agent skills and wanting measurable quality
- Developers who want directed improvement — not guesswork, but knowing exactly which dimension to fix next
- Teams needing a quality gate — any tool that edits a skill gets auto-evaluated

</td><td>

**Not For**
- General code review or runtime debugging
- Creating new skills from scratch (use skill-creator)
- Evaluating non-skill files

</td></tr>
</table>

---

## Quick Start

> **Prerequisites:** Claude Opus 4.6 (complex reasoning + consistent scoring) &middot; Node.js v18+ (local validators)

### Claude Code

```bash
git clone https://github.com/Evol-ai/SkillCompass.git
cd SkillCompass && npm install

# User-level (all projects)
rsync -a --exclude='.git'  . ~/.claude/skills/skill-compass/

# Or project-level (current project only)
rsync -a --exclude='.git'  . .claude/skills/skill-compass/
```

> **First run:** Claude Code will request permission for `node -e` and `node` commands. Select **"Allow always"** to avoid repeated prompts. SkillCompass may also offer a ~5 second local inventory on first use, then continue your original command automatically.

### OpenClaw

```bash
git clone https://github.com/Evol-ai/SkillCompass.git
cd SkillCompass && npm install
# Follow OpenClaw skill installation docs for your setup
rsync -a --exclude='.git'  . <your-openclaw-skills-path>/skill-compass/
```

If your OpenClaw skills live outside the default scan roots, add them to `skills.load.extraDirs` in `~/.openclaw/openclaw.json`:

```json
{
  "skills": {
    "load": {
      "extraDirs": ["<your-openclaw-skills-path>"]
    }
  }
}
```

---

## ClawHub Canary Workflow

Use a dedicated canary slug when you want a real platform-side publish check without touching the live `skill-compass` listing.

### Principles

- Reuse a single shadow slug: `skill-compass-canary`
- Always pass an explicit canary version such as `1.0.5-canary.1`
- In PowerShell, use `clawhub.cmd` rather than `clawhub`
- After validation, hide the canary entry so it does not remain publicly searchable

### Prepare

```powershell
node scripts/release/prepare-clawhub-canary.js --version 1.0.5-canary.1
```

This runs the local ClawHub preflight checks, creates a clean upload bundle in `clawhub-canary-upload/`, excludes optional example guides from the publish artifact, and writes the publish checklist to `clawhub-canary-publish.txt`.

### Publish

```powershell
clawhub.cmd publish ".\clawhub-canary-upload" --slug skill-compass-canary --name "SkillCompass Canary (Internal)" --version 1.0.5-canary.1 --changelog "internal canary validation" --tags canary
```

### Validate And Hide

```powershell
clawhub.cmd inspect skill-compass-canary --no-input
clawhub.cmd search skill compass --no-input
clawhub.cmd hide skill-compass-canary --yes
```

Notes:

- ClawHub currently applies tags per slug. A canary publish does not replace the live `skill-compass` entry, but the canary slug can still appear in search results until hidden.
- Keep canary versions explicit and monotonic. Do not fall back to the repo's local `1.0.0` metadata for repeat publishes.

---

## Usage

Two ways to invoke SkillCompass:

### `/skill-compass` + natural language

```
/skill-compass evaluate ./my-skill/SKILL.md
/setup
/skill-compass improve the nano-banana skill
/skill-compass security scan ./my-skill/SKILL.md
/skill-compass audit all skills in .claude/skills/
/skill-compass compare my-skill 1.0.0 vs 1.0.0-evo.2
/skill-compass roll back my-skill to previous version
```

### Or just talk to Claude

No slash command needed — Claude automatically recognizes the intent:

```
Evaluate the nano-banana skill for me
Show me my installed skills
Improve this skill — fix the weakest dimension
Scan all skills in .claude/skills/ for security issues
```

<details>
<summary><strong>Capability reference</strong></summary>

| Intent | Maps to |
|--------|---------|
| Show my installed skills / first-run inventory | `setup` |
| Evaluate / score / review a skill | `eval-skill` |
| Improve / fix / upgrade a skill | `eval-improve` |
| Security scan a skill | `eval-security` |
| Batch audit a directory | `eval-audit` |
| Compare two versions | `eval-compare` |
| Merge with upstream | `eval-merge` |
| Rollback to previous version | `eval-rollback` |

</details>

`/setup` is the interactive inventory flow. On first use, the same inventory can be offered as a brief helper before another command, but it should always return to the original command instead of replacing it.

---

## What It Does

<p align="center">
  <img src="assets/skill-quality-report.png" alt="SkillCompass — Skill Quality Report" width="380" />
</p>

The score isn't the point — **the direction is.** You instantly see which dimension is the bottleneck and what to do about it.

Each `/eval-improve` round follows a closed loop: **fix the weakest → re-evaluate → verify improvement → next weakest**. No fix is saved unless the re-evaluation confirms it actually helped.

---

## Six-Dimension Evaluation Model

| ID | Dimension | Weight | What it evaluates |
|:--:|-----------|:------:|-------------------|
| **D1** | Structure | 10% | Frontmatter validity, markdown format, declarations |
| **D2** | Trigger | 15% | Activation quality, rejection accuracy, discoverability |
| **D3** | Security | 20% | Secrets, injection, permissions, exfiltration |
| **D4** | Functional | 30% | Core quality, edge cases, output stability, error handling |
| **D5** | Comparative | 15% | Value over direct prompting (with vs without skill) |
| **D6** | Uniqueness | 10% | Overlap with similar skills, model supersession risk |

```
overall_score = round((D1×0.10 + D2×0.15 + D3×0.20 + D4×0.30 + D5×0.15 + D6×0.10) × 10)
```

| Verdict | Condition |
|---------|-----------|
| **PASS** | score ≥ 70 AND D3 pass |
| **CAUTION** | 50–69, or D3 High findings |
| **FAIL** | score < 50, or D3 Critical (gate override) |

---

## Features

### Core Loop

| Feature | Description |
|---------|-------------|
| **Directed Evolution** | Diagnose → targeted fix → verify → next weakness. Not random patching. |
| **Closed-Loop Improve** | `/eval-improve` auto re-evaluates after each fix. Only saves if improved and nothing regressed. |
| **Scope Control** | `--scope gate` = D1+D3 (~8K tokens). `--scope target --dimension D4` = single dim + gate. |
| **Tiered Verification** | L0 syntax → L1 single dimension → L2 full re-eval → L3 cross-skill. |
| **D1+D2 Grouping** | Both metadata dimensions weak (≤5)? Improved together — they share the frontmatter layer. |

### Safety

| Feature | Description |
|---------|-------------|
| **Pre-Accept Gate** | Hooks auto-scan every SKILL.md write. D1 + D3 checks. Zero config. Warns, never blocks. |
| **Pre-Eval Scan** | Static analysis blocks malicious code, exfiltration, prompt injection before LLM eval. |
| **Output Guard** | Validates improvement output for URL injection, dangerous commands, size anomalies. |
| **Auto-Rollback** | Any dimension drops >2 points after improvement? Changes discarded. |
| **Local Validators** | JS-based D1/D2/D3 validators run locally. Saves ~60% tokens on clear-cut issues. |

### Smart Optimization

| Feature | Description |
|---------|-------------|
| **Correction Tracking** | Detects repeated manual fixes, maps to dimensions, prompts update at next invocation. |
| **Feedback Integration** | Real usage data fuses into scores: 60% static + 40% feedback signals. |
| **Multi-Language Triggers** | Detects your language, tests trigger accuracy in it, fixes multilingual gaps. |
| **Obsolescence Detection** | Compares skill vs base model. Tracks supersession risk across model updates. |
| **Skill Type Detection** | Auto-classifies atom / composite / meta. Evaluation adapts accordingly. |

### Version & Scale

| Feature | Description |
|---------|-------------|
| **Version Management** | SHA-256 hashed snapshots. Rollback to any version anytime. |
| **Three-Way Merge** | Merges upstream updates region-by-region. Local improvements preserved. |
| **Optional Plugin-Assisted Evolution** | `/eval-evolve` runs up to 6 rounds when you explicitly opt in. Stops at PASS or plateau. |
| **Batch Audit + Optional Write Mode** | `/eval-audit --fix --budget 3` scans worst-first and only writes when you explicitly enable fix mode. |
| **CI Mode** | `--ci` flag, exit codes: 0=PASS, 1=CAUTION, 2=FAIL. |

---

## Works With Everything

No point-to-point integration needed. The Pre-Accept Gate intercepts all SKILL.md edits regardless of source.

| Tool | How it works together | Guide |
|------|----------------------|-------|
| **Auto-Updater** | Pulls new version → Gate auto-checks for security regressions → keep or rollback | [guide](examples/guide-auto-updater.md) |
| **Claudeception** | Extracts skill → auto-evaluation catches security holes + redundancy → directed fix | [guide](examples/guide-claudeception.md) |
| **Self-Improving Agent** | Logs errors → feed as signals → SkillCompass maps to dimensions and fixes | [guide](examples/guide-self-improving-agent.md) |

---

## Feedback Signal Standard

SkillCompass defines an open `feedback-signal.json` schema for any tool to report skill usage data:

```bash
/eval-skill ./my-skill/SKILL.md --feedback ./feedback-signals.json
```

Signals: `trigger_accuracy`, `correction_count`, `correction_patterns`, `adoption_rate`, `ignore_rate`, `usage_frequency`. The schema is extensible (`additionalProperties: true`) — any pipeline can produce or consume this format.

---

## License

**MIT** — Use, modify, distribute freely. See [LICENSE](LICENSE) for details.
