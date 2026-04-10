#!/usr/bin/env node
/**
 * session-tracker.js — Session lifecycle tracker + context injection
 *
 * SessionStart: write session_start event, check version, run digest, inject context
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
const versionFile = path.join(platformDir, 'last-version');

// Ensure directory
if (!fs.existsSync(platformDir)) {
  fs.mkdirSync(platformDir, { recursive: true });
}

// Session ID: start generates and persists; end reads the persisted one
const sessionFile = path.join(platformDir, 'current-session');
let sessionId;

if (mode === 'start') {
  sessionId = crypto.randomBytes(4).toString('hex');
  fs.writeFileSync(sessionFile, sessionId, 'utf-8');
} else {
  // end: read the session ID that start wrote
  try {
    sessionId = fs.readFileSync(sessionFile, 'utf-8').trim();
  } catch {
    sessionId = crypto.randomBytes(4).toString('hex');
  }
}

// Write event
const event = {
  type: mode === 'start' ? 'session_start' : 'session_end',
  timestamp: new Date().toISOString(),
  session_id: sessionId
};
fs.appendFileSync(usageFile, JSON.stringify(event) + '\n');

if (mode === 'start') {
  let contextMessage = '';

  try {
    // --- Version check: detect first install, reinstall, or update ---
    const currentVersion = getCurrentVersion();
    const lastVersion = fs.existsSync(versionFile)
      ? fs.readFileSync(versionFile, 'utf-8').trim()
      : null;

    const needsOnboarding = !lastVersion || lastVersion !== currentVersion;

    if (needsOnboarding) {
      // First install, reinstall, or version update — trigger onboarding
      contextMessage = `SkillCompass ${currentVersion} ${lastVersion ? `(updated from ${lastVersion})` : '(first install)'}. `
        + 'On the user\'s first message, run the Post-Install Onboarding from SKILL.md.';
    } else {
      // Normal session — check inbox state
      let inbox = { suggestions: [], skill_cache: [], meta: { last_digest_at: null } };
      if (fs.existsSync(inboxFile)) {
        inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
      }

      // Run digest if due (> 7 days)
      const lastDigest = inbox.meta?.last_digest_at;
      const isDue = !lastDigest || (Date.now() - new Date(lastDigest).getTime() > 7 * 86400000);

      if (isDue) {
        const setupState = loadSetupState();
        if (setupState && setupState.inventory && setupState.inventory.length > 0) {
          try {
            const { InboxEngine } = require(path.join(baseDir, 'lib', 'inbox-engine'));
            const engine = new InboxEngine('cc', baseDir);
            engine.runDigest(setupState.inventory);
            // Re-read inbox after digest
            if (fs.existsSync(inboxFile)) {
              inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8'));
            }
          } catch { /* engine not available */ }
        }
      }

      // Build status message
      const setupState = loadSetupState();
      const skillCount = setupState?.skills_found || setupState?.inventory?.length || 0;
      const pending = (inbox.suggestions || []).filter(s =>
        s.status === 'pending' || s.status === 'viewed'
      ).length;

      if (pending > 0) {
        contextMessage = `SkillCompass active. ${skillCount} skills, ${pending} pending. /skillcompass to manage.`;
      } else {
        contextMessage = `SkillCompass active. ${skillCount} skills, no pending.`;
      }
    }
  } catch {
    contextMessage = 'SkillCompass active.';
  }

  // Output context injection
  const payload = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: contextMessage
    }
  };
  process.stdout.write(JSON.stringify(payload) + '\n');
}

// --- Helpers ---

function getCurrentVersion() {
  // Try package.json first, then SKILL.md frontmatter
  const pkgPath = path.join(baseDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      if (pkg.version) return pkg.version;
    } catch { /* fall through */ }
  }

  const skillPath = path.join(baseDir, 'SKILL.md');
  if (fs.existsSync(skillPath)) {
    try {
      const content = fs.readFileSync(skillPath, 'utf-8');
      const match = content.match(/version:\s*['"]?([^\s'"]+)/);
      if (match) return match[1];
    } catch { /* fall through */ }
  }

  return 'unknown';
}

function loadSetupState() {
  const paths = [
    path.join(baseDir, '.skill-compass', 'setup-state.json'),
    path.join(platformDir, 'setup-state.json')
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) {
      try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch { /* skip */ }
    }
  }
  return null;
}
