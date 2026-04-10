# /skill-inbox — Skill Suggestion Inbox

Unified entry point for managing skill suggestions and browsing all installed skills. Provides two views: suggestions (default) and all skills.

## Arguments

- (no args): Show suggestions view (default)
- `all`: Show all installed skills view

## Step 1: Load Data

1. Use the **Read** tool to load `.skill-compass/setup-state.json`. If the file does not exist, this is a first-time use. Auto-initialize:

   1. Run skill discovery silently (same as setup Step 3: scan immediate children of skill directories for `*/SKILL.md` — do NOT recurse).
   2. Run quick scan D1+D2+D3 on all discovered skills.
   3. Save `setup-state.json`.
   4. Show a brief summary:

      ```
      Found {N} skill(s){, M with security risks if any high risk}.
      Usage data accumulates automatically; you'll be notified when suggestions appear.
      ```

   Then check for statusLine configuration (see `setup.md` StatusLine integration section). If no statusLine is configured, offer the choice.

   After initialization, continue to Step 2 (show header) and proceed normally. The inbox will be empty (no suggestions yet since no usage data), but the all-skills view will be populated.

2. Extract the `inventory` array from setup-state.json. This is the full skill list.

3. Load inbox data using `lib/inbox-store.js`. Execute with the **Bash** tool:
   ```javascript
   node -e "
   const { InboxStore } = require('./lib/inbox-store');
   const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
   const store = new InboxStore('cc', baseDir);
   store.reactivateSnoozed();
   const allCache = store.getAllSkillCache();
   const cacheMap = {};
   allCache.forEach(c => { cacheMap[c.skill_name] = c; });
   console.log(JSON.stringify({
     pending: store.getPending(),
     skillCache: cacheMap
   }, null, 2));
   "
   ```
   Parse the output as `inboxData`. `skillCache` is a map keyed by skill name. If the script fails, treat `pending` as `[]` and `skillCache` as `{}`.

4. Check if a weekly digest is due and run it if so. Execute with the **Bash** tool:
   ```javascript
   node -e "
   const { InboxEngine } = require('./lib/inbox-engine');
   const fs = require('fs');
   const path = require('path');
   const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
   const setupPaths = [
     path.join(baseDir, '.skill-compass', 'cc', 'setup-state.json'),
     path.join(baseDir, '.skill-compass', 'setup-state.json')
   ];
   let state = { inventory: [] };
   for (const sp of setupPaths) {
     if (fs.existsSync(sp)) { state = JSON.parse(fs.readFileSync(sp, 'utf8')); break; }
   }
   const skillEntries = state.inventory || [];
   const engine = new InboxEngine('cc', baseDir);
   if (engine.isDigestDue(7)) {
     const result = engine.runDigest(skillEntries);
     console.log(JSON.stringify({ ran: true, added: result.added }));
   } else {
     console.log(JSON.stringify({ ran: false, added: 0 }));
   }
   "
   ```
   If `ran` is true and `added > 0`, note that `added` new suggestions were generated. Re-load `inboxData.pending` by re-running Step 1.3.

## Step 2: Show Header

Compute:
- `pendingCount`: `inboxData.pending.length`
- `totalSkills`: `inventory.length`

Always display:

```
Skill Inbox — Suggestions ({pendingCount})  |  All skills ({totalSkills})
```

## Step 3: Route to View

- If argument is `all` → go to Step 5 (All Skills View).
- Otherwise → go to Step 4 (Suggestions View).

## Step 4: Suggestions View (Default)

Get pending suggestions from `inboxData.pending` (already sorted by priority).

### If suggestions exist

Show up to 3 suggestions at a time. Present each conversationally — explain what was detected and why it matters. Do NOT show rule_id, priority, category, or evidence directly. These are internal metadata; the reason text already summarizes the situation.

Example output:

```
Skill Inbox — Suggestions (3)  |  All skills (12)

1. old-formatter — installed 30 days ago, never invoked
   Uses 7.1KB of context without producing value; cleaning it up frees space.

2. k8s-deploy — used 8 times in the prior two weeks, suddenly stopped in the last 7 days
   May indicate the user found an alternative or hit a problem.

3. translate — used only once (March 15), never again
   May have been a one-off need.
```

