/**
 * usage-reader.js — Read usage.jsonl and compute derived signals
 *
 * Reads .skill-compass/{platform}/usage.jsonl and surfaces per-skill
 * usage metrics for consumption by the rule engine.
 */

const fs = require('node:fs');
const path = require('node:path');

class UsageReader {
  /**
   * @param {string} platform - Platform identifier, defaults to 'cc'
   * @param {string} [baseDir] - Root directory for .skill-compass state.
   *   Defaults to CLAUDE_PLUGIN_ROOT (CC) or cwd as last resort.
   */
  constructor(platform = 'cc', baseDir) {
    this.platform = platform;
    this.baseDir = baseDir || process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
    this.usageFile = path.join(this.baseDir, '.skill-compass', platform, 'usage.jsonl');
  }

  // ---------------------------------------------------------------------------
  // Core I/O
  // ---------------------------------------------------------------------------

  /**
   * Read all usage events, optionally filtered by time.
   * @param {string|null} since - ISO string; only return events at or after this time.
   * @returns {Array} Parsed event objects.
   */
  readEvents(since = null) {
    if (!fs.existsSync(this.usageFile)) return [];
    const lines = fs.readFileSync(this.usageFile, 'utf-8').trim().split('\n').filter(Boolean);
    const events = [];
    for (const line of lines) {
      try {
        const e = JSON.parse(line);
        if (since && e.timestamp < since) continue;
        events.push(e);
      } catch { /* skip corrupt lines */ }
    }
    return events;
  }

  // ---------------------------------------------------------------------------
  // Per-skill signals
  // ---------------------------------------------------------------------------

  /**
   * Get usage signals for a specific skill.
   * @param {string} skillName - Parent skill name.
   * @returns {{
   *   ever_used: boolean,
   *   last_used_at: string|null,
   *   first_used_at: string|null,
   *   total_use_count: number,
   *   use_count_7d: number,
   *   use_count_14d: number,
   *   sessions_used_7d: number,
   *   children_usage: Object
   * }}
   */
  getSignals(skillName) {
    const allEvents = this.readEvents();
    const now = Date.now();
    const sevenDaysAgo   = new Date(now - 7  * 86400000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString();

    const skillEvents = allEvents.filter(e => e.type === 'skill_used' && e.skill === skillName);

    if (skillEvents.length === 0) {
      return {
        ever_used: false,
        last_used_at: null,
        first_used_at: null,
        total_use_count: 0,
        use_count_7d: 0,
        use_count_14d: 0,
        sessions_used_7d: 0,
        children_usage: {}
      };
    }

    // Sort chronologically
    skillEvents.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    const last_used_at  = skillEvents[skillEvents.length - 1].timestamp;
    const first_used_at = skillEvents[0].timestamp;

    const use_count_7d  = skillEvents.filter(e => e.timestamp >= sevenDaysAgo).length;
    const use_count_14d = skillEvents.filter(e => e.timestamp >= fourteenDaysAgo).length;

    // Distinct sessions in last 7 days
    const sessionsIn7d = new Set(
      skillEvents
        .filter(e => e.timestamp >= sevenDaysAgo && e.session_id)
        .map(e => e.session_id)
    );

    // Children usage breakdown (for collection/composite skills)
    const childrenUsage = {};
    for (const e of skillEvents) {
      if (e.child) {
        childrenUsage[e.child] = (childrenUsage[e.child] || 0) + 1;
      }
    }

    return {
      ever_used: true,
      last_used_at,
      first_used_at,
      total_use_count: skillEvents.length,
      use_count_7d,
      use_count_14d,
      sessions_used_7d: sessionsIn7d.size,
      children_usage: childrenUsage
    };
  }

  // ---------------------------------------------------------------------------
  // Bulk signals (prefer over repeated getSignals calls)
  // ---------------------------------------------------------------------------

  /**
   * Get usage signals for ALL skills at once (more efficient than calling
   * getSignals per skill when processing many skills in a single pass).
   * @returns {Object} Map of skillName → signals object (same shape as getSignals).
   */
  getAllSignals() {
    const allEvents = this.readEvents();
    const now = Date.now();
    const sevenDaysAgo    = new Date(now - 7  * 86400000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 86400000).toISOString();

    // Group events by skill name in a single pass
    const bySkill = {};
    for (const e of allEvents) {
      if (e.type !== 'skill_used') continue;
      if (!bySkill[e.skill]) bySkill[e.skill] = [];
      bySkill[e.skill].push(e);
    }

    const result = {};
    for (const [skillName, events] of Object.entries(bySkill)) {
      events.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

      const childrenUsage = {};
      for (const e of events) {
        if (e.child) childrenUsage[e.child] = (childrenUsage[e.child] || 0) + 1;
      }

      const sessionsIn7d = new Set(
        events
          .filter(e => e.timestamp >= sevenDaysAgo && e.session_id)
          .map(e => e.session_id)
      );

      result[skillName] = {
        ever_used: true,
        last_used_at: events[events.length - 1].timestamp,
        first_used_at: events[0].timestamp,
        total_use_count: events.length,
        use_count_7d:  events.filter(e => e.timestamp >= sevenDaysAgo).length,
        use_count_14d: events.filter(e => e.timestamp >= fourteenDaysAgo).length,
        sessions_used_7d: sessionsIn7d.size,
        children_usage: childrenUsage
      };
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // Maintenance
  // ---------------------------------------------------------------------------

  /**
   * Remove events older than N days from the usage file (in-place rewrite).
   * @param {number} days - Retention window, default 90.
   * @returns {number} Number of lines removed.
   */
  cleanup(days = 90) {
    if (!fs.existsSync(this.usageFile)) return 0;
    const cutoff = new Date(Date.now() - days * 86400000).toISOString();
    const lines = fs.readFileSync(this.usageFile, 'utf-8').trim().split('\n').filter(Boolean);
    const kept = lines.filter(line => {
      try {
        const e = JSON.parse(line);
        return e.timestamp >= cutoff;
      } catch { return false; }
    });
    const removed = lines.length - kept.length;
    if (removed > 0) {
      fs.writeFileSync(this.usageFile, kept.join('\n') + '\n', 'utf-8');
    }
    return removed;
  }
}

module.exports = { UsageReader };
