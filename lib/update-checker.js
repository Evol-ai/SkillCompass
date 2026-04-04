/**
 * update-checker.js — Git-based skill update checker
 *
 * Checks if installed skills (that are git repos) have remote updates.
 * Does NOT auto-fetch — only checks local git state or fetches when user explicitly asks.
 */

const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

class UpdateChecker {
  /**
   * Check which skills are git repos and when they were last fetched
   * @param {Array} inventory - from setup-state.json
   * @returns {Array} skills with git info: { name, path, is_git, last_fetch_days, behind_count }
   */
  checkAll(inventory) {
    const results = [];

    for (const skill of inventory) {
      const skillPath = this._resolveSkillDir(skill);
      if (!skillPath) continue;

      const gitDir = path.join(skillPath, '.git');
      if (!fs.existsSync(gitDir)) {
        // Not a git repo, skip
        continue;
      }

      const info = {
        name: skill.name,
        path: skillPath,
        is_git: true,
        last_fetch_days: this._daysSinceLastFetch(skillPath),
        behind_count: null, // only known after fetch
        remote_url: this._getRemoteUrl(skillPath)
      };

      results.push(info);
    }

    return results;
  }

  /**
   * Get skills that haven't been fetched in N days
   * @param {Array} inventory
   * @param {number} days - threshold (default 7)
   * @returns {Array} stale skills
   */
  getStale(inventory, days = 7) {
    return this.checkAll(inventory).filter(s => s.last_fetch_days > days);
  }

  /**
   * Fetch remote for a single skill (user-initiated, requires network)
   * @param {string} skillPath
   * @returns {Object} { success, behind_count, new_commits, current_version, remote_version, error }
   */
  fetchAndCheck(skillPath) {
    try {
      // git fetch (this is the network call — only when user explicitly requests)
      execSync('git fetch', { cwd: skillPath, timeout: 30000, stdio: 'pipe' });

      // Check how many commits behind
      let behind = 0;
      try {
        const status = execSync('git status -sb', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' });
        const match = status.match(/behind (\d+)/);
        if (match) behind = parseInt(match[1], 10);
      } catch { /* ignore */ }

      // Get current and remote HEAD short descriptions
      let currentRef = '';
      let remoteRef = '';
      try {
        currentRef = execSync('git log --oneline -1 HEAD', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' }).trim();
        remoteRef = execSync('git log --oneline -1 FETCH_HEAD', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' }).trim();
      } catch { /* ignore */ }

      // Try to get version from frontmatter of current vs remote SKILL.md
      const versions = this._getVersions(skillPath);

      return {
        success: true,
        behind_count: behind,
        has_updates: behind > 0,
        current_ref: currentRef,
        remote_ref: remoteRef,
        current_version: versions.local,
        remote_version: versions.remote,
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
   * Pull updates for a skill (user-initiated)
   * @param {string} skillPath
   * @returns {Object} { success, message, error }
   */
  pullUpdate(skillPath) {
    try {
      const output = execSync('git pull', { cwd: skillPath, timeout: 60000, encoding: 'utf-8' });
      return { success: true, message: output.trim(), error: null };
    } catch (e) {
      return { success: false, message: null, error: e.message };
    }
  }

  // --- Private helpers ---

  _resolveSkillDir(skill) {
    // For standalone skills: path points to SKILL.md, get parent dir
    // For collections: path points to directory
    const p = skill.path;
    if (!p) return null;

    const resolved = p.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '');
    if (fs.existsSync(resolved)) {
      const stat = fs.statSync(resolved);
      return stat.isDirectory() ? resolved : path.dirname(resolved);
    }
    return null;
  }

  _daysSinceLastFetch(skillPath) {
    const fetchHead = path.join(skillPath, '.git', 'FETCH_HEAD');
    if (!fs.existsSync(fetchHead)) {
      // Never fetched — check .git/HEAD mtime as proxy (clone time)
      const head = path.join(skillPath, '.git', 'HEAD');
      if (!fs.existsSync(head)) return Infinity;
      const mtime = fs.statSync(head).mtime;
      return (Date.now() - mtime.getTime()) / 86400000;
    }
    const mtime = fs.statSync(fetchHead).mtime;
    return (Date.now() - mtime.getTime()) / 86400000;
  }

  _getRemoteUrl(skillPath) {
    try {
      return execSync('git remote get-url origin', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' }).trim();
    } catch {
      return null;
    }
  }

  _getVersions(skillPath) {
    const result = { local: null, remote: null };

    // Local version from frontmatter
    const skillMdPaths = [
      path.join(skillPath, 'SKILL.md'),
      path.join(skillPath, 'skill.md')
    ];
    for (const p of skillMdPaths) {
      if (fs.existsSync(p)) {
        result.local = this._extractVersion(fs.readFileSync(p, 'utf-8'));
        break;
      }
    }

    // Remote version from FETCH_HEAD's SKILL.md
    try {
      const remote = execSync('git show FETCH_HEAD:SKILL.md', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' });
      result.remote = this._extractVersion(remote);
    } catch {
      // Try lowercase
      try {
        const remote = execSync('git show FETCH_HEAD:skill.md', { cwd: skillPath, timeout: 5000, encoding: 'utf-8' });
        result.remote = this._extractVersion(remote);
      } catch { /* ignore */ }
    }

    return result;
  }

  _extractVersion(content) {
    if (!content.startsWith('---')) return null;
    const fmEnd = content.indexOf('---', 3);
    if (fmEnd === -1) return null;
    const fm = content.slice(3, fmEnd);
    const match = fm.match(/version:\s*['"]?([^\s'"]+)/);
    return match ? match[1] : null;
  }
}

module.exports = { UpdateChecker };
