/**
 * inbox-engine.js — Rule Engine for Skill Inbox
 *
 * Evaluates v1.1.0 CC rules against skill signals and feeds suggestions
 * into InboxStore. Depends on lib/inbox-store.js.
 */

'use strict';

const fs   = require('node:fs');
const path = require('node:path');
const { InboxStore } = require('./inbox-store');

// ---------------------------------------------------------------------------
// Rule definitions — v1.1.0 CC
// ---------------------------------------------------------------------------
const RULES = [
  {
    id: 'R1-unused-7d',
    category: 'hygiene',
    priority: 'P3',
    reason: 'Skill installed >10 days ago with no activity in the last 7 days. Consider removing or archiving it.',
    check(signals) {
      const { first_seen_at, last_activity_at, pinned } = signals;
      if (pinned) return false;
      if (!first_seen_at) return false;
      const installedDaysAgo = daysSince(first_seen_at);
      const inactiveDaysAgo  = last_activity_at ? daysSince(last_activity_at) : Infinity;
      return installedDaysAgo > 10 && inactiveDaysAgo > 7;
    },
    evidence(signals) {
      return [
        `first_seen_at: ${signals.first_seen_at}`,
        `last_activity_at: ${signals.last_activity_at ?? 'never'}`,
        `days_since_activity: ${signals.last_activity_at ? Math.floor(daysSince(signals.last_activity_at)) : 'N/A'}`
      ];
    }
  },
  {
    id: 'R2-never-used',
    category: 'hygiene',
    priority: 'P3',
    reason: 'Skill installed >7 days ago but has never been evaluated or improved.',
    check(signals) {
      const { first_seen_at, last_eval_at, last_improve_at, version_count } = signals;
      if (!first_seen_at) return false;
      return (
        daysSince(first_seen_at) > 7 &&
        !last_eval_at &&
        !last_improve_at &&
        version_count === 0
      );
    },
    evidence(signals) {
      return [
        `first_seen_at: ${signals.first_seen_at}`,
        `version_count: ${signals.version_count}`,
        'no eval or improve activity recorded'
      ];
    }
  },
  {
    id: 'R6-undo-2x',
    category: 'friction',
    priority: 'P1',
    reason: 'Skill has been rolled back 2 or more times in the last 7 days, indicating instability.',
    check(signals) {
      return signals.rollback_count_7d >= 2;
    },
    evidence(signals) {
      return [
        `rollback_count_7d: ${signals.rollback_count_7d}`
      ];
    }
  },
  {
    id: 'R8-highfreq-no-review',
    category: 'leverage',
    priority: 'P3',
    reason: 'Skill has 5+ versions but has not been evaluated in the last 14 days.',
    check(signals) {
      const { version_count, last_eval_at } = signals;
      if (version_count < 5) return false;
      const evalAge = last_eval_at ? daysSince(last_eval_at) : Infinity;
      return evalAge > 14;
    },
    evidence(signals) {
      return [
        `version_count: ${signals.version_count}`,
        `last_eval_at: ${signals.last_eval_at ?? 'never'}`,
        `days_since_eval: ${signals.last_eval_at ? Math.floor(daysSince(signals.last_eval_at)) : 'N/A'}`
      ];
    }
  },
  {
    id: 'R9-duplicate-shadow',
    category: 'hygiene',
    priority: 'P3',
    reason: 'Skill is marked as a duplicate and has had no activity in the last 7 days.',
    check(signals) {
      const { duplicate_of, last_activity_at } = signals;
      if (!duplicate_of) return false;
      const inactiveDaysAgo = last_activity_at ? daysSince(last_activity_at) : Infinity;
      return inactiveDaysAgo > 7;
    },
    evidence(signals) {
      return [
        `duplicate_of: ${signals.duplicate_of}`,
        `last_activity_at: ${signals.last_activity_at ?? 'never'}`
      ];
    }
  }
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Return the number of days elapsed since an ISO timestamp.
 * @param {string} isoString
 * @returns {number}
 */
function daysSince(isoString) {
  return (Date.now() - new Date(isoString).getTime()) / 86_400_000;
}

/**
 * Attempt to read and parse a JSON file.
 * Returns null on missing file or parse error.
 * @param {string} filePath
 * @returns {Object|null}
 */
function tryReadJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

/**
 * Read all lines from a JSONL file, returning parsed objects.
 * Lines that fail to parse are silently skipped.
 * @param {string} filePath
 * @returns {Object[]}
 */
function readJsonl(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const lines = fs.readFileSync(filePath, 'utf-8').split('\n');
    const results = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try { results.push(JSON.parse(trimmed)); } catch { /* skip */ }
    }
    return results;
  } catch {
    return [];
  }
}

/**
 * Extract the latest timestamp for a given trigger type from a versions array.
 * Returns null if not found.
 * @param {Object[]} versions
 * @param {string} triggerKeyword - substring to match against version.trigger
 * @returns {string|null}
 */
function latestTimestampByTrigger(versions, triggerKeyword) {
  if (!Array.isArray(versions)) return null;
  const matches = versions
    .filter(v => typeof v.trigger === 'string' && v.trigger.includes(triggerKeyword))
    .map(v => v.timestamp)
    .filter(Boolean);
  if (matches.length === 0) return null;
  return matches.reduce((latest, ts) => (ts > latest ? ts : latest));
}

// ---------------------------------------------------------------------------
// InboxEngine
// ---------------------------------------------------------------------------

class InboxEngine {
  /**
   * @param {string} platform
   */
  constructor(platform = 'cc') {
    this.platform = platform;
    this.store    = new InboxStore(platform);
  }

  // ---------------------------------------------------------------------------
  // Signal collection
  // ---------------------------------------------------------------------------