For state-changing actions, present keyboard-selectable choices per suggestion. The user can also respond with natural language for non-state-changing queries (e.g. "show all skills", "which haven't been used"), but state changes (pin/delete/mute/snooze) should go through explicit choice confirmation.

After the list, prompt:

```
Choose a suggestion to see action options, or tell me how you'd like to handle it.
```

When user selects a suggestion (by number or by name), show the action choices as keyboard-selectable options:

```
old-formatter — installed 30 days ago, never invoked

  [Pin (stop suggesting cleanup)]
  [Evaluate quality]
  [Delete]
  [Remind later (in 14 days)]
  [View details]

```

"View details" expands to show rule_id, evidence, cooldown info — only when user explicitly asks.

### If no suggestions

Output:

```
All suggestions processed ✓ Skill usage data is accumulating.

[View all skills / View skill report / Done]
```

Stop.

### Handle Actions

Wait for the user's input in the form `{n} {action}`. Parse the suggestion number and action keyword per the table below.

For each action, execute the corresponding store methods via the **Bash** tool, then print the confirmation message.

| Action keyword | What to execute | Confirmation output |
|----------------|-----------------|---------------------|
| pin | `store.pinSkill(skillName)`, `store.accept(sugId)`, `store.resolve(sugId)` | `✓ Pinned {name}; Hygiene rules will no longer suggest cleanup.` |
| eval | `store.accept(sugId)` | `✓ Added to eval queue. Run /eval-skill {name}.` |
| improve | `store.accept(sugId)` | `✓ Added to improve queue. Run /eval-improve {name}.` |
| delete | `store.accept(sugId)` | `✓ Marked for deletion. To confirm deletion, manually remove the SKILL.md file.` |
| snooze | `store.snooze(sugId, 14)` | `✓ Snoozed for 14 days.` |
| dismiss | `store.dismiss(sugId, cooldownDays)` | `✓ Dismissed; this suggestion is suppressed for a while.` |
| mute | `store.disableSkill(skillName)`, `store.accept(sugId)`, `store.resolve(sugId)` | `✓ Marked as no longer tracked. SkillCompass will stop generating suggestions for this skill, but will not affect the skill's own execution.` |

<!-- Internal: cooldown days by rule (doubled after dismiss):
R1=14, R2=21, R4=28, R5=14, R6=14, R7=28, R8=28, R9=14, R10=28, R11=14
Look up from the suggestion's rule_id. User never sees these values. -->

Execute the required store methods using the **Bash** tool:

```javascript
node -e "
const { InboxStore } = require('./lib/inbox-store');
const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
const store = new InboxStore('cc', baseDir);
// call the appropriate methods here based on action
"
```

After printing the action confirmation, check remaining pending suggestions:
- If there are remaining pending suggestions, show:
  ```
  {N} more suggestion(s) remaining. [Continue / Done]
  ```
- If no remaining suggestions, show:
  ```
  All suggestions processed ✓
  [View all skills / View skill report / Done]
  ```

Then re-display the next pending suggestions (Step 4 again, paginating forward). If all suggestions for the current batch of 3 have been acted on and more remain, show the next batch. If none remain, show the empty state message.

## Step 5: All Skills View

Read the `inventory` array from setup-state.json. For each skill entry, determine its status:

**Activity** — based on usage data from `lib/usage-reader.js`:
- `active(N/week)`: `use_count_7d > 0` — show the 7-day count
- `active(N/2wk)`: `use_count_7d = 0` but `use_count_14d > 0` — show the 14-day count
- `idle`: `ever_used` is true but `use_count_14d = 0`
- `never_used`: `ever_used` is false

Load usage data by running via the **Bash** tool:

```javascript
node -e "
const { UsageReader } = require('./lib/usage-reader');
const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
const reader = new UsageReader('cc', baseDir);
const allSignals = reader.getAllSignals();
console.log(JSON.stringify(allSignals));
"
```

