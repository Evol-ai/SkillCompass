#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function writeSkillFile(filePath, lines) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${lines.join("\n")}\n`, "utf8");
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skillcompass-oc-e2e-"));
  try {
    const fixtureRoot = path.join(tempRoot, "fixtures");
    const now = new Date().toISOString();

    process.env.OPENCLAW_PLUGIN_ROOT = tempRoot;

    const pluginDist = path.resolve("oc", "dist", "plugin.js");
    assert(fs.existsSync(pluginDist), "Missing oc/dist/plugin.js. Run `npm run build:oc` first.");

    const mediumSkillPath = path.join(fixtureRoot, "medium-d3", "SKILL.md");
    const criticalSkillPath = path.join(fixtureRoot, "critical-d3", "SKILL.md");
    const criticalDirPath = path.join(fixtureRoot, "critical-dir");
    const emptyDirPath = path.join(fixtureRoot, "empty-dir");

    writeSkillFile(mediumSkillPath, [
      "---",
      "name: medium-d3",
      "description: local offline read-only checker",
      "tools:",
      "  - Bash",
      "  - WebFetch",
      "globs:",
      "  - \"**/*\"",
      "---",
      "# Medium D3 fixture",
      "Path example ../../tmp for docs.",
      "Another traversal ../../home.",
    ]);

    writeSkillFile(criticalSkillPath, [
      "---",
      "name: critical-d3",
      "description: fixture with hardcoded credential leak",
      "---",
      "# Critical D3 fixture",
      "postgresql://admin:supersecret@db.example.com/prod",
    ]);

    writeSkillFile(path.join(criticalDirPath, "SKILL.md"), [
      "---",
      "name: critical-dir",
      "description: fixture where event path is directory",
      "---",
      "# Critical Dir fixture",
      "mysql://root:topsecret@db.example.com/prod",
    ]);
    fs.mkdirSync(emptyDirPath, { recursive: true });

    const hooks = new Map();
    const commands = new Map();
    const crons = new Map();
    const announcements = [];

    const fakeApi = {
      registerHook(event, handler) {
        hooks.set(event, handler);
      },
      registerCommand(options) {
        commands.set(options.name, options);
      },
      cron: {
        register(options) {
          crons.set(options.name, options);
        },
      },
      channels: {
        async announce(payload) {
          announcements.push(payload);
        },
      },
    };

    const { register, configure } = require(pluginDist);
    configure({
      config: {
        preferredChannel: "im",
        quietHoursStart: 25,
        quietHoursEnd: 26,
        dailyPushLimit: 99,
      },
      inventory: () => [],
    });
    register(fakeApi);

    assert(hooks.has("plugin_installed"), "plugin_installed hook was not registered.");
    assert(hooks.has("plugin_updated"), "plugin_updated hook was not registered.");
    assert(commands.has("sc"), "/sc command was not registered.");
    assert(crons.has("skillcompass-weekly"), "weekly digest cron was not registered.");

    const onInstalled = hooks.get("plugin_installed");
    const onUpdated = hooks.get("plugin_updated");

    const beforeMedium = announcements.length;
    await onInstalled({
      type: "plugin_installed",
      timestamp: now,
      skillPath: mediumSkillPath,
      skillName: "medium-d3",
    });
    assert(
      announcements.length === beforeMedium,
      "Medium-only D3 unexpectedly triggered a security push.",
    );

    const beforeCritical = announcements.length;
    await onInstalled({
      type: "plugin_installed",
      timestamp: now,
      skillPath: criticalSkillPath,
      skillName: "critical-d3",
    });
    assert(
      announcements.length === beforeCritical + 1,
      "Critical/high D3 did not trigger a security push.",
    );
    assert(
      announcements[announcements.length - 1].message.includes("Security risk in critical-d3"),
      "Critical D3 push message is missing expected skill name.",
    );

    const beforeDir = announcements.length;
    await onUpdated({
      type: "plugin_updated",
      timestamp: now,
      skillPath: criticalDirPath,
      skillName: "critical-dir",
    });
    assert(
      announcements.length === beforeDir + 1,
      "Directory skillPath with SKILL.md did not trigger expected security push.",
    );
    assert(
      announcements[announcements.length - 1].message.includes("Security risk in critical-dir"),
      "Directory skillPath push message is missing expected skill name.",
    );

    const beforeEmpty = announcements.length;
    await onInstalled({
      type: "plugin_installed",
      timestamp: now,
      skillPath: emptyDirPath,
      skillName: "empty-dir",
    });
    assert(
      announcements.length === beforeEmpty,
      "Directory without SKILL.md should not trigger a push.",
    );

    const sc = commands.get("sc");
    const nonSecurityFixture = path.resolve("test-fixtures", "d1-broken-structure", "SKILL.md");
    const cmdResult = await sc.handler({
      raw: `/sc eval ${nonSecurityFixture}`,
      subcommand: "eval",
      args: [nonSecurityFixture],
    });
    assert(
      cmdResult.message.includes("Quality issues detected (not security)"),
      "/sc eval classification regressed for non-security high-risk fixture.",
    );

    const weekly = crons.get("skillcompass-weekly");
    await weekly.handler();

    console.log(
      "openclaw event-flow ok: medium-no-push, critical-push, directory-resolution, command classification, and cron registration",
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
