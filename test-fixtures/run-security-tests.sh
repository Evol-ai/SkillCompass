#!/usr/bin/env bash
set -euo pipefail

# Security Test Runner
# Test all security layer functions

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

echo "=== SkillCompass Security Test Suite ==="
echo "Project Root: $PROJECT_ROOT"
echo ""

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test pre-evaluation scanner
test_pre_eval_scan() {
    local skill_path="$1"
    local expected_exit_code="$2"
    local test_name="$3"
    
    echo -n "Testing: $test_name ... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    local scan_script="$PROJECT_ROOT/hooks/scripts/pre-eval-scan.sh"
    
    if [[ ! -f "$scan_script" ]]; then
        echo -e "${RED}FAIL${NC} (pre-eval-scan.sh not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return
    fi
    
    # Run scanner
    local exit_code=0
    "$scan_script" "$skill_path" 2>/dev/null || exit_code=$?
    
    if [[ $exit_code -eq $expected_exit_code ]]; then
        echo -e "${GREEN}PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}FAIL${NC} (expected exit code $expected_exit_code, got $exit_code)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Run all tests
echo "Testing Layer 1: Pre-LLM Static Scanning"
echo "----------------------------------------"

# Malicious skill tests
test_pre_eval_scan "$SCRIPT_DIR/malicious-curl-pipe/SKILL.md" 2 "Malicious curl pipe"
test_pre_eval_scan "$SCRIPT_DIR/malicious-ascii-smuggling/SKILL.md" 2 "ASCII smuggling"
test_pre_eval_scan "$SCRIPT_DIR/malicious-prompt-injection/SKILL.md" 2 "Prompt injection"
test_pre_eval_scan "$SCRIPT_DIR/malicious-base64-exfil/SKILL.md" 2 "Base64 exfiltration"

# Benign skill tests
test_pre_eval_scan "$SCRIPT_DIR/benign-normal-skill/SKILL.md" 0 "Normal skill"
test_pre_eval_scan "$SCRIPT_DIR/benign-with-code-blocks/SKILL.md" 0 "Skill with code blocks"

echo ""
echo "Testing Layer 2: Prompt Isolation"
echo "---------------------------------"

# Check if prompt file contains security rules
check_prompt_isolation() {
    local prompt_file="$1"
    local test_name="$2"
    
    echo -n "Testing: $test_name ... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ ! -f "$prompt_file" ]]; then
        echo -e "${RED}FAIL${NC} (file not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return
    fi
    
    # Check if it contains necessary security rules
    if grep -q "MANDATORY SAFETY RULES" "$prompt_file" && \
       (grep -q "UNTRUSTED_SKILL_BEGIN" "$prompt_file" || grep -q "VERSION_BEGIN" "$prompt_file") && \
       grep -q "Required Output" "$prompt_file"; then
        echo -e "${GREEN}PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}FAIL${NC} (missing security isolation patterns)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

check_prompt_isolation "$PROJECT_ROOT/prompts/d1-structure.md" "D1 Structure prompt"
check_prompt_isolation "$PROJECT_ROOT/prompts/d2-trigger.md" "D2 Trigger prompt"
check_prompt_isolation "$PROJECT_ROOT/prompts/d3-security.md" "D3 Security prompt"
check_prompt_isolation "$PROJECT_ROOT/prompts/d4-functional.md" "D4 Functional prompt"
check_prompt_isolation "$PROJECT_ROOT/prompts/d5-comparative.md" "D5 Comparative prompt"
check_prompt_isolation "$PROJECT_ROOT/prompts/d6-uniqueness.md" "D6 Uniqueness prompt"
check_prompt_isolation "$PROJECT_ROOT/prompts/improve.md" "Improve prompt"
check_prompt_isolation "$PROJECT_ROOT/prompts/merge.md" "Merge prompt"

echo ""
echo "Testing Layer 3: Output Guard"
echo "-----------------------------"

test_output_guard() {
    local test_name="$1"
    
    echo -n "Testing: $test_name ... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    local guard_script="$PROJECT_ROOT/hooks/scripts/output-guard.js"
    
    if [[ ! -f "$guard_script" ]]; then
        echo -e "${RED}FAIL${NC} (output-guard.js not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return
    fi
    
    if [[ ! -x "$guard_script" ]]; then
        echo -e "${RED}FAIL${NC} (output-guard.js not executable)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return
    fi
    
    echo -e "${GREEN}PASS${NC} (script exists and is executable)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
}

test_output_guard "Output guard script availability"

echo ""
echo "Testing Layer 4: Audit & Integrity"
echo "-----------------------------------"

test_audit_chain() {
    local test_name="$1"
    
    echo -n "Testing: $test_name ... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    local audit_lib="$PROJECT_ROOT/lib/audit-chain.js"
    local integrity_lib="$PROJECT_ROOT/lib/integrity-monitor.js"
    
    if [[ ! -f "$audit_lib" ]] || [[ ! -f "$integrity_lib" ]]; then
        echo -e "${RED}FAIL${NC} (library files not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return
    fi
    
    # Test if library can be require
    if node -e "require('$audit_lib'); require('$integrity_lib'); console.log('OK');" 2>/dev/null | grep -q "OK"; then
        echo -e "${GREEN}PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}FAIL${NC} (library syntax errors)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

test_audit_chain "Audit chain libraries"

echo ""
echo "Testing Configuration Files"
echo "---------------------------"

test_config_file() {
    local file_path="$1"
    local test_name="$2"
    
    echo -n "Testing: $test_name ... "
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ ! -f "$file_path" ]]; then
        echo -e "${RED}FAIL${NC} (file not found)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return
    fi
    
    # For YAML files, check syntax
    if [[ "$file_path" == *.yaml ]] || [[ "$file_path" == *.yml ]]; then
        if python3 -c "import yaml; yaml.safe_load(open('$file_path'))" 2>/dev/null; then
            echo -e "${GREEN}PASS${NC}"
            PASSED_TESTS=$((PASSED_TESTS + 1))
        else
            echo -e "${RED}FAIL${NC} (invalid YAML syntax)"
            FAILED_TESTS=$((FAILED_TESTS + 1))
        fi
    else
        echo -e "${GREEN}PASS${NC} (file exists)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    fi
}

test_config_file "$PROJECT_ROOT/shared/threat-signatures.yaml" "Threat signatures"

echo ""
echo "=== Test Results ==="
echo "Total: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "\n${GREEN}🎉 All tests passed! Security layers are functional.${NC}"
    exit 0
else
    echo -e "\n${RED}❌ Some tests failed. Please review the security implementation.${NC}"
    exit 1
fi