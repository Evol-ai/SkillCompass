---
name: markdown-toc
description: >
  Generate a table of contents for markdown files by parsing headings.
  Supports configurable depth (h1-h6), anchor link generation, and
  insertion at a marked position (<!-- toc -->).
  Not for: HTML files, RST files, or non-markdown documentation formats.
---

# Markdown TOC Generator

## Prerequisites

- Target file must be a `.md` file

## How to use

### Step 1: Parse headings

Use the **Read** tool to load the markdown file. Extract all headings (`#` through `######`).

### Step 2: Configure depth

Ask: "Include headings up to which level? (default: h3)"

### Step 3: Generate TOC

Build a nested list with anchor links:

```markdown
- [Heading 1](#heading-1)
  - [Subheading](#subheading)
```

Anchor generation rules:
- Lowercase the heading text
- Replace spaces with hyphens
- Remove special characters except hyphens
- Handle duplicate headings by appending `-1`, `-2`, etc.

### Step 4: Insert or replace

Look for `<!-- toc -->` marker in the file:
- **Found**: Replace content between `<!-- toc -->` and `<!-- /toc -->` markers
- **Not found**: Ask where to insert (top of file / after first heading / custom position)

Use the **Edit** tool to update the file.

## Output Format

```
TOC generated for: <filename>
- Headings found: <count>
- Depth: h1-h<max>
- Duplicates resolved: <count>
- Inserted at: marker | line <N>
```

## Edge Cases

- **No headings found**: Report "No headings found in file"
- **Code block headings**: Skip `#` inside fenced code blocks (``` or ~~~)
- **Existing TOC outdated**: Replace entirely, don't try to diff
- **Front matter**: Skip YAML frontmatter (between `---` delimiters) when parsing
