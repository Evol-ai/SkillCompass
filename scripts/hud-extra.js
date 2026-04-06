#!/usr/bin/env node
/**
 * hud-extra.js — Claude HUD extra-cmd script for SkillCompass
 *
 * Outputs JSON { "label": "🧭 N pending" } when inbox has pending suggestions.
 * Outputs { "label": "" } when nothing pending (HUD hides empty labels).
 *
 * Used by claude-hud via --extra-cmd flag.
 * Must execute in < 3 seconds, output < 10KB.
 */

const fs = require('node:fs');
const path = require('node:path');

// Try multiple possible inbox.json locations
const candidates = [
  path.join(process.cwd(), '.skill-compass', 'cc', 'inbox.json'),
  path.join(process.env.HOME || process.env.USERPROFILE || '', '.skill-compass', 'cc', 'inbox.json')
];

let label = '';

for (const inboxPath of candidates) {
  try {
    if (!fs.existsSync(inboxPath)) continue;
    const data = JSON.parse(fs.readFileSync(inboxPath, 'utf-8'));
    const pending = (data.suggestions || []).filter(s =>
      s.status === 'pending' || s.status === 'viewed'
    ).length;

    if (pending > 0) {
      label = `🧭 ${pending} pending`;
    }
    break; // found inbox, stop searching
  } catch {
    // skip corrupt file, try next
  }
}

console.log(JSON.stringify({ label }));
