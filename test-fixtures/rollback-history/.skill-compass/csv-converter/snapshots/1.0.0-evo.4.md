---
name: csv-converter
description: >
  Convert CSV files to JSON, YAML, or markdown tables. Handles headers,
  custom delimiters, quoted fields, and encoding detection.
  Not for: Excel (.xlsx), database imports, or streaming large datasets.
---

# CSV Converter

## Prerequisites

- Input must be a CSV file (or TSV/custom delimiter)

## How to use

### Step 1: Read and detect format

Use the **Read** tool to load the file. Auto-detect:
- Delimiter (comma, tab, semicolon, pipe)
- Has header row (first row analysis)
- Encoding (UTF-8, Latin-1, etc.)

Ask: "Detected `<delimiter>` delimiter with `<N>` columns. Header row: `<yes/no>`. Correct?"

### Step 2: Choose output format

Ask: "Convert to JSON, YAML, or markdown table?"

### Step 3: Convert

**JSON**: Array of objects (if headers) or array of arrays (no headers)
**YAML**: Same structure as JSON, YAML syntax
**Markdown**: Pipe-delimited table with alignment row

### Step 4: Write output

Use the **Write** tool. Default output filename: `<input_name>.<format>`

## Output Format

```
Converted: <input> → <output>
- Rows: <count>
- Columns: <count>
- Format: JSON | YAML | Markdown
- Encoding: <detected>
```

## Edge Cases

- **Empty file**: Report "File is empty, nothing to convert"
- **Inconsistent columns**: Warn per-row, pad missing columns with null
- **Quoted fields with delimiters**: Respect RFC 4180 quoting rules
- **Very large files (>50MB)**: Stream-process, warn about memory
- **BOM marker**: Strip UTF-8 BOM if present
