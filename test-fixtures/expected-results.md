# Layer 1 — Dimension-Targeted Test Fixtures

Each fixture is designed with a deliberate weakness in one specific dimension.
Use these to validate that SkillCompass correctly identifies the weakest dimension.

## Validation Criteria

For each fixture, a test PASSES if:
1. The target dimension scores lowest (or within 1 point of lowest)
2. The target dimension score falls within the expected range
3. The overall verdict matches the expected verdict

---

## d1-broken-structure/

**Target**: D1 Structure
**Deliberate defects**:
- YAML frontmatter missing `---` delimiters (bare key-value, invalid YAML block)
- No `description` field (only bare `name:` and `description:` without proper YAML)
- No section hierarchy (flat text, no ## headings)
- No prerequisites, no tool declarations, no edge cases
- Vague, unstructured instructions

**Expected**:
- D1: 1-3 (broken frontmatter, no format compliance)
- D2: 2-4 (description too vague to trigger accurately)
- D3: 5-7 (no dangerous operations, but no safety declarations either)
- D4: 2-4 (no structured workflow, no error handling)
- D5: 2-4 (minimal value over baseline — grep is trivially available)
- D6: 3-5 (log analysis has some niche but tool is too generic)
- Overall: 25-40, FAIL
- Weakest: D1

---

## d2-bad-trigger/

**Target**: D2 Trigger Quality
**Deliberate defects**:
- Name is completely generic: "helper-tool"
- Description says nothing specific: "a useful tool that helps with various things"
- No keywords, no domain terms, no not_for boundaries
- Would match virtually any user request (extreme false positive rate)
- Would also miss targeted requests (no specificity to match against)

**Expected**:
- D1: 5-7 (valid frontmatter, has sections, reasonable format)
- D2: 1-3 (description is maximally vague, name is generic)
- D3: 5-7 (no dangerous operations, asks user when unsure)
- D4: 3-5 (instructions are too generic to be functional)
- D5: 1-3 (adds no value — instructions are what any model would do anyway)
- D6: 1-3 (completely undifferentiated, matches nothing specifically)
- Overall: 25-40, FAIL
- Weakest: D2 (tied with D5/D6 — all suffer from vagueness)

---

## d3-insecure/

**Target**: D3 Security (Gate)
**Deliberate defects**:
- Hardcoded production credentials: `postgresql://admin:Sup3rS3cret!@db.prod.internal:5432/maindb`
- SQL injection via direct variable interpolation: `$USER_QUERY`, `$TABLE_NAME`, `$COLUMNS`
- Shell injection via unquoted variables: `$BACKUP_FILE`, `$USERNAME`, `$PASSWORD`
- No user confirmation before destructive operations (DROP, DELETE, RESTORE)
- AWS credentials exposure via `--profile prod`
- Writes to `/tmp/` without cleanup
- Continues execution after partial migration failure

**Expected**:
- D1: 6-8 (well-structured, proper frontmatter, sections, edge cases)
- D2: 6-8 (specific description with clear scope and not_for)
- D3: 0-2 (multiple Critical findings → gate FAIL)
- D4: 5-7 (covers many operations, has output format, some edge cases)
- D5: 5-7 (database management has real value)
- D6: 5-7 (database-specific, not highly duplicated)
- Overall: irrelevant — D3 gate triggers FAIL regardless of total
- Verdict: FAIL (D3 gate)
- Weakest: D3
- Expected D3 findings (minimum):
  - CRITICAL: Hardcoded credentials
  - CRITICAL: SQL injection ($USER_QUERY interpolation)
  - CRITICAL: Shell injection ($BACKUP_FILE, $USERNAME, etc.)
  - HIGH: No user confirmation for destructive operations
  - HIGH: AWS profile exposure

---

## d4-shallow-function/

**Target**: D4 Functional Quality
**Deliberate defects**:
- Only 3 trivial steps (check diff → generate message → commit)
- No handling of: empty staging area, merge commits, monorepo scope
- No commit message customization (body, breaking changes, scope)
- No pre-commit hook awareness
- No interactive confirmation before committing
- "Done." as the only completion signal
- No output format specification
- Description promises "Conventional Commits" but implementation doesn't cover scope, body, or breaking changes

**Expected**:
- D1: 6-8 (valid structure, proper frontmatter)
- D2: 6-8 (specific description, clear scope, has not_for)
- D3: 6-8 (no dangerous operations, git commit is low-risk)
- D4: 2-4 (extremely shallow: happy-path only, no edge cases, no output format)
- D5: 4-6 (some value in message generation, but too shallow to be reliable)
- D6: 4-6 (many commit message tools exist, but conventional commits angle has some differentiation)
- Overall: 42-55, FAIL or CAUTION
- Weakest: D4

---

## d5-no-value/

**Target**: D5 Comparative Value
**Deliberate defects**:
- Entire skill is "use the Read tool to read files" — exactly what the model does natively
- No transformation, no analysis, no synthesis
- Every instruction maps 1:1 to a built-in tool capability
- JSON/YAML "support" is just reading the file (no parsing, no validation, no querying)
- Line range support is just using Read tool parameters that already exist
- Zero added intelligence over baseline model behavior

**Expected**:
- D1: 6-7 (decent structure, proper frontmatter)
- D2: 5-7 (specific enough description)
- D3: 7-9 (read-only operations, very safe)
- D4: 4-6 (instructions work but are trivially simple)
- D5: 0-2 (delta ≤ 0 — model does this identically without the skill)
- D6: 2-4 (file reading is the most basic capability, highly duplicated)
- Overall: 38-50, FAIL
- Weakest: D5

---

## d6-duplicate/

**Target**: D6 Uniqueness
**Deliberate defects**:
- "Code reviewer" is one of the most common skill categories
- Functionality overlaps heavily with: requesting-code-review, receiving-code-review, simplify, coding-standards, security-review (all available in current environment)
- No unique angle or specialization
- Standard checklist approach (bugs, quality, best practices, security, performance)
- No domain-specific knowledge, no project-aware context, no learning from past reviews
- Output format is generic review template (Critical/Warning/Suggestion)

**Expected**:
- D1: 7-8 (well-structured, complete sections)
- D2: 6-8 (description is specific and clear)
- D3: 6-8 (safe operations, only reads diffs)
- D4: 5-7 (reasonable instructions, covers several scenarios)
- D5: 4-6 (adds some structure to review, but not dramatically better than asking model directly)
- D6: 1-3 (extremely high overlap with existing skills, no differentiation)
- Overall: 48-58, FAIL or CAUTION
- Weakest: D6

---

# Layer 2 — Type/Trigger Coverage Fixtures

Validate that the evaluator correctly handles different skill types and trigger methods.

## atom-formatter/ (json-sorter)

**Type**: Atom (single operation)
**Trigger**: Description match
**Quality level**: Good (~70-78)
**Validation**: Well-structured atom skill should score PASS. D4 should recognize focused, complete single-operation coverage.

## composite-workflow/ (release-manager)

**Type**: Composite (multi-phase workflow)
**Trigger**: Slash command (`/release`)
**Quality level**: Good (~72-80)
**Validation**:
- D2 should evaluate slash command trigger (naming, args, discoverability), not description match
- D4 should assess multi-phase workflow completeness and step handoff quality
- Has `commands` field in frontmatter — evaluator must detect slash command trigger type

## meta-decision/ (tech-debt-prioritizer)

**Type**: Meta (decision framework)
**Trigger**: Description match
**Quality level**: Good (~68-76)
**Validation**:
- D4 should use rubric scoring for decision framework quality, not assertion testing
- Skill provides heuristic guidance, not deterministic output — evaluator must not penalize this
- D5 should measure "decision quality improvement" not "task completion"

---

# Layer 3 — Command-Specific Fixtures

## merge-scenario/ (api-client)

**Tests**: `/eval-merge`
**Setup**:
- Current version: 1.0.0-evo.2 (local evolution, score 65)
- Upstream new version: 1.1.0 (adds Go support, retry logic, rate limiting)
- Common ancestor: 1.0.0
- 4 snapshots in .skill-compass/api-client/snapshots/

**Validation**:
1. System detects three-way merge scenario (ancestor 1.0.0, local evo.2, upstream 1.1.0)
2. Frontmatter merge: local not_for + upstream Go support both preserved
3. Instructions merge: local auth/pagination + upstream retry/rate-limit both included
4. Merged version numbered 1.1.0-evo.1
5. Post-merge eval score ≥ max(65, upstream_score)

## audit-batch/skills/ (3 skills)

**Tests**: `/eval-audit`
**Setup**:
- skill-a (markdown-toc): Well-structured, should score ~70-78, PASS
- skill-b (env-checker): Terrible — leaks secrets via echo, minimal structure, should FAIL
- skill-c (regex-tester): Decent, some shell injection risk in pattern passing, CAUTION

**Validation**:
1. All 3 skills discovered and evaluated
2. Results sorted worst-first (skill-b < skill-c < skill-a)
3. skill-b flagged for D3 security (echoing secret env vars)
4. Progress display shows 1/3, 2/3, 3/3
5. Summary shows PASS/CAUTION/FAIL distribution

## rollback-history/ (csv-converter)

**Tests**: `/eval-rollback`
**Setup**: 5 versions (1.0.0 through 1.0.0-evo.4), all snapshots present

**Validation**:
1. Timeline display shows all 5 versions with scores and verdicts
2. User can select any version to rollback to
3. After rollback: SKILL.md matches selected snapshot content
4. Manifest updated: current_version changed, no versions deleted
5. Edge case: rollback to 1.0.0 (lowest score) should warn but allow

---

# Layer 4 — Edge Cases / Robustness

## edge-empty/

**Content**: 0 bytes
**Expected**: Graceful error — "SKILL.md is empty. Cannot evaluate."
**Must NOT**: crash, return NaN scores, or produce partial results

## edge-no-yaml/

**Content**: Markdown with headings but no `---` frontmatter delimiters
**Expected**:
- D1: 0-2 (no frontmatter at all)
- Other dimensions: still attempt evaluation on body content
- Overall: very low, FAIL
- Warning: "No YAML frontmatter detected"

## edge-yaml-only/

**Content**: Valid frontmatter, empty body
**Expected**:
- D1: 3-5 (frontmatter exists but no body → structure incomplete)
- D4: 0-2 (no instructions at all)
- Warning: "SKILL.md has no instructions body"
- Overall: very low, FAIL

## edge-huge/

**Content**: ~1046 lines, full-stack-scaffold skill
**Expected**:
- Evaluator handles without timeout or truncation
- D1: 7-9 (well-structured, extensive)
- D4: 6-8 (comprehensive coverage)
- Possible D6 concern: "too broad, covers too many domains"
- Warning or note about skill size may be appropriate
- Should NOT score higher just because it's longer

## edge-non-english/

**Content**: Chinese-language translation skill (中文翻译助手)
**Expected**:
- Evaluator handles non-ASCII frontmatter name and description
- D1: 7-8 (proper structure despite non-English)
- D2: 5-7 (description is specific but in Chinese — trigger matching depends on user locale)
- All dimensions should be evaluated normally
- Should NOT be penalized for non-English content
