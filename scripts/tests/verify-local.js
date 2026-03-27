#!/usr/bin/env node

const fs = require("fs");
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
  console.log(`verified ${filesToCheck.length} JS files and 1 smoke test`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
