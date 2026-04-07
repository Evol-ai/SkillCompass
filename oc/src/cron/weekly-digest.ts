// weekly-digest.ts — Weekly cron job: run rules + ClawHub update check + IM push

import type { OpenClawApi, ClawHubApi, SkillEntry, UserConfig } from '../types/openclaw';
import {
  formatDigest,
  formatUpdateNotice,
  shouldPush,
  recordPush,
  inMergeWindow
} from '../renderers/digest-formatter';

interface InboxEngine {
  runDigest(entries: SkillEntry[]): { added: number; total_pending: number };
  store: {
    // Matches real InboxStore API
    getPending(): Array<{
      id: string;
      skill_name: string;
      reason: string;
      rule_id: string;
    }>;
  };
}

export function registerWeeklyDigest(
  api: OpenClawApi,
  engine: InboxEngine,
  getClawHub: () => ClawHubApi | undefined,
  getInventory: () => SkillEntry[],
  getUserConfig: () => UserConfig
): void {
  api.cron.register({
    name: 'skillcompass-weekly',
    cron: '0 10 * * 1', // Monday 10:00
    session: 'isolated',
    handler: async () => {
      const config = getUserConfig();
      const inventory = getInventory();
      const clawhub = getClawHub();

      // Enrich ClawHub-sourced skills with update signals
      const updateNotices: Array<{
        skill: string;
        current: string;
        latest: string;
        changelog?: string;
      }> = [];

      if (clawhub) {
        for (const skill of inventory) {
          if (skill.source === 'clawhub' && skill.slug) {
            try {
              const latest = await clawhub.getLatestVersion(skill.slug);
              if (latest.version !== skill.version) {
                skill.extraSignals = {
                  ...skill.extraSignals,
                  clawhub_has_update: true,
                  clawhub_latest_version: latest.version,
                  clawhub_current_version: skill.version
                };
                updateNotices.push({
                  skill: skill.name,
                  current: skill.version || 'unknown',
                  latest: latest.version,
                  changelog: latest.changelog
                });
              }
            } catch {
              // ClawHub API unavailable — skip update check for this skill
            }
          }
        }
      }

      // Run digest (evaluates all rules including R15)
      const result = engine.runDigest(inventory);

      // Push digest if there are new suggestions
      if (result.added > 0 && shouldPush(config)) {
        const pending = engine.store.getPending();
        const digest = formatDigest(pending, result.added);
        await api.channels.announce({
          message: digest.message,
          channel: config.preferredChannel,
          buttons: digest.buttons
        });
        recordPush();
      }

      // Push update notices (batched, respecting merge window)
      if (updateNotices.length > 0 && shouldPush(config) && !inMergeWindow()) {
        for (const notice of updateNotices) {
          if (!shouldPush(config)) break;
          const msg = formatUpdateNotice(
            notice.skill, notice.current, notice.latest, notice.changelog
          );
          await api.channels.announce({
            message: msg.message,
            channel: config.preferredChannel,
            buttons: msg.buttons
          });
          recordPush();
        }
      }
    }
  });
}
