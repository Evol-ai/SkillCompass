/**
 * quick-scan.js — Batch D1+D2+D3 scanner
 *
 * Runs StructureValidator (D1), TriggerValidator (D2), and SecurityValidator (D3)
 * against a set of skill files, with a file-based cache to skip unchanged entries.
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const { StructureValidator } = require('./structure-validator');
const { TriggerValidator } = require('./trigger-validator');
const { SecurityValidator } = require('./security-validator');

class QuickScanner {
  /**
   * @param {string} platform - Platform identifier, used to namespace the cache file.
   *   Defaults to 'cc' (Claude Code).
   */
  constructor(platform = 'cc') {
    this.platform = platform;
    this.cacheFile = path.join(
      '.skill-compass',
      platform,
      'quick-scan-cache.json'
    );
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Scan a single SKILL.md file.
   *
   * @param {string} filePath  - Path to the SKILL.md file.
   * @param {string} skillName - Human-readable skill identifier.
   * @returns {{ skill_name, d1, d2, d3, verdict, findings }}
   */
  scanOne(filePath, skillName) {
    // File existence check
    if (!fs.existsSync(filePath)) {
      return {
        skill_name: skillName,
        d1: null,
        d2: null,
        d3: null,
        verdict: 'error',
        findings: [{ severity: 'error', message: `File not found: ${filePath}` }]
      };
    }

    const findings = [];

    // D1 — Structure
    let d1 = 5;
    try {
      const sv = new StructureValidator();
      const result = sv.validate(filePath);
      d1 = typeof result.score === 'number' ? result.score : 5;
    } catch (err) {
      findings.push({ severity: 'error', source: 'D1', message: err.message });
    }

    // D2 — Trigger
    let d2 = 5;
    try {
      const tv = new TriggerValidator();
      const result = tv.validate(filePath);
      d2 = typeof result.score === 'number' ? result.score : 5;

      // Collect failed, non-info checks from D2
      if (Array.isArray(result.checks)) {
        result.checks.forEach(c => {
          if (!c.passed && c.severity !== 'info') {
            findings.push({
              severity: c.severity || 'warning',
              source: 'D2',
              check: c.check,
              message: c.description || c.check
            });
          }
        });
      }
    } catch (err) {
      findings.push({ severity: 'error', source: 'D2', message: err.message });
    }

    // D3 — Security
    let d3 = 5;
    try {
      const sec = new SecurityValidator();
      const result = sec.validate(filePath);
      d3 = typeof result.score === 'number' ? result.score : 5;

      // Collect critical / high findings from D3
      if (Array.isArray(result.findings)) {
        result.findings.forEach(f => {
          const sev = (f.severity || '').toLowerCase();
          if (sev === 'critical' || sev === 'high') {
            findings.push({
              severity: sev,
              source: 'D3',
              check: f.check,
              message: f.description || f.message || f.check
            });
          }
        });
      }
    } catch (err) {
      findings.push({ severity: 'error', source: 'D3', message: err.message });
    }

    // Verdict
    let verdict;
    if ([d1, d2, d3].some(s => s !== null && s <= 4)) {
      verdict = 'high_risk';
    } else if ([d1, d2, d3].some(s => s !== null && s <= 6)) {
      verdict = 'medium';
    } else {
      verdict = 'clean';
    }

    return { skill_name: skillName, d1, d2, d3, verdict, findings };
  }

  /**
   * Scan multiple skills, using a cache to skip unchanged files.
   *
   * @param {Array<{name: string, path: string, modified_at: string}>} skillEntries
   * @param {boolean} useCache - Whether to honour the on-disk cache.
   * @returns {{ results: Array, summary: { clean, medium, high_risk, error, total } }}
   */
  scanAll(skillEntries, useCache = true) {
    const cache = useCache ? this._readCache() : {};
    const results = [];

    for (const entry of skillEntries) {
      const { name, path: filePath, modified_at } = entry;

      // Cache hit: skip if mtime unchanged
      if (useCache && cache[name] && cache[name].modified_at === modified_at) {
        results.push(cache[name].result);
        continue;
      }

      const result = this.scanOne(filePath, name);
      results.push(result);

      // Update cache entry
      cache[name] = { modified_at, result };
    }

    if (useCache) {
      this._writeCache(cache);
    }

    // Build summary
    const summary = { clean: 0, medium: 0, high_risk: 0, error: 0, total: results.length };
    for (const r of results) {
      const key = r.verdict in summary ? r.verdict : 'error';
      summary[key]++;
    }

    return { results, summary };
  }

  // ---------------------------------------------------------------------------
  // Cache helpers
  // ---------------------------------------------------------------------------

  _readCache() {
    try {
      if (fs.existsSync(this.cacheFile)) {
        return JSON.parse(fs.readFileSync(this.cacheFile, 'utf-8'));
      }
    } catch (_) {
      // Corrupt or missing cache — start fresh
    }
    return {};
  }

  _writeCache(data) {
    const dir = path.dirname(this.cacheFile);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(this.cacheFile, JSON.stringify(data, null, 2), 'utf-8');
  }
}

module.exports = { QuickScanner };
