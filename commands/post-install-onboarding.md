# Post-Install Onboarding

Triggered by the SessionStart hook (`hooks/scripts/session-tracker.js`), which compares the current SkillCompass version against the last recorded version. On first install, reinstall, or version change the hook injects a context message instructing Claude to load this file and follow it on the user's first interaction.

Do not wait for a slash command. Execute the steps below in order as soon as the session starts.

## Step 1: Introduce

```
🧭 SkillCompass

Evaluate skill quality, find the weakest area, and improve it.
Also tracks usage to help you spot idle or risky skills.
```

## Step 2: Quick Scan (automatic, no permission needed)

Silently run skill discovery — scan immediate children `*/SKILL.md` in each skill root (same as `/setup` Step 3; do NOT recurse) — and run a D1+D2+D3 quick scan on every discovered skill. Save the results to `.skill-compass/setup-state.json`. Then show one of the two result summaries below.

If any risks found:
```
Scanning installed skills...

Found {N} skill(s){, including M collections if any}.
{K} have security or structural risks; the rest passed the quick scan ✓

[View risky skills / Continue]
```

If all clean:
```
Scanning installed skills...

Found {N} skill(s){, including M collections if any}, all passed the quick scan ✓

[Continue]
```

## Step 3: StatusLine Configuration

Check whether `~/.claude/settings.json` already has a `statusLine` configured.

If NO existing statusLine:
```
SkillCompass tracks skill usage automatically.
When suggestions exist, the status line shows 🧭 N pending — type /skillcompass to view.

[Enable status line 🧭 / Skip]
```

If the user chooses Enable, offer two modes:
```
[Minimal — just the 🧭 hint / Full HUD — model, context, and more]
```

- **Minimal**: write the statusLine config to `~/.claude/settings.json` pointing to `scripts/hud-extra.js`.
- **Full HUD**: check for claude-hud; if present, configure its `--extra-cmd`; otherwise fall back to Minimal.
- **Skip**: do nothing.

If YES existing statusLine: skip silently — do not overwrite the user's configuration.

## Step 4: Finish

```
✓ Setup complete. SkillCompass runs in the background:
  · Tracks skill usage frequency
  · Surfaces idle or problematic skills
  · Shows 🧭 in the status line when there are suggestions

Type /skillcompass anytime to view and manage skills.
```

After displaying the finish message, record the current version so the onboarding won't trigger again next session. Use the **Bash** tool to run:

```bash
node "${CLAUDE_PLUGIN_ROOT:-.}/hooks/scripts/write-last-version.js"
```

The script is silent on success and on failure (the onboarding must complete even if the sidecar cannot be written).

## Return

After onboarding, do NOT show the inbox view. The user was not asking for inbox — they were just starting a session. Return control to whatever the user intended to do.
