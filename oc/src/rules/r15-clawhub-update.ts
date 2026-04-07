// R15-clawhub-update — ClawHub marketplace version check
// Replaces R12 (git-based) for OC platform.
// Signal enrichment happens in weekly-digest cron, not here.

export const r15ClawHubUpdate = {
  id: 'R15-clawhub-update',
  category: 'hygiene',
  priority: 'P3',
  appliesToPackages: true,

  check(s: Record<string, unknown>): boolean {
    if (s.pinned || s.disabled) return false;
    return s.clawhub_has_update === true;
  },

  reason(s: Record<string, unknown>): string {
    return `New version ${s.clawhub_latest_version} available (current: ${s.clawhub_current_version || 'unknown'})`;
  },

  evidence(s: Record<string, unknown>): Array<{ field: string; value: unknown }> {
    return [
      { field: 'clawhub_latest_version', value: s.clawhub_latest_version },
      { field: 'clawhub_current_version', value: s.clawhub_current_version }
    ];
  }
};