`allSignals` is a map keyed by skill name. If the script fails or returns `{}`, treat all skills as `never_used`.

Activity and usage data from `lib/usage-reader.js`. Run via Bash `node -e` with UsageReader.getAllSignals().

**Special status** — check `inboxData.skillCache` for the skill name:
- If `skillCache[name].pinned === true` → label `pinned`
- If `skillCache[name].disabled === true` → label `muted`
  Special status overrides activity label.

**Group skills by category** using the `purpose` field from the inventory entry (Code/Dev, Deploy/Ops, Data/API, Productivity, Other). Assign the same way as `/setup`: keyword-match on `description` if `purpose` is absent.

**Quality badge** — for each skill, determine `badge` and `eval_info`:

Badge logic:
1. Check `.skill-compass/cc/{name}/manifest.json` or `.skill-compass/{name}/manifest.json` for a real eval record. Find the most recent entry in `versions[]` where `trigger === 'eval'` and `overall_score != null`.
   - Found → use `overall_score` + verdict symbol + "eval {date}" (from that entry's `timestamp`)
   - verdict symbol: use the entry's `verdict` field if present (`PASS`→`✓`, `CAUTION`→`⚠`, `FAIL`→`✗`). If `verdict` is absent, derive from `overall_score`: `✓` (≥70), `⚠` (50–69), `✗` (<50)
2. If no eval record found, check `.skill-compass/cc/quick-scan-cache.json` for quick scan results
   - Has result for the skill → show lowest dimension score + scan symbol + "scan {date}"
3. If neither → show `—`

Display grouped output (number skills sequentially across all groups):

```
{Category} ({count})
  {n}. {name}    {badge}  {version}  {status}    {eval_info}

{Category} ({count})
  {n}. {name}    {badge}  {version}  {status}    {eval_info}
```

Where:
- `badge`: `✓` (clean/PASS), `⚠` (medium/CAUTION), `✗` (high_risk/FAIL), `—` (no eval data)
- `eval_info`:
  - If manifest has full eval: `{score} · eval {date}`
  - If only quick-scan-cache: `D1={d1} · scan {date}`
  - If neither: empty

Then prompt:

```
Choose a skill to view details, or tell me what you want to do (e.g., "list unused skills", "evaluate superpowers").
Type `inbox` to return to the suggestion view.
```

### Handle Skill Selection

When the user enters a number, look up the corresponding skill from the numbered list. Show detail:

```
{name} {version}  ·  {status}  ·  last active {modified_at|never}

Path:       {path}
Category:   {purpose}
Installed:  {first_seen_at}
Versions:   {version_count|1}

  [Pin]
  [Mute]
  [Evaluate quality]
  [Improve]
  [Delete]
  [Back to list]
```

Wait for the user's action input. Handle each action (no suggestion ID here — update skill cache directly):

| Action | What to execute | Confirmation output |
|--------|-----------------|---------------------|
| pin | `store.pinSkill(name)` | `✓ Pinned` |
| mute | `store.disableSkill(name)` | `✓ Marked as no longer tracked. SkillCompass will stop generating suggestions for this skill, but will not affect the skill's own execution.` |
| eval | (no store call) | `Run /eval-skill {name}` |
| improve | (no store call) | `Run /eval-improve {name}` |
| delete | (no store call) | `To confirm deletion, manually remove the SKILL.md file.` |
| back | (no store call) | Return to All Skills View (Step 5) |

Execute pin/disable actions via the **Bash** tool:

```javascript
node -e "
const { InboxStore } = require('./lib/inbox-store');
const baseDir = process.env.CLAUDE_PLUGIN_ROOT || process.cwd();
const store = new InboxStore('cc', baseDir);
// call store.pinSkill(name) or store.disableSkill(name)
"
```

After the action confirmation, ask if the user wants to select another skill or return to a view:

```
Continue viewing other skills? Enter a number, type `inbox` to return to the suggestion view, or press Enter to exit.
```
