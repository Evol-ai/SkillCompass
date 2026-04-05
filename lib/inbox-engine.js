// lib/inbox-engine.js — Rule engine for Skill Inbox (v2 — usage-based)
// Uses real skill usage data from PostToolUse Skill hook

const fs = require('node:fs');
const path = require('node:path');
const { InboxStore } = require('./inbox-store');
const { UsageReader } = require('./usage-reader');

class InboxEngine {
  constructor(platform = 'cc') {
    this.platform = platform;
    this.store = new InboxStore(platform);
    this.usageReader = new UsageReader(platform);
  }

  // --- Signal collection ---

  collectSignals(skillName, setupEntry) {
    // Get usage signals from usage.jsonl
    const usage = this.usageReader.getSignals(skillName);

    // Get eval signals from manifest
    let last_eval_at = null;
    const manifestPaths = [
      path.join('.skill-compass', this.platform, skillName, 'manifest.json'),
      path.join('.skill-compass', skillName, 'manifest.json')
    ];
    for (const mp of manifestPaths) {
      if (fs.existsSync(mp)) {
        try {
          const manifest = JSON.parse(fs.readFileSync(mp, 'utf-8'));
          const versions = manifest.versions || [];
          for (let i = versions.length - 1; i >= 0; i--) {
            if (versions[i].trigger === 'eval' || versions[i].trigger === 'initial') {
              last_eval_at = versions[i].timestamp || versions[i].date;
              break;
            }
          }
          break;
        } catch { /* skip */ }
      }
    }

    // Get rollback count from audit
    let rollback_count_7d = 0;
    const auditPaths = [
      path.join('.skill-compass', this.platform, skillName, 'audit.jsonl'),
      path.join('.skill-compass', skillName, 'audit.jsonl')
    ];
    for (const ap of auditPaths) {
      if (fs.existsSync(ap)) {
        try {
          const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
          const lines = fs.readFileSync(ap, 'utf-8').trim().split('\n').filter(Boolean);
          rollback_count_7d = lines
            .map(l => { try { return JSON.parse(l); } catch { return null; } })
            .filter(e => e && e.type === 'rollback' && e.timestamp >= sevenDaysAgo)
            .length;
          break;
        } catch { /* skip */ }
      }
    }

    // Get inbox cache
    const cache = this.store.getSkillCache(skillName);

    return {
      skill_name: skillName,
      type: setupEntry.type || 'standalone',
      // Usage signals (from usage.jsonl)
      ever_used: usage.ever_used,
      last_used_at: usage.last_used_at,
      first_used_at: usage.first_used_at,
      total_use_count: usage.total_use_count,
      use_count_7d: usage.use_count_7d,
      use_count_14d: usage.use_count_14d,
      children_usage: usage.children_usage,
      // Setup signals
      first_seen_at: cache?.first_seen_at || setupEntry.first_seen_at || setupEntry.modified_at || null,
      total_size: setupEntry.total_size || setupEntry.file_size || 0,
      duplicate_of: setupEntry.duplicate_of || null,
      // Git signals (for R12)
      is_git: setupEntry.is_git || false,
      last_fetch_days: setupEntry.last_fetch_days || null,
      remote_url: setupEntry.remote_url || null,
      // Eval signals
      last_eval_at,
      rollback_count_7d,
      // Inbox state
      pinned: !!cache?.pinned,
      disabled: !!cache?.disabled
    };
  }

  // --- Rule definitions ---

  // Each rule: { id, category, priority, check(signals), reason(signals), evidence(signals) }

