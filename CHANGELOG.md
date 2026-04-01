# Changelog

## [1.0.0] - 2026-03-25

### Added
- Six-dimension evaluation framework (D1 Structure, D2 Trigger, D3 Security, D4 Functional, D5 Comparative, D6 Uniqueness)
- Local JavaScript validators for D1/D2/D3 to reduce token consumption
- Pre-evaluation security scanner (`pre-eval-scan.js`, with shell wrapper for compatibility) with inline backtick stripping
- Output guard validation for eval-improve write-backs
- Audit chain with hash-chain tamper detection
- File integrity monitor with checksum snapshots
- 8 commands: eval-skill, eval-improve, eval-security, eval-audit, eval-compare, eval-merge, eval-rollback, eval-evolve
- PostToolUse hooks for auto-snapshot and eval-gate
- Threat signatures database (shared/threat-signatures.yaml)
- 25 test fixtures covering dimension-targeted, type/trigger, command-specific, edge case, and security scenarios
- Scoring formula with weighted dimensions and security gate
- Version management with snapshot/rollback support
- Cross-locale trigger evaluation (D2)
- CI mode with exit codes (0=PASS, 1=CAUTION, 2=FAIL)
- Feedback signal fusion support
- Skill registry (54 canonical skills) for D6 uniqueness comparison
