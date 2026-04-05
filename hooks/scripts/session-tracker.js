#!/usr/bin/env node
/**
 * session-tracker.js — Session lifecycle tracker + context injection
 *
 * SessionStart: write session_start event, run digest if due, inject additionalContext
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

// Generate a session ID
const sessionId = crypto.randomBytes(4).toString('hex');

// Write event
const event = {
  type: mode === 'start' ? 'session_start' : 'session_end',
  timestamp: new Date().toISOString(),
  session_id: sessionId
};
fs.appendFileSync(usageFile, JSON.stringify(event) + '\n');

if (mode === 'start') {
  let contextMessage = '';
  let digestAdded = 0;

  try {
    // Check setup state
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

    if (!setupState) {
      // Not initialized — tell Claude to run onboarding on first user interaction
      contextMessage = 'SkillCompass installed but not initialized. On the user\'s first message, run the Post-Install Onboarding from SKILL.md.';
    } else {
      // Initialized — read inbox state
      let inbox = { suggestions: [], skill_cache: [], meta: { last_digest_at: null } };
      if (fs.existsSync(inboxFile)) {
        inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
      }

      // Run digest if due
      const lastDigest = inbox.meta?.last_digest_at;
      const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
      const isDue = !lastDigest || (Date.now() - new Date(lastDigest).getTime() > sevenDaysMs);

      if (isDue && setupState.inventory && setupState.inventory.length > 0) {
        try {
          const { InboxEngine } = require(path.join(baseDir, 'lib', 'inbox-engine'));
          const engine = new InboxEngine('cc');
          const result = engine.runDigest(setupState.inventory);
          digestAdded = result.added;
          // Re-read inbox after digest
          if (fs.existsSync(inboxFile)) {
            inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
          }
        } catch {
          // Engine not available, skip
        }
      }

      // Build context message
      const skillCount = setupState.skills_found || (setupState.inventory || []).length || 0;
      const pending = (inbox.suggestions || []).filter(s =>
        s.status === 'pending' || s.status === 'viewed'
      ).length;

      if (pending > 0) {
        contextMessage = `SkillCompass active. ${skillCount} skills tracked, ${pending} pending suggestion(s). User: /skillcompass to manage.`;
      } else {
        contextMessage = `SkillCompass active. ${skillCount} skills tracked, no pending suggestions.`;
      }
    }
  } catch {
    // Non-critical, don't block session start
    contextMessage = 'SkillCompass active.';
  }

  // Output context injection as JSON
  // Claude Code reads hookSpecificOutput.additionalContext
  const payload = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: contextMessage
    }
  };
  process.stdout.write(JSON.stringify(payload) + '\n');
}
