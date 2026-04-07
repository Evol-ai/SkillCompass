// plugin.ts — SkillCompass OpenClaw plugin entry point
// register(api) is called by the OpenClaw runtime on plugin load.

import type { OpenClawApi, ClawHubApi, SkillEntry, UserConfig } from './types/openclaw';
import { r15ClawHubUpdate } from './rules/r15-clawhub-update';
import { registerUsageTracking } from './hooks/after-tool';
import { registerLifecycleHooks } from './hooks/plugin-lifecycle';
import { registerWeeklyDigest } from './cron/weekly-digest';
import { registerCommands } from './commands/sc';

// Shared lib — resolved at runtime from the package root
// From oc/dist/plugin.js, need ../../lib/ to reach root lib/
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { InboxEngine } = require('../../lib/inbox-engine');

// Resolve plugin root consistently — all state files go here
const OC_BASE_DIR = process.env.OPENCLAW_PLUGIN_ROOT || process.cwd();

// Mutable config — updated via configure(), read via getters
// so downstream modules always see the latest values.
let _clawhubApi: ClawHubApi | undefined;
let _userConfig: UserConfig = {};
let _inventoryProvider: () => SkillEntry[] = () => [];

export function register(api: OpenClawApi): void {
  // Initialize engine for OC platform, anchored to plugin root
  const engine = new InboxEngine('oc', OC_BASE_DIR);

  // Swap R12 (git-based) for R15 (ClawHub API)
  engine.removeRule('R12-check-update');
  engine.registerRule(r15ClawHubUpdate);

  // Register hooks — pass getter so lifecycle always reads latest config
  registerUsageTracking(api);
  registerLifecycleHooks(api, () => _userConfig);

  // Register weekly digest cron — all dynamic values via getters
  registerWeeklyDigest(
    api,
    engine,
    () => _clawhubApi,
    () => _inventoryProvider(),
    () => _userConfig
  );

  // Register /sc commands
  registerCommands(api, engine.store);
}

/**
 * Configure the plugin. Called by the host or plugin config system.
 * Can be called before or after register() — downstream modules
 * read via getters so they always see the latest values.
 */
export function configure(options: {
  clawhub?: ClawHubApi;
  config?: UserConfig;
  inventory?: () => SkillEntry[];
}): void {
  if (options.clawhub) _clawhubApi = options.clawhub;
  if (options.config) _userConfig = options.config;
  if (options.inventory) _inventoryProvider = options.inventory;
}
