import * as path from 'node:path';

/**
 * Resolve the OpenClaw plugin root consistently.
 *
 * Hosts should provide OPENCLAW_PLUGIN_ROOT. If they do not, fall back to the
 * installed package root derived from this module location instead of the
 * caller's current working directory.
 */
export function getOpenClawBaseDir(): string {
  return process.env.OPENCLAW_PLUGIN_ROOT || path.resolve(__dirname, '..', '..');
}
