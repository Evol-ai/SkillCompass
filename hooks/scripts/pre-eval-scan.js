#!/usr/bin/env node

const path = require('node:path');
const { scanFile, formatFindings } = require(path.join(__dirname, '..', '..', 'lib', 'pre-eval-scan.js'));

const skillPath = process.argv[2];
if (!skillPath) {
  console.error('[ERROR] File path required');
  process.exit(2);
}

const result = scanFile(skillPath, {
  projectRoot: path.resolve(__dirname, '..', '..'),
});

console.error(formatFindings(result, skillPath));
process.exit(result.exitCode);
