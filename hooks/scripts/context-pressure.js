#!/usr/bin/env node
/**
 * context-pressure.js — PreCompact hook for context pressure detection
 *
 * Tracks compression count per session. When 3 conditions are met simultaneously:
 * 1. Compressions in this session > 3
 * 2. Skill context > 40% of total budget (80KB)
 * 3. Idle skills > 30% of skill context
 * Outputs a cleanup suggestion to stderr.
 *
 * Cooldown: once per session, 3 days cross-session.
 */

const fs = require('node:fs');
const path = require('node:path');

const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
const platformDir = path.join(baseDir, '.skill-compass', 'cc');
const stateFile = path.join(platformDir, 'context-pressure-state.json');

// Ensure directory
if (!fs.existsSync(platformDir)) {
  fs.mkdirSync(platformDir, { recursive: true });
}

// Load state
let state = { session_compact_count: 0, last_shown_at: null, last_session_id: null };
if (fs.existsSync(stateFile)) {
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf-8')); } catch { /* use default */ }
}

// Determine current session (use a simple heuristic: if last compact was > 30min ago, new session)
const now = Date.now();
const thirtyMinMs = 30 * 60 * 1000;
const lastCompactTime = state.last_compact_at ? new Date(state.last_compact_at).getTime() : 0;
if (now - lastCompactTime > thirtyMinMs) {
  state.session_compact_count = 0; // new session
  state.shown_this_session = false;
}
state.session_compact_count++;
state.last_compact_at = new Date().toISOString();

// Save state immediately
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));

// Check condition 1: compressions > 3
if (state.session_compact_count <= 3) process.exit(0);

// Check cooldown: 3 days cross-session, once per session
const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
if (state.last_shown_at && (now - new Date(state.last_shown_at).getTime() < threeDaysMs)) {
  process.exit(0);
}
if (state.shown_this_session) process.exit(0);

// Check condition 2 & 3: need setup-state for skill inventory
const setupStatePaths = [
  path.join(baseDir, '.skill-compass', 'setup-state.json'),
  path.join(platformDir, 'setup-state.json')
];
let inventory = null;
for (const sp of setupStatePaths) {
  if (fs.existsSync(sp)) {
    try {
      const s = JSON.parse(fs.readFileSync(sp, 'utf-8'));
      if (s.inventory) { inventory = s.inventory; break; }
    } catch { /* skip */ }
  }
}
if (!inventory || inventory.length === 0) process.exit(0);

// Calculate total skill size
const BUDGET_KB = 80;
let totalSkillKB = 0;
let idleSkillKB = 0;
let idleCount = 0;

// Read usage data for "idle" determination
const usageFile = path.join(platformDir, 'usage.jsonl');
const usedSkills = new Set();
if (fs.existsSync(usageFile)) {
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
  const lines = fs.readFileSync(usageFile, 'utf-8').trim().split('\n').filter(Boolean);
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.type === 'skill_used' && e.timestamp >= fourteenDaysAgo) {
        usedSkills.add(e.skill);
      }
    } catch { /* skip */ }
  }
}

for (const skill of inventory) {
  const sizeKB = ((skill.total_size || skill.file_size || 0) / 1024);
  totalSkillKB += sizeKB;
  if (!usedSkills.has(skill.name)) {
    idleSkillKB += sizeKB;
    idleCount++;
  }
}

// Condition 2: skill context > 40% of budget
const skillPct = (totalSkillKB / BUDGET_KB) * 100;
if (skillPct <= 40) process.exit(0);

// Condition 3: idle > 30% of skill context
const idlePct = totalSkillKB > 0 ? (idleSkillKB / totalSkillKB) * 100 : 0;
if (idlePct <= 30) process.exit(0);

// All conditions met — output suggestion
process.stderr.write(
  `\n[SkillCompass] 本次会话上下文已压缩 ${state.session_compact_count} 次。\n` +
  `  ${inventory.length} 个 skill 占用 ${totalSkillKB.toFixed(1)}KB（${Math.round(skillPct)}%），` +
  `其中 ${idleCount} 个近期未使用（${idleSkillKB.toFixed(1)}KB）。\n` +
  `  清理闲置 skill 可释放上下文空间 → /skill-inbox all\n\n`
);

// Mark as shown
state.last_shown_at = new Date().toISOString();
state.shown_this_session = true;
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
