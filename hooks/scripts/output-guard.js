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
const { spawn } = require('node:child_process');

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

// Helper function: Extract URLs
function extractUrls(content) {
  const urlRegex = /https?:\/\/[^\s"'<>\[\]{}\\^`|]+/gi;
  return Array.from(new Set((content.match(urlRegex) || [])));
}

// Helper function: Extract commands from code blocks
function extractCommands(content) {
  const codeBlockRegex = /```[\s\S]*?```/g;
  const commands = [];
  
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const block = match[0];
    // Check if contains dangerous command patterns
    const dangerousPatterns = [
      /(curl|wget)[^|]*\|\s*(bash|sh|python|node)/i,
      /base64\s+(-d|--decode)[^|]*\|\s*(bash|sh|eval)/i,
      /\$\((curl|wget)\s[^)]+\)/i,
      /nc\s+(.*\s)?(-e|-l|-v|-p)/i,
      /python\s+-c\s*["'].*import\s+socket/i,
      /\/dev\/tcp\//i,
      /rm\s+-rf\s+(\$HOME|~|\/)\s*$/i
    ];
    
    for (const pattern of dangerousPatterns) {
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

// Helper function: Run pre-evaluation scan
async function runPreEvalScan(filePath) {
  const scriptPath = path.join(__dirname, 'pre-eval-scan.sh');
  
  return new Promise((resolve) => {
    const child = spawn('bash', [scriptPath, filePath], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    child.on('close', (code) => {
      resolve({
        exitCode: code,
        stdout,
        stderr
      });
    });
    
    // Timeout protection
    setTimeout(() => {
      child.kill('SIGTERM');
      resolve({
        exitCode: 124,
        stdout: '',
        stderr: 'Pre-eval scan timeout'
      });
    }, 10000);
  });
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
    const scanResult = await runPreEvalScan(improvedPath);
    
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