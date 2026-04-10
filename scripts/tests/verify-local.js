#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function listJsFiles(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".js"))
    .map((entry) => path.join(dir, entry.name));
}

function runNodeSyntaxCheck(file) {
  const result = spawnSync(process.execPath, ["-c", file], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`Syntax check failed for ${file}`);
  }

  console.log(`syntax ok: ${file}`);
}

function runSmokeTest() {
  const fixturePath = "test-fixtures/benign-normal-skill/SKILL.md";
  const { SecurityValidator } = require(path.resolve("lib/security-validator.js"));
  const result = new SecurityValidator().validate(fixturePath);

  if (!result.pass) {
    throw new Error(`Security smoke test failed for ${fixturePath}`);
  }

  console.log(`smoke ok: ${fixturePath}`);
}

function runSelfHostingChecks() {
  const skillPath = "SKILL.md";
  const { TriggerValidator } = require(path.resolve("lib/trigger-validator.js"));
  const { SecurityValidator } = require(path.resolve("lib/security-validator.js"));
  const { StructureValidator } = require(path.resolve("lib/structure-validator.js"));

  const triggerResult = new TriggerValidator().validate(skillPath);
  if (triggerResult.trigger_type !== "command") {
    throw new Error(`Trigger validator misclassified repo skill as ${triggerResult.trigger_type}`);
  }
  if (triggerResult.score < 8) {
    throw new Error(`Trigger validator scored repo skill too low: ${triggerResult.score}`);
  }

  const securityResult = new SecurityValidator().validate(skillPath);
  if (!securityResult.pass) {
    throw new Error(`Security validator falsely failed repo skill: ${securityResult.details}`);
  }
  if (securityResult.max !== 10 || typeof securityResult.details !== "string") {
    throw new Error("Security validator output is missing required contract fields.");
  }
  if (!Array.isArray(securityResult.tools_used) || !securityResult.tools_used.includes("builtin")) {
    throw new Error("Security validator must report builtin tools_used.");
  }
  const invalidFinding = (securityResult.findings || []).find(
    (finding) =>
      !finding.source ||
      !["critical", "high", "medium", "low"].includes(finding.severity),
  );
  if (invalidFinding) {
    throw new Error(`Security validator finding contract invalid: ${JSON.stringify(invalidFinding)}`);
  }

  const structureResult = new StructureValidator().validate(skillPath);
  const htmlUsageIssue = structureResult.checks?.format?.issues?.find(
    (issue) => issue.check === "html_usage",
  );
  if (htmlUsageIssue) {
    throw new Error(`Structure validator reported false HTML usage: ${htmlUsageIssue.description}`);
  }

  const scanResult = spawnSync(process.execPath, ["hooks/scripts/pre-eval-scan.js", skillPath], {
    encoding: "utf8",
  });
  if (scanResult.status !== 0) {
    throw new Error(`Pre-eval scan failed for repo skill: ${scanResult.stderr || scanResult.stdout}`);
  }

  console.log(`self-hosting ok: ${skillPath}`);
}

