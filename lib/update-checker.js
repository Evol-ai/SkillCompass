/**
 * update-checker.js — Git-based skill update checker
 *
 * Checks if installed skills (that are git repos) have remote updates.
 * Does NOT auto-fetch — only scans local git state or fetches when the
 * user explicitly asks. Pure-read filesystem operations (path resolution,
 * FETCH_HEAD mtime, local SKILL.md version parsing) live in
 * git-skill-reader.js so that this file contains only the git invocation
 * surface.
 */

const { execSync } = require('node:child_process');
const { GitSkillReader } = require('./git-skill-reader');

class UpdateChecker {
  constructor() {
    this._reader = new GitSkillReader();
  }

  /**
   * Check which skills are git repos and when they were last fetched.
   * @param {Array} inventory - from setup-state.json
   * @returns {Array} skills with git info: { name, path, is_git, last_fetch_days, behind_count, remote_url }
   */
  checkAll(inventory) {
    const results = [];

    for (const skill of inventory) {
      const skillPath = this._reader._resolveSkillDir(skill);
      if (!skillPath) continue;
      if (!this._reader.isGitRepo(skillPath)) continue;

      const remote_url = this._getRemoteUrl(skillPath);
      if (!remote_url) continue; // local-only repo — no remote to check

      results.push({
        name: skill.name,
        path: skillPath,
        is_git: true,
        last_fetch_days: this._reader._daysSinceLastFetch(skillPath),
        behind_count: null, // only known after fetch
        remote_url
      });
    }

    return results;
  }

  /**
   * Get skills that haven't been fetched in N days.
   * @param {Array} inventory
   * @param {number} days - threshold (default 7)
   * @returns {Array} stale skills
   */
  getStale(inventory, days = 7) {
    return this.checkAll(inventory).filter(s => s.last_fetch_days > days);
  }

  /**
   * Fetch remote for a single skill (user-initiated, requires network).
   * @param {string} skillPath
   * @returns {Object} { success, behind_count, new_commits, current_version, remote_version, error }
   */
  fetchAndCheck(skillPath) {
    try {
      execSync('git fetch', { cwd: skillPath, timeout: 30000, stdio: 'pipe' });

      let behind = 0;
      try {
        const status = execSync('git status -sb', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' });
        const match = status.match(/behind (\d+)/);
        if (match) behind = parseInt(match[1], 10);
      } catch { /* ignore */ }

      let currentRef = '';
      let remoteRef = '';
      try {
        currentRef = execSync('git log --oneline -1 HEAD', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' }).trim();
        remoteRef = execSync('git log --oneline -1 FETCH_HEAD', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' }).trim();
      } catch { /* ignore */ }

      const current_version = this._reader.extractLocalVersion(skillPath);
      const remote_version = this._getRemoteVersion(skillPath);

      return {
        success: true,
        behind_count: behind,
        has_updates: behind > 0,
        current_ref: currentRef,
        remote_ref: remoteRef,
        current_version,
        remote_version,
        error: null
      };
    } catch (e) {
      return {
        success: false,
        behind_count: null,
        has_updates: false,
        current_ref: null,
        remote_ref: null,
        current_version: null,
        remote_version: null,
        error: e.message
      };
    }
  }

  /**
   * Pull updates for a skill (user-initiated).
   * Safety rails: rejects if working tree is dirty, uses --ff-only to
   * prevent unexpected merge commits.
   * @param {string} skillPath
   * @param {{ snapshot?: function }} [options] - Optional snapshot callback
   *   called before pull. Signature: (skillPath) => void.
   * @returns {Object} { success, message, error }
   */
  pullUpdate(skillPath, options = {}) {
    // Step 1: Reject if tracked files have uncommitted changes.
    // git diff --quiet HEAD ignores untracked files, so the
    // .skill-compass/ sidecar won't block updates.
    try {
      execSync('git diff --quiet HEAD', {
        cwd: skillPath, timeout: 10000, stdio: ['pipe', 'pipe', 'pipe']
      });
    } catch (diffErr) {
      if (diffErr.status === 1) {
        return {
          success: false,
          message: null,
          error: 'Working tree has uncommitted changes. Commit or stash before updating.'
        };
      }
      // Other errors (e.g. not a git repo) — fall through to pull which will also fail
    }

    // Step 2: Take a snapshot before pull if callback provided
    if (typeof options.snapshot === 'function') {
      try { options.snapshot(skillPath); } catch { /* non-critical */ }
    }

    // Step 3: Fast-forward only — refuse merge commits
    try {
      const output = execSync('git pull --ff-only', {
        cwd: skillPath, timeout: 60000, encoding: 'utf-8'
      });
      return { success: true, message: output.trim(), error: null };
    } catch (e) {
      return { success: false, message: null, error: e.message };
    }
  }

  // --- Private git invocations ---

  _getRemoteUrl(skillPath) {
    try {
      return execSync('git remote get-url origin', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' }).trim();
    } catch {
      return null;
    }
  }

  _getRemoteVersion(skillPath) {
    try {
      const content = execSync('git show FETCH_HEAD:SKILL.md', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' });
      return this._reader._extractVersion(content);
    } catch {
      try {
        const content = execSync('git show FETCH_HEAD:skill.md', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' });
        return this._reader._extractVersion(content);
      } catch {
        return null;
      }
    }
  }
}

module.exports = { UpdateChecker };
