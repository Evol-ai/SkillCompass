#!/usr/bin/env node
/**
 * session-tracker.js — Session lifecycle tracker
 *
 * SessionStart: write session_start event to usage.jsonl, run digest if due
 * SessionEnd: write session_end event
 *
 * Usage: node session-tracker.js start|end
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const mode = process.argv[2]; // 'start' or 'end'
if (!mode || !['start', 'end'].includes(mode)) process.exit(0);

const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
const platformDir = path.join(baseDir, '.skill-compass', 'cc');
const usageFile = path.join(platformDir, 'usage.jsonl');
const inboxFile = path.join(platformDir, 'inbox.json');

// Ensure directory
if (!fs.existsSync(platformDir)) {
  fs.mkdirSync(platformDir, { recursive: true });
}

// Generate a session ID (stable within this process invocation)
const sessionId = crypto.randomBytes(4).toString('hex');

// Write event
const event = {
  type: mode === 'start' ? 'session_start' : 'session_end',
  timestamp: new Date().toISOString(),
  session_id: sessionId
};
fs.appendFileSync(usageFile, JSON.stringify(event) + '\n');

// On start: check if digest is due
if (mode === 'start') {
  try {
    let inbox = { suggestions: [], skill_cache: [], meta: { last_digest_at: null } };
    if (fs.existsSync(inboxFile)) {
      inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
    }

    const lastDigest = inbox.meta?.last_digest_at;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const isDue = !lastDigest || (Date.now() - new Date(lastDigest).getTime() > sevenDaysMs);

    if (isDue) {
      // Check if setup-state exists
      const setupStatePaths = [
        path.join(baseDir, '.skill-compass', 'setup-state.json'),
        path.join(platformDir, 'setup-state.json')
      ];
      let setupState = null;
      for (const sp of setupStatePaths) {
        if (fs.existsSync(sp)) {
          try { setupState = JSON.parse(fs.readFileSync(sp, 'utf-8')); break; } catch { /* skip */ }
        }
      }

      if (setupState && setupState.inventory && setupState.inventory.length > 0) {
        // Run digest via inbox-engine
        try {
          const { InboxEngine } = require(path.join(baseDir, 'lib', 'inbox-engine'));
          const engine = new InboxEngine('cc');
          const result = engine.runDigest(setupState.inventory);
          if (result.added > 0) {
            process.stderr.write(
              `[SkillCompass] ${result.added} 条新建议已生成，运行 /skill-inbox 查看。\n`
            );
          }
        } catch (e) {
          // Engine not available or error, skip silently
        }
      }
    }
  } catch {
    // Non-critical, don't block session start
  }
}
