#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

const INCLUDED_PATHS = [
  ".claude-plugin",
  "commands",
  "hooks",
  "lib",
  "prompts",
  "schemas",
  "shared",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "README.md",
  "SECURITY.md",
  "SKILL.md",
  "package.json",
  "package-lock.json",
];

function parseArgs(argv) {
  const options = {
    outDir: path.join(repoRoot, "clawhub-canary-upload"),
    notePath: path.join(repoRoot, "clawhub-canary-publish.txt"),
    slug: "skill-compass-canary",
    name: "SkillCompass Canary (Internal)",
    tags: "canary",
    verify: true,
    configPath: "%TEMP%\\clawhub-canary.json",
    version: null,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out-dir") {
      options.outDir = path.resolve(repoRoot, argv[++i]);
    } else if (arg === "--note-path") {
      options.notePath = path.resolve(repoRoot, argv[++i]);
    } else if (arg === "--slug") {
      options.slug = argv[++i];
    } else if (arg === "--name") {
      options.name = argv[++i];
    } else if (arg === "--version") {
      options.version = argv[++i];
    } else if (arg === "--tags") {
      options.tags = argv[++i];
    } else if (arg === "--config-path") {
      options.configPath = argv[++i];
    } else if (arg === "--skip-verify") {
      options.verify = false;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return options;
}

function runClawhubVerify() {
  const result = spawnSync(process.execPath, [path.join("scripts", "tests", "verify-clawhub.js")], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("verify:clawhub failed; refusing to prepare canary package");
  }
}

function ensureParentDir(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function copyRecursive(sourcePath, targetPath) {
  const stat = fs.statSync(sourcePath);

  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const entry of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, entry), path.join(targetPath, entry));
    }
    return;
  }

  ensureParentDir(targetPath);
  fs.copyFileSync(sourcePath, targetPath);
}

function createCleanOutput(outDir) {
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  for (const relativePath of INCLUDED_PATHS) {
    const sourcePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing expected release path: ${relativePath}`);
    }
    copyRecursive(sourcePath, path.join(outDir, relativePath));
  }
}

function resolveCanaryVersion(options) {
  const envVersion = process.env.SKILLCOMPASS_CANARY_VERSION || process.env.SKILL_COMPASS_CANARY_VERSION;
  const version = options.version || envVersion || null;

  if (!version) {
    throw new Error(
      "Canary version is required. Pass --version 1.0.5-canary.1 or set SKILLCOMPASS_CANARY_VERSION."
    );
  }

  return version;
}

function writeManifestNote(outDir, options, version) {
  const notePath = options.notePath;
  const lines = [
    "ClawHub canary publish checklist",
    "",
    `Prepared from: ${repoRoot}`,
    `Output dir: ${outDir}`,
    `Note file: ${notePath}`,
    `Slug: ${options.slug}`,
    `Name: ${options.name}`,
    `Version: ${version}`,
    `Tags: ${options.tags}`,
    "",
    "Suggested publish command (PowerShell, current logged-in profile):",
    `clawhub.cmd publish "${outDir}" --slug ${options.slug} --name "${options.name}" --version ${version} --changelog "internal canary validation" --tags ${options.tags}`,
    "",
    "Suggested publish command (PowerShell, isolated canary profile):",
    `$env:CLAWHUB_CONFIG_PATH = \"$env:TEMP\\clawhub-canary.json\"`,
    `clawhub.cmd publish "${outDir}" --slug ${options.slug} --name "${options.name}" --version ${version} --changelog "internal canary validation" --tags ${options.tags}`,
    "",
    "Suggested publish command (Windows cmd):",
    `set CLAWHUB_CONFIG_PATH=${options.configPath}`,
    `clawhub.cmd publish "${outDir}" --slug ${options.slug} --name "${options.name}" --version ${version} --changelog "internal canary validation" --tags ${options.tags}`,
    "",
    "Notes:",
    "- In PowerShell, use clawhub.cmd instead of clawhub to avoid execution-policy errors on clawhub.ps1.",
    "- Version is intentionally required for canary publishes; do not rely on the repo's local 1.0.0 metadata.",
    "- Reuse the same canary slug every time to avoid cluttering search results.",
    "- The publish bundle intentionally excludes optional example guides to keep the platform artifact focused on runtime files.",
    "- ClawHub tags apply per slug; the canary slug may still receive its own latest tag.",
    "- After validation, hide the canary entry: clawhub.cmd hide skill-compass-canary --yes",
    "- Delete or update the canary entry after review if needed.",
  ];
  fs.mkdirSync(path.dirname(notePath), { recursive: true });
  fs.writeFileSync(notePath, `${lines.join("\n")}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.verify) {
    runClawhubVerify();
  }

  createCleanOutput(options.outDir);
  const version = resolveCanaryVersion(options);
  writeManifestNote(options.outDir, options, version);

  console.log(`canary package prepared: ${options.outDir}`);
  console.log(`slug: ${options.slug}`);
  console.log(`name: ${options.name}`);
  console.log(`version: ${version}`);
  console.log(`tags: ${options.tags}`);
  console.log(`note: ${options.notePath}`);
  console.log("");
  console.log("Suggested next step (PowerShell):");
  console.log(`  clawhub.cmd publish "${options.outDir}" --slug ${options.slug} --name "${options.name}" --version ${version} --changelog "internal canary validation" --tags ${options.tags}`);
  console.log("");
  console.log("Suggested isolated-profile variant:");
  console.log(`  $env:CLAWHUB_CONFIG_PATH = "$env:TEMP\\clawhub-canary.json"`);
  console.log(
    `  clawhub.cmd publish "${options.outDir}" --slug ${options.slug} --name "${options.name}" --version ${version} --changelog "internal canary validation" --tags ${options.tags}`,
  );
  console.log("");
  console.log("After validation:");
  console.log(`  clawhub.cmd hide ${options.slug} --yes`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