function runStaticScanHygieneChecks() {
  const hygieneTargets = [
    "lib/pre-eval-scan.js",
    path.join("hooks", "scripts", "eval-gate.js"),
    path.join("hooks", "scripts", "output-guard.js"),
  ];
  const forbiddenLiteral = /\bcurl\b|\bwget\b|network|axios|requests\.|fetch\(/i;

  for (const file of hygieneTargets) {
    const content = fs.readFileSync(file, "utf-8");
    const hit = content.match(forbiddenLiteral);
    if (hit) {
      throw new Error(`Static-scan hygiene failed for ${file}: found "${hit[0]}"`);
    }
  }

  console.log(`static-scan hygiene ok: ${hygieneTargets.length} files`);
}

function runPreEvalFixtureChecks() {
  const cases = [
    {
      fixturePath: "test-fixtures/benign-with-code-blocks/SKILL.md",
      expectedExitCode: 0,
      expectedText: "[RESULT] Security scan PASSED",
    },
    {
      fixturePath: "test-fixtures/malicious-curl-pipe/SKILL.md",
      expectedExitCode: 2,
      expectedText: "Pipe remote script to shell",
    },
    {
      fixturePath: "test-fixtures/malicious-base64-exfil/SKILL.md",
      expectedExitCode: 2,
      expectedText: "[BLOCK] malicious_code:",
    },
    {
      fixturePath: "test-fixtures/malicious-ascii-smuggling/SKILL.md",
      expectedExitCode: 2,
      expectedText: "Unicode Tag characters detected (ASCII smuggling)",
    },
  ];

  for (const testCase of cases) {
    const scanResult = spawnSync(process.execPath, ["hooks/scripts/pre-eval-scan.js", testCase.fixturePath], {
      encoding: "utf8",
    });
    const combinedOutput = `${scanResult.stdout || ""}\n${scanResult.stderr || ""}`;

    if (scanResult.status !== testCase.expectedExitCode) {
      throw new Error(
        `Pre-eval fixture check failed for ${testCase.fixturePath}: expected exit ${testCase.expectedExitCode}, got ${scanResult.status}`,
      );
    }
    if (!combinedOutput.includes(testCase.expectedText)) {
      throw new Error(
        `Pre-eval fixture check failed for ${testCase.fixturePath}: missing "${testCase.expectedText}"`,
      );
    }
  }

  console.log(`pre-eval fixtures ok: ${cases.length} cases`);
}

function createHookPayload(filePath) {
  return JSON.stringify({
    tool_input: { file_path: filePath },
  });
}

function runHook(scriptPath, filePath, env = {}) {
  return spawnSync(process.execPath, [scriptPath], {
    input: createHookPayload(filePath),
    encoding: "utf8",
    env: {
      ...process.env,
      ...env,
    },
  });
}

function runNonGitSidecarChecks() {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), "skillcompass-non-git-"));
  const homeDir = path.join(tempRoot, "home");
  const outerDir = path.join(tempRoot, "external-skill");
  const skillDir = path.join(outerDir, "demo-skill");
  const skillPath = path.join(skillDir, "SKILL.md");
  const sidecarRoot = path.join(homeDir, ".skill-compass");
  const manifestPath = path.join(sidecarRoot, "demo-skill", "manifest.json");
  const snapshotPath = path.join(sidecarRoot, "demo-skill", "snapshots", "1.0.0.md");
  const localSidecarRoot = path.join(skillDir, ".skill-compass");

  fs.mkdirSync(skillDir, { recursive: true });
  fs.mkdirSync(homeDir, { recursive: true });
  fs.writeFileSync(
    skillPath,
    [
      "---",
      "name: demo-skill",
      "description: Non-git regression fixture for local hooks.",
      "---",
      "",
      "This fixture keeps enough body text to avoid structure warnings.",
      "It is used to verify non-git sidecar placement and baseline lookup.",
      "",
    ].join("\n"),
  );

  const hookEnv = {
    HOME: homeDir,
    USERPROFILE: homeDir,
    HOMEDRIVE: path.parse(homeDir).root.replace(/[\\/]$/, ""),
    HOMEPATH: homeDir.slice(path.parse(homeDir).root.length - 1),
  };

  const postEdit = runHook(path.join("hooks", "scripts", "post-skill-edit.js"), skillPath, hookEnv);
  if (postEdit.status !== 0) {
    throw new Error(`post-skill-edit failed in non-git test: ${postEdit.stderr || postEdit.stdout}`);
  }
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`post-skill-edit did not create manifest under homedir: ${manifestPath}`);
  }
  if (!fs.existsSync(snapshotPath)) {
    throw new Error(`post-skill-edit did not create initial snapshot under homedir: ${snapshotPath}`);
  }
  if (fs.existsSync(localSidecarRoot)) {
    throw new Error("post-skill-edit unexpectedly created .skill-compass inside the skill directory");
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  if (manifest.versions?.[0]?.dimension_scores !== null) {
    throw new Error("post-skill-edit manifest is missing the null dimension_scores field");
  }
  if (!manifest.upstream_origin || manifest.upstream_origin.source !== "unknown") {
    throw new Error("post-skill-edit manifest is missing upstream_origin metadata");
  }

  manifest.versions[0].overall_score = 91;
  manifest.versions[0].verdict = "PASS";
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  const evalGate = runHook(path.join("hooks", "scripts", "eval-gate.js"), skillPath, hookEnv);
  if (evalGate.status !== 0) {
    throw new Error(`eval-gate failed in non-git test: ${evalGate.stderr || evalGate.stdout}`);
  }
  if (!evalGate.stderr.includes("Previous version scored 91/100 (PASS)")) {
    throw new Error("eval-gate did not read baseline data from the homedir sidecar manifest");
  }

  const cachePath = path.join(sidecarRoot, ".gate-cache.json");
  if (!fs.existsSync(cachePath)) {
    throw new Error("eval-gate did not write throttle cache under the homedir sidecar root");
  }
  if (fs.existsSync(path.join(localSidecarRoot, ".gate-cache.json"))) {
    throw new Error("eval-gate unexpectedly wrote throttle cache inside the skill directory");
  }

  console.log("non-git sidecar ok: post-skill-edit + eval-gate");
}

function runOpenClawEventFlowChecks() {
  const result = spawnSync(process.execPath, ["scripts/tests/verify-oc-event-flow.js"], {
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status !== 0) {
    throw new Error(`OpenClaw event-flow checks failed with exit ${result.status}`);
  }
}

function main() {
  const filesToCheck = [
    ...listJsFiles("lib"),
    ...listJsFiles(path.join("hooks", "scripts")),
  ];

  if (filesToCheck.length === 0) {
    throw new Error("No JS files found for local verification.");
  }

  for (const file of filesToCheck) {
    runNodeSyntaxCheck(file);
  }

  runSmokeTest();
  runSelfHostingChecks();
  runStaticScanHygieneChecks();
  runPreEvalFixtureChecks();
  runNonGitSidecarChecks();
  runOpenClawEventFlowChecks();
  console.log(`verified ${filesToCheck.length} JS files, 1 fixture smoke test, repo self-hosting contracts, static-scan hygiene, pre-eval fixtures, non-git sidecar hooks, and OpenClaw event-flow checks`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
