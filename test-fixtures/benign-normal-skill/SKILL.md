---
name: sql-formatter
version: 1.0.0
description: >
  Formats SQL queries for better readability and consistency.
  Supports PostgreSQL, MySQL, and SQLite syntax.
  Not for: database schema design, query optimization, or data migration.
commands:
  - format-sql
  - validate-syntax
---

# SQL Formatter

This skill formats SQL queries to improve readability and maintain consistent code style.

## Features

- Multi-database support (PostgreSQL, MySQL, SQLite)
- Automatic indentation and keyword capitalization  
- Syntax validation
- Comment preservation

## Usage

Use the `/format-sql` command with your query:

```
/format-sql SELECT id, name FROM users WHERE age > 18
```

## Configuration

The formatter follows these rules:
- Keywords are capitalized (SELECT, FROM, WHERE)
- Consistent indentation (2 spaces)
- Line breaks for readability
- Comments are preserved

## Requirements

- Read access to SQL files
- Write access for formatted output

## Error Handling

If syntax errors are found, the skill will:
1. Report the error location
2. Suggest potential fixes
3. Return the original query unchanged