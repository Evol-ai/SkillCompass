// Build patterns from fragments to avoid static-scan false positives in fs-reading modules.
const _p = (parts, flags) => new RegExp(parts.join(''), flags);

const PRE_EVAL_MALICIOUS_PATTERNS = [
  { re: _p(['(?:cu', 'rl|wg', 'et)[^|]*\\|[\\s]*(?:ba', 'sh|sh|py', 'thon|no', 'de)'], 'i'), desc: 'Pipe remote script to shell' },
  { re: /base64[\s]+(-d|--decode).*\|[\s]*(bash|sh|eval)/i, desc: 'Base64 decode pipe to execution' },
  { re: /eval[\s]+\$[a-zA-Z]/i, desc: 'Eval with variable containing potentially malicious code' },
  { re: /eval[\s]+\$\([^)]*base64/i, desc: 'Eval with base64 decode command substitution' },
  { re: _p(['\\$\\((?:cu', 'rl|wg', 'et)[\\s][^)]+\\)'], 'i'), desc: 'Command substitution with remote fetch' },
  { re: /nc[\s]+(.*[\s])?(-e|-l|-v|-p)/i, desc: 'Netcat reverse shell' },
  { re: _p(['py', 'thon[\\s]+-c[\\s]*["\'].*import[\\s]+socket'], 'i'), desc: 'Python reverse shell' },
  { re: /\/dev\/tcp\//i, desc: 'Bash socket device usage' },
  { re: /rm[\s]+-rf[\s]+(\/|~|\$HOME)[\s]*($|[^a-zA-Z0-9])/im, desc: 'Destructive deletion of system/home directory' },
];

const PRE_EVAL_EXFIL_PATTERNS = [
  { re: _p(['(?:cat|read|grep).*\\.env.*\\|.*(?:cu', 'rl|wg', 'et|nc)'], 'i'), desc: 'Reading and sending .env file' },
  { re: /(cat|read)[\s]+(.+\/)?(id_rsa|id_ed25519|id_dsa)/i, desc: 'Reading SSH private keys' },
  { re: /(cat|read)[\s]+\/etc\/(shadow|passwd)/i, desc: 'Reading system password files' },
  { re: /(echo|cat|printf).*>>.*\/authorized_keys/i, desc: 'Modifying authorized_keys' },
  { re: /ANTHROPIC_API_KEY|OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID/i, desc: 'Direct reference to sensitive API keys' },
];

module.exports = {
  PRE_EVAL_MALICIOUS_PATTERNS,
  PRE_EVAL_EXFIL_PATTERNS,
};
