// after-tool.ts — Usage tracking via after_agent_tool hook
// Data collection only (v1) — no rules fire from execution results.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { OpenClawApi, AfterAgentToolEvent } from '../types/openclaw';
import { getOpenClawBaseDir } from '../runtime';

// Resolve from plugin root, not caller cwd
const BASE_DIR = getOpenClawBaseDir();
const USAGE_FILE = path.join(BASE_DIR, '.skill-compass', 'oc', 'usage.jsonl');

// SkillCompass's own commands — don't track self-usage
const SELF_COMMANDS = new Set([
  'skillcompass', 'sc', 'eval-skill', 'eval-improve',
  'eval-security', 'eval-audit', 'eval-compare',
  'eval-merge', 'eval-rollback', 'eval-evolve',
  'skill-inbox', 'skill-report', 'skill-update', 'setup'
]);

export function registerUsageTracking(api: OpenClawApi): void {
  api.registerHook('after_agent_tool', async (event) => {
    const e = event as AfterAgentToolEvent;
    if (e.tool_name !== 'skill' && e.tool_type !== 'skill') return;
    if (!e.skill_name) return;

    // Normalize whitespace to dashes but preserve case —
    // UsageReader matches by exact name, so lowercasing would break aggregation.
    const skillName = e.skill_name.replace(/\s+/g, '-');
    if (SELF_COMMANDS.has(skillName.toLowerCase())) return;

    const record = {
      type: 'skill_used',
      skill: skillName,
      timestamp: new Date().toISOString(),
      success: !e.error,
      output_length: e.result?.length || 0,
      error_message: e.error?.message || null,
      duration_ms: e.duration_ms || null
    };

    try {
      fs.mkdirSync(path.dirname(USAGE_FILE), { recursive: true });
      fs.appendFileSync(USAGE_FILE, JSON.stringify(record) + '\n');
    } catch {
      // Non-critical — don't crash the plugin for a tracking failure
    }
  });
}
