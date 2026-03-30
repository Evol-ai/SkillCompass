# /eval-skill — Six-Dimension Evaluation

**🚀 Enhanced with Local Validators**: This command now uses local JavaScript validators for D1, D2, and D3 dimensions to significantly reduce token consumption while maintaining evaluation quality. Complex reasoning tasks (D4, D5, D6) continue to use LLM evaluation with local pre-analysis.

## Prerequisites

- **Recommended model: Claude Opus 4.6** (`claude-opus-4-6`). The 6-dimension rubric requires complex multi-dimensional reasoning, nuanced security analysis, and consistent scoring across dimensions. Sonnet and Haiku may produce inconsistent dimension scores, miss subtle security findings in D3, and generate unreliable D5 comparative assessments. If not using an Opus-class model, treat results as approximate.

## Arguments

- `<path>` (required): Path to the SKILL.md file to evaluate.
- `--scope [gate|target|full]` (optional, default: `full`): Evaluation scope.
  - `gate`: D1 + D3 only (~8K tokens). Outputs `"partial": true`.
  - `target --dimension D{N}`: specified dimension + D3 gate (~12K tokens). Outputs `"partial": true`.
  - `full`: all 6 dimensions (~40K tokens). Default behavior.
- `--dimension D{N}` (optional): Used with `--scope target` to specify which dimension.
- `--format [json|md|all]` (optional, default: `json`): Output format.
- `--feedback <path>` (optional): Path to a feedback signal JSON file.
- `--ci` (optional): CI-friendly mode. Suppresses interactive prompts, outputs JSON only, sets exit code (0=all PASS, 1=CAUTION, 2=FAIL).

## Error Handling

- **File not found**: Stop immediately. Output: `"Error: File not found: {path}"`
- **Not a SKILL.md**: Warn if filename is not SKILL.md. Continue with evaluation.
- **YAML malformed**: Warn, set D1 frontmatter_sub = 0, continue with remaining checks.

## Steps

### Step 1: Load Target

Parse arguments. Check current model — if not an Opus-class model, output a warning:
```
⚠ Warning: Current model is {model_name}. For reliable 6D evaluation, Claude Opus 4.6 is recommended. Results may be less consistent with other models.
```
Continue with evaluation regardless.

Use the **Read** tool to load the target SKILL.md file. Parse YAML frontmatter.

### Step 2: Pre-Processing Analysis

**Local Optimization**: Run basic analysis to inform evaluation strategy and reduce token consumption:

1. Execute `node -e "const {BasicValidator} = require('./lib/basic-validator.js'); const basic = new BasicValidator().validateBasics('{skillPath}'); console.log(JSON.stringify(basic, null, 2));"` using the **Bash** tool
2. Extract skill type (`atom`/`composite`/`meta`), trigger type, complexity, and quality indicators
3. Use results to optimize subsequent evaluation steps: simple skills with clear issues can use local validation only

### Step 3: Detect Types

Determine skill type and trigger type from Step 2 pre-processing results or fallback to frontmatter parsing for detection rules.

### Step 4: Load Config

Use the **Read** tool to load `.skill-compass/config.json` if it exists. Extract `user_locale`. If file doesn't exist, use defaults (`user_locale: null`).

### Step 5: Load Scoring Rules

Use the **Read** tool to load `{baseDir}/shared/scoring.md`. This provides dimension names, weights, formula, verdict rules, and security gate.

### Step 6: Determine Evaluation Scope

Based on `--scope`:

- **gate**: evaluate only D1 (Step 7) and D3 (Step 8). Skip Steps 9-12.
- **target**: evaluate D3 (Step 8) + the specified `--dimension` + D4 if not already included (D4 is always included due to its 30% weight). Skip other dimensions.
- **full**: evaluate all dimensions (Steps 7-12). Default.

### Step 7: Evaluate D1 (Structure)

*Scope: gate, full, or target when dimension=D1.*

**Enhanced Local Processing**: First run local validation to reduce token consumption:

