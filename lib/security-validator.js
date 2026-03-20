/**
 * security-validator.js — D3 Security Validator (Enhanced Version)
 * 
 * Based on archive/v0.1-skeleton/prompts/d3-security.md and existing pre-eval-scan.sh
 * Locally implements all L0 security checks to reduce token consumption
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

class SecurityValidator {
  constructor() {
    this.findings = [];
  }

  /**
   * Execute complete security validation
   * @param {string} filePath - SKILL.md file path
   * @returns {Object} Validation result
   */
  validate(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    this.findings = [];

    // Build code block line set — matches inside code blocks are documentation
    // examples, not executable code, so findings get downgraded severity.
    this.codeBlockLines = new Set();
    let inCB = false;
    content.split('\n').forEach((line, i) => {
      if (line.trim().startsWith('```')) inCB = !inCB;
      if (inCB) this.codeBlockLines.add(i + 1);
    });

    // Execute all L0 checks
    this.checkHardcodedSecrets(content);
    this.checkUnconfirmedExternalCalls(content);
    this.checkFilesystemPrivilegeEscalation(content);
    this.checkCommandInjection(content);
    this.checkPromptInjectionRisk(content);
    this.checkDataExfiltration(content);
    this.checkExcessivePermissions(content, this.extractFrontmatter(content));

    // Calculate score and pass status
    const criticalFindings = this.findings.filter(f => f.severity === 'critical');
    const pass = criticalFindings.length === 0;
    const score = pass ? Math.max(0, 10 - this.calculateDeductions()) : 0;

    return {
      dimension: "d3-security",
      score,
      pass,
      is_gate: true,
      summary: this.generateSummary(pass, criticalFindings.length),
      findings: this.findings.map(f => ({
        check: f.check,
        severity: f.severity,
        location: f.location,
        description: f.description,
        owasp_category: f.owaspCategory || this.mapToOWASPCategory(f.check),
        recommendation: f.recommendation
      })),
      checks_executed: [
        "hardcoded_secrets",
        "unconfirmed_external_calls", 
        "filesystem_privilege_escalation",
        "command_injection",
        "prompt_injection_risk",
        "data_exfiltration",
        "excessive_permissions"
      ],
      tools_used: ["builtin"],
      gate_rule: "Any Critical finding forces pass=false and overall verdict=FAIL"
    };
  }

  /**
   * Check 1: Hardcoded Secrets
   */
  checkHardcodedSecrets(content) {
    const secretPatterns = [
      {
        pattern: /AKIA[0-9A-Z]{16}/g,
        description: "AWS Access Key ID detected",
        severity: "critical"
      },
      {
        pattern: /sk-[a-zA-Z0-9]{20,}/g,
        description: "OpenAI API key detected", 
        severity: "critical"
      },
      {
        pattern: /sk-ant-[a-zA-Z0-9\-]{20,}/g,
        description: "Anthropic API key detected",
        severity: "critical"
      },
      {
        pattern: /ghp_[a-zA-Z0-9]{36}/g,
        description: "GitHub Personal Access Token detected",
        severity: "critical"
      },
      {
        pattern: /gho_[a-zA-Z0-9]{36}/g,
        description: "GitHub OAuth token detected",
        severity: "critical"
      },
      {
        pattern: /-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----/g,
        description: "Private key detected",
        severity: "critical"
      },
      {
        pattern: /(postgresql|mongodb|mysql|redis):\/\/[^:]+:[^@]+@/gi,
        description: "Database connection string with embedded credentials",
        severity: "critical"
      }
    ];

    // Generic API key detection
    const genericKeyPatterns = [
      {
        pattern: /(?:api_key|apikey|api_secret|token|password|secret|credential)\s*[:=]\s*["']([^"']{20,})["']/gi,
        description: "Generic API key or secret detected",
        severity: "critical"
      }
    ];

    [...secretPatterns, ...genericKeyPatterns].forEach(({ pattern, description, severity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        const value = match[1] || match[0];
        
        // Check if it's a placeholder
        if (this.isPlaceholder(value)) continue;
        
        this.addFinding('hardcoded_secrets', severity, line,
          `${description}: ${this.maskSecret(value)}`,
          "Remove hardcoded secret and use environment variables");
      }
    });

    // High entropy string detection
    this.checkHighEntropyStrings(content);
  }

  /**
   * Check high entropy strings
   */
  checkHighEntropyStrings(content) {
    const highEntropyPattern = /[A-Za-z0-9_\-]{30,}/g;
    let match;
    
    while ((match = highEntropyPattern.exec(content)) !== null) {
      const string = match[0];
      const line = this.getLineNumber(content, match.index);
      
      // Exclude known prefixes (these have dedicated pattern detection)
      const knownPrefixes = ['AKIA', 'sk-', 'ghp_', 'gho_', 'ghs_', 'ghu_'];
      if (knownPrefixes.some(prefix => string.startsWith(prefix))) continue;
      
      // Exclude placeholders
      if (this.isPlaceholder(string)) continue;
      
      // Calculate Shannon entropy
      const entropy = this.calculateEntropy(string);
      if (entropy > 4.5) {
        this.addFinding('hardcoded_secrets', 'high', line,
          `High-entropy string detected (entropy: ${entropy.toFixed(2)}): ${this.maskSecret(string)}`,
          "Verify this is not a hardcoded secret; use environment variables if needed");
      }
    }
  }

  /**
   * Check 2: Unconfirmed External Calls
   */
  checkUnconfirmedExternalCalls(content) {
    const externalCallPatterns = [
      {
        pattern: /(?:curl|wget|fetch\(|http\.get|requests\.|axios\.)/gi,
        description: "Network request command detected",
        baseSeverity: "high"
      },
      {
        pattern: /WebFetch|WebSearch/g,
        description: "External tool usage detected",
        baseSeverity: "medium"
      }
    ];

    externalCallPatterns.forEach(({ pattern, description, baseSeverity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        const context = this.getContext(content, match.index, 100);

        // Check for user confirmation language
        const hasConfirmation = /(?:ask|confirm|user approval|permission)/i.test(context);
        const isLocalhost = /(?:localhost|127\.0\.0\.1|::1)/i.test(context);

        if (!hasConfirmation && !isLocalhost) {
          // Inside code blocks = documentation example, downgrade to medium
          const severity = this.codeBlockLines.has(line) ? 'medium' : baseSeverity;
          this.addFinding('unconfirmed_external_calls', severity, line,
            `${description} without explicit user confirmation`,
            "Add user confirmation step before making external requests");
        }
      }
    });

    // Check webhook URLs
    const webhookPattern = /https?:\/\/[^\s"']*(?:webhook|hook|callback|ngrok)/gi;
    let match;
    while ((match = webhookPattern.exec(content)) !== null) {
      const line = this.getLineNumber(content, match.index);
      this.addFinding('unconfirmed_external_calls', 'high', line,
        `Webhook or callback URL detected: ${match[0]}`,
        "Ensure webhook URLs are user-controlled or explicitly approved");
    }
  }

  /**
   * Check 3: Filesystem Privilege Escalation
   */
  checkFilesystemPrivilegeEscalation(content) {
    const privilegePatterns = [
      {
        pattern: /\/etc\/(?:passwd|shadow|hosts|sudoers)/gi,
        description: "System configuration file access",
        severity: "high"
      },
      {
        pattern: /~\/\.(?:ssh|aws|gnupg)/gi,
        description: "User credential directory access",
        severity: "high"
      },
      {
        pattern: /%(?:USERPROFILE|APPDATA)%\\\.(?:ssh|aws)/gi,
        description: "Windows user credential directory access", 
        severity: "high"
      },
      {
        pattern: /\.\.\/\.\.\//g,
        description: "Directory traversal pattern detected",
        severity: "medium"
      },
      {
        pattern: /rm\s+-rf\s+(?:\/|\$HOME|~)/gi,
        description: "Destructive deletion command",
        severity: "critical"
      },
      {
        pattern: /del\s+\/s\s+\/q\s+[A-Z]:\\/gi,
        description: "Windows destructive deletion command",
        severity: "critical"
      }
    ];

    privilegePatterns.forEach(({ pattern, description, severity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        this.addFinding('filesystem_privilege_escalation', severity, line,
          description,
          "Restrict file access to project directory only");
      }
    });
  }

  /**
   * Check 4: Command Injection Vectors
   */
  checkCommandInjection(content) {
    const injectionPatterns = [
      {
        pattern: /bash\s+-c\s+["\'][^"']*\$\{[^}]+\}[^"']*["\']|\`[^`]*\$\{[^}]+\}[^`]*\`/gi,
        description: "Shell command with variable interpolation",
        severity: "critical"
      },
      {
        pattern: /eval\s*\(\s*[^)]*\$\{[^}]+\}/gi,
        description: "eval() with variable interpolation",
        severity: "critical"
      },
      {
        pattern: /eval\s+\$[a-zA-Z_][a-zA-Z0-9_]*/gi,
        description: "eval with variable (potential code injection)",
        severity: "critical"
      },
      {
        pattern: /subprocess|exec\s*\([^)]*shell\s*=\s*True/gi,
        description: "Subprocess call with shell=True",
        severity: "high"
      },
      {
        pattern: /echo\s+\$\{[^}]+\}\s*\|\s*(?:python|bash|sh)/gi,
        description: "Piping user input to interpreter",
        severity: "critical"
      },
      {
        pattern: /data=\$\([^)]*base64[^)]*\)[^;]*;[^;]*eval\s+\$data/gi,
        description: "Base64 decode + eval pattern (code injection)",
        severity: "critical"
      }
    ];

    injectionPatterns.forEach(({ pattern, description, severity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        this.addFinding('command_injection', severity, line,
          description,
          "Sanitize input and use parameterized commands");
      }
    });
  }

  /**
   * Check 5: Prompt Injection Risk
   */
  checkPromptInjectionRisk(content) {
    const injectionPatterns = [
      {
        pattern: /ignore\s+(?:all\s+)?previous\s+instructions/gi,
        description: "Prompt injection: ignore instructions",
        severity: "high"
      },
      {
        pattern: /you\s+are\s+now\s+(?:a|an)\s+/gi,
        description: "Prompt injection: role override",
        severity: "high"
      },
      {
        pattern: /forget\s+(?:everything|all|your)/gi,
        description: "Prompt injection: memory manipulation",
        severity: "high"
      },
      {
        pattern: /new\s+instructions?:/gi,
        description: "Prompt injection: instruction override",
        severity: "high"
      },
      {
        pattern: /system\s*:\s*["\']|<\|system\|>/gi,
        description: "Prompt injection: system role manipulation",
        severity: "high"
      }
    ];

    injectionPatterns.forEach(({ pattern, description, severity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        this.addFinding('prompt_injection_risk', severity, line,
          description,
          "Remove prompt injection attempts and use proper input delimitation");
      }
    });

    // Check invisible characters
    this.checkInvisibleCharacters(content);
  }

  /**
   * Check invisible characters
   */
  checkInvisibleCharacters(content) {
    const invisiblePatterns = [
      {
        pattern: /[\u200B-\u200F]/g,
        description: "Zero-width Unicode characters detected",
        severity: "critical"
      },
      {
        pattern: /[\u2060-\u2064]/g,
        description: "Invisible formatting characters detected",
        severity: "critical"
      },
      {
        pattern: /\uFEFF/g,
        description: "BOM character detected",
        severity: "high"
      },
      {
        pattern: /[\x00-\x08\x0E-\x1F\x7F]/g,
        description: "ASCII control characters detected",
        severity: "critical"
      }
    ];

    invisiblePatterns.forEach(({ pattern, description, severity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        this.addFinding('prompt_injection_risk', severity, line,
          description,
          "Remove invisible characters that may hide malicious content");
      }
    });
  }

  /**
   * Check 6: Data Exfiltration Paths
   */
  checkDataExfiltration(content) {
    const exfiltrationPatterns = [
      {
        pattern: /(?:cat|read|type)\s+[^|]*\.env[^|]*\|[^|]*(?:curl|wget|http)/gi,
        description: "Reading .env file with network transmission",
        severity: "critical"
      },
      {
        pattern: /(?:cat|read|type)\s+[^|]*(?:id_rsa|id_ed25519|\.ssh)[^|]*\|[^|]*(?:curl|wget|http)/gi,
        description: "Reading SSH keys with network transmission",
        severity: "critical"
      },
      {
        pattern: /base64\s+[^|]*\|[^|]*(?:curl|wget|http)/gi,
        description: "Base64 encoding with network transmission",
        severity: "high"
      },
      {
        pattern: /(?:send|upload|share|post)\s+[^|]*(?:file|content|data)[^|]*(?:to|http)/gi,
        description: "File content transmission to external endpoint",
        severity: "medium"  // Downgraded: pattern is too broad, triggers on natural language
      }
    ];

    // Check for base64-encoded exfiltration patterns
    this.checkBase64Exfiltration(content);

    exfiltrationPatterns.forEach(({ pattern, description, severity }) => {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const line = this.getLineNumber(content, match.index);
        // Inside code blocks = documentation example, downgrade to medium
        const effectiveSeverity = this.codeBlockLines.has(line) ? 'medium' : severity;
        this.addFinding('data_exfiltration', effectiveSeverity, line,
          description,
          "Add explicit user consent before transmitting sensitive data");
      }
    });
  }

  /**
   * Check Base64-encoded data exfiltration patterns
   */
  checkBase64Exfiltration(content) {
    // Find base64 strings longer than 50 characters
    const base64Pattern = /[A-Za-z0-9+/]{50,}={0,2}/g;
    let match;
    
    while ((match = base64Pattern.exec(content)) !== null) {
      const base64String = match[0];
      
      try {
        // Try to decode the base64 string
        const decoded = Buffer.from(base64String, 'base64').toString('utf-8');
        
        // Check if decoded content contains suspicious patterns
        const suspiciousPatterns = [
          {
            pattern: /cat\s+[^|]*\.ssh[^|]*\|\s*curl/i,
            description: "Base64-encoded SSH key exfiltration detected",
            severity: "critical"
          },
          {
            pattern: /cat\s+[^|]*\.env[^|]*\|\s*curl/i,
            description: "Base64-encoded environment file exfiltration detected", 
            severity: "critical"
          },
          {
            pattern: /curl.*--data.*https?:\/\/[^\/]*(?:exfil|collect|steal|dump)/i,
            description: "Base64-encoded data exfiltration to suspicious endpoint",
            severity: "critical"
          },
          {
            pattern: /\|\s*curl\s+-X\s+POST.*--data/i,
            description: "Base64-encoded POST data transmission detected",
            severity: "high"
          }
        ];

        suspiciousPatterns.forEach(({ pattern, description, severity }) => {
          if (pattern.test(decoded)) {
            const line = this.getLineNumber(content, match.index);
            this.addFinding('data_exfiltration', severity, line,
              `${description}: ${decoded.substring(0, 100)}...`,
              "Remove data exfiltration code and add explicit user consent");
          }
        });
      } catch (error) {
        // Not valid base64 or not UTF-8, skip
      }
    }
  }

  /**
   * Check 7: Excessive Permission Requests
   */
  checkExcessivePermissions(content, frontmatter) {
    const description = frontmatter.description || '';
    const name = frontmatter.name || '';
    const purpose = (name + ' ' + description).toLowerCase();
    
    // Analyze declared tools
    const declaredTools = frontmatter.tools || [];
    const toolNames = declaredTools.map(tool => 
      typeof tool === 'string' ? tool : tool.name || tool
    );

    // Check tool-purpose matching
    const powerfulTools = ['Bash', 'Write', 'WebFetch', 'WebSearch'];
    const hasPowerfulTools = toolNames.some(tool => powerfulTools.includes(tool));
    
    const suggestsReadOnly = /(?:read|view|display|show|format|analyze|check)/i.test(purpose);
    const suggestsOffline = /(?:local|offline|format|lint|validate)/i.test(purpose);
    const suggestsNetworking = /(?:download|fetch|api|upload|send|sync)/i.test(purpose);

    if (hasPowerfulTools && suggestsReadOnly) {
      this.addFinding('excessive_permissions', 'medium', 'frontmatter',
        `Read-only purpose but requests powerful tools: ${toolNames.join(', ')}`,
        "Reduce tool permissions to match stated purpose");
    }

    if (toolNames.some(t => ['WebFetch', 'WebSearch'].includes(t)) && suggestsOffline) {
      this.addFinding('excessive_permissions', 'medium', 'frontmatter',
        "Offline purpose but requests network tools",
        "Remove network tools if not needed for core functionality");
    }

    // Check glob patterns
    const globs = frontmatter.globs || [];
    const broadGlobs = globs.filter(glob => 
      glob === '**/*' || glob === '*' || glob.includes('**/*.')
    );
    
    if (broadGlobs.length > 0 && !purpose.includes('all') && !purpose.includes('any')) {
      this.addFinding('excessive_permissions', 'medium', 'frontmatter',
        `Broad file access patterns: ${broadGlobs.join(', ')}`,
        "Narrow glob patterns to specific file types needed");
    }
  }

  /**
   * Extract frontmatter
   */
  extractFrontmatter(content) {
    if (!content.startsWith('---')) return {};
    
    const endIndex = content.indexOf('---', 3);
    if (endIndex === -1) return {};
    
    const yamlContent = content.substring(3, endIndex);
    
    try {
      // Simple YAML parsing
      const frontmatter = {};
      const lines = yamlContent.split('\n');
      
      lines.forEach(line => {
        const match = line.match(/^([^:]+):\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          const value = match[2].trim();
          
          if (value.startsWith('[') && value.endsWith(']')) {
            try {
              frontmatter[key] = JSON.parse(value);
            } catch {
              frontmatter[key] = [value.slice(1, -1)];
            }
          } else {
            frontmatter[key] = value;
          }
        }
      });
      
      return frontmatter;
    } catch {
      return {};
    }
  }

  /**
   * Helper methods
   */
  getLineNumber(content, index) {
    return content.substring(0, index).split('\n').length;
  }

  getContext(content, index, length = 50) {
    const start = Math.max(0, index - length);
    const end = Math.min(content.length, index + length);
    return content.substring(start, end);
  }

  isPlaceholder(value) {
    const placeholders = [
      'your_', '<', '>', 'example', 'sample', 'placeholder', 
      'enter_', 'insert_', 'replace_', '$', '${', 'env_'
    ];
    const lower = value.toLowerCase();
    return placeholders.some(p => lower.includes(p));
  }

  maskSecret(secret) {
    if (secret.length <= 8) return '*'.repeat(secret.length);
    return secret.substring(0, 4) + '*'.repeat(secret.length - 8) + secret.substring(secret.length - 4);
  }

  calculateEntropy(string) {
    const charCounts = {};
    for (const char of string) {
      charCounts[char] = (charCounts[char] || 0) + 1;
    }
    
    let entropy = 0;
    const length = string.length;
    
    for (const count of Object.values(charCounts)) {
      const probability = count / length;
      entropy -= probability * Math.log2(probability);
    }
    
    return entropy;
  }

  addFinding(check, severity, location, description, recommendation) {
    this.findings.push({
      check,
      severity,
      location: typeof location === 'number' ? `line ${location}` : location,
      description,
      recommendation
    });
  }

  calculateDeductions() {
    let deduction = 0;
    this.findings.forEach(finding => {
      switch (finding.severity) {
        case 'critical': deduction += 10; break; // Should not reach here, critical auto-set to 0
        case 'high': deduction += 4; break;
        case 'medium': deduction += 1.0; break;
        case 'low': deduction += 0.5; break;
      }
    });
    return deduction;
  }

  generateSummary(pass, criticalCount) {
    if (!pass) {
      return `CRITICAL security issues found (${criticalCount} critical findings) - GATE FAILED`;
    }
    
    const highCount = this.findings.filter(f => f.severity === 'high').length;
    const mediumCount = this.findings.filter(f => f.severity === 'medium').length;
    
    if (this.findings.length === 0) {
      return "No security issues detected - clean skill";
    } else if (highCount === 0) {
      return `Minor security concerns (${mediumCount} medium findings) - acceptable`;
    } else {
      return `Security issues found (${highCount} high, ${mediumCount} medium) - review recommended`;
    }
  }

  mapToOWASPCategory(check) {
    const mapping = {
      'hardcoded_secrets': 'LLM01 - Prompt Injection',
      'unconfirmed_external_calls': 'LLM09 - Overreliance',
      'filesystem_privilege_escalation': 'LLM06 - Excessive Agency',
      'command_injection': 'LLM07 - System Prompt Leakage', 
      'prompt_injection_risk': 'LLM01 - Prompt Injection',
      'data_exfiltration': 'LLM02 - Insecure Output Handling',
      'excessive_permissions': 'LLM06 - Excessive Agency'
    };
    return mapping[check] || 'General Security';
  }
}

module.exports = { SecurityValidator };