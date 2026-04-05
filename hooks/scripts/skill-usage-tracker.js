#!/usr/bin/env node
/**
 * skill-usage-tracker.js — Track skill usage via PostToolUse Skill hook
 *
 * Reads hook payload from stdin, extracts skill name, handles collection
 * qualified names (e.g., "superpowers:writing-plans" → parent "superpowers"),
 * appends to .skill-compass/cc/usage.jsonl.
 *
 * Also checks usage milestones (10/50/100 uses without eval) and outputs
 * a one-time reminder to stderr.
 */

const fs = require('node:fs');
const path = require('node:path');

async function main() {
  // Read stdin
  let input;
  try { input = fs.readFileSync(0, 'utf-8'); } catch { return; }
  if (!input) return;

  let payload;
  try { payload = JSON.parse(input); } catch { return; }

  // Extract skill name from payload
  // PostToolUse Skill payload: { tool_name: "Skill", tool_input: { skill: "name", ... }, ... }
  const rawSkill = payload?.tool_input?.skill || payload?.tool_input?.name;
  if (!rawSkill) return;

  // Skip SkillCompass's own commands (don't track self-usage)
  const scCommands = ['skill-compass', 'setup', 'eval-skill', 'eval-improve', 'eval-security',
    'eval-audit', 'eval-compare', 'eval-merge', 'eval-rollback', 'eval-evolve',
    'skill-inbox', 'skill-report'];
  if (scCommands.includes(rawSkill) || rawSkill.startsWith('skill-compass:')) return;

  // Parse collection qualified name
  let parent, child;
  if (rawSkill.includes(':')) {
    const parts = rawSkill.split(':');
    parent = parts[0];
    child = parts.slice(1).join(':');
  } else {
    parent = rawSkill;
    child = null;
  }

  // Determine base directory
  const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
  const platformDir = path.join(baseDir, '.skill-compass', 'cc');
  const usageFile = path.join(platformDir, 'usage.jsonl');

  // Ensure directory
  if (!fs.existsSync(platformDir)) {
    fs.mkdirSync(platformDir, { recursive: true });
  }

  // Append usage event
  const event = {
    type: 'skill_used',
    skill: parent,
    child: child,
    timestamp: new Date().toISOString()
  };
  fs.appendFileSync(usageFile, JSON.stringify(event) + '\n');

  // Milestone check
  checkMilestone(parent, usageFile, platformDir, baseDir);
}

function checkMilestone(skillName, usageFile, platformDir, baseDir) {
  const MILESTONES = [10, 50, 100];

  // Count total uses for this skill
  if (!fs.existsSync(usageFile)) return;
  const lines = fs.readFileSync(usageFile, 'utf-8').trim().split('\n').filter(Boolean);
  let count = 0;
  for (const line of lines) {
    try {
      const e = JSON.parse(line);
      if (e.type === 'skill_used' && e.skill === skillName) count++;
    } catch { /* skip */ }
  }

  // Check if hit a milestone
  const milestone = MILESTONES.find(m => count === m);
  if (!milestone) return;

  // Check if already shown this milestone (inbox.json skill_cache)
  const inboxFile = path.join(platformDir, 'inbox.json');
  let inbox = { suggestions: [], skill_cache: [], meta: {} };
  if (fs.existsSync(inboxFile)) {
    try { inbox = JSON.parse(fs.readFileSync(inboxFile, 'utf-8')); } catch { /* use default */ }
  }

  let cache = (inbox.skill_cache || []).find(s => s.skill_name === skillName);
  const shownMilestones = cache?.milestones_shown || [];
  if (shownMilestones.includes(milestone)) return;

  // Check if skill has been evaluated (manifest exists with eval)
  const manifestPaths = [
    path.join(baseDir, '.skill-compass', 'cc', skillName, 'manifest.json'),
    path.join(baseDir, '.skill-compass', skillName, 'manifest.json')
  ];
  for (const mp of manifestPaths) {
    if (fs.existsSync(mp)) {
      try {
        const m = JSON.parse(fs.readFileSync(mp, 'utf-8'));
        if (m.versions && m.versions.length > 0) return; // already evaluated, skip milestone
      } catch { /* continue */ }
    }
  }

  // Output milestone reminder to stderr
  process.stderr.write(
    `\n[SkillCompass] ${skillName} has been used ${milestone} times.\n` +
    `  Consider evaluating its quality — improvements will benefit every future use.\n\n`
  );

  // Record milestone as shown
  if (!cache) {
    cache = { skill_name: skillName };
    inbox.skill_cache = inbox.skill_cache || [];
    inbox.skill_cache.push(cache);
  }
  cache.milestones_shown = [...shownMilestones, milestone];
  fs.writeFileSync(inboxFile, JSON.stringify(inbox, null, 2));
}

main().catch(() => {});
