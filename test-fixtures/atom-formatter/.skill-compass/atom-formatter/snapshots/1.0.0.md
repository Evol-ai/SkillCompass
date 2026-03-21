---
name: json-sorter
description: >
  Sort JSON object keys alphabetically or by custom order.
  Handles nested objects, arrays of objects, and preserves formatting.
  Useful for normalizing JSON config files, package.json, tsconfig.json, etc.
  Not for: JSON validation, JSON schema generation, or JSON-to-other-format conversion.
---

# JSON Sorter

## Prerequisites

- Input must be a valid JSON file

## How to use

### Step 1: Read the JSON file

Use the **Read** tool to load the target file. Parse and validate JSON structure.

If invalid JSON, report: "Invalid JSON at line `<line>`: `<error_message>`. Fix the syntax first."

### Step 2: Determine sort order

Ask the user: "Sort keys alphabetically, or do you have a preferred key order?"

- **Alphabetical** (default): Sort all keys A-Z at every nesting level
- **Custom order**: User provides a list of priority keys (e.g., `name, version, description, ...`). Priority keys come first in specified order, remaining keys follow alphabetically.

### Step 3: Sort

Apply the chosen sort order recursively:

- **Objects**: Sort keys at current level, then recurse into nested objects
- **Arrays of objects**: Sort keys within each object element (do NOT reorder array elements)
- **Primitive arrays**: Leave unchanged (`[1, 3, 2]` stays `[1, 3, 2]`)
- **Preserve values**: Only key order changes, never modify values

### Step 4: Write back

Use the **Write** tool to save the sorted JSON. Preserve the original indentation style (detect 2-space vs 4-space vs tab).

Report:
```
Sorted: <filename>
- Keys reordered: <count>
- Nesting levels processed: <count>
- Indentation: <detected_style>
```

## Edge Cases

- **Empty object `{}`**: No-op, report "Nothing to sort"
- **Top-level array**: Sort keys within each object element in the array
- **Mixed nesting**: Objects containing arrays containing objects — recurse through all levels
- **Duplicate keys**: Warn "Duplicate key `<key>` found at `<path>`, keeping last occurrence"
- **Large files (>1MB)**: Warn before processing, ask user to confirm
- **Comments in JSON (JSONC)**: Warn "JSON comments detected. Sorting will strip comments. Proceed? [y/n]"
