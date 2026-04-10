# SkillCompass for OpenClaw

SkillCompass is an OpenClaw plugin for skill quality evaluation, usage tracking, and inbox suggestions.

## Install

Install from ClawHub:

```bash
openclaw plugins install clawhub:__PACKAGE_NAME__@__PACKAGE_VERSION__
```

If you prefer the latest tag for this package:

```bash
openclaw plugins install clawhub:__PACKAGE_NAME__
```

## What It Adds

- `/sc status` for inbox and portfolio status
- `/sc eval <skill>` for evaluation flows
- lifecycle checks for installs and updates
- weekly digest formatting and localized suggestion reasons

## Runtime Notes

- This ClawHub package is prebuilt. No `npm install`, `git clone`, or manual `rsync` step is required.
- The plugin writes local state under `.skill-compass/` inside the OpenClaw plugin root.
- The plugin reads installed skill metadata to generate evaluation and inbox signals.

## Configuration

The plugin supports these config keys:

- `preferredChannel`
- `quietHoursStart`
- `quietHoursEnd`
- `dailyPushLimit`
- `locale`
- `userLocale`

## Compatibility

- Plugin API: `>=2026.3.24-beta.2`
- Minimum gateway version: `2026.3.24-beta.2`
