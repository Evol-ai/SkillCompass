#!/usr/bin/env node
/**
 * eval-gate.js — Pre-Accept Gate for skill-compass
 *
 * Triggered after Write|Edit tool use. If the modified file is a SKILL.md,
 * runs lightweight D1 (structure) + D3 (security) checks without LLM calls.
 * Outputs warnings to stderr (visible to user, never blocks the operation).
 *
 * Cross-platform. No external dependencies. Uses only node: built-ins.
 */

const fs = require("node:fs");
const path = require("node:path");

// ── D3 Security Patterns ──────────────────────────────────────────────

const SECRET_PATTERNS = [
  { regex: /(?:api[_-]?key|apikey)\s*[:=]\s*["']?[A-Za-z0-9_\-]{16,}/gi, label: "Hardcoded API key" },
  { regex: /(?:secret|token|password|passwd|pwd)\s*[:=]\s*["'][^"']{8,}["']/gi, label: "Hardcoded secret/token" },
  { regex: /sk-[A-Za-z0-9]{20,}/g, label: "OpenAI-style API key" },
  { regex: /sk-ant-[A-Za-z0-9\-]{20,}/g, label: "Anthropic API key" },
  { regex: /ghp_[A-Za-z0-9]{36,}/g, label: "GitHub personal access token" },
  { regex: /glpat-[A-Za-z0-9\-_]{20,}/g, label: "GitLab personal access token" },
  { regex: /xox[bpors]-[A-Za-z0-9\-]{10,}/g, label: "Slack token" },
  { regex: /AKIA[0-9A-Z]{16}/g, label: "AWS access key ID" },
  { regex: /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----/g, label: "Private key" },
];

const DANGEROUS_PATTERNS = [
  { regex: /rm\s+-rf\s+[\/~]/gi, label: "Destructive rm -rf with absolute/home path" },
  { regex: /curl\s+[^\n|]*\|\s*(?:bash|sh|zsh)/gi, label: "Pipe remote script to shell" },
  { regex: /wget\s+[^\n|]*\|\s*(?:bash|sh|zsh)/gi, label: "Pipe remote download to shell" },
  { regex: /\beval\s*\(/gi, label: "eval() usage" },
  { regex: /\bexec\s*\(/gi, label: "exec() usage" },
  { regex: /(?:process\.env|os\.environ)\b/gi, label: "Direct environment variable access" },
  { regex: /chmod\s+[0-7]*777/gi, label: "World-writable permissions" },
];

const INJECTION_PATTERNS = [
  { regex: /ignore\s+(?:all\s+)?previous\s+instructions/gi, label: "Prompt injection: ignore instructions" },
  { regex: /you\s+are\s+now\s+(?:a|an)\s+/gi, label: "Prompt injection: role override" },
  { regex: /\bsystem\s*:\s*["']/gi, label: "Prompt injection: system role" },
  { regex: /\$\{.*\}/g, label: "Template injection via ${}", context: "instructions" },
];

const EXFILTRATION_PATTERNS = [
  { regex: /https?:\/\/[^\s"']*(?:webhook|hook|exfil|callback|ngrok|burp)/gi, label: "Suspicious webhook/callback URL" },
  { regex: /fetch\s*\(\s*["']https?:\/\//gi, label: "Outbound HTTP fetch in instructions" },
  { regex: /(?:XMLHttpRequest|navigator\.sendBeacon)/gi, label: "Browser-based exfiltration" },
];

// ── D1 Structure Checks ───────────────────────────────────────────────

function checkStructure(content) {
  const findings = [];

  // Check frontmatter exists
  if (!content.startsWith("---")) {
    findings.push({ severity: "high", message: "Missing YAML frontmatter (must start with ---)" });
    return findings; // can't check further
  }

  const fmEnd = content.indexOf("---", 3);
  if (fmEnd === -1) {
    findings.push({ severity: "high", message: "Unclosed YAML frontmatter (missing closing ---)" });
    return findings;
  }

  const frontmatter = content.substring(3, fmEnd);

  // Check required fields
  if (!/^name\s*:/m.test(frontmatter)) {
    findings.push({ severity: "high", message: "Missing required field: name" });
  }
  if (!/^description\s*:/m.test(frontmatter)) {
    findings.push({ severity: "high", message: "Missing required field: description" });
  }

  // Check for common YAML issues
  if (/\t/.test(frontmatter)) {
    findings.push({ severity: "low", message: "YAML frontmatter contains tabs (use spaces)" });
  }

  // Check body has content after frontmatter
  const body = content.substring(fmEnd + 3).trim();
  if (body.length < 50) {
    findings.push({ severity: "medium", message: "Skill body is very short (<50 chars) — may lack instructions" });
  }

  return findings;
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Strip fenced code blocks from content to avoid false positives
 * on patterns that appear only in code examples.
 */
function stripCodeBlocks(text) {
  return text.replace(/```[\s\S]*?```/g, (match) => {
    // Preserve line count for accurate line number reporting
    return match.replace(/[^\n]/g, " ");
  });
}

// ── D3 Security Checks ───────────────────────────────────────────────

function checkSecurity(content) {
  const findings = [];
  const scanContent = stripCodeBlocks(content);

  function scan(patterns, category) {
    for (const { regex, label } of patterns) {
      // Reset regex state for global patterns
      regex.lastIndex = 0;
      let match;
      while ((match = regex.exec(scanContent)) !== null) {
        // Find approximate line number
        const beforeMatch = scanContent.substring(0, match.index);
        const lineNum = (beforeMatch.match(/\n/g) || []).length + 1;
        findings.push({
          severity: category === "secret" ? "critical" : "high",
          message: `${label} (line ~${lineNum})`,
          category,
        });
      }
    }
  }

  scan(SECRET_PATTERNS, "secret");
  scan(DANGEROUS_PATTERNS, "dangerous_command");
  scan(INJECTION_PATTERNS, "injection");
  scan(EXFILTRATION_PATTERNS, "exfiltration");

  return findings;
}

// ── Baseline Comparison ───────────────────────────────────────────────

function checkBaseline(projectRoot, skillName) {
  const findings = [];

  try {
    const manifestPath = path.join(projectRoot, ".skill-compass", skillName, "manifest.json");
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));

    const lastVersion = manifest.versions[manifest.versions.length - 1];
    if (lastVersion && lastVersion.overall_score !== null && lastVersion.verdict === "PASS") {
      findings.push({
        severity: "info",
        message: `Previous version scored ${lastVersion.overall_score}/100 (${lastVersion.verdict}). Run /eval-skill to verify this edit maintains quality.`,
        category: "baseline",
      });
    }
  } catch {
    // No manifest or unreadable — skip baseline check
  }

  return findings;
}

// ── Frequency Limiting ───────────────────────────────────────────────

/**
 * Returns true if we should suppress verbose output for this skill.
 * Uses a cache file to track last warning time per skill.
 * Rate limit: one full output per skill per 60 seconds.
 */
function shouldThrottle(projectRoot, skillName) {
  const cachePath = path.join(projectRoot, ".skill-compass", ".gate-cache.json");
  const now = Date.now();
  const THROTTLE_MS = 60000; // 60 seconds

  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(cachePath, "utf-8"));
  } catch {
    // no cache yet
  }

  const lastTime = cache[skillName] || 0;
  if (now - lastTime < THROTTLE_MS) {
    return true; // throttle
  }

  // Update cache
  cache[skillName] = now;
  try {
    fs.mkdirSync(path.join(projectRoot, ".skill-compass"), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(cache));
  } catch {
    // cache write failed, not critical
  }

  return false;
}

// ── Main ──────────────────────────────────────────────────────────────

async function main() {
  // Fast path: read stdin and check for SKILL.md before JSON parsing
  let input;
  try {
    input = fs.readFileSync(0, "utf-8");
  } catch {
    return;
  }
  if (!input || !input.includes("SKILL.md") && !input.includes("skill.md")) return;

  let payload;
  try {
    payload = JSON.parse(input);
  } catch {
    return;
  }

  const filePath = payload?.tool_input?.file_path || payload?.tool_input?.path;
  if (!filePath) return;

  // Only act on SKILL.md files
  if (!path.basename(filePath).toLowerCase().endsWith("skill.md")) return;

  // Don't gate our own snapshot writes
  if (filePath.includes(".skill-compass")) return;

  // Resolve project root via .git or cwd
  let projectRoot = path.dirname(filePath);
  let check = projectRoot;
  while (check !== path.dirname(check)) {
    if (fs.existsSync(path.join(check, ".git"))) {
      projectRoot = check;
      break;
    }
    check = path.dirname(check);
  }

  // Check gate bypass lock (eval-improve sets this to prevent noise during improvement)
  const bypassPath = path.join(projectRoot, ".skill-compass", ".gate-bypass");
  try {
    const bypass = JSON.parse(fs.readFileSync(bypassPath, "utf-8"));
    if (bypass.until && Date.now() / 1000 < bypass.until) return; // bypass active
  } catch {
    // No bypass file or expired — proceed normally
  }

  let content;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    return;
  }

  const skillDir = path.dirname(filePath);
  const skillName = path.basename(skillDir);
  if (!skillName || skillName === ".") return;

  // Run checks
  const d1Findings = checkStructure(content);
  const d3Findings = checkSecurity(content);
  const baselineFindings = checkBaseline(projectRoot, skillName);
  const allFindings = [...d1Findings, ...d3Findings, ...baselineFindings];

  if (allFindings.length === 0) return; // all clear, silent

  // Check frequency limit — always show criticals, throttle for repeat non-criticals
  const criticals = allFindings.filter((f) => f.severity === "critical");
  if (criticals.length === 0 && shouldThrottle(projectRoot, skillName)) {
    // Throttled: show one-line summary only
    process.stderr.write(
      `[SkillCompass Gate] ${skillName}/SKILL.md — ${allFindings.length} finding(s) (repeat, run /eval-skill for details)\n`
    );
    return;
  }

  // Full output
  const highs = allFindings.filter((f) => f.severity === "high");
  const mediums = allFindings.filter((f) => f.severity === "medium");
  const infos = allFindings.filter((f) => f.severity === "info" || f.severity === "low");

  const lines = [];
  lines.push(`\n[SkillCompass Gate] ${skillName}/SKILL.md — ${allFindings.length} finding(s)\n`);

  if (criticals.length > 0) {
    lines.push("  CRITICAL:");
    for (const f of criticals) lines.push(`    \u26d4 ${f.message}`);
  }
  if (highs.length > 0) {
    lines.push("  HIGH:");
    for (const f of highs) lines.push(`    \u26a0\ufe0f ${f.message}`);
  }
  if (mediums.length > 0) {
    lines.push("  MEDIUM:");
    for (const f of mediums) lines.push(`    \u24d8 ${f.message}`);
  }
  if (infos.length > 0) {
    for (const f of infos) lines.push(`  \u2139 ${f.message}`);
  }

  if (criticals.length > 0) {
    lines.push("\n  Action: Run /eval-security to get full analysis and fix recommendations.");
  } else if (highs.length > 0) {
    lines.push("\n  Action: Run /eval-skill to check overall quality.");
  }

  // Output to stderr — visible to user but doesn't block
  process.stderr.write(lines.join("\n") + "\n");
}

main().catch(() => {
  process.exit(0);
});
