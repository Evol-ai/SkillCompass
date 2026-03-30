#!/usr/bin/env node

const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

function runNode(file, args = [], options = {}) {
  return spawnSync(process.execPath, [file, ...args], {
    encoding: "utf8",
    ...options,
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runStaticScanHygieneChecks() {
  const riskyFiles = [
    "lib/pre-eval-scan.js",
    path.join("hooks", "scripts", "eval-gate.js"),
    path.join("hooks", "scripts", "output-guard.js"),
  ];
  const fsReadPattern = /\breadFile(?:Sync)?\b/;
  const forbiddenLiteral = /\bcurl\b|\bwget\b|network|axios|requests\.|fetch\(/i;

  for (const file of riskyFiles) {
    const content = fs.readFileSync(file, "utf8");
    const hasFsRead = fsReadPattern.test(content);
    const literalHit = content.match(forbiddenLiteral);

    if (literalHit) {
      throw new Error(`ClawHub hygiene failed for ${file}: found literal "${literalHit[0]}"`);
    }

    if (hasFsRead && literalHit) {
      throw new Error(`ClawHub hygiene failed for ${file}: fs-read + network literal co-occur`);
    }
  }

  const patternsModule = require(path.resolve("lib/pre-eval-patterns.js"));
  assert(
    Array.isArray(patternsModule.PRE_EVAL_MALICIOUS_PATTERNS) &&
      patternsModule.PRE_EVAL_MALICIOUS_PATTERNS.length > 0,
    "pre-eval malicious patterns are missing",
  );
  assert(
    Array.isArray(patternsModule.PRE_EVAL_EXFIL_PATTERNS) &&
      patternsModule.PRE_EVAL_EXFIL_PATTERNS.length > 0,
    "pre-eval exfil patterns are missing",
  );

  console.log(`clawhub hygiene ok: ${riskyFiles.length} risky files + split pattern module`);
}

function runOpenClawSignalChecks() {
  const packageFacingFiles = [
    "SKILL.md",
    "SECURITY.md",
    "commands/eval-improve.md",
    "commands/eval-evolve.md",
    "README.md",
    "hooks/scripts/eval-gate.js",
    "hooks/scripts/post-skill-edit.js",
  ];

  for (const file of packageFacingFiles) {
    const content = fs.readFileSync(file, "utf8");
    assert(!content.includes("gate-bypass"), `OpenClaw signal check failed for ${file}: found legacy gate-bypass wording`);
  }

  const prepareScript = fs.readFileSync("scripts/release/prepare-clawhub-canary.js", "utf8");
  assert(!prepareScript.includes('"examples"'), "Canary prepare script should exclude optional examples from the publish bundle");
  assert(prepareScript.includes("optional example guides"), "Canary prepare script should explain why examples are excluded");

  console.log(`openclaw signal checks ok: ${packageFacingFiles.length} package-facing files + canary bundle policy`);
}

function runPreEvalCanaries() {
  const cases = [
    {
      fixturePath: "SKILL.md",
      expectedExitCode: 0,
      expectedText: "[RESULT] Security scan PASSED",
      label: "repo-skill",
    },
    {
      fixturePath: "test-fixtures/benign-with-code-blocks/SKILL.md",
      expectedExitCode: 0,
      expectedText: "[RESULT] Security scan PASSED",
      label: "benign-docs",
    },
    {
      fixturePath: "test-fixtures/malicious-curl-pipe/SKILL.md",
      expectedExitCode: 2,
      expectedText: "Pipe remote script to shell",
      label: "malicious-pipe",
    },
    {
      fixturePath: "test-fixtures/malicious-base64-exfil/SKILL.md",
      expectedExitCode: 2,
      expectedText: "[BLOCK] malicious_code:",
      label: "malicious-base64",
    },
    {
      fixturePath: "test-fixtures/malicious-ascii-smuggling/SKILL.md",
      expectedExitCode: 2,
      expectedText: "Unicode Tag characters detected (ASCII smuggling)",
      label: "ascii-smuggling",
    },
  ];

  for (const testCase of cases) {
    const result = runNode("hooks/scripts/pre-eval-scan.js", [testCase.fixturePath]);
    const combinedOutput = `${result.stdout || ""}\n${result.stderr || ""}`;

    assert(
      result.status === testCase.expectedExitCode,
      `Pre-eval canary failed for ${testCase.label}: expected exit ${testCase.expectedExitCode}, got ${result.status}`,
    );
    assert(
      combinedOutput.includes(testCase.expectedText),
      `Pre-eval canary failed for ${testCase.label}: missing "${testCase.expectedText}"`,
    );
  }

  console.log(`pre-eval clawhub canaries ok: ${cases.length} cases`);
}

function writeTempCopy(sourcePath, transform) {
  const content = fs.readFileSync(sourcePath, "utf8");
  const tempFile = path.join(os.tmpdir(), `skillcompass-clawhub-${Date.now()}-${Math.random().toString(16).slice(2)}.md`);
  fs.writeFileSync(tempFile, transform(content));
  return tempFile;
}

function runOutputGuardCanaries() {
  const original = "test-fixtures/benign-normal-skill/SKILL.md";
  const harmlessImproved = writeTempCopy(
    original,
    (content) =>
      `${content.trimEnd()}\n\n## Validation Note\nThis harmless note is used to verify the guard does not block benign edits.\n`,
  );
  const maliciousImproved = "test-fixtures/malicious-curl-pipe/SKILL.md";

  try {
    const benign = runNode("hooks/scripts/output-guard.js", [original, harmlessImproved, "D4 Functional"]);
    assert(benign.status === 0, `Output guard falsely blocked benign edit: ${benign.stderr || benign.stdout}`);
    const benignJson = JSON.parse(benign.stdout);
    assert(benignJson.approved === true, "Output guard did not approve benign edit");

    const malicious = runNode("hooks/scripts/output-guard.js", [original, maliciousImproved, "D3 Security"]);
    assert(malicious.status === 1, "Output guard did not block malicious edit");
    const maliciousJson = JSON.parse(malicious.stdout);
    assert(maliciousJson.approved === false, "Output guard did not mark malicious edit as rejected");
    assert(
      Array.isArray(maliciousJson.findings) &&
        maliciousJson.findings.some((finding) => finding.action === "BLOCK"),
      "Output guard malicious canary is missing a blocking finding",
    );
  } finally {
    fs.rmSync(harmlessImproved, { force: true });
  }

  console.log("output-guard clawhub canaries ok: benign pass + malicious block");
}

function main() {
  runStaticScanHygieneChecks();
  runOpenClawSignalChecks();
  runPreEvalCanaries();
  runOutputGuardCanaries();
  console.log("verify:clawhub passed: local static-scan hygiene, pre-eval canaries, and output-guard canaries");
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
