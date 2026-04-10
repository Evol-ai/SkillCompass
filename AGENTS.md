# Agent Instructions

This file exists so agentic tools have a repository-local instruction entry point.
For the full contributor guide, workflow, and repo structure, read `CONTRIBUTING.md`.

## Required Rules

- **Branch names**: ASCII only, `kebab-case`. No spaces, no non-Latin characters.
- **PR titles**: ASCII only. Keep under 70 characters.
- **Commit messages**: ASCII only. Prefer conventional commits such as `fix:`, `feat:`, `docs:`, `refactor:`, `chore:`.
- **Code and technical files** (`.js`, `.ts`, `.json`, `.yml`, schemas): English only. No non-English comments, identifiers, or string literals.
- **User-facing templates in `SKILL.md` and `commands/*.md`**: English only at rest. Detect locale at runtime and translate at display time per `SKILL.md`'s Global UX Rules.
- **Runtime i18n resources**: localized catalogs belong in `oc/src/locale.ts`.
- **Test fixtures**: may contain any language when the fixture is explicitly testing non-English content.

## Source of Truth

Keep this file aligned with the "Naming & Language Conventions" section in `CONTRIBUTING.md`.
