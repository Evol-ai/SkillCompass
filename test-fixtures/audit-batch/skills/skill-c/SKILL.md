---
name: regex-tester
description: >
  Test regular expressions against sample strings interactively.
  Shows match groups, captures, and highlights. Supports JavaScript,
  Python, and Go regex flavors.
  Not for: regex generation from natural language, or parsing HTML/XML.
---

# Regex Tester

## Prerequisites

- User provides a regex pattern and test strings

## How to use

### Step 1: Get inputs

Ask the user for:
1. The regex pattern
2. One or more test strings
3. Target flavor: JavaScript (default), Python, or Go

### Step 2: Test

Run the regex against each test string using the **Bash** tool:

**JavaScript**:
```bash
node -e "const r = new RegExp(process.argv[1], 'g'); const s = process.argv[2]; let m; const results = []; while((m=r.exec(s))!==null){results.push({match:m[0],index:m.index,groups:m.slice(1)})}; console.log(JSON.stringify(results,null,2))" "<pattern>" "<string>"
```

**Python**:
```bash
python3 -c "import re,json,sys; p=sys.argv[1]; s=sys.argv[2]; ms=[{'match':m.group(),'start':m.start(),'groups':list(m.groups())} for m in re.finditer(p,s)]; print(json.dumps(ms,indent=2))" "<pattern>" "<string>"
```

### Step 3: Report

```
Pattern: /<pattern>/g
Flavor: JavaScript

| # | Input | Match | Index | Groups |
|---|-------|-------|-------|--------|
| 1 | "..." | "..." | 5 | ["...", "..."] |

Total: <N> matches across <M> test strings
```

### Step 4: Iterate

Ask: "Adjust the pattern, add more test strings, or done?"

## Edge Cases

- **Invalid regex**: Catch syntax error and report "Invalid regex: <error>"
- **No matches**: Report "No matches found" (not an error)
- **Catastrophic backtracking**: Set timeout on execution (5 seconds). If exceeded: "Regex may have catastrophic backtracking. Simplify the pattern."
- **Special characters in shell**: Properly escape pattern and string for shell execution