1. Execute `node -e "const {StructureValidator} = require('./lib/structure-validator.js'); const result = new StructureValidator().validate('{skillPath}'); console.log(JSON.stringify(result, null, 2));"` using the **Bash** tool
2. If local validation finds errors, use those results directly
3. For borderline cases (score 5-7), supplement with LLM evaluation using `{baseDir}/prompts/d1-structure.md`
4. Record combined JSON result with `"tools_used": ["local", "llm"]` or `["local"]`

### Step 8: Evaluate D3 (Security — Gate)

*Scope: always evaluated (all scopes).*

**Enhanced Local Processing**: Run comprehensive local security validation:

1. Execute `node -e "const {SecurityValidator} = require('./lib/security-validator.js'); const result = new SecurityValidator().validate('{skillPath}'); console.log(JSON.stringify(result, null, 2));"` using the **Bash** tool
2. Run pre-evaluation scan: `node "{baseDir}/hooks/scripts/pre-eval-scan.js" "{skillPath}"` using the **Bash** tool
3. If local validation detects Critical findings, set `gate_failed = true` and use local results
4. For L1/L2 supplementation: use the **Read** tool to load `{baseDir}/shared/tool-instructions.md` and follow detection procedures only if local validation passes
5. Merge findings with `"tools_used": ["local", "pre-eval-scan", ...]` and prioritize Critical findings from any source

### Step 9: Evaluate D2 (Trigger)

*Scope: full, or target when dimension=D2.*

**Enhanced Local Processing**: Use local trigger validation for structural checks:

1. Execute `node -e "const {TriggerValidator} = require('./lib/trigger-validator.js'); const result = new TriggerValidator().validate('{skillPath}', '{user_locale}'); console.log(JSON.stringify(result, null, 2));"` using the **Bash** tool
2. If local validation detects clear trigger mechanism and scores well, use local results
3. For complex evaluation cases (v2 triggers, cross-locale evaluation), supplement with LLM using `{baseDir}/prompts/d2-trigger.md`
4. Record combined JSON result with appropriate `"tools_used"` field

### Step 10: Evaluate D4 (Functional)

*Scope: full, or target (always included due to 30% weight).*

**Enhanced Local Processing**: Pre-analyze skill characteristics before LLM evaluation:

1. Execute `node -e "const {BasicValidator} = require('./lib/basic-validator.js'); const basic = new BasicValidator().validateBasics('{skillPath}'); const skillType = new BasicValidator().detectSkillType(basic.frontmatter, basic.bodyContent); console.log(JSON.stringify({...basic, skillType}, null, 2));"` using the **Bash** tool
2. Use local analysis to inform LLM evaluation: pass detected `skill_type`, `complexity`, `wordCount`, and `codeBlocks` as context
3. Apply full LLM evaluation using `{baseDir}/prompts/d4-functional.md` with enriched context
4. Record result with `"tools_used": ["local-analysis", "llm"]`

### Step 11: Evaluate D5 (Comparative)

*Scope: full, or target when dimension=D5.*

Use the **Read** tool to load `{baseDir}/prompts/d5-comparative.md`. Apply to target skill content.

### Step 12: Evaluate D6 (Uniqueness)

*Scope: full, or target when dimension=D6.*

Use the **Read** tool to load `{baseDir}/prompts/d6-uniqueness.md`. Load the built-in registry from `{baseDir}/shared/skill-registry.json`. Also use the **Glob** tool to find `**/SKILL.md` files in these locations (in order):
1. `.claude/skills/` in the project root
2. `.openclaw/skills/` in the project root, if present
3. any extra roots from `skills.load.extraDirs` in `~/.openclaw/openclaw.json`
4. `~/.claude/skills/`
5. `~/.openclaw/skills/`, if present

Exclude: `test-fixtures/`, `node_modules/`, `archive/`, `.git/`, `.skill-compass/`, and `{baseDir}` itself.

Pass both skill content and combined known skills list.

### Step 13: Apply Feedback (Optional)

*Scope: full only.*

If `--feedback` was passed: use the **Read** tool to load `{baseDir}/shared/feedback-integration.md` and the specified feedback file. Apply fusion formula to adjust dimension scores.

