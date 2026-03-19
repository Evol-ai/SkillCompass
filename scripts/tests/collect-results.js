#!/usr/bin/env node
/**
 * SkillCompass Test Harness — Result Collector & Reporter
 *
 * Reads individual test result JSONs from $TEST_RESULTS_DIR/json/
 * Outputs summary report + detailed results.
 */

const fs = require('fs');
const path = require('path');

const RESULTS_DIR = process.env.TEST_RESULTS_DIR ||
  path.join(require('os').homedir(), 'skill-compass-test-results');
const JSON_DIR = path.join(RESULTS_DIR, 'json');
const REPORT_FILE = path.join(RESULTS_DIR, 'test-report.md');

// Load all test results
const files = fs.readdirSync(JSON_DIR).filter(f =>
  f.endsWith('.json') && !f.startsWith('_phase_') && !f.endsWith('_raw.json')
);

const results = [];
const phases = {};

for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(JSON_DIR, f), 'utf8'));
    if (data.id) {
      results.push(data);

      // Categorize by phase
      const phase = categorize(data.id);
      if (!phases[phase]) phases[phase] = { pass: 0, fail: 0, skip: 0, tests: [] };
      phases[phase].tests.push(data);
      phases[phase][data.status.toLowerCase()]++;
    }
  } catch (e) {
    console.warn(`WARN: Failed to parse ${f}: ${e.message}`);
  }
}

// Load phase summaries
const phaseFiles = fs.readdirSync(JSON_DIR).filter(f => f.startsWith('_phase_'));
for (const f of phaseFiles) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(JSON_DIR, f), 'utf8'));
    // Override with official phase counts if available
    const phaseName = data.phase;
    if (phaseName && phases[phaseName]) {
      // Keep the test list but use official counts
    }
  } catch {}
}

function categorize(id) {
  if (id.startsWith('T1.')) return 'T1: eval-skill';
  if (id.startsWith('T2.')) return 'T2: eval-improve';
  if (id.startsWith('T3.')) return 'T3: eval-security';
  if (id.startsWith('T4.')) return 'T4: eval-audit';
  if (id.startsWith('T5.')) return 'T5: eval-compare';
  if (id.startsWith('T6.')) return 'T6: eval-merge';
  if (id.startsWith('T7.')) return 'T7: eval-rollback';
  if (id.startsWith('T8.')) return 'T8: eval-evolve';
  if (id.startsWith('INT1.')) return 'INT1: Hooks';
  if (id.startsWith('INT2.')) return 'INT2: Claudeception';
  if (id.startsWith('INT3.')) return 'INT3: ralph-wiggum';
  if (id.startsWith('INT4.')) return 'INT4: MCP Security';
  if (id.startsWith('INT5.')) return 'INT5: Skill Registry';
  if (id.startsWith('VM1.')) return 'VM1: Manifest Lifecycle';
  if (id.startsWith('VM2.')) return 'VM2: Rollback Integrity';
  if (id.startsWith('VM3.')) return 'VM3: Merge Versioning';
  if (id.startsWith('VM4.')) return 'VM4: Snapshot Strategy';
  return 'Other';
}

// Summary stats
const total = results.length;
const pass = results.filter(r => r.status === 'PASS').length;
const fail = results.filter(r => r.status === 'FAIL').length;
const skip = results.filter(r => r.status === 'SKIP').length;

// Generate report
let report = `# SkillCompass v1.0.0 — Functional Test Report

> **Date**: ${new Date().toISOString().split('T')[0]}
> **Environment**: Codespace eval-v2
> **Tests**: ${total} total

---

## Summary

| Metric | Count |
|--------|-------|
| **PASS** | ${pass} |
| **FAIL** | ${fail} |
| **SKIP** | ${skip} |
| **Total** | ${total} |
| **Pass Rate** | ${total > 0 ? ((pass / (total - skip)) * 100).toFixed(1) : 0}% (excluding skips) |

---

## Results by Category

`;

