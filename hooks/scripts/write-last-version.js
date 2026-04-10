/**
 * write-last-version.js — Record the current SkillCompass version to the
 * sidecar so the SessionStart onboarding trigger (session-tracker.js)
 * knows not to fire again until the package version changes.
 *
 * Called from the Post-Install Onboarding Step 4 after the user has
 * been shown the finish message. Idempotent and silent on failure:
 * the onboarding flow must complete even if the sidecar directory
 * cannot be created or written.
 */

const fs = require('node:fs');
const path = require('node:path');

const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();

try {
  const pkgPath = path.join(baseDir, 'package.json');
  const versionFile = path.join(baseDir, '.skill-compass', 'cc', 'last-version');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  fs.mkdirSync(path.dirname(versionFile), { recursive: true });
  fs.writeFileSync(versionFile, pkg.version);
} catch {
  // Non-critical — silent failure is intentional.
}