### Step 14: Aggregate Scores

**Full scope:** Use the formula from shared/scoring.md:
```
overall_score = round((D1×0.10 + D2×0.15 + D3×0.20 + D4×0.30 + D5×0.15 + D6×0.10) × 10)
```

**Partial scope (gate/target):** Compute `overall_score` using only evaluated dimensions. For unevaluated dimensions, do NOT use zero — leave them out of the formula and note them as unevaluated.

Apply the security gate: if `gate_failed`, set `verdict = "FAIL"` regardless of score.
Otherwise apply verdict rules from shared/scoring.md.

**Partial verdict labeling:** If scope is not `full`, append `(partial)` to the verdict string (e.g., `"PASS (partial)"`). This signals that the verdict is based on incomplete data and should not be used for definitive quality assessment.

### Step 15: Identify Weakest Dimension

*Full scope only.* Find the dimension with the lowest score. On ties, use priority from shared/scoring.md:
security > functional > trigger > structure > uniqueness > comparative.

For partial scope: set `weakest_dimension` to the lowest-scored among evaluated dimensions, or `null` if only gate scope.

### Step 16: Output Report

Assemble the JSON report conforming to `schemas/eval-result.json`. Add these fields for partial evaluations:
- `"partial": true` (when scope is not full)
- `"evaluated_dimensions": ["D1", "D3"]` (list of dimensions actually evaluated)

Output to stdout. If `--format md` or `--format all`: use the **Write** tool to save a human-readable report to `.skill-compass/{skill-name}/eval-report.md`.

### Step 17: Record in Manifest

*Full scope only.* Use the **Read** tool to check `.skill-compass/{skill-name}/manifest.json`. If it doesn't exist, create it using the **Write** tool (see shared/version-management.md for structure). Update with current eval results.

Partial evaluations do NOT update manifest scores (to avoid overwriting complete evaluations with partial data).

### Step 18: Action Recommendation

*Full scope only.* Based on verdict and dimension scores, output a recommended action. Follow this decision tree **in order** — the first matching branch wins:

**For PASS verdict (score >= 70, D3 pass):**

Check if any dimension scored below 8:

If all dimensions >= 8:
```
✓ PASS (score: {score}/100)
  All dimensions ≥ 8. No further improvement suggested.
```

If any dimension < 8:
```
✓ PASS (score: {score}/100)
  Lowest dimension: {Dx} ({Dx_score}/10).
  Impact: {plain-language summary of top issues from Dx evaluation — what real
  problem users will experience if this isn't fixed}.
  Continue improving?
```

The **Impact** line must be derived from the `issues` array of the lowest-scoring dimension. Translate technical findings into user-facing consequences:
- D1 issues → "skill may not be discovered or activated correctly"
- D2 issues → "users searching for this capability may not find it"
- D3 issues → "security risk: {specific finding in plain language}"
- D4 issues → "users may get inconsistent results when {specific edge case}"
- D5 issues → "skill adds little value over direct prompting for {scenario}"
- D6 issues → "overlaps significantly with {similar_skill} — may be redundant"

**Polish loop rules** (applies when user chooses to continue after PASS):
- Run `/eval-improve` targeting the lowest dimension.
- After improvement, re-evaluate. If still PASS, repeat the check above (with updated Impact).
- **Plateau detection:** if the same dimension fails to improve for 2 consecutive attempts, output:
  ```
  {Dx} ({Dx_score}/10) — improvement plateaued after 2 attempts.
  This may be limited by the skill's inherent scope: {brief reason from issues}.
  Continue improving other dimensions, or accept current score?
  ```
  If user chooses to continue, target the next-lowest dimension instead.
- The polish loop ends when the user declines to continue.

**For CAUTION verdict (score 50-69):**

Check if only one dimension is dragging the score down (one dim <= 4, all others >= 6):
```
⚠ CAUTION (score: {score}/100)
  Only {Dx} is below threshold ({Dx_score}/10).
  Quick fix: /eval-improve --scope target --dimension {Dx}
```

