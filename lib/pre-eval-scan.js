const fs = require('node:fs');
const path = require('node:path');
const {
  PRE_EVAL_MALICIOUS_PATTERNS,
  PRE_EVAL_EXFIL_PATTERNS,
} = require('./pre-eval-patterns.js');

function getLineNumber(content, index) {
  return content.slice(0, index).split('\n').length;
}

function stripInlineBackticks(content) {
  return content.replace(/`[^`\n]*`/g, match => ' '.repeat(match.length));
}

function calculateShannonEntropy(value) {
  if (!value) return 0;

  const counts = new Map();
  for (const char of value) {
    counts.set(char, (counts.get(char) || 0) + 1);
  }

  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / value.length;
    entropy -= probability * Math.log2(probability);
  }

  return entropy;
}

function loadThreatSignatures(baseDir) {
  const signaturesPath = path.join(baseDir, 'shared', 'threat-signatures.yaml');
  if (!fs.existsSync(signaturesPath)) return [];

  const yaml = fs.readFileSync(signaturesPath, 'utf-8');
  const signatures = [];
  const pattern = /pattern:\s*"([^"]+)"[\s\S]*?severity:\s*"([^"]+)"[\s\S]*?description:\s*"([^"]+)"/g;
  let match;

  while ((match = pattern.exec(yaml)) !== null) {
    try {
      signatures.push({
        re: new RegExp(match[1], 'i'),
        severity: match[2].toUpperCase(),
        description: match[3],
      });
    } catch {
      // Ignore malformed patterns instead of failing the whole scan.
    }
  }

  return signatures;
}

function scanPatterns(content, patternDefs, category, findings, blockedRef) {
  for (const { re, desc } of patternDefs) {
    re.lastIndex = 0;
    const match = re.exec(content);
    if (!match) continue;

    findings.push({
      level: 'BLOCK',
      category,
      description: desc,
      line: getLineNumber(content, match.index),
    });
    blockedRef.value = true;
  }
}

function scanThreatSignatures(content, threatSignatures, findings, blockedRef) {
  for (const signature of threatSignatures) {
    signature.re.lastIndex = 0;
    const match = signature.re.exec(content);
    if (!match) continue;

    findings.push({
      level: signature.severity === 'MEDIUM' ? 'WARN' : 'BLOCK',
      category: 'known_malicious_domain',
      description: signature.description,
      line: getLineNumber(content, match.index),
    });

    if (signature.severity === 'MEDIUM') {
      blockedRef.warn = true;
    } else {
      blockedRef.value = true;
    }
  }
}

function scanInvisibleCharacters(raw, findings, blockedRef) {
  const invisiblePatterns = [
    { re: /[\x00-\x08\x0e-\x1f\x7f]/u, desc: 'ASCII control characters detected' },
    { re: /[\u200B-\u200F]/u, desc: 'Unicode zero-width characters detected' },
    { re: /[\u2060-\u2064]/u, desc: 'Unicode invisible formatting characters detected' },
    { re: /\uFEFF/u, desc: 'BOM character detected' },
    { re: /[\u{E0000}-\u{E007F}]/u, desc: 'Unicode Tag characters detected (ASCII smuggling)' },
  ];

  for (const { re, desc } of invisiblePatterns) {
    const match = re.exec(raw);
    if (!match) continue;

    findings.push({
      level: 'BLOCK',
      category: 'prompt_injection',
      description: desc,
      line: getLineNumber(raw, match.index),
    });
    blockedRef.value = true;
  }
}

function scanHighEntropy(raw, findings, state) {
  const candidatePattern = /[A-Za-z0-9_\-]{20,}/g;
  const excludedContexts = ['example', 'sample', 'placeholder', 'YOUR_', '<'];
  const knownPrefixes = ['AKIA', 'sk-', 'ghp_', 'glpat-', 'xox'];
  let match;

  while ((match = candidatePattern.exec(raw)) !== null) {
    const value = match[0];
    if (knownPrefixes.some(prefix => value.startsWith(prefix))) continue;

    const context = raw.slice(Math.max(0, match.index - 20), Math.min(raw.length, match.index + value.length + 20));
    if (excludedContexts.some(exclusion => context.includes(exclusion))) continue;

    const entropy = calculateShannonEntropy(value);
    if (entropy <= 4.5) continue;

    findings.push({
      level: 'WARN',
      category: 'high_entropy',
      description: `Suspicious string with entropy ${entropy.toFixed(2)}`,
      line: getLineNumber(raw, match.index),
    });
    state.warn = true;
  }
}

function scanFile(filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    return {
      exitCode: 2,
      findings: [
        {
          level: 'BLOCK',
          category: 'file_error',
          description: `File not found: ${filePath}`,
          line: null,
        },
      ],
    };
  }

  const raw = fs.readFileSync(filePath, 'utf-8');
  const stripped = stripInlineBackticks(raw);
  const projectRoot = options.projectRoot || path.resolve(__dirname, '..');
  const threatSignatures = loadThreatSignatures(projectRoot);
  const findings = [];
  const state = { value: false, warn: false };

  scanPatterns(stripped, PRE_EVAL_MALICIOUS_PATTERNS, 'malicious_code', findings, state);
  scanPatterns(stripped, PRE_EVAL_EXFIL_PATTERNS, 'data_exfiltration', findings, state);
  scanInvisibleCharacters(raw, findings, state);
  scanThreatSignatures(stripped, threatSignatures, findings, state);
  scanHighEntropy(raw, findings, state);

  return {
    exitCode: state.value ? 2 : state.warn ? 1 : 0,
    findings,
  };
}

function formatFindings(result, filePath) {
  const lines = [
    '=== Pre-LLM Security Scan ===',
    `Target: ${filePath}`,
    '',
  ];

  for (const finding of result.findings) {
    const prefix = finding.level === 'BLOCK' ? '[BLOCK]' : '[WARN]';
    const suffix = finding.line ? ` (line ~${finding.line})` : '';
    lines.push(`${prefix} ${finding.category}: ${finding.description}${suffix}`);
  }

  lines.push('');
  if (result.exitCode === 2) {
    lines.push('[RESULT] Security scan FAILED - evaluation blocked');
  } else if (result.exitCode === 1) {
    lines.push('[RESULT] Security scan passed with warnings');
  } else {
    lines.push('[RESULT] Security scan PASSED');
  }

  return lines.join('\n');
}

module.exports = {
  scanFile,
  formatFindings,
};
