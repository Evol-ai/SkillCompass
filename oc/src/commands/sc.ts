// sc.ts — /sc structured commands for SkillCompass on OpenClaw
// Subcommands: status, eval, report, dismiss, snooze

import type { OpenClawApi, CommandArgs, CommandResponse, InlineButton } from '../types/openclaw';

// Matches the real InboxStore API from lib/inbox-store.js
interface InboxStore {
  getSummary(): { pending: number; urgent: number; accepted: number; totalSkills: number };
  getPending(): Array<{
    id: string;
    skill_name: string;
    reason: string;
    rule_id: string;
    category: string;
    priority: string;
  }>;
  dismiss(id: string, cooldownDays?: number): unknown;
  snooze(id: string, days?: number): unknown;
  getAllSkillCache(): Array<{
    skill_name: string;
    use_count_14d?: number;
    total_use_count?: number;
    last_eval_at?: string | null;
    type?: string;
  }>;
}

export function registerCommands(api: OpenClawApi, store: InboxStore): void {
  api.registerCommand({
    name: 'sc',
    description: 'SkillCompass — skill quality and usage management',
    handler: async (args: CommandArgs): Promise<CommandResponse> => {
      const sub = args.subcommand || args.args[0] || 'status';
      const rest = args.subcommand ? args.args : args.args.slice(1);

      switch (sub) {
        case 'status':
          return handleStatus(store);
        case 'eval':
          return handleEval(rest[0]);
        case 'report':
          return handleReport(store);
        case 'dismiss':
          return handleDismiss(store, rest[0]);
        case 'snooze':
          return handleSnooze(store, rest[0]);
        default:
          return {
            message: [
              'Unknown subcommand. Available:',
              '  /sc status   — Overview and pending suggestions',
              '  /sc eval <skill> — Evaluate a skill',
              '  /sc report   — Skill portfolio report',
              '  /sc dismiss <id> — Dismiss a suggestion',
              '  /sc snooze <id>  — Snooze a suggestion'
            ].join('\n')
          };
      }
    }
  });
}

function handleStatus(store: InboxStore): CommandResponse {
  const summary = store.getSummary();
  const pending = store.getPending();
  const cache = store.getAllSkillCache();

  const lines = [
    `\ud83e\udded ${cache.length} skills tracked. ${summary.pending} suggestion${summary.pending !== 1 ? 's' : ''} pending.`
  ];

  if (pending.length > 0) {
    lines.push('');
    pending.slice(0, 5).forEach((s, i) => {
      lines.push(`  ${i + 1}. ${s.skill_name} \u2014 ${s.reason}`);
    });
    if (pending.length > 5) {
      lines.push(`  ... and ${pending.length - 5} more`);
    }
  }

  const buttons: InlineButton[] = pending.slice(0, 5).map((s, i) => ({
    label: `Handle #${i + 1}`,
    action: 'sc_handle',
    payload: { id: s.id }
  }));
  if (pending.length > 0) {
    buttons.push({ label: 'View All', action: 'sc_view_all' });
  }

  return { message: lines.join('\n'), buttons };
}

function resolveSkillPath(skillName: string): string | null {
  const fs = require('node:fs');
  const path = require('node:path');
  const baseDir = process.env.OPENCLAW_PLUGIN_ROOT || process.cwd();
  const home = process.env.HOME || process.env.USERPROFILE || '';

  // If it looks like a path (contains / or \), treat it as a direct file path
  if (skillName.includes('/') || skillName.includes('\\')) {
    if (fs.existsSync(skillName)) return skillName;
    return null;
  }

  // Handle qualified names like "superpowers:writing-plans"
  // Look for the child skill's SKILL.md within the parent package
  let parentName = skillName;
  let childName: string | null = null;
  if (skillName.includes(':')) {
    const parts = skillName.split(':');
    parentName = parts[0];
    childName = parts.slice(1).join(':');
  }

  // Try setup-state inventory first
  const setupPaths = [
    path.join(baseDir, '.skill-compass', 'oc', 'setup-state.json'),
    path.join(baseDir, '.skill-compass', 'setup-state.json')
  ];
  for (const sp of setupPaths) {
    if (fs.existsSync(sp)) {
      try {
        const state = JSON.parse(fs.readFileSync(sp, 'utf-8'));
        const inventory = state.inventory || [];

        if (childName) {
          // Qualified name: find parent, then resolve child within it
          const parent = inventory.find(
            (s: { name: string }) => s.name === parentName
          );
          if (parent?.path) {
            const parentDir = path.dirname(
              parent.path.replace(/^~/, home)
            );
            // Children are typically under skills/<childName>/SKILL.md within the package
            for (const sub of ['skills', '']) {
              const candidate = path.join(parentDir, parentName, sub, childName, 'SKILL.md');
              if (fs.existsSync(candidate)) return candidate;
            }
          }
        } else {
          // Simple name: direct lookup
          const entry = inventory.find(
            (s: { name: string }) => s.name === skillName
          );
          if (entry?.path) {
            const resolved = entry.path.replace(/^~/, home);
            // entry.path may be a directory (for packages) or a file
            if (fs.existsSync(resolved)) {
              try {
                if (fs.statSync(resolved).isDirectory()) {
                  const skillMd = path.join(resolved, 'SKILL.md');
                  if (fs.existsSync(skillMd)) return skillMd;
                } else {
                  return resolved;
                }
              } catch { /* fall through */ }
            }
          }
        }
      } catch { /* continue */ }
    }
  }

  // Fallback: scan skill directories (project-local + user-level)
  const roots = [
    process.env.OPENCLAW_SKILLS_DIR,
    path.join(process.cwd(), '.openclaw', 'skills'),
    path.join(process.cwd(), '.claude', 'skills'),
    path.join(home, '.openclaw', 'skills'),
    path.join(home, '.claude', 'skills')
  ].filter(Boolean) as string[];

  const lookupName = childName || parentName;
  for (const root of roots) {
    if (!fs.existsSync(root)) continue;
    const candidate = path.join(root, lookupName, 'SKILL.md');
    if (fs.existsSync(candidate)) return candidate;
  }

  return null;
}