  static RULES = [
    {
      id: 'R1-never-used',
      category: 'hygiene',
      priority: 'P3',
      check(s) {
        if (s.pinned || s.disabled) return false;
        if (!s.first_seen_at) return false;
        const installedDays = (Date.now() - new Date(s.first_seen_at).getTime()) / 86400000;
        return installedDays > 7 && !s.ever_used;
      },
      reason(s) {
        const days = Math.floor((Date.now() - new Date(s.first_seen_at).getTime()) / 86400000);
        return `Installed ${days} days ago, never invoked`;
      },
      evidence(s) {
        return [{ field: 'first_seen_at', value: s.first_seen_at }, { field: 'ever_used', value: false }];
      }
    },
    {
      id: 'R2-idle',
      category: 'hygiene',
      priority: 'P3',
      check(s) {
        if (s.pinned || s.disabled) return false;
        if (!s.ever_used) return false;
        if (!s.last_used_at) return false;
        const lastUsedDays = (Date.now() - new Date(s.last_used_at).getTime()) / 86400000;
        return s.use_count_14d === 0 && lastUsedDays > 14;
      },
      reason(s) {
        const days = Math.floor((Date.now() - new Date(s.last_used_at).getTime()) / 86400000);
        return `Last used ${days} days ago, no invocations in 14 days`;
      },
      evidence(s) {
        return [{ field: 'last_used_at', value: s.last_used_at }, { field: 'use_count_14d', value: 0 }];
      }
    },
    // R3 is user-initiated, not engine-evaluated
    // R4-low-roi removed: premise (file size = context cost) was false.
    // Only frontmatter is loaded; file size is irrelevant.
    {
      id: 'R5-declining',
      category: 'friction',
      priority: 'P2',
      check(s) {
        if (s.pinned || s.disabled) return false;
        return s.use_count_7d === 0 && s.use_count_14d >= 3;
      },
      reason(s) {
        return `Used ${s.use_count_14d} times in prior 2 weeks, 0 times in last 7 days`;
      },
      evidence(s) {
        return [{ field: 'use_count_7d', value: 0 }, { field: 'use_count_14d', value: s.use_count_14d }];
      }
    },
    {
      id: 'R6-undo-2x',
      category: 'friction',
      priority: 'P1',
      check(s) {
        return s.rollback_count_7d >= 2;
      },
      reason(s) {
        return `Rolled back ${s.rollback_count_7d} times in 7 days, output quality may be unstable`;
      },
      evidence(s) {
        return [{ field: 'rollback_count_7d', value: s.rollback_count_7d }];
      }
    },
    {
      id: 'R7-heavy-no-eval',
      category: 'leverage',
      priority: 'P3',
      check(s) {
        if (s.disabled) return false;
        return s.use_count_14d >= 10 && !s.last_eval_at;
      },
      reason(s) {
        return `Used ${s.use_count_14d} times in 14 days but never evaluated`;
      },
      evidence(s) {
        return [{ field: 'use_count_14d', value: s.use_count_14d }, { field: 'last_eval_at', value: null }];
      }
    },
    {
      id: 'R8-stale-eval',
      category: 'leverage',
      priority: 'P3',
      check(s) {
        if (s.disabled) return false;
        if (!s.last_eval_at) return false;
        const evalDays = (Date.now() - new Date(s.last_eval_at).getTime()) / 86400000;
        return s.use_count_14d >= 5 && evalDays > 30;
      },
      reason(s) {
        const evalDays = Math.floor((Date.now() - new Date(s.last_eval_at).getTime()) / 86400000);
        return `Used ${s.use_count_14d} times in 14 days, last evaluated ${evalDays} days ago`;
      },
      evidence(s) {
        return [{ field: 'use_count_14d', value: s.use_count_14d }, { field: 'last_eval_at', value: s.last_eval_at }];
      }
    },
    {
      id: 'R9-duplicate-loser',
      category: 'hygiene',
      priority: 'P3',
      check(s, allSignals) {
        if (s.pinned || s.disabled) return false;
        if (!s.duplicate_of) return false;
        const other = allSignals?.[s.duplicate_of];
        if (!other) return false;
        return s.use_count_14d < other.use_count_14d;
      },
      reason(s, allSignals) {
        const other = allSignals?.[s.duplicate_of];
        return `Overlaps with ${s.duplicate_of} (${other?.use_count_14d || '?'} uses) while this skill has only ${s.use_count_14d}`;
      },
      evidence(s) {
        return [{ field: 'duplicate_of', value: s.duplicate_of }, { field: 'use_count_14d', value: s.use_count_14d }];
      }
    },
    {
      id: 'R10-one-and-done',
      category: 'hygiene',
      priority: 'P3',
      check(s) {
        if (s.pinned || s.disabled) return false;
        if (!s.ever_used || !s.first_used_at) return false;
        const sinceDays = (Date.now() - new Date(s.first_used_at).getTime()) / 86400000;
        return s.total_use_count === 1 && sinceDays > 14;
      },
      reason(s) {
        const date = s.first_used_at ? s.first_used_at.slice(0, 10) : '?';
        return `Used only once (${date}), never invoked again`;
      },
      evidence(s) {
        return [{ field: 'total_use_count', value: 1 }, { field: 'first_used_at', value: s.first_used_at }];
      }
    },
    // R11-context-waste removed: merged into R1 (never used is never used,
    // regardless of file size). Context cost premise was false.
    {
      id: 'R12-check-update',
      category: 'hygiene',
      priority: 'P3',
      check(s) {
        if (s.pinned || s.disabled) return false;
        if (!s.is_git) return false;
        return s.last_fetch_days > 7;
      },
      reason(s) {
        const days = Math.floor(s.last_fetch_days);
        return `${days} days since last update check, new version may be available`;
      },
      evidence(s) {
        return [{ field: 'last_fetch_days', value: Math.floor(s.last_fetch_days) }, { field: 'remote_url', value: s.remote_url }];
      }
    }
  ];

