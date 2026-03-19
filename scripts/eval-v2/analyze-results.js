#!/usr/bin/env node
/**
 * SkillCompass v2 — Statistical Analysis of Batch Evaluation Results
 *
 * Reads JSON results from results/json/*.json
 * Outputs: V1-V9 verification metrics + visual report
 */

const fs = require('fs');
const path = require('path');

const EVAL_DIR = process.env.EVAL_DIR || path.join(require('os').homedir(), 'eval-workspace');
const RESULTS_DIR = path.join(EVAL_DIR, 'results', 'json');
const SKILLS_DIR = path.join(EVAL_DIR, 'clawhub-skills');
const OUTPUT_FILE = path.join(EVAL_DIR, 'results', 'eval-analysis.md');

// Load sample metadata
function loadMeta(slug) {
  try {
    return JSON.parse(fs.readFileSync(path.join(SKILLS_DIR, slug, 'meta.json'), 'utf8'));
  } catch {
    return { slug, tier: 'unknown', installsCurrent: 0 };
  }
}

// Load all results
const files = fs.readdirSync(RESULTS_DIR).filter(f => f.endsWith('.json'));
const results = [];

for (const f of files) {
  try {
    const data = JSON.parse(fs.readFileSync(path.join(RESULTS_DIR, f), 'utf8'));
    if (data.error) {
      console.warn(`  WARN: ${f} has error: ${data.error}`);
      continue;
    }
    const slug = f.replace('.json', '');
    const meta = loadMeta(slug);
    results.push({
      slug,
      tier: meta.tier || 'unknown',
      type: meta.type || 'unknown',
      installsCurrent: meta.installsCurrent || 0,
      score: data.overall_score,
      verdict: data.verdict,
      d1: data.dimensions?.D1?.score || data.dimension_scores?.D1 || 0,
      d2: data.dimensions?.D2?.score || data.dimension_scores?.D2 || 0,
      d3: data.dimensions?.D3?.score || data.dimension_scores?.D3 || 0,
      d4: data.dimensions?.D4?.score || data.dimension_scores?.D4 || 0,
      d5: data.dimensions?.D5?.score || data.dimension_scores?.D5 || 0,
      d6: data.dimensions?.D6?.score || data.dimension_scores?.D6 || 0,
      d3Pass: data.dimensions?.D3?.pass !== false,
      weakest: data.weakest_dimension || '',
    });
  } catch (e) {
    console.warn(`  WARN: Failed to parse ${f}: ${e.message}`);
  }
}

console.log(`Loaded ${results.length} valid results out of ${files.length} files\n`);

if (results.length === 0) {
  console.error('No valid results to analyze. Run batch-eval.sh first.');
  process.exit(1);
}

