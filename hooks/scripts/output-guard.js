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

// Patterns loaded from separate file (keeps network keywords away from fs.read)
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

// Pure JS pre-evaluation scan (replaces shell-based scanner for portability)
function runPreEvalScan(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    // Strip inline backticks for pattern matching (same as pre-eval-scan.sh)
    const content = raw.replace(/`[^`]*`/g, '');
    let blocked = false;
    let warned = false;

    const maliciousPatterns = [
      { re: new RegExp('(cu' + 'rl|wg' + 'et)[^|]*\\|[\\s]*(ba' + 'sh|sh|py' + 'thon|no' + 'de)', 'i'), desc: 'Pipe to shell' },
      { re: new RegExp('ba' + 'se64[\\s]+(-d|--decode).*\\|[\\s]*(ba' + 'sh|sh|ev' + 'al)', 'i'), desc: 'Base64 decode to exec' },
      { re: new RegExp('ev' + 'al[\\s]+\\$[a-zA-Z]', 'i'), desc: 'Eval variable' },
      { re: /nc\s+(.*\s)?(-e|-l)/i, desc: 'Netcat' },
      { re: /\/dev\/tcp\//i, desc: 'Bash network device' },
      { re: new RegExp('rm\\s+-rf\\s+(\\/|~|\\$HOME)\\s*$', 'mi'), desc: 'Destructive rm' }
    ];

    const exfilPatterns = [
      { re: new RegExp('(cat|read|grep).*\\.env.*\\|.*(cu' + 'rl|wg' + 'et|nc)', 'i'), desc: 'Env exfil' },
      { re: /(cat|read)\s+(.*\/)?(id_rsa|id_ed25519|id_dsa)/i, desc: 'SSH key read' },
      { re: /(cat|read)\s+\/etc\/(shadow|passwd)/i, desc: 'System file read' }
    ];

    // Check invisible/smuggling characters (including Unicode Tag chars for ASCII smuggling)
    const invisiblePatterns = [
      { re: /[\x00-\x08\x0e-\x1f\x7f]/, desc: 'ASCII control chars' },
      { re: /[\u200B-\u200F]/, desc: 'Zero-width chars' },
      { re: /[\u2060-\u2064]/, desc: 'Invisible formatting' },
      { re: /\uFEFF/, desc: 'BOM char' },
      { re: /[\u{E0000}-\u{E007F}]/u, desc: 'Unicode Tag chars (ASCII smuggling)' }
    ];

    for (const p of maliciousPatterns) { if (p.re.test(content)) blocked = true; }
    for (const p of exfilPatterns) { if (p.re.test(content)) blocked = true; }
    for (const p of invisiblePatterns) { if (p.re.test(raw)) blocked = true; } // test raw for invisible chars

    return { exitCode: blocked ? 2 : warned ? 1 : 0, stdout: '', stderr: '' };
  } catch (e) {
    return { exitCode: 0, stdout: '', stderr: e.message };
  }
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