  // --- Evaluation ---

  evaluateRules(signals, allSignals = {}) {
    const results = [];
    if (signals.disabled) return results;

    for (const rule of InboxEngine.RULES) {
      if (this.store.isInCooldown(rule.id, signals.skill_name)) continue;
      const passes = rule.check(signals, allSignals);
      if (passes) {
        results.push({
          rule_id: rule.id,
          skill_name: signals.skill_name,
          category: rule.category,
          priority: rule.priority,
          reason: rule.reason(signals, allSignals),
          evidence: rule.evidence(signals, allSignals)
        });
      }
    }
    return results;
  }

  // --- Batch digest ---

  runDigest(skillEntries) {
    let added = 0;
    this.store.reactivateSnoozed();

    // Get all usage signals at once (efficient)
    const allUsage = this.usageReader.getAllSignals();

    // Get git status for R12 (no network calls — reads local .git state only)
    let gitInfo = {};
    try {
      const { UpdateChecker } = require('./update-checker');
      const checker = new UpdateChecker();
      const gitSkills = checker.checkAll(skillEntries);
      for (const g of gitSkills) {
        gitInfo[g.name] = g;
      }
    } catch { /* update-checker not available, skip R12 */ }

    // Collect all signals first (needed for R9 cross-skill comparison)
    const allSignals = {};
    for (const entry of skillEntries) {
      const name = entry.name;
      // Merge git info into entry for collectSignals
      if (gitInfo[name]) {
        entry.is_git = true;
        entry.last_fetch_days = gitInfo[name].last_fetch_days;
        entry.remote_url = gitInfo[name].remote_url;
      }
      const signals = this.collectSignals(name, entry);
      // Merge pre-computed usage if available
      if (allUsage[name]) {
        Object.assign(signals, {
          ever_used: allUsage[name].ever_used,
          last_used_at: allUsage[name].last_used_at,
          first_used_at: allUsage[name].first_used_at,
          total_use_count: allUsage[name].total_use_count,
          use_count_7d: allUsage[name].use_count_7d,
          use_count_14d: allUsage[name].use_count_14d,
          children_usage: allUsage[name].children_usage
        });
      }
      allSignals[name] = signals;
    }

    // Evaluate rules
    for (const [name, signals] of Object.entries(allSignals)) {
      const suggestions = this.evaluateRules(signals, allSignals);
      for (const sug of suggestions) {
        if (this.store.addSuggestion(sug)) added++;
      }
      // Update skill cache
      this.store.updateSkillCache(name, {
        first_seen_at: signals.first_seen_at,
        last_used_at: signals.last_used_at,
        last_eval_at: signals.last_eval_at,
        use_count_14d: signals.use_count_14d,
        total_use_count: signals.total_use_count,
        total_size: signals.total_size,
        type: signals.type
      });
    }

    // Cleanup old usage data
    this.usageReader.cleanup(90);

    this.store.setLastDigestAt(new Date().toISOString());
    const summary = this.store.getSummary();
    return { added, total_pending: summary.pending };
  }

  isDigestDue(days = 7) {
    const last = this.store.getLastDigestAt();
    if (!last) return true;
    return (Date.now() - new Date(last).getTime()) > days * 86400000;
  }
}

module.exports = { InboxEngine };
