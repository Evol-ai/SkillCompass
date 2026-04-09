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

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function main() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skillcompass-oc-e2e-"));
  try {
    const fixtureRoot = path.join(tempRoot, "fixtures");
    const now = new Date().toISOString();
    const localeDist = path.resolve("oc", "dist", "locale.js");

    process.env.OPENCLAW_PLUGIN_ROOT = tempRoot;

    const pluginDist = path.resolve("oc", "dist", "plugin.js");
    const digestFormatterDist = path.resolve("oc", "dist", "renderers", "digest-formatter.js");
    assert(fs.existsSync(pluginDist), "Missing oc/dist/plugin.js. Run `npm run build:oc` first.");
    assert(fs.existsSync(localeDist), "Missing oc/dist/locale.js. Run `npm run build:oc` first.");
    assert(
      fs.existsSync(digestFormatterDist),
      "Missing oc/dist/renderers/digest-formatter.js. Run `npm run build:oc` first.",
    );

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
    const { detectLocaleFromText, resolveLocale } = require(localeDist);
    const { formatDigest } = require(digestFormatterDist);
    configure({
      config: {
        preferredChannel: "im",
        quietHoursStart: 25,
        quietHoursEnd: 26,
        dailyPushLimit: 99,
        locale: "en-US",
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

    const jaCmdResult = await sc.handler({
      raw: `/sc eval ${nonSecurityFixture} \u8a55\u4fa1\u3057\u3066\u304f\u3060\u3055\u3044`,
      subcommand: "eval",
      args: [nonSecurityFixture],
    });
    assert(
      jaCmdResult.message.includes(
        "\u54c1\u8cea\u4e0a\u306e\u554f\u984c\u304c\u898b\u3064\u304b\u308a\u307e\u3057\u305f",
      ),
      "/sc eval should switch to Japanese when the user message is Japanese, even if config defaults to English.",
    );

    const jaKanjiOnlyResult = await sc.handler({
      raw: `/sc eval ${nonSecurityFixture} \u8a55\u4fa1`,
      subcommand: "eval",
      args: [nonSecurityFixture],
    });
    assert(
      jaKanjiOnlyResult.message.includes(
        "\u54c1\u8cea\u4e0a\u306e\u554f\u984c\u304c\u898b\u3064\u304b\u308a\u307e\u3057\u305f",
      ),
      "/sc eval should treat common Japanese kanji prompts as Japanese.",
    );

    assert(
      detectLocaleFromText("/sc eval foo por favor") === "es",
      "Short Spanish prompts should be detected.",
    );
    assert(
      detectLocaleFromText("/sc eval foo evaluer") === "fr",
      "Short French prompts should be detected.",
    );
    assert(
      detectLocaleFromText("/sc eval foo bitte") === "de",
      "Short German prompts should be detected.",
    );
    assert(
      resolveLocale({ locale: "en-US" }, "/sc eval foo \u8a55\u4fa1") === "ja",
      "Detected user language should override a default English locale.",
    );
    assert(
      resolveLocale({ locale: "en-US" }, "/sc status s'il vous plait rapport suggestion")
        === "fr",
      "Strong Latin-language signals should override a default English locale.",
    );
    assert(
      resolveLocale({ locale: "en-US" }, "/sc eval my-skill ver") === "en",
      "Single Latin-language keywords should not override a configured default locale.",
    );

    const firstSeenAt = new Date(Date.now() - 9 * 86400000).toISOString();
    writeJsonFile(path.join(tempRoot, ".skill-compass", "oc", "inbox.json"), {
      suggestions: [
        {
          id: "sug_never_used",
          rule_id: "never-used",
          skill_name: "stale-skill",
          category: "hygiene",
          priority: "P3",
          reason: "Installed 9 days ago, never invoked",
          evidence: [
            { field: "first_seen_at", value: firstSeenAt },
            { field: "ever_used", value: false },
          ],
          status: "pending",
          created_at: now,
          cooldown_until: null,
        },
      ],
      skill_cache: [],
      meta: { last_digest_at: null },
    });

    const frStatusResult = await sc.handler({
      raw: "/sc status s'il vous plait rapport suggestion",
      subcommand: "status",
      args: [],
    });
    assert(
      frStatusResult.message.includes("jamais invoquee"),
      "/sc status should localize suggestion reasons when the user message is French.",
    );

    const digestResult = formatDigest(
      [
        {
          id: "digest_never_used",
          rule_id: "never-used",
          skill_name: "stale-skill",
          reason: "Installed 9 days ago, never invoked",
          evidence: [
            { field: "first_seen_at", value: firstSeenAt },
            { field: "ever_used", value: false },
          ],
        },
      ],
      1,
      { locale: "fr-FR" },
    );
    assert(
      digestResult.message.includes("jamais invoquee"),
      "Weekly digest should localize suggestion reasons for configured locales.",
    );
    assert(
      digestResult.buttons[0].label === "Traiter #1",
      "Weekly digest buttons should be localized for configured locales.",
    );

    configure({
      config: {
        preferredChannel: "im",
        quietHoursStart: 25,
        quietHoursEnd: 26,
        dailyPushLimit: 99,
        locale: "fr-FR",
      },
      inventory: () => [],
    });

    const beforeConfiguredLocale = announcements.length;
    await onUpdated({
      type: "plugin_updated",
      timestamp: now,
      skillPath: criticalSkillPath,
      skillName: "critical-d3",
    });
    assert(
      announcements.length === beforeConfiguredLocale + 1,
      "Configured non-English locale should still trigger a security push.",
    );
    assert(
      announcements[announcements.length - 1].message.includes("Risque de securite dans critical-d3"),
      "Configured French locale should localize lifecycle security alerts.",
    );

    const weekly = crons.get("skillcompass-weekly");
    await weekly.handler();

    console.log(
      "openclaw event-flow ok: medium-no-push, critical-push, multilingual localization, and cron registration",
    );
  } finally {
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
