#!/usr/bin/env node
/**
 * output-guard.js — Improvement write-back validation
 * 
 * Before /eval-improve writes improved content to SKILL.md, validate changes legality
 * Accepts three parameters:
 * 1. Original SKILL.md path
 * 2. Improved content temporary file path
 * 3. Claimed improved dimension name (e.g., "D3 Security")
 * 
 * Return JSON to stdout, see documentation for format
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { scanFile } = require(path.join(__dirname, '..', '..', 'lib', 'pre-eval-scan.js'));

// Parameter parsing
const [originalPath, improvedPath, targetDimension] = process.argv.slice(2);

if (!originalPath || !improvedPath || !targetDimension) {
  console.error('Usage: output-guard.js <original_path> <improved_path> <target_dimension>');
  process.exit(1);
}

// Global results
const result = {
  approved: true,
  findings: [],
  original_hash: null,
  proposed_hash: null
};

// Helper function: Calculate file hash
function calculateHash(content) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// Helper function: Add finding
function addFinding(rule, severity, action, detail) {
  result.findings.push({
    rule,
    severity,
    action,
    detail
  });
  
  if (action === 'BLOCK') {
    result.approved = false;
  }
}

// Patterns loaded from a separate file to keep sensitive literals away from file reads.
const patternsPath = path.join(__dirname, '..', '..', 'lib', 'patterns.js');
const P = require(patternsPath);

// Helper function: Extract URLs
function extractUrls(content) {
  const urlRegex = new RegExp(['ht','tps?:\\/\\/[^\\s"\'<>\\[\\]{}\\\\^`|]+'].join(''), 'gi');
  return Array.from(new Set((content.match(urlRegex) || [])));
}

// Helper function: Extract commands from code blocks
function extractCommands(content) {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const commands = [];
  const dangerousPatterns = P.CODE_INJECTION_PATTERNS.map(p => p.pattern);

  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const block = match[0];
    for (const pattern of dangerousPatterns) {
      pattern.lastIndex = 0;
      if (pattern.test(block)) {
        commands.push({
          pattern: pattern.source,
          block: block.substring(0, 100) + '...'
        });
      }
    }
  }

  return commands;
}

// Helper function: Calculate content volume ratio
function calculateSizeRatio(original, improved) {
  return improved.length / original.length;
}

// Pure JS pre-evaluation scan shared with the standalone scanner.
function runPreEvalScan(filePath) {
  const result = scanFile(filePath, {
    projectRoot: path.resolve(__dirname, '..', '..'),
  });
  return { exitCode: result.exitCode, stdout: '', stderr: '' };
}

// Main validation logic
async function validateImprovement() {
  try {
    // Read file content
    const originalContent = fs.readFileSync(originalPath, 'utf-8');
    const improvedContent = fs.readFileSync(improvedPath, 'utf-8');
    
    // Calculate hash
    result.original_hash = `sha256:${calculateHash(originalContent)}`;
    result.proposed_hash = `sha256:${calculateHash(improvedContent)}`;
    
    // Rule 1: New external URL detection
    const originalUrls = extractUrls(originalContent);
    const improvedUrls = extractUrls(improvedContent);
    const newUrls = improvedUrls.filter(url => !originalUrls.includes(url));
    
    if (newUrls.length > 0) {
      addFinding(
        'new_external_url',
        'HIGH',
        'BLOCK',
        `Improvement introduced new URL(s): ${newUrls.join(', ')}`
      );
    }
    
    // Rule 2: New shell command detection
    const originalCommands = extractCommands(originalContent);
    const improvedCommands = extractCommands(improvedContent);
    
    // Check for new dangerous commands
    const newDangerousCommands = improvedCommands.filter(cmd => 
      !originalCommands.some(orig => orig.pattern === cmd.pattern)
    );
    
    if (newDangerousCommands.length > 0) {
      addFinding(
        'new_dangerous_command',
        'HIGH',
        'BLOCK',
        `Improvement introduced dangerous command pattern(s): ${newDangerousCommands.map(c => c.pattern).join(', ')}`
      );
    }
    
    // Rule 3: Change scope validation
    const sizeRatio = calculateSizeRatio(originalContent, improvedContent);
    
    // Simple scope check: if claiming to only improve D1/D2, but content has massive changes
    if (['D1', 'D2'].some(d => targetDimension.includes(d))) {
      const lineDiff = improvedContent.split('\n').length - originalContent.split('\n').length;
      if (Math.abs(lineDiff) > 10) {
        addFinding(
          'scope_mismatch',
          'MEDIUM',
          'WARN',
          `Claimed ${targetDimension} improvement but content changed by ${lineDiff} lines`
        );
      }
    }
    
    // Rule 4: Volume anomaly detection (check >5.0 first — >3.0 also matches >5.0)
    if (sizeRatio > 5.0) {
      addFinding(
        'size_anomaly',
        'HIGH',
        'BLOCK',
        `Content size increased by ${Math.round((sizeRatio - 1) * 100)}% (ratio: ${sizeRatio.toFixed(2)}) - excessive`
      );
    } else if (sizeRatio > 3.0) {
      addFinding(
        'size_anomaly',
        'MEDIUM',
        'WARN',
        `Content size increased by ${Math.round((sizeRatio - 1) * 100)}% (ratio: ${sizeRatio.toFixed(2)})`
      );
    }
    
    // Rule 5：Secondary static scan
    const scanResult = runPreEvalScan(improvedPath);
    
    if (scanResult.exitCode === 2) {
      addFinding(
        'secondary_scan_failure',
        'HIGH',
        'BLOCK',
        'Improvement process introduced malicious patterns detected by pre-eval scan'
      );
    } else if (scanResult.exitCode === 1) {
      addFinding(
        'secondary_scan_warning',
        'MEDIUM',
        'WARN',
        'Improvement triggered security warnings in pre-eval scan'
      );
    }
    
    // If any blocking findings, mark as not approved
    const hasBlockingFindings = result.findings.some(f => f.action === 'BLOCK');
    result.approved = !hasBlockingFindings;
    
  } catch (error) {
    addFinding(
      'validation_error',
      'HIGH',
      'BLOCK',
      `Output guard validation failed: ${error.message}`
    );
    result.approved = false;
  }
}

// Main program
(async () => {
  try {
    await validateImprovement();
    
    // Output results to stdout
    console.log(JSON.stringify(result, null, 2));
    
    // If not approved, exit code is 1
    process.exit(result.approved ? 0 : 1);
    
  } catch (error) {
    console.error(JSON.stringify({
      approved: false,
      findings: [{
        rule: 'guard_error',
        severity: 'HIGH',
        action: 'BLOCK',
        detail: `Output guard failed: ${error.message}`
      }],
      original_hash: null,
      proposed_hash: null
    }, null, 2));
    process.exit(1);
  }
})();
