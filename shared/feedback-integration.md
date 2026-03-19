# Feedback Integration Rules

> Loaded only when `--feedback <path>` flag is passed to eval-skill or eval-improve.
> Contains feedback signal fusion logic for adjusting static evaluation scores.

## When to Load

This file is loaded ONLY when the user passes `--feedback <path>` flag. The path points to a JSON file conforming to `schemas/feedback-signal.json`.

Use the **Read** tool to load the feedback file. Validate against the schema before processing.

## Fusion Formula

```
dimension_score = static_score × 0.6 + feedback_score × 0.4
```

Where:
- `static_score`: the score from the dimension prompt (0-10)
- `feedback_score`: derived from feedback signals (0-10, see mapping below)

## Per-Dimension Feedback Mapping

| Dimension | Feedback Signal | Derivation |
|-----------|----------------|------------|
| D2 (Trigger) | `trigger_accuracy` | Direct: accuracy percentage → 0-10 scale |
| D4 (Functional) | `correction_count` + `correction_patterns` | Inverse: fewer corrections = higher score. 0 corrections → 10, 10+ → 2 |
| D5 (Comparative) | `adoption_rate` vs `ignore_rate` | adoption / (adoption + ignore) → 0-10 scale |
| D6 (Uniqueness) | `usage_frequency` trends | Increasing trend → +2, stable → 0, decreasing → -2 (applied as additive modifier to static score, clamped to [0, 10]) |

**Why D6 uses additive modifier instead of fusion:** Usage frequency trends are a directional signal (up/down/flat), not a 0-10 quality score. Converting a trend to a synthetic 0-10 score would lose meaning. Instead, the trend adjusts the static uniqueness score: a skill that sees increasing usage is more unique in practice (+2), while declining usage suggests redundancy (-2).

Dimensions without feedback mapping (D1, D3): use 100% static score (no fusion).

## Minimum Sample Threshold

- `usage_count` must be >= 10 in the feedback file
- If below threshold: ignore feedback entirely, use 100% static scores for all dimensions
- Log: "Feedback ignored: insufficient sample size ({usage_count}/10 minimum)"

## Noise Control

- **Repeated patterns only**: a correction pattern must appear >= 3 times to influence scoring
- **User expertise weighting**: if `user_expertise` field is present:
  - `"expert"`: weight feedback × 1.2 (capped at 10)
  - `"intermediate"`: weight feedback × 1.0
  - `"beginner"`: weight feedback × 0.8

## Schema Reference

Validate the feedback file against `schemas/feedback-signal.json` before processing. If validation fails, warn and fall back to 100% static scores.
