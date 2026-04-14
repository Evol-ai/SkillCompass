# Agent Instructions

This file exists so agentic tools have a repository-local instruction entry point.
For the full contributor guide, workflow, and repo structure, read `CONTRIBUTING.md`.

## Required Rules

- **Branch names**: ASCII only, `kebab-case` (e.g., `fix/d5-delta-override`, `feat/d6-rubric-band`). No spaces, no non-Latin characters.
- **PR titles**: ASCII only. Keep under 70 characters. Use the description/body for details.
- **Commit messages**: ASCII only. Follow conventional commit format (`fix:`, `feat:`, `docs:`, `refactor:`, `chore:`).
- **Code and technical files** (`.js`, `.ts`, `.json`, `.yml`, schemas): English only. No non-English comments, identifiers, or string literals.
- **User-facing templates in `SKILL.md` and `commands/*.md`**: English only at rest. Claude detects the user's locale at runtime and translates at display time per `SKILL.md`'s Global UX Rules.
- **Runtime i18n resources** (`oc/src/locale.ts`): the one place localized message catalogs live. Add new locales here.
- **Test fixtures**: stored in a [separate repo](https://github.com/Evol-ai/SkillCompass-test-fixtures). Fetch with `npm run fetch-fixtures`. May contain any language.

## Source of Truth

Keep this file aligned with the "Naming & Language Conventions" section in `CONTRIBUTING.md`.
