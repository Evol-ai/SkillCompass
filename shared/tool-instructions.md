# Security Tool Instructions

> Single source of truth for L0/L1/L2 security tool detection, invocation, and result parsing.
> Loaded by: eval-skill (D3 step), eval-security.

## L0: Built-in Checks (Always Run)

These checks are performed by the LLM using `prompts/d3-security.md`. No external tools required.

7 check categories:
1. **Hardcoded secrets** — API keys, tokens, passwords in plaintext
2. **Unconfirmed external calls** — network requests without user confirmation
3. **File system privilege escalation** — access outside expected scope
4. **Command injection** — user input concatenated into shell commands
5. **Prompt injection risk** — template patterns exploitable by adversarial input
6. **Data exfiltration** — sending data to external services without consent
7. **Excessive permissions** — more tool access than stated purpose requires

## L1: Whitelist Tools (Auto-detect and Invoke)

Check for each tool in order. If detected, invoke and merge results.

| Tool | Detect | Invoke | Parse |
|------|--------|--------|-------|
| skill-security-scan | Use **Bash**: `command -v skill-security-scan` | `skill-security-scan scan {path} --format json` | JSON: extract `findings[]`, map `severity` to critical/high/medium/low |
| snyk agent-scan | Use **Bash**: `command -v uvx` AND check env `SNYK_TOKEN` is set | `uvx snyk-agent-scan@latest scan --skill {path}` | Parse structured output, extract findings |
| secureclaw | Check OpenClaw plugin environment is available | `secureclaw audit {path}` | Extract audit check results |

### Detection procedure

For each tool in the table above:
1. Use the **Bash** tool to run the detect command
2. If exit code 0 (tool found): run the invoke command via **Bash**
3. Parse the output according to the Parse column
4. Add `"source": "{tool-name}"` to each finding
5. Continue to next tool regardless of results

## L2: Custom Tools (User-configured)

Read from `.skill-compass/config.json` field `security_tools.custom[]`.

Each entry has:
- `name` (string): display name for the tool
- `command` (string): shell command with `{skill_path}` placeholder
- `output_format` (string): `"json"` or `"text"`

For `"json"` format: parse findings array directly.
For `"text"` format: use LLM analysis to extract findings from output.

Add `"source": "{name}"` to each finding.

## First-Run Prompt

If no L1 tools are detected AND `.skill-compass/config.json` field `l1_tool_prompt_dismissed` is not `true`:

Display: "No external security tools detected. For deeper security analysis, consider installing: `pip install skill-security-scan`. Dismiss this message? [y/n]"

If dismissed: use the **Write** tool to set `l1_tool_prompt_dismissed: true` in config.json.

## Result Aggregation

After collecting findings from all layers (L0 + L1 + L2):

1. **Deduplicate**: by `(location, check_type)` tuple — keep the finding with highest severity
2. **Source tracking**: every finding MUST include a `"source"` field (`"builtin"`, `"skill-security-scan"`, `"snyk-agent-scan"`, `"secureclaw"`, or custom tool name)
3. **Severity precedence**: critical > high > medium > low
4. **tools_used array**: list all tools that were actually invoked (always includes `"builtin"`)
