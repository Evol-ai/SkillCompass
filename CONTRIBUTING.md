# Contributing to SkillCompass

Thanks for your interest in contributing! This guide covers the basics.

## AI-Generated Code Policy

AI-assisted contributions are welcome, but the submitter must:
- **Understand** every line of the change
- **Test** it against real skills (not just syntax checks)
- **Explain** the reasoning if asked in review

PRs that are clearly bulk-generated without human review (no testing evidence, generic descriptions, changes to files the submitter can't explain) will be closed.

## Ways to Contribute

- **Report bugs** — open an issue with reproduction steps
- **Suggest features** — open an issue describing the use case
- **Fix bugs / add features** — submit a pull request
- **Improve docs** — typos, clarity, examples

## Getting Started

```bash
git clone https://github.com/Evol-ai/SkillCompass.git
cd SkillCompass
npm install
```

### Run tests locally

```bash
npm run verify:local
```

This command is cross-platform and works in macOS, Linux, PowerShell, and Codespaces.
GitHub Actions also runs the same verification on `dev`/`main` pushes and pull requests.

### Project structure

```
commands/       — 9 command definitions (markdown specs)
prompts/        — 6 evaluation dimension prompts + improve + merge
lib/            — JavaScript validators + patterns + utilities
hooks/scripts/  — PostToolUse hooks (eval-gate, post-skill-edit, output-guard)
shared/         — Scoring rules, skill registry, threat signatures
schemas/        — JSON schemas for eval results, feedback, manifests
test-fixtures/  — 25 test skills (benign, malicious, edge cases)
```

## Pull Request Process

1. **Fork** the repo and create a branch from `dev`
2. **Make changes** — keep them focused (one concern per PR)
3. **Test** — run the syntax checks and smoke tests above
4. **Commit** — use conventional commits: `fix:`, `feat:`, `docs:`, `refactor:`, `chore:`
5. **Open PR** against `dev` branch for normal work. Only release PRs from `dev` or `release/*` should target `main`.
6. **Describe** what changed and why

### PR Checklist

- [ ] `node -c` passes on all changed JS files
- [ ] Existing test fixtures still produce expected results
- [ ] No secrets, credentials, or personal data in the diff
- [ ] Commit messages follow conventional format

## Code Style

- **JS files**: No framework, Node.js built-ins only (+ js-yaml)
- **Markdown command files**: Follow existing structure in `commands/`
- **Prompts**: Changes to `prompts/` affect evaluation scoring — test carefully

## Reporting Security Issues

If you find a security vulnerability in SkillCompass itself (not in a skill being evaluated), use GitHub's private vulnerability reporting flow instead of opening a public issue. See [SECURITY.md](SECURITY.md) for the reporting link and trust model.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