  /**
   * Collect signals for a single skill.
   *
   * @param {string} skillName
   * @param {{ name: string, path: string, modified_at?: string, first_seen_at?: string, duplicate_of?: string }} setupEntry
   * @returns {Object} signals bag
   */
  collectSignals(skillName, setupEntry) {
    const cache = this.store.getSkillCache(skillName) || {};

    // first_seen_at: prefer setupEntry, fall back to cache
    const first_seen_at = setupEntry.first_seen_at || cache.first_seen_at || null;
    const file_path     = setupEntry.path || null;

    // Locate manifest.json — new path first, then legacy path
    const manifestPathNew    = path.join('.skill-compass', this.platform, skillName, 'manifest.json');
    const manifestPathLegacy = path.join('.skill-compass', skillName, 'manifest.json');
    const manifest           = tryReadJson(manifestPathNew) || tryReadJson(manifestPathLegacy) || null;

    const versions       = manifest?.versions ?? [];
    const version_count  = versions.length;

    const last_eval_at    = latestTimestampByTrigger(versions, 'eval')    ?? null;
    const last_improve_at = latestTimestampByTrigger(versions, 'improve') ?? null;

    // last_activity_at = max of eval, improve, modified_at
    const candidates = [last_eval_at, last_improve_at, setupEntry.modified_at].filter(Boolean);
    const last_activity_at = candidates.length > 0
      ? candidates.reduce((latest, ts) => (ts > latest ? ts : latest))
      : null;

    // Rollbacks in last 7 days from audit.jsonl
    const auditPathNew    = path.join('.skill-compass', this.platform, skillName, 'audit.jsonl');
    const auditPathLegacy = path.join('.skill-compass', skillName, 'audit.jsonl');
    const auditPath       = fs.existsSync(auditPathNew) ? auditPathNew : auditPathLegacy;
    const auditEntries    = readJsonl(auditPath);
    const sevenDaysAgo    = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const rollback_count_7d = auditEntries.filter(
      e => e.type === 'rollback' && typeof e.timestamp === 'string' && e.timestamp >= sevenDaysAgo
    ).length;

    // pinned / disabled from cache
    const pinned   = cache.pinned   ?? false;
    const disabled = cache.disabled ?? false;

    // duplicate_of from setupEntry
    const duplicate_of = setupEntry.duplicate_of ?? null;

    // file_size
    let file_size = null;
    if (file_path) {
      try {
        if (fs.existsSync(file_path)) {
          file_size = fs.statSync(file_path).size;
        }
      } catch { /* ignore */ }
    }

    return {
      skill_name:        skillName,
      first_seen_at,
      file_path,
      last_eval_at,
      last_improve_at,
      version_count,
      last_activity_at,
      rollback_count_7d,
      pinned,
      disabled,
      duplicate_of,
      file_size
    };
  }

  // ---------------------------------------------------------------------------
  // Rule evaluation
  // ---------------------------------------------------------------------------

  /**
   * Evaluate all v1.1.0 CC rules against the given signals.
   *
   * @param {Object} signals - Output of collectSignals()
   * @returns {Array<{ rule_id, skill_name, category, priority, reason, evidence }>}
   */
  evaluateRules(signals) {
    const results = [];

    for (const rule of RULES) {
      // Skip if the skill is disabled (no rules fire on disabled skills)
      if (signals.disabled) continue;

      // Skip if in cooldown
      if (this.store.isInCooldown(rule.id, signals.skill_name)) continue;

      // Evaluate the rule predicate
      if (!rule.check(signals)) continue;

      results.push({
        rule_id:    rule.id,
        skill_name: signals.skill_name,
        category:   rule.category,
        priority:   rule.priority,
        reason:     rule.reason,
        evidence:   rule.evidence(signals)
      });
    }

    return results;
  }

  // ---------------------------------------------------------------------------
  // Digest
  // ---------------------------------------------------------------------------

  /**
   * Run a full digest over the supplied skill entries.
   *
   * @param {Array<{ name: string, path: string, modified_at?: string, first_seen_at?: string, duplicate_of?: string }>} skillEntries
   * @returns {{ added: number, total_pending: number }}
   */
  runDigest(skillEntries) {
    this.store.reactivateSnoozed();

    let added = 0;

    for (const entry of skillEntries) {
      const skillName = entry.name;
      const signals   = this.collectSignals(skillName, entry);
      const matches   = this.evaluateRules(signals);

      for (const suggestion of matches) {
        const result = this.store.addSuggestion(suggestion);
        if (result !== null) added++;
      }

      // Update skill cache with latest signal snapshot
      this.store.updateSkillCache(skillName, {
        first_seen_at:     signals.first_seen_at,
        last_eval_at:      signals.last_eval_at,
        last_improve_at:   signals.last_improve_at,
        last_activity_at:  signals.last_activity_at,
        version_count:     signals.version_count,
        rollback_count_7d: signals.rollback_count_7d,
        file_path:         signals.file_path,
        file_size:         signals.file_size,
        duplicate_of:      signals.duplicate_of
      });
    }

    this.store.setLastDigestAt(new Date().toISOString());

    const summary = this.store.getSummary();
    return { added, total_pending: summary.pending };
  }

  // ---------------------------------------------------------------------------
  // Digest schedule check
  // ---------------------------------------------------------------------------

  /**
   * Return true if a digest is due (never run or older than `days` days).
   *
   * @param {number} days
   * @returns {boolean}
   */
  isDigestDue(days = 7) {
    const last = this.store.getLastDigestAt();
    if (!last) return true;
    return daysSince(last) >= days;
  }
}

module.exports = { InboxEngine };