// === Statistical helpers ===
function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function median(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
function stddev(arr) {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / arr.length);
}
function bar(score, width = 20) {
  const filled = Math.round((score / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// === V1: Score Distribution ===
const allScores = results.map(r => r.score);
const v1 = {
  mean: mean(allScores).toFixed(1),
  median: median(allScores).toFixed(1),
  stddev: stddev(allScores).toFixed(1),
  min: Math.min(...allScores),
  max: Math.max(...allScores),
};

// === V2: Tier Discrimination ===
const tiers = { T1: [], T2: [], T3: [] };
results.forEach(r => {
  if (tiers[r.tier]) tiers[r.tier].push(r.score);
});
const v2 = {};
for (const t of ['T1', 'T2', 'T3']) {
  v2[t] = tiers[t].length > 0
    ? { mean: mean(tiers[t]).toFixed(1), n: tiers[t].length }
    : { mean: 'N/A', n: 0 };
}
const v2Monotonic = parseFloat(v2.T1.mean) >= parseFloat(v2.T2.mean) &&
                    parseFloat(v2.T2.mean) >= parseFloat(v2.T3.mean);

// === V3: Security Gate ===
const d3Failures = results.filter(r => !r.d3Pass);
const v3 = {
  total: d3Failures.length,
  rate: ((d3Failures.length / results.length) * 100).toFixed(1),
  byTier: {},
};
for (const t of ['T1', 'T2', 'T3']) {
  const tierResults = results.filter(r => r.tier === t);
  const tierFails = tierResults.filter(r => !r.d3Pass);
  v3.byTier[t] = tierResults.length > 0
    ? ((tierFails.length / tierResults.length) * 100).toFixed(0)
    : 'N/A';
}

// === V4: Category Fairness ===
const devScores = results.filter(r => r.type === 'dev').map(r => r.score);
const nondevScores = results.filter(r => r.type === 'non-dev').map(r => r.score);
const v4 = {
  devMean: devScores.length > 0 ? mean(devScores).toFixed(1) : 'N/A',
  nondevMean: nondevScores.length > 0 ? mean(nondevScores).toFixed(1) : 'N/A',
  delta: devScores.length > 0 && nondevScores.length > 0
    ? (mean(devScores) - mean(nondevScores)).toFixed(1)
    : 'N/A',
};

// === V5: Verdict Distribution ===
const v5 = { PASS: 0, CAUTION: 0, FAIL: 0 };
results.forEach(r => { v5[r.verdict] = (v5[r.verdict] || 0) + 1; });
const v5ByTier = {};
for (const t of ['T1', 'T2', 'T3']) {
  v5ByTier[t] = { PASS: 0, CAUTION: 0, FAIL: 0 };
  results.filter(r => r.tier === t).forEach(r => {
    v5ByTier[t][r.verdict] = (v5ByTier[t][r.verdict] || 0) + 1;
  });
}

// === V6: Anomalies (Top 5 + Bottom 5) ===
const sorted = [...results].sort((a, b) => b.score - a.score);
const top5 = sorted.slice(0, 5);
const bottom5 = sorted.slice(-5).reverse();

// === V7: Dimension Variance ===
const dimNames = ['d1', 'd2', 'd3', 'd4', 'd5', 'd6'];
const v7 = {};
for (const d of dimNames) {
  const scores = results.map(r => r[d]).filter(s => s > 0);
  v7[d] = {
    mean: scores.length > 0 ? mean(scores).toFixed(1) : 'N/A',
    stddev: scores.length > 0 ? stddev(scores).toFixed(1) : 'N/A',
  };
}

// === Generate Report ===
let report = `# SkillCompass v2 Evaluation Analysis

> **Date**: ${new Date().toISOString().split('T')[0]}
> **Sample**: ${results.length} skills from ClawHub
> **Source**: \`clawhub explore --sort installs\`

---

## V1: Score Distribution

| Metric | Value |
|--------|-------|
| Mean | ${v1.mean} |
| Median | ${v1.median} |
| Std Dev | ${v1.stddev} |
| Min | ${v1.min} |
| Max | ${v1.max} |

\`\`\`
${allScores.sort((a,b)=>a-b).map(s => `${String(s).padStart(3)} ${bar(s)}`).join('\n')}
\`\`\`

---

## V2: Tier Discrimination

| Tier | N | Mean Score | Expected |
|------|---|-----------|----------|
| T1 (Top 50) | ${v2.T1.n} | ${v2.T1.mean} | Highest |
| T2 (51-192) | ${v2.T2.n} | ${v2.T2.mean} | Middle |
| T3 (200+) | ${v2.T3.n} | ${v2.T3.mean} | Lowest |

**Monotonic (T1 ≥ T2 ≥ T3)**: ${v2Monotonic ? '✓ PASS' : '✗ FAIL'}

---

## V3: Security Gate (D3)

| Metric | Value |
|--------|-------|
| D3 Failures (Critical) | ${v3.total} / ${results.length} (${v3.rate}%) |
| T1 failure rate | ${v3.byTier.T1}% |
| T2 failure rate | ${v3.byTier.T2}% |
| T3 failure rate | ${v3.byTier.T3}% |

${d3Failures.length > 0 ? '**Failed skills:**\n' + d3Failures.map(r => `- ${r.slug} (T${r.tier}, score ${r.score})`).join('\n') : 'No D3 gate failures.'}

---

## V4: Category Fairness (Dev vs Non-Dev)

| Type | N | Mean Score |
|------|---|-----------|
| Dev | ${devScores.length} | ${v4.devMean} |
| Non-Dev | ${nondevScores.length} | ${v4.nondevMean} |
| **Delta** | | **${v4.delta}** |

**Fair (|Δ| < 8)**: ${Math.abs(parseFloat(v4.delta)) < 8 ? '✓ PASS' : '✗ FAIL — possible systematic bias'}

---

## V5: Verdict Distribution

| Verdict | Total | T1 | T2 | T3 |
|---------|-------|----|----|-----|
| PASS | ${v5.PASS} | ${v5ByTier.T1.PASS} | ${v5ByTier.T2.PASS} | ${v5ByTier.T3.PASS} |
| CAUTION | ${v5.CAUTION} | ${v5ByTier.T1.CAUTION} | ${v5ByTier.T2.CAUTION} | ${v5ByTier.T3.CAUTION} |
| FAIL | ${v5.FAIL} | ${v5ByTier.T1.FAIL} | ${v5ByTier.T2.FAIL} | ${v5ByTier.T3.FAIL} |

---

## V6: Anomaly Detection (Manual Review Required)

### Top 5 Scores (verify these deserve high scores)

| Slug | Tier | Score | Verdict | Installs |
|------|------|-------|---------|----------|
${top5.map(r => `| ${r.slug} | ${r.tier} | ${r.score} | ${r.verdict} | ${r.installsCurrent} |`).join('\n')}

### Bottom 5 Scores (verify these deserve low scores)

| Slug | Tier | Score | Verdict | Installs |
|------|------|-------|---------|----------|
${bottom5.map(r => `| ${r.slug} | ${r.tier} | ${r.score} | ${r.verdict} | ${r.installsCurrent} |`).join('\n')}

---

## V7: Dimension Variance

| Dimension | Weight | Mean | Std Dev | Role |
|-----------|--------|------|---------|------|
| D1 Structure | 10% | ${v7.d1.mean} | ${v7.d1.stddev} | |
| D2 Trigger | 15% | ${v7.d2.mean} | ${v7.d2.stddev} | |
| D3 Security | 20% | ${v7.d3.mean} | ${v7.d3.stddev} | Gate |
| D4 Functional | 30% | ${v7.d4.mean} | ${v7.d4.stddev} | Heaviest |
| D5 Comparative | 15% | ${v7.d5.mean} | ${v7.d5.stddev} | |
| D6 Uniqueness | 10% | ${v7.d6.mean} | ${v7.d6.stddev} | |

**Highest variance dimension**: ${Object.entries(v7).sort((a,b) => parseFloat(b[1].stddev) - parseFloat(a[1].stddev))[0]?.[0]?.toUpperCase() || 'N/A'}

---

## Weakest Dimension Frequency

\`\`\`
${(() => {
  const freq = {};
  results.forEach(r => { freq[r.weakest] = (freq[r.weakest] || 0) + 1; });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([dim, count]) => `${dim.padEnd(15)} ${'█'.repeat(count)} (${count})`)
    .join('\n');
})()}
\`\`\`

---

## Raw Data

| # | Slug | Tier | Type | Score | Verdict | D1 | D2 | D3 | D4 | D5 | D6 | Weakest |
|---|------|------|------|-------|---------|----|----|----|----|----|----|---------|
${results.sort((a,b) => b.score - a.score).map((r, i) =>
  `| ${i+1} | ${r.slug} | ${r.tier} | ${r.type} | ${r.score} | ${r.verdict} | ${r.d1} | ${r.d2} | ${r.d3} | ${r.d4} | ${r.d5} | ${r.d6} | ${r.weakest} |`
).join('\n')}
`;

fs.writeFileSync(OUTPUT_FILE, report, 'utf8');
console.log(`\nReport saved to: ${OUTPUT_FILE}`);
console.log('\n=== Quick Summary ===');
console.log(`Scores: mean=${v1.mean}, median=${v1.median}, σ=${v1.stddev}`);
console.log(`Tiers: T1=${v2.T1.mean}, T2=${v2.T2.mean}, T3=${v2.T3.mean} (monotonic: ${v2Monotonic})`);
console.log(`D3 gate: ${v3.total} failures (${v3.rate}%)`);
console.log(`Dev vs Non-Dev: Δ=${v4.delta}`);
console.log(`Verdicts: PASS=${v5.PASS}, CAUTION=${v5.CAUTION}, FAIL=${v5.FAIL}`);
