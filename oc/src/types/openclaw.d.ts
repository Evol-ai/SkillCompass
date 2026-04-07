// Ambient type declarations for the OpenClaw Plugin SDK
// Based on the API surface described in the product spec.
// Replace with actual SDK imports when available.

export interface OpenClawApi {
  registerHook(event: string, handler: (event: HookEvent) => Promise<void>): void;

  cron: {
    register(options: CronOptions): void;
  };

  channels: {
    announce(options: AnnounceOptions): Promise<void>;
  };

  registerCommand(options: CommandOptions): void;
}

export interface CronOptions {
  name: string;
  cron: string;
  session?: 'isolated' | 'shared';
  handler: () => Promise<void>;
}

export interface AnnounceOptions {
  message: string;
  channel?: string;
  buttons?: InlineButton[];
}

export interface InlineButton {
  label: string;
  action: string;
  payload?: Record<string, unknown>;
}

export interface CommandOptions {
  name: string;
  description: string;
  handler: (args: CommandArgs) => Promise<CommandResponse>;
}

export interface CommandArgs {
  raw: string;
  subcommand?: string;
  args: string[];
}

export interface CommandResponse {
  message: string;
  buttons?: InlineButton[];
}

// Hook event types

export interface HookEvent {
  type: string;
  timestamp: string;
}

export interface AfterAgentToolEvent extends HookEvent {
  type: 'after_agent_tool';
  tool_name: string;
  tool_type?: string;
  skill_name?: string;
  result?: string;
  error?: { message: string };
  duration_ms?: number;
}

export interface PluginInstalledEvent extends HookEvent {
  type: 'plugin_installed';
  skillPath: string;
  skillName: string;
  version?: string;
  source?: 'clawhub' | 'local';
}

export interface PluginUpdatedEvent extends HookEvent {
  type: 'plugin_updated';
  skillPath: string;
  skillName: string;
  previousVersion?: string;
  newVersion?: string;
  source?: 'clawhub' | 'local';
}

// ClawHub API types

export interface ClawHubVersionInfo {
  version: string;
  changelog?: string;
  published_at?: string;
}

export interface ClawHubApi {
  getLatestVersion(slug: string): Promise<ClawHubVersionInfo>;
}

// Skill inventory entry (shared with CC lib)

export interface SkillEntry {
  name: string;
  type?: 'standalone' | 'package' | 'collection';
  source?: 'clawhub' | 'local' | 'git';
  version?: string;
  slug?: string;
  first_seen_at?: string;
  modified_at?: string;
  total_size?: number;
  duplicate_of?: string;
  activation?: string;
  hidden?: boolean;
  extraSignals?: Record<string, unknown>;
}

// User config

export interface UserConfig {
  preferredChannel?: string;
  quietHoursStart?: number; // 0-23, default 22
  quietHoursEnd?: number;   // 0-23, default 9
  dailyPushLimit?: number;  // default 3
}
