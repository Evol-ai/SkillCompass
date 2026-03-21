#!/usr/bin/env bash
set -euo pipefail

# Pre-LLM static scanning script
# Intercept known threats before SKILL.md content enters any evaluation prompt
# Return codes: 0=Pass, 1=Warning(can continue), 2=Block(reject evaluation)

SKILL_PATH="$1"
if [[ ! -f "$SKILL_PATH" ]]; then
    echo "[ERROR] File not found: $SKILL_PATH" >&2
    exit 2
fi

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Read file content
CONTENT=$(cat "$SKILL_PATH")
EXIT_CODE=0
BLOCK_FOUND=false
WARN_FOUND=false

# Helper function to calculate line numbers
get_line_number() {
    local pattern="$1"
    local content="$2"
    echo "$content" | grep -n -E "$pattern" | head -1 | cut -d: -f1
}

# 1a. Malicious code pattern detection
check_malicious_code() {
    local patterns=(
        '(curl|wget)[^|]*\|[[:space:]]*(bash|sh|python|node)'
        'base64[[:space:]]+(-d|--decode).*\|[[:space:]]*(bash|sh|eval)'
        'eval[[:space:]]+\$[a-zA-Z]'
        'eval[[:space:]]+\$\([^)]*base64'
        '\$\((curl|wget)[[:space:]][^)]+\)'
        'nc[[:space:]]+(.*[[:space:]])?(-e|-l|-v|-p)'
        'python[[:space:]]+-c[[:space:]]*["\047].*import[[:space:]]+socket'
        '/dev/tcp/'
        'rm[[:space:]]+-rf[[:space:]]+(/|~|\$HOME)[[:space:]]*($|[^a-zA-Z0-9])'
    )
    
    local descriptions=(
        "Pipe remote script to shell"
        "Base64 decode pipe to execution"
        "Eval with variable containing potentially malicious code"
        "Eval with base64 decode command substitution"
        "Command substitution with remote fetch"
        "Netcat reverse shell"
        "Python reverse shell"
        "Bash network device usage"
        "Destructive deletion of system/home directory"
    )
    
    for i in "${!patterns[@]}"; do
        if echo "$CONTENT" | grep -qE "${patterns[$i]}"; then
            local line=$(get_line_number "${patterns[$i]}" "$CONTENT")
            echo "[BLOCK] malicious_code: ${descriptions[$i]} (line ~$line)" >&2
            BLOCK_FOUND=true
        fi
    done
}

# 1b. Data exfiltration pattern detection
check_data_exfiltration() {
    local patterns=(
        '(cat|read|grep).*\.env.*\|.*(curl|wget|nc)'
        '(cat|read)[[:space:]]+(.*/)?(id_rsa|id_ed25519|id_dsa)'
        '(cat|read)[[:space:]]+/etc/(shadow|passwd)'
        '(echo|cat|printf).*>>.*/authorized_keys'
        'ANTHROPIC_API_KEY|OPENAI_API_KEY|AWS_SECRET_ACCESS_KEY|AWS_ACCESS_KEY_ID'
    )
    
    local descriptions=(
        "Reading and sending .env file"
        "Reading SSH private keys"
        "Reading system password files"
        "Modifying authorized_keys"
        "Direct reference to sensitive API keys"
    )
    
    for i in "${!patterns[@]}"; do
        if echo "$CONTENT" | grep -qE "${patterns[$i]}"; then
            local line=$(get_line_number "${patterns[$i]}" "$CONTENT")
            echo "[BLOCK] data_exfiltration: ${descriptions[$i]} (line ~$line)" >&2
            BLOCK_FOUND=true
        fi
    done
}

