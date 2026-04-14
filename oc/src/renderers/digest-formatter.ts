// digest-formatter.ts — IM message formatting with inline buttons
// Includes frequency controls: merge window, daily limit, quiet hours.

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { InlineButton, UserConfig } from '../types/openclaw';
import {
  localizeSuggestionReason,
  msg,
  resolveLocale,
  type EvidenceEntry
} from '../locale';
import { getOpenClawBaseDir } from '../runtime';

const BASE_DIR = getOpenClawBaseDir();
const PUSH_STATE_FILE = path.join(BASE_DIR, '.skill-compass', 'oc', 'push-state.json');

interface PushState {
  today: string;       // YYYY-MM-DD
  count: number;       // pushes sent today
  lastPushAt: string;  // ISO timestamp of last push
}

// --- Frequency controls ---

function loadPushState(): PushState {
  try {
    if (fs.existsSync(PUSH_STATE_FILE)) {
      return JSON.parse(fs.readFileSync(PUSH_STATE_FILE, 'utf-8'));
    }
  } catch { /* corrupt state — reset */ }
  return { today: '', count: 0, lastPushAt: '' };
}

function savePushState(state: PushState): void {
  try {
    fs.mkdirSync(path.dirname(PUSH_STATE_FILE), { recursive: true });
    fs.writeFileSync(PUSH_STATE_FILE, JSON.stringify(state, null, 2));
  } catch { /* non-critical */ }
}

function isQuietHours(config: UserConfig): boolean {
  const hour = new Date().getHours();
  const start = config.quietHoursStart ?? 22;
  const end = config.quietHoursEnd ?? 9;
  if (start > end) {
    // Wraps midnight: e.g. 22-9 means 22,23,0,1,...,8 are quiet
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

function isWithinMergeWindow(state: PushState): boolean {
  if (!state.lastPushAt) return false;
  const elapsed = Date.now() - new Date(state.lastPushAt).getTime();
  return elapsed < 3600000; // 1 hour
}

/**
 * Check if a push is allowed given frequency controls.
 * Call this before sending any IM message.
 */
export function shouldPush(config: UserConfig): boolean {
  if (isQuietHours(config)) return false;

  const state = loadPushState();
  const today = new Date().toISOString().slice(0, 10);
  const limit = config.dailyPushLimit ?? 3;

  if (state.today === today && state.count >= limit) return false;
  return true;
}

/**
 * Record that a push was sent. Call after successful announce().
 */
export function recordPush(): void {
  const state = loadPushState();
  const today = new Date().toISOString().slice(0, 10);
  if (state.today !== today) {
    state.today = today;
    state.count = 0;
  }
  state.count++;
  state.lastPushAt = new Date().toISOString();
  savePushState(state);
}

/**
 * Check if we're in a merge window (within 1h of last push).
 * Caller should batch messages instead of sending immediately.
 */
export function inMergeWindow(): boolean {
  return isWithinMergeWindow(loadPushState());
}

// --- Message formatting ---

interface Suggestion {
  id: string;
  skill_name: string;
  reason: string;
  rule_id: string;
  evidence?: EvidenceEntry[] | null;
}

export function formatDigest(
  suggestions: Suggestion[],
  added: number,
  config: UserConfig = {}
): { message: string; buttons: InlineButton[] } {
  const locale = resolveLocale(config);
  const lines = [msg(locale, 'weeklyDigest', { count: added, plural_s: added === 1 ? '' : 's' })];
  lines.push('');

  suggestions.slice(0, 5).forEach((s, i) => {
    lines.push(`${i + 1}. ${s.skill_name} \u2014 ${localizeSuggestionReason(locale, s)}`);
  });

  if (suggestions.length > 5) {
    lines.push(msg(locale, 'andMore', { count: suggestions.length - 5 }));
  }

  const buttons: InlineButton[] = suggestions.slice(0, 5).map((s, i) => ({
    label: msg(locale, 'handleButton', { index: i + 1 }),
    action: 'sc_handle',
    payload: { id: s.id }
  }));
  buttons.push({
    label: msg(locale, 'dismissAll'),
    action: 'sc_dismiss_all'
  });

  return { message: lines.join('\n'), buttons };
}

export function formatUpdateNotice(
  skillName: string,
  currentVersion: string,
  latestVersion: string,
  changelog?: string,
  config: UserConfig = {}
): { message: string; buttons: InlineButton[] } {
  const locale = resolveLocale(config);
  const current = currentVersion || msg(locale, 'unknown');
  const lines = [
    msg(locale, 'updateAvailable'),
    '',
    `${skillName}: ${current} \u2192 ${latestVersion}`
  ];
  if (changelog) {
    lines.push(msg(locale, 'changelog', { text: changelog }));
  }

  return {
    message: lines.join('\n'),
    buttons: [
      {
        label: msg(locale, 'updateRescan'),
        action: 'sc_update',
        payload: { skill: skillName }
      },
      {
        label: msg(locale, 'viewChangelog'),
        action: 'sc_changelog',
        payload: { skill: skillName }
      },
      {
        label: msg(locale, 'skip'),
        action: 'sc_skip',
        payload: { skill: skillName }
      }
    ]
  };
}
