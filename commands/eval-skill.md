# /eval-skill — Six-Dimension Evaluation

**🚀 Enhanced with Local Validators**: This command now uses local JavaScript validators for D1, D2, and D3 dimensions to significantly reduce token consumption while maintaining evaluation quality. Complex reasoning tasks (D4, D5, D6) continue to use LLM evaluation with local pre-analysis.

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

Parse arguments. Use the **Read** tool to load the target SKILL.md file. Parse YAML frontmatter.

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
2. Run pre-evaluation scan: `{baseDir}/hooks/scripts/pre-eval-scan.sh '{skillPath}'` using the **Bash** tool
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
2. `~/.claude/skills/`

Exclude: `test-fixtures/`, `node_modules/`, `archive/`, `.git/`, `.skill-compass/`.

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

### Step 18: First-Run Guidance

If this is the first evaluation for this skill (manifest was just created in Step 17), append guidance to the output:

```
First evaluation complete. Next steps:
  - Score < 70? Run /eval-improve to fix the weakest dimension
  - D3 FAIL?    /eval-improve will target security first
  - Score >= 70? Your skill passes. Re-evaluate after significant changes.
```

### Step 19: CI Exit Code

If `--ci` flag is set, exit with:
- `0` if verdict is PASS
- `1` if verdict is CAUTION
- `2` if verdict is FAIL