// Sort phases by name
const phaseOrder = [
  'INT1: Hooks',
  'T1: eval-skill', 'T3: eval-security',
  'T5: eval-compare', 'T6: eval-merge', 'T7: eval-rollback',
  'T2: eval-improve', 'T4: eval-audit',
  'INT2: Claudeception', 'INT3: ralph-wiggum', 'T8: eval-evolve',
  'INT4: MCP Security', 'INT5: Skill Registry',
  'VM1: Manifest Lifecycle', 'VM2: Rollback Integrity',
  'VM3: Merge Versioning', 'VM4: Snapshot Strategy',
];

for (const phaseName of phaseOrder) {
  const p = phases[phaseName];
  if (!p) continue;

  const phaseTotal = p.pass + p.fail + p.skip;
  const phasePassRate = phaseTotal - p.skip > 0
    ? ((p.pass / (phaseTotal - p.skip)) * 100).toFixed(0)
    : 'N/A';

  report += `### ${phaseName}\n\n`;
  report += `**${p.pass}/${phaseTotal} PASS** (${phasePassRate}%)\n\n`;
  report += `| ID | Fixture | Status | Expected | Actual | Notes |\n`;
  report += `|----|---------|--------|----------|--------|-------|\n`;

  for (const t of p.tests.sort((a, b) => a.id.localeCompare(b.id))) {
    const statusIcon = t.status === 'PASS' ? '✓' : t.status === 'FAIL' ? '✗' : '○';
    const expected = (t.expected || '').replace(/\|/g, '\\|').slice(0, 40);
    const actual = (t.actual || '').replace(/\|/g, '\\|').slice(0, 50);
    const notes = (t.notes || '').replace(/\|/g, '\\|').slice(0, 30);
    report += `| ${t.id} | ${t.fixture} | ${statusIcon} ${t.status} | ${expected} | ${actual} | ${notes} |\n`;
  }

  report += '\n';
}

// Failures detail
const failures = results.filter(r => r.status === 'FAIL');
if (failures.length > 0) {
  report += `---\n\n## Failed Tests (${failures.length})\n\n`;
  for (const f of failures) {
    report += `### ${f.id} — ${f.fixture}\n\n`;
    report += `- **Expected**: ${f.expected}\n`;
    report += `- **Actual**: ${f.actual}\n`;
    if (f.notes) report += `- **Notes**: ${f.notes}\n`;
    report += '\n';
  }
}

// Phase summary table
report += `---\n\n## Phase Summary\n\n`;
report += `\`\`\`\n`;

let allPass = 0, allFail = 0, allSkip = 0;
for (const phaseName of phaseOrder) {
  const p = phases[phaseName];
  if (!p) continue;
  const t = p.pass + p.fail + p.skip;
  allPass += p.pass;
  allFail += p.fail;
  allSkip += p.skip;
  report += `${phaseName.padEnd(30)} ${String(p.pass).padStart(2)}/${String(t).padStart(2)} passed`;
  if (p.skip > 0) report += `, ${p.skip} skipped`;
  if (p.fail > 0) report += ` [${p.fail} FAILED]`;
  report += '\n';
}

report += `${'─'.repeat(50)}\n`;
report += `${'TOTAL'.padEnd(30)} ${String(allPass).padStart(2)}/${String(allPass + allFail + allSkip).padStart(2)} passed, ${allSkip} skipped\n`;
report += `\`\`\`\n`;

// Write report
fs.writeFileSync(REPORT_FILE, report, 'utf8');

// Console output
console.log('\n' + '═'.repeat(50));
console.log('  SkillCompass Test Report');
console.log('═'.repeat(50));
console.log(`  PASS: ${pass}  FAIL: ${fail}  SKIP: ${skip}  TOTAL: ${total}`);
console.log(`  Pass rate: ${total > 0 ? ((pass / Math.max(total - skip, 1)) * 100).toFixed(1) : 0}%`);
console.log('');

if (failures.length > 0) {
  console.log('  Failed tests:');
  failures.forEach(f => console.log(`    ✗ ${f.id} (${f.fixture}): ${f.actual}`));
  console.log('');
}

console.log(`  Full report: ${REPORT_FILE}`);
console.log('═'.repeat(50));
