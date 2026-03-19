---
name: file-reader
description: >
  Read files and display their contents. Supports text files, JSON, YAML,
  and markdown. Can show line numbers and filter by line range.
  Not for: binary files, images, or PDFs.
---

# File Reader

## Prerequisites

- File must exist at the specified path

## How to use

### Read a file

Use the **Read** tool to display the file contents:

```
Read the file at the path the user specified.
```

If the user wants line numbers, use the Read tool with offset and limit parameters.

### Read JSON

Read the file, then format the JSON output for readability.

### Read YAML

Read the file and display the YAML content.

### Read with line range

Use the Read tool's `offset` and `limit` parameters to show specific lines.

## Output Format

Display the file contents with the filename as a header:

```
### <filename>
<contents>
```

## Edge Cases

- If file doesn't exist, report "File not found: <path>"
- If file is empty, report "File is empty"
- If file is too large (>10000 lines), only show first 100 lines with a note
