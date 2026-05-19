# SkillCompass + OpenClaw Plugin Review

> **Install after the review, not before.**
> SkillCompass helps you inspect a networked OpenClaw skill before you allow tools, API keys, or private workflows.

---

## The Problem

OpenClaw plugins can add powerful agent tools. A social automation plugin may search tweets, post tweets, export followers, upload media, read direct messages, or manage monitors. That power is useful, but it also means the skill file deserves a review before an agent can call live tools.

Manual review is easy to skip:

- Trigger text can be too broad and activate on unrelated prompts.
- Security boundaries can be unclear around API keys and private data.
- Tool descriptions can hide write actions behind generic wording.
- Install instructions can drift from the published package.

## The Example

[TweetClaw](https://github.com/Xquik-dev/tweetclaw) is a real OpenClaw plugin and npm package, [`@xquik/tweetclaw`](https://www.npmjs.com/package/@xquik/tweetclaw). It adds X/Twitter automation workflows such as:

- scrape tweets and search tweets
- search tweet replies and post tweet replies
- post tweets with approval prompts
- export followers and run user lookup
- upload media and download media
- send direct messages
- monitor tweets and deliver webhooks
- run giveaway draws

That makes it a useful SkillCompass review sample: the skill is practical, networked, and action-oriented.

## Step 1: Inspect The Skill File

Clone or unpack the plugin in a review directory:

```bash
git clone https://github.com/Xquik-dev/tweetclaw.git
cd tweetclaw
```

The OpenClaw skill lives at:

```text
skills/tweetclaw/SKILL.md
```

Confirm the install source before enabling anything:

```bash
npm view @xquik/tweetclaw version repository.url homepage
```

The canonical OpenClaw install command is:

```bash
openclaw plugins install @xquik/tweetclaw
```

The [ClawHub page](https://clawhub.ai/plugins/@xquik/tweetclaw) is useful for discovery, while npm is the package install source.

## Step 2: Run A Full Evaluation

From your SkillCompass-enabled agent session:

```bash
/eval-skill ./tweetclaw/skills/tweetclaw/SKILL.md --scope full
```

Read the six dimensions as an install gate:

| Dimension | What To Check In A Networked Plugin |
|-----------|-------------------------------------|
| D1 Structure | Valid frontmatter, clear commands, expected OpenClaw skill shape |
| D2 Trigger | Activates for X/Twitter automation, rejects unrelated social prompts |
| D3 Security | Protects API keys, private messages, media URLs, and write actions |
| D4 Functional | Explains setup, tool allow-listing, error paths, and approvals |
| D5 Comparative | Adds value beyond generic prompting or direct API docs |
| D6 Uniqueness | Clear role beside MCP servers, SDKs, and other agent tools |

Treat `PASS` as permission to continue review, not as permission to skip human approval.

## Step 3: Deep-Dive Security

Run the focused D3 check before enabling the optional live tool:

```bash
/eval-security ./tweetclaw/skills/tweetclaw/SKILL.md
```

For TweetClaw-style tools, look for clear boundaries around:

- No API key exposure in prompts or chat transcripts.
- Approval prompts before post, reply, follow, DM, monitor, webhook, or profile actions.
- Distinct read-only exploration versus live endpoint invocation.
- Setup guidance when API keys or signing keys are missing.
- No broad "always run" trigger language for social media prompts.

If D3 reports High or Critical findings, do not install or allow the live tool until the finding is fixed and re-evaluated.

## Step 4: Enable Narrowly

After review, install the plugin:

```bash
openclaw plugins install @xquik/tweetclaw
```

Keep the allow-list explicit:

```bash
openclaw config set tools.alsoAllow '["explore", "tweetclaw"]'
```

Use `explore` first for read-only endpoint discovery. Allow `tweetclaw` only when you intend the agent to call live API endpoints.

## Step 5: Re-Check After Updates

Re-run SkillCompass when the package changes:

```bash
npm view @xquik/tweetclaw version
/eval-skill ./tweetclaw/skills/tweetclaw/SKILL.md --scope full
```

If you maintain the plugin, use `/eval-improve` on the weakest dimension, then verify that D3 and D4 did not regress before release.

## Why This Pattern Works

This review pattern applies to any OpenClaw plugin that handles private data, network calls, or write actions. TweetClaw is just a concrete example with realistic X/Twitter automation surfaces. SkillCompass gives maintainers and users a repeatable quality gate before the plugin becomes part of an agent workflow.