Otherwise (multiple dimensions in the 4-5 range):
```
⚠ CAUTION (score: {score}/100)
  Multiple dimensions need improvement. Weakest: {Dx}.
  Recommended: /eval-improve
```

If D5 delta < 0.1 (marginal value), add a note:
```
  Note: D5 comparative value is marginal ({delta}). Consider whether this skill is worth maintaining.
```

**For FAIL verdict (score < 50):**

Evaluate in this order:

1. **Check for regression** (manifest has a previous version with verdict=PASS):
```
✗ FAIL (score: {score}/100) — Regression detected (was PASS at v{X.Y.Z})
  Options:
    1. /eval-rollback {version} — restore last passing version
    2. /eval-improve — fix current version
```

2. **Check D5 value** (D5 delta < 0):
```
✗ FAIL (score: {score}/100)
  D5 analysis: this skill degrades agent performance (delta: {delta}).
  Recommended: remove this skill. Prompting the LLM directly produces better results.
```

3. **Check D5 marginal + D6 low** (D5 delta < 0.1 AND D6 <= 2):
```
✗ FAIL (score: {score}/100)
  D5 value is marginal ({delta}) and D6 uniqueness is very low ({D6_score}/10).
  The LLM's native capabilities already cover this skill's purpose.
  Recommended: remove this skill.
```

4. **Check D6 high overlap** (D6 similar_skills has entry with overlap > 60% AND that skill scores higher):
```
✗ FAIL (score: {score}/100)
  D6 found a better alternative: {similar_skill_name} ({overlap}% overlap, score: {their_score}).
  Recommended: /eval-merge — merge unique parts into the existing skill.
  Install alternative: claude install {similar_skill_name}
```

5. **Check rebuild threshold** (4+ dimensions scored <= 2, OR D3 has 5+ Critical findings):
```
✗ FAIL (score: {score}/100)
  Too many fundamental issues ({N} dimensions scored ≤ 2) for incremental improvement.
  Options:
    1. Find an alternative skill on ClawHub or the skill registry
    2. Create a new skill from scratch: /skill-creator create
    3. Remove this skill if it's not essential
```

6. **Check D3 gate failure** (D3 pass = false, but skill has value):
```
✗ FAIL (score: {score}/100) — Security gate failure
  {N} critical security finding(s) must be fixed first.
  Recommended: /eval-improve — security will be addressed in round 1.
```

7. **Default FAIL** (has value, fixable):
```
✗ FAIL (score: {score}/100)
  Weakest dimension: {Dx} ({Dx_score}/10).
  Recommended: /eval-improve — estimated {N} rounds to reach PASS.
```
  Estimate rounds as: count of dimensions scoring below 5, minimum 1, maximum 5.

**Important:** Actions that SkillCompass executes upon user confirmation: `/eval-improve`, `/eval-rollback`, `/eval-merge`. All other recommendations (remove, install alternative, /skill-creator) are suggestions only — the user must execute them independently.

### Step 19: Action Field in JSON Output

When `--format json` (default), include the recommendation in the JSON output:

```json
{
  "action": {
    "type": "polish|evolve|quick_fix|rollback|merge|rebuild|remove",
    "summary": "human-readable one-line recommendation",
    "command": "/eval-improve|/eval-rollback {version}|/eval-merge|null",
    "executable": true|false
  }
}
```

`executable: true` means SkillCompass can execute the action upon user confirmation (`/eval-improve`, `/eval-rollback`, `/eval-merge`). `executable: false` means the action is a suggestion only (remove, rebuild, find alternative).

For PASS verdict with all dimensions >= 8, set `"action": null`.
For PASS verdict with any dimension < 8, set:
```json
{
  "action": {
    "type": "polish",
    "summary": "{Dx} ({score}/10): {impact summary from issues}",
    "command": "/eval-improve --dimension {Dx}",
    "executable": true
  }
}
```

### Step 20: CI Exit Code

If `--ci` flag is set, exit with:
- `0` if verdict is PASS
- `1` if verdict is CAUTION
- `2` if verdict is FAIL