# 1c. Prompt injection marker detection
check_prompt_injection_markers() {
    # Use Python to detect invisible characters — content passed via stdin to avoid shell injection
    cat "$SKILL_PATH" | python3 -c "
import sys
import re

content = sys.stdin.read()

# ASCII control characters
ascii_control = re.findall(r'[\x00-\x08\x0e-\x1f\x7f]', content)
if ascii_control:
    print('[BLOCK] prompt_injection: ASCII control characters detected', file=sys.stderr)
    sys.exit(2)

# Unicode zero-width characters
zero_width = re.findall(r'[\u200B-\u200F]', content)
if zero_width:
    print('[BLOCK] prompt_injection: Unicode zero-width characters detected', file=sys.stderr)
    sys.exit(2)

# Unicode invisible formatting characters
invisible = re.findall(r'[\u2060-\u2064]', content)
if invisible:
    print('[BLOCK] prompt_injection: Unicode invisible formatting characters detected', file=sys.stderr)
    sys.exit(2)

# BOM character
if '\uFEFF' in content:
    print('[BLOCK] prompt_injection: BOM character detected', file=sys.stderr)
    sys.exit(2)

# Unicode Tag characters (core ASCII smuggling technique)
tag_chars = re.findall(r'[\U000E0000-\U000E007F]', content)
if tag_chars:
    print('[BLOCK] prompt_injection: Unicode Tag characters detected (ASCII smuggling)', file=sys.stderr)
    sys.exit(2)
" || {
    if [[ $? -eq 2 ]]; then
        BLOCK_FOUND=true
    fi
}
}

# 1d. Known malicious domain detection
check_known_malicious_domains() {
    local signatures_file="$PROJECT_ROOT/shared/threat-signatures.yaml"
    
    if [[ -f "$signatures_file" ]]; then
        # Extract domain patterns
        local patterns=$(grep "pattern:" "$signatures_file" | sed 's/.*pattern:[[:space:]]*"\(.*\)"/\1/')
        
        while IFS= read -r pattern; do
            if [[ -n "$pattern" ]] && echo "$CONTENT" | grep -qE "$pattern"; then
                local line=$(get_line_number "$pattern" "$CONTENT")
                echo "[BLOCK] known_malicious_domain: Pattern '$pattern' matched (line ~$line)" >&2
                BLOCK_FOUND=true
            fi
        done <<< "$patterns"
    fi
}

# 1e. High entropy string detection
check_high_entropy_strings() {
    cat "$SKILL_PATH" | python3 -c "
import sys
import re
import math
from collections import Counter

content = sys.stdin.read()

def calculate_shannon_entropy(s):
    if not s:
        return 0
    entropy = 0
    counter = Counter(s)
    l = len(s)
    for count in counter.values():
        p = count / l
        if p > 0:
            entropy -= p * math.log2(p)
    return entropy

# Extract long strings
pattern = r'[A-Za-z0-9_\-]{20,}'
matches = re.findall(pattern, content)

# Exclude contexts
exclude_contexts = ['example', 'sample', 'placeholder', 'YOUR_', '<']
known_prefixes = ['AKIA', 'sk-', 'ghp_', 'glpat-', 'xox']

suspicious = []
for match in matches:
    # Check if in excluded context
    start = content.find(match)
    context = content[max(0, start-20):min(len(content), start+len(match)+20)]
    
    if any(exc in context for exc in exclude_contexts):
        continue
        
    # Check if known prefix (should use other detection)
    if any(match.startswith(prefix) for prefix in known_prefixes):
        continue
    
    # Calculate entropy
    entropy = calculate_shannon_entropy(match)
    if entropy > 4.5:
        # Find line number
        lines_before = content[:start].count('\\n')
        line_num = lines_before + 1
        print(f'[WARN] high_entropy: Suspicious string with entropy {entropy:.2f} (line ~{line_num})', file=sys.stderr)
        sys.exit(1)
" || {
    if [[ $? -eq 1 ]]; then
        WARN_FOUND=true
    fi
}
}

# Execute all checks
echo "=== Pre-LLM Security Scan ===" >&2
echo "Target: $SKILL_PATH" >&2
echo "" >&2

check_malicious_code
check_data_exfiltration
check_prompt_injection_markers
check_known_malicious_domains
check_high_entropy_strings

# Set exit code
if [[ "$BLOCK_FOUND" == true ]]; then
    echo "" >&2
    echo "[RESULT] Security scan FAILED - evaluation blocked" >&2
    exit 2
elif [[ "$WARN_FOUND" == true ]]; then
    echo "" >&2
    echo "[RESULT] Security scan passed with warnings" >&2
    exit 1
else
    echo "[RESULT] Security scan PASSED" >&2
    exit 0
fi