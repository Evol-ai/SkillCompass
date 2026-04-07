// plugin-lifecycle.ts — Install/update detection + D1-D3 quick scan
// Only pushes IM alert for D3 Critical/High findings.

import type {
  OpenClawApi,
  PluginInstalledEvent,
  PluginUpdatedEvent,
  UserConfig
} from '../types/openclaw';
import { shouldPush } from '../renderers/digest-formatter';

export function registerLifecycleHooks(
  api: OpenClawApi,
  getUserConfig: () => UserConfig
): void {
  api.registerHook('plugin_installed', async (event) => {
    const e = event as PluginInstalledEvent;
    await scanAndAlert(api, e.skillPath, e.skillName, getUserConfig());
  });

  api.registerHook('plugin_updated', async (event) => {
    const e = event as PluginUpdatedEvent;
    await scanAndAlert(api, e.skillPath, e.skillName, getUserConfig());
  });
}

async function scanAndAlert(
  api: OpenClawApi,
  skillPath: string,
  skillName: string,
  config: UserConfig
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('node:fs');
    const path = require('node:path');
    const { QuickScanner } = require('../../../lib/quick-scan');
    const scanner = new QuickScanner('oc');

    // skillPath may be a directory — resolve to SKILL.md inside it
    let filePath = skillPath;
    try {
      if (fs.statSync(skillPath).isDirectory()) {
        const candidate = path.join(skillPath, 'SKILL.md');
        if (fs.existsSync(candidate)) {
          filePath = candidate;
        } else {
          return; // No SKILL.md in directory — nothing to scan
        }
      }
    } catch {
      return; // Path doesn't exist
    }

    const result = scanner.scanOne(filePath, skillName);
    if (!result || result.verdict === 'error') return;

    // Only alert on D3 Critical/High findings — not medium-only
    // (d3 <= 6 alone is too broad; require actual critical/high findings)
    const hasCriticalFinding = (result.findings || []).some(
      (f: { source?: string; severity?: string }) =>
        f.source === 'D3' && (f.severity === 'critical' || f.severity === 'high')
    );

    if (hasCriticalFinding && shouldPush(config)) {
      // Pick the first D3 critical/high finding, not just any finding
      const d3Finding = (result.findings || []).find(
        (f: { source?: string; severity?: string }) =>
          f.source === 'D3' && (f.severity === 'critical' || f.severity === 'high')
      ) || (result.findings || []).find(
        (f: { source?: string }) => f.source === 'D3'
      );
      const desc = d3Finding?.message || 'security concern detected';
      await api.channels.announce({
        message: `\u26a0 Security risk in ${skillName}: ${desc}`,
        channel: config.preferredChannel,
        buttons: [
          { label: 'View Details', action: 'sc_eval', payload: { skill: skillName } },
          { label: 'Dismiss', action: 'sc_dismiss', payload: { skill: skillName } }
        ]
      });
    }
  } catch {
    // quick-scan not available or scan failed — non-critical
  }
}
