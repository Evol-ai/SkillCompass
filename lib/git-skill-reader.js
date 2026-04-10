/**
 * git-skill-reader.js — Read-only helpers for git-backed skills
 *
 * Pure filesystem reads: path resolution, git-repo detection, last-fetch
 * timestamp, local SKILL.md version extraction. No child_process, no
 * network, no writes. Consumed by UpdateChecker for the parts of its
 * flow that do not need to invoke git.
 */

const fs = require('node:fs');
const path = require('node:path');

class GitSkillReader {
  /**
   * Resolve a skill inventory entry to its base directory.
   * For standalone skills the entry path points at SKILL.md; for
   * collections it already points at the directory. Expands a leading
   * `~` using HOME or USERPROFILE. Returns null when the path cannot
   * be resolved.
   */
  _resolveSkillDir(skill) {
    const p = skill.path;
    if (!p) return null;

    const resolved = p.replace(/^~/, process.env.HOME || process.env.USERPROFILE || '');
    if (fs.existsSync(resolved)) {
      const stat = fs.statSync(resolved);
      return stat.isDirectory() ? resolved : path.dirname(resolved);
    }
    return null;
  }

  /**
   * Cheap existence check: is there a .git entry in the skill directory?
   * Accepts both the normal directory form and the submodule/worktree
   * file form (which git itself resolves internally when invoked).
   */
  isGitRepo(skillPath) {
    return fs.existsSync(path.join(skillPath, '.git'));
  }

  /**
   * Days since the most recent `git fetch`, using FETCH_HEAD mtime.
   * Returns Infinity when FETCH_HEAD is absent (never fetched) so R12
   * inbox rules can treat it as stale. Using HEAD mtime as a proxy
   * would be wrong because local commits or checkouts refresh HEAD
   * even when the remote has never been contacted.
   */
  _daysSinceLastFetch(skillPath) {
    const fetchHead = path.join(skillPath, '.git', 'FETCH_HEAD');
    if (!fs.existsSync(fetchHead)) return Infinity;
    const mtime = fs.statSync(fetchHead).mtime;
    return (Date.now() - mtime.getTime()) / 86400000;
  }

  /**
   * Read the local SKILL.md (or skill.md) and extract its version from
   * YAML frontmatter. Returns null when no file exists or no version
   * field is found.
   */
  extractLocalVersion(skillPath) {
    const candidates = [
      path.join(skillPath, 'SKILL.md'),
      path.join(skillPath, 'skill.md')
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return this._extractVersion(fs.readFileSync(p, 'utf-8'));
      }
    }
    return null;
  }

  /**
   * Parse a `version: x.y.z` line out of the YAML frontmatter of a
   * SKILL.md text blob. Pure string operation; exported so that the
   * update-checker can reuse it on content it fetched via git show.
   */
  _extractVersion(content) {
    if (!content.startsWith('---')) return null;
    const fmEnd = content.indexOf('---', 3);
    if (fmEnd === -1) return null;
    const fm = content.slice(3, fmEnd);
    const match = fm.match(/version:\s*['"]?([^\s'"]+)/);
    return match ? match[1] : null;
  }
}

module.exports = { GitSkillReader };
