# .skill-compass

This directory is managed by SkillCompass.
It contains version snapshots and evaluation history for your skills.

**Recommended:** add `.skill-compass/` to `.gitignore`.
Evaluation data is local — snapshots can be regenerated from source.

Structure:
```
.skill-compass/
  {skill-name}/
    manifest.json     # Version history + scores
    snapshots/        # SKILL.md copies by version
    corrections.json  # Correction tracking (optional)
  config.json         # User preferences (optional)
```