function handleEval(skillName?: string): CommandResponse {
  if (!skillName) {
    return { message: 'Usage: /sc eval <skill-name | path/to/SKILL.md>' };
  }

  try {
    const filePath = resolveSkillPath(skillName);
    if (!filePath) {
      return { message: `Skill "${skillName}" not found.` };
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { QuickScanner } = require('../../../lib/quick-scan');
    const scanner = new QuickScanner('oc');
    const result = scanner.scanOne(filePath, skillName);

    if (!result || result.verdict === 'error') {
      const errMsg = result?.findings?.[0]?.message || 'scan failed';
      return { message: `Cannot scan "${skillName}": ${errMsg}` };
    }

    // QuickScanner returns top-level d1, d2, d3, verdict, findings
    // Distinguish security issues (D3) from quality issues (D1/D2)
    const isD3Issue = result.d3 !== null && result.d3 <= 4;
    let verdictLine: string;
    if (result.verdict === 'high_risk' && isD3Issue) {
      verdictLine = '\u26a0 Security issues detected';
    } else if (result.verdict === 'high_risk') {
      verdictLine = '\u26a0 Quality issues detected (not security)';
    } else if (result.verdict === 'medium') {
      verdictLine = '\u26a0 Quality concerns found';
    } else {
      verdictLine = '\u2713 Clean';
    }
    const lines = [
      `D1=${result.d1 ?? '?'} D2=${result.d2 ?? '?'} D3=${result.d3 ?? '?'}`,
      verdictLine
    ];

    return {
      message: lines.join('\n'),
      buttons: [
        { label: 'Full eval (D4-D6)', action: 'sc_full_eval', payload: { skill: skillName } },
        { label: 'Skip', action: 'sc_skip' }
      ]
    };
  } catch {
    return { message: `Quick scan unavailable. Run a full evaluation manually.` };
  }
}

function handleReport(store: InboxStore): CommandResponse {
  const cache = store.getAllSkillCache();
  const summary = store.getSummary();

  const byType: Record<string, number> = {};
  let totalUses = 0;
  let neverEvaluated = 0;

  for (const s of cache) {
    const t = s.type || 'standalone';
    byType[t] = (byType[t] || 0) + 1;
    totalUses += s.total_use_count || 0;
    if (!s.last_eval_at) neverEvaluated++;
  }

  const typeStr = Object.entries(byType)
    .map(([t, n]) => `${t}: ${n}`)
    .join(', ');

  const lines = [
    `\ud83e\udded Skill Portfolio`,
    '',
    `Skills: ${cache.length} (${typeStr})`,
    `Total uses (all time): ${totalUses}`,
    `Never evaluated: ${neverEvaluated}`,
    `Pending suggestions: ${summary.pending}`
  ];

  return { message: lines.join('\n') };
}

function handleDismiss(store: InboxStore, id?: string): CommandResponse {
  if (!id) return { message: 'Usage: /sc dismiss <suggestion-id>' };
  try {
    const result = store.dismiss(id, 30);
    if (!result) return { message: `Suggestion "${id}" not found.` };
    return { message: `Dismissed suggestion ${id} (30-day cooldown).` };
  } catch {
    return { message: `Failed to dismiss "${id}".` };
  }
}

function handleSnooze(store: InboxStore, id?: string): CommandResponse {
  if (!id) return { message: 'Usage: /sc snooze <suggestion-id>' };
  try {
    const result = store.snooze(id, 14);
    if (!result) return { message: `Suggestion "${id}" not found.` };
    return { message: `Snoozed suggestion ${id} for 14 days.` };
  } catch {
    return { message: `Failed to snooze "${id}".` };
  }
}
