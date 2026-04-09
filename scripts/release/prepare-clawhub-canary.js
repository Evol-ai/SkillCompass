#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

function runGitCommand(args) {
  const result = spawnSync("git", args, {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim() || result.stdout.trim()}`);
  }

  return result.stdout.trim();
}

function getSourceMetadata() {
  const repoUrl = runGitCommand(["remote", "get-url", "origin"]);
  const commit = runGitCommand(["rev-parse", "HEAD"]);
  const ref = runGitCommand(["rev-parse", "--abbrev-ref", "HEAD"]);

  let repo = repoUrl;
  const githubMatch = repoUrl.match(/github\.com[:/](.+?)(?:\.git)?$/i);
  if (githubMatch) {
    repo = githubMatch[1];
  }

  return { repo, commit, ref, path: "." };
}

// CC profile: Claude Code skill (commands, hooks, SKILL.md).
const CC_PATHS = [
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

// OC profile: OpenClaw plugin (compiled TS + shared libs, no CC-specific code).
// oc/package.json is copied to the artifact root as package.json.
const OC_PATHS = [
  "oc/dist",
  "lib",
  "prompts",
  "schemas",
  "shared",
  "CHANGELOG.md",
  "CONTRIBUTING.md",
  "LICENSE",
  "SECURITY.md",
];

function parseArgs(argv) {
  const options = {
    outDir: path.join(repoRoot, "clawhub-canary-upload"),
    notePath: path.join(repoRoot, "clawhub-canary-publish.txt"),
    profile: "cc",
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
    } else if (arg === "--profile") {
      options.profile = argv[++i];
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

function createCleanOutput(outDir, options, version) {
  const profile = options.profile;
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const paths = profile === "oc" ? OC_PATHS : CC_PATHS;
  for (const relativePath of paths) {
    const sourcePath = path.join(repoRoot, relativePath);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing expected release path: ${relativePath}`);
    }
    copyRecursive(sourcePath, path.join(outDir, relativePath));
  }

  // OC packages need a root package manifest plus openclaw.plugin.json.
  if (profile === "oc") {
    const ocReadmeTemplate = path.join(repoRoot, "oc", "README.clawhub.md");
    const ocUnsafeSharedFiles = [
      path.join(outDir, "lib", "update-checker.js"),
    ];
    for (const unsafeFile of ocUnsafeSharedFiles) {
      if (fs.existsSync(unsafeFile)) {
        fs.rmSync(unsafeFile, { force: true });
      }
    }

    const ocPkg = path.join(repoRoot, "oc", "package.json");
    const ocPluginManifest = path.join(repoRoot, "oc", "openclaw.plugin.json");
    if (!fs.existsSync(ocReadmeTemplate)) {
      throw new Error("Missing oc/README.clawhub.md for OC profile");
    }
    if (!fs.existsSync(ocPkg)) {
      throw new Error("Missing oc/package.json for OC profile");
    }
    if (!fs.existsSync(ocPluginManifest)) {
      throw new Error("Missing oc/openclaw.plugin.json for OC profile");
    }

    const pkg = JSON.parse(fs.readFileSync(ocPkg, "utf-8"));
    if (options.slug) pkg.name = options.slug;
    if (options.name) pkg.displayName = options.name;
    if (version) pkg.version = version;
    if (Array.isArray(pkg.openclaw?.extensions)) {
      pkg.openclaw.extensions = pkg.openclaw.extensions.map((entry) => {
        const normalized = String(entry || "").replace(/^\.?\//, "");
        return `./oc/${normalized}`;
      });
    }
    if (pkg.main) pkg.main = `oc/${pkg.main}`;
    if (pkg.types) pkg.types = `oc/${pkg.types}`;
    delete pkg.scripts;
    delete pkg.devDependencies;
    fs.writeFileSync(path.join(outDir, "package.json"), JSON.stringify(pkg, null, 2));
    fs.copyFileSync(ocPluginManifest, path.join(outDir, "openclaw.plugin.json"));
    const readme = fs
      .readFileSync(ocReadmeTemplate, "utf-8")
      .replace(/__PACKAGE_NAME__/g, options.slug)
      .replace(/__PACKAGE_VERSION__/g, version);
    fs.writeFileSync(path.join(outDir, "README.md"), readme);
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

function buildPublishCommand(outDir, options, version, source) {
  if (options.profile === "oc") {
    return [
      `clawhub.cmd package publish "${outDir}"`,
      "--family code-plugin",
      `--name ${options.slug}`,
      `--display-name "${options.name}"`,
      `--version ${version}`,
      `--changelog "internal canary validation"`,
      `--tags ${options.tags}`,
      `--source-repo ${source.repo}`,
      `--source-commit ${source.commit}`,
      `--source-ref ${source.ref}`,
      `--source-path ${source.path}`,
    ].join(" ");
  }

  return `clawhub.cmd publish "${outDir}" --slug ${options.slug} --name "${options.name}" --version ${version} --changelog "internal canary validation" --tags ${options.tags}`;
}

function writeManifestNote(outDir, options, version, source) {
  const notePath = options.notePath;
  const publishCommand = buildPublishCommand(outDir, options, version, source);
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
    ...(options.profile === "oc"
      ? [
          `Source repo: ${source.repo}`,
          `Source commit: ${source.commit}`,
          `Source ref: ${source.ref}`,
        ]
      : []),
    "",
    "Suggested publish command (PowerShell, current logged-in profile):",
    publishCommand,
    "",
    "Suggested publish command (PowerShell, isolated canary profile):",
    `$env:CLAWHUB_CONFIG_PATH = \"$env:TEMP\\clawhub-canary.json\"`,
    publishCommand,
    "",
    "Suggested publish command (Windows cmd):",
    `set CLAWHUB_CONFIG_PATH=${options.configPath}`,
    publishCommand,
    "",
    "Notes:",
    "- In PowerShell, use clawhub.cmd instead of clawhub to avoid execution-policy errors on clawhub.ps1.",
    "- Version is intentionally required for canary publishes; do not rely on the repo's local metadata.",
    "- Reuse the same canary slug every time to avoid cluttering search results.",
    "- The publish bundle intentionally excludes optional example guides to keep the artifact focused on runtime files.",
    "- ClawHub tags apply per slug; the canary slug may still receive its own latest tag.",
    `- After validation, hide the canary entry: clawhub.cmd hide ${options.slug} --yes`,
    "- Delete or update the canary entry after review if needed.",
  ];
  fs.mkdirSync(path.dirname(notePath), { recursive: true });
  fs.writeFileSync(notePath, `${lines.join("\n")}\n`);
}

function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.profile === "oc") {
    if (options.slug === "skill-compass-canary") options.slug = "skillcompass-oc-canary";
    if (options.name === "SkillCompass Canary (Internal)") options.name = "SkillCompass OC Canary (Internal)";
    if (options.outDir === path.join(repoRoot, "clawhub-canary-upload")) {
      options.outDir = path.join(repoRoot, "clawhub-oc-canary-upload");
    }
  }

  if (options.verify) {
    runClawhubVerify();
  }

  const source = getSourceMetadata();
  const version = resolveCanaryVersion(options);
  createCleanOutput(options.outDir, options, version);
  writeManifestNote(options.outDir, options, version, source);
  const publishCommand = buildPublishCommand(options.outDir, options, version, source);

  console.log(`canary package prepared: ${options.outDir}`);
  console.log(`slug: ${options.slug}`);
  console.log(`name: ${options.name}`);
  console.log(`version: ${version}`);
  console.log(`tags: ${options.tags}`);
  console.log(`note: ${options.notePath}`);
  console.log("");
  console.log("Suggested next step (PowerShell):");
  console.log(`  ${publishCommand}`);
  console.log("");
  console.log("Suggested isolated-profile variant:");
  console.log('  $env:CLAWHUB_CONFIG_PATH = "$env:TEMP\\clawhub-canary.json"');
  console.log(`  ${publishCommand}`);
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
