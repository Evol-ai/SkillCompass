/**
 * inbox-store.js — Skill Inbox Data Layer
 *
 * Manages .skill-compass/{platform}/inbox.json for the Skill Inbox system.
 * Handles suggestion lifecycle, skill cache, and metadata.
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const PRIORITY_ORDER = { P1: 1, P2: 2, P3: 3, P4: 4 };

const EMPTY_STORE = () => ({
  suggestions: [],
  skill_cache: [],
  meta: { last_digest_at: null }
});

class InboxStore {
  /**
   * @param {string} platform - Platform identifier, defaults to 'cc'
   */
  constructor(platform = 'cc') {
    this.platform = platform;
    this.platformDir = path.join('.skill-compass', platform);
    this.inboxFile = path.join(this.platformDir, 'inbox.json');
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** mkdir -p the platform directory */
  _ensureDir() {
    if (!fs.existsSync(this.platformDir)) {
      fs.mkdirSync(this.platformDir, { recursive: true });
    }
  }

  /**
   * Read inbox.json, returning a default structure if the file doesn't exist.
   * @returns {{ suggestions: Array, skill_cache: Array, meta: Object }}
   */
  _read() {
    if (!fs.existsSync(this.inboxFile)) {
      return EMPTY_STORE();
    }
    try {
      const raw = fs.readFileSync(this.inboxFile, 'utf-8');
      const data = JSON.parse(raw);
      // Ensure all top-level keys exist (forward-compat guard)
      data.suggestions  = data.suggestions  || [];
      data.skill_cache  = data.skill_cache  || [];
      data.meta         = data.meta         || { last_digest_at: null };
      return data;
    } catch (err) {
      throw new Error(`inbox-store: failed to read ${this.inboxFile}: ${err.message}`);
    }
  }

  /**
   * Write data to inbox.json (pretty-printed).
   * @param {Object} data
   */
  _write(data) {
    this._ensureDir();
    fs.writeFileSync(this.inboxFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Generate a unique suggestion ID like sug_2026_04_02_a1b2c3.
   * @returns {string}
   */
  _genId() {
    const now = new Date();
    const datePart = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0')
    ].join('_');
    const randPart = crypto.randomBytes(3).toString('hex'); // 6 hex chars
    return `sug_${datePart}_${randPart}`;
  }

  // ---------------------------------------------------------------------------
  // Suggestion lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Add a new suggestion, deduplicating on rule_id + skill_name.
   * @param {{ rule_id: string, skill_name: string, category: string, priority: string, reason: string, evidence?: any }} params
   * @returns {Object|null} The created suggestion, or null if deduped.
   */
  addSuggestion({ rule_id, skill_name, category, priority, reason, evidence = null }) {
    const data = this._read();

    // Dedup: skip if same rule_id+skill_name already pending or viewed
    const isDupe = data.suggestions.some(
      s =>
        s.rule_id === rule_id &&
        s.skill_name === skill_name &&
        (s.status === 'pending' || s.status === 'viewed')
    );
    if (isDupe) return null;

    const suggestion = {
      id: this._genId(),
      rule_id,
      skill_name,
      category,
      priority,
      reason,
      evidence,
      status: 'pending',
      created_at: new Date().toISOString(),
      cooldown_until: null
    };

    data.suggestions.push(suggestion);
    this._write(data);
    return suggestion;
  }

  /**
   * Return pending + viewed suggestions sorted by priority (P1 first).
   * @returns {Array}
   */
  getPending() {
    const data = this._read();
    return data.suggestions
      .filter(s => s.status === 'pending' || s.status === 'viewed')
      .sort((a, b) => {
        const pa = PRIORITY_ORDER[a.priority] ?? 99;
        const pb = PRIORITY_ORDER[b.priority] ?? 99;
        return pa - pb;
      });
  }

  /**
   * Update a suggestion's status by id.
   * @param {string} id
   * @param {string} newStatus
   * @returns {Object|null} Updated suggestion or null if not found.
   */
  updateStatus(id, newStatus) {
    const data = this._read();
    const sug = data.suggestions.find(s => s.id === id);
    if (!sug) return null;
    sug.status = newStatus;
    this._write(data);
    return sug;
  }

  /**
   * Dismiss a suggestion and optionally set a cooldown.
   * @param {string} id
   * @param {number|null} cooldownDays - Number of days for cooldown, or null for no cooldown.
   * @returns {Object|null}
   */
  dismiss(id, cooldownDays = null) {
    const data = this._read();
    const sug = data.suggestions.find(s => s.id === id);
    if (!sug) return null;
    sug.status = 'dismissed';
    if (cooldownDays != null) {
      const until = new Date();
      until.setDate(until.getDate() + cooldownDays);
      sug.cooldown_until = until.toISOString();
    } else {
      sug.cooldown_until = null;
    }
    this._write(data);
    return sug;
  }

  /**
   * Snooze a suggestion for a given number of days (default 14).
   * @param {string} id
   * @param {number} days
   * @returns {Object|null}
   */
  snooze(id, days = 14) {
    const data = this._read();
    const sug = data.suggestions.find(s => s.id === id);
    if (!sug) return null;
    const until = new Date();
    until.setDate(until.getDate() + days);
    sug.status = 'snoozed';
    sug.snoozed_until = until.toISOString();
    this._write(data);
    return sug;
  }

  /**
   * Accept a suggestion.
   * @param {string} id
   * @returns {Object|null}
   */
  accept(id) {
    return this.updateStatus(id, 'accepted');
  }

  /**
   * Resolve a suggestion.
   * @param {string} id
   * @returns {Object|null}
   */
  resolve(id) {
    return this.updateStatus(id, 'resolved');
  }

  /**
   * Reactivate snoozed suggestions whose snoozed_until is in the past.
   * @returns {Array} Suggestions that were reactivated.
   */
  reactivateSnoozed() {
    const data = this._read();
    const now = new Date();
    const reactivated = [];

    for (const sug of data.suggestions) {
      if (sug.status === 'snoozed' && sug.snoozed_until) {
        if (new Date(sug.snoozed_until) <= now) {
          sug.status = 'pending';
          delete sug.snoozed_until;
          reactivated.push(sug);
        }
      }
    }

    if (reactivated.length > 0) {
      this._write(data);
    }
    return reactivated;
  }

  // ---------------------------------------------------------------------------
  // Skill cache
  // ---------------------------------------------------------------------------

  /**
   * Find a skill entry in the cache by name.
   * @param {string} skillName
   * @returns {Object|undefined}
   */
  getSkillCache(skillName) {
    const data = this._read();
    return data.skill_cache.find(s => s.skill_name === skillName);
  }

  /**
   * Return all skill cache entries.
   * @returns {Array}
   */
  getAllSkillCache() {
    const data = this._read();
    return data.skill_cache;
  }

  /**
   * Upsert a skill entry in the cache with the given fields.
   * @param {string} skillName
   * @param {Object} fields
   * @returns {Object} The updated/created cache entry.
   */
  updateSkillCache(skillName, fields) {
    const data = this._read();
    let entry = data.skill_cache.find(s => s.skill_name === skillName);
    if (!entry) {
      entry = { skill_name: skillName };
      data.skill_cache.push(entry);
    }
    Object.assign(entry, fields);
    this._write(data);
    return entry;
  }

  /**
   * Pin a skill (set pinned=true in cache) and auto-resolve pending suggestions.
   * @param {string} skillName
   * @returns {Object}
   */
  pinSkill(skillName) {
    this._resolveBySkill(skillName);
    return this.updateSkillCache(skillName, { pinned: true });
  }

  /**
   * Disable a skill (set disabled=true in cache) and auto-resolve pending suggestions.
   * @param {string} skillName
   * @returns {Object}
   */
  disableSkill(skillName) {
    this._resolveBySkill(skillName);
    return this.updateSkillCache(skillName, { disabled: true });
  }

  /**
   * Auto-resolve all pending/viewed suggestions for a given skill.
   * Called when user pins or disables a skill — existing suggestions are no longer relevant.
   * @param {string} skillName
   * @private
   */
  _resolveBySkill(skillName) {
    const data = this._read();
    let changed = false;
    for (const sug of data.suggestions) {
      if (sug.skill_name === skillName && (sug.status === 'pending' || sug.status === 'viewed')) {
        sug.status = 'resolved';
        changed = true;
      }
    }
    if (changed) this._write(data);
  }

  /**
   * Check whether any dismissed suggestion for rule_id+skill_name has a
   * cooldown_until that is still in the future.
   * @param {string} ruleId
   * @param {string} skillName
   * @returns {boolean}
   */
  isInCooldown(ruleId, skillName) {
    const data = this._read();
    const now = new Date();
    return data.suggestions.some(
      s =>
        s.rule_id === ruleId &&
        s.skill_name === skillName &&
        s.status === 'dismissed' &&
        s.cooldown_until != null &&
        new Date(s.cooldown_until) > now
    );
  }

  // ---------------------------------------------------------------------------
  // Meta
  // ---------------------------------------------------------------------------

  /**
   * Return meta.last_digest_at.
   * @returns {string|null}
   */
  getLastDigestAt() {
    const data = this._read();
    return data.meta.last_digest_at;
  }

  /**
   * Set meta.last_digest_at.
   * @param {string} isoString
   */
  setLastDigestAt(isoString) {
    const data = this._read();
    data.meta.last_digest_at = isoString;
    this._write(data);
  }

  /**
   * Return counts for a status line display.
   * @returns {{ pending: number, urgent: number, accepted: number, totalSkills: number }}
   */
  getSummary() {
    const data = this._read();
    const pending  = data.suggestions.filter(s => s.status === 'pending' || s.status === 'viewed').length;
    const urgent   = data.suggestions.filter(s => (s.status === 'pending' || s.status === 'viewed') && s.priority === 'P1').length;
    const accepted = data.suggestions.filter(s => s.status === 'accepted').length;
    const totalSkills = data.skill_cache.length;
    return { pending, urgent, accepted, totalSkills };
  }
}

module.exports = { InboxStore };
