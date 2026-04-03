# /skill-inbox — Skill 建议收件箱

Unified entry point for managing skill suggestions and browsing all installed skills. Provides two views: suggestions (default) and all skills.

## Arguments

- (no args): Show suggestions view (default)
- `all`: Show all installed skills view

## Step 1: Load Data

1. Use the **Read** tool to load `.skill-compass/setup-state.json`. If the file does not exist, output:
   ```
   未找到 setup-state.json。请先运行 /setup 建立 skill 清单。
   ```
   Then stop.

2. Extract the `inventory` array from setup-state.json. This is the full skill list.

3. Load inbox data using `lib/inbox-store.js`. Execute with the **Bash** tool:
   ```javascript
   node -e "
   const { InboxStore } = require('./lib/inbox-store');
   const store = new InboxStore('cc');
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
   const state = JSON.parse(fs.readFileSync('.skill-compass/setup-state.json', 'utf8'));
   const skillEntries = state.inventory || [];
   const engine = new InboxEngine('cc');
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
Skill Inbox — 建议 ({pendingCount})  |  全部 skill ({totalSkills})
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
Skill Inbox — 建议 (3)  |  全部 skill (12)

1. old-formatter — 安装 30 天，从未被调用过
   占 7.1KB 上下文但没有产出价值，清理后可释放空间。

2. k8s-deploy — 前两周使用 8 次，最近 7 天突然停用
   可能找到了替代方案，或遇到了问题。

3. translate — 仅使用过 1 次（3月15日），之后再未调用
   可能是一次性需求。
```

For state-changing actions, present keyboard-selectable choices per suggestion. The user can also respond with natural language for non-state-changing queries (e.g. "看看全部 skill"、"哪些没用过"), but state changes (pin/delete/mute/snooze) should go through explicit choice confirmation.

After the list, prompt:

```
选择一个建议查看操作选项，或直接告诉我你想怎么处理。
```

When user selects a suggestion (by number or by name), show the action choices as keyboard-selectable options:

```
old-formatter — 安装 30 天，从未被调用过

  [保留（不再提醒清理）]
  [评估质量]
  [删除]
  [稍后提醒（14 天后）]
  [查看详情]

```

"查看详情" expands to show rule_id, evidence, cooldown info — only when user explicitly asks.

### If no suggestions

Output:

```
暂无建议。

输入 all 查看和管理全部已安装 skill。
或运行 /skill-report 查看 skill 生态报告。
```

Stop.

### Handle Actions

Wait for the user's input in the form `{n} {action}`. Parse the suggestion number and action keyword (accept both Chinese and English forms per the table below).

For each action, execute the corresponding store methods via the **Bash** tool, then print the confirmation message.

| Action keyword | Chinese | What to execute | Confirmation output |
|----------------|---------|-----------------|---------------------|
| pin / 保留 | 保留 | `store.pinSkill(skillName)`, `store.accept(sugId)`, `store.resolve(sugId)` | `✓ 已保留 {name}，Hygiene 类规则不再提醒` |
| eval / 评估 | 评估 | `store.accept(sugId)` | `✓ 已加入评估队列。运行 /eval-skill {name}` |
| improve / 优化 | 优化 | `store.accept(sugId)` | `✓ 已加入优化队列。运行 /eval-improve {name}` |
| delete / 删除 | 删除 | `store.accept(sugId)` | `✓ 已标记待删除。确认删除请手动移除 SKILL.md 文件` |
| snooze / 稍后提醒 | 稍后提醒 | `store.snooze(sugId, 14)` | `✓ 已延后 14 天提醒` |
| dismiss / 忽略 | 忽略 | `store.dismiss(sugId, cooldownDays)` | `✓ 已忽略，一段时间内不再提醒此建议` |
| mute / 不再关注 | 不再关注 | `store.disableSkill(skillName)`, `store.accept(sugId)`, `store.resolve(sugId)` | `✓ 已标记为不再关注。SkillCompass 不再为此 skill 生成建议，但不影响 skill 本身的运行。` |

<!-- Internal: cooldown days by rule (doubled after dismiss):
R1=14, R2=21, R4=28, R5=14, R6=14, R7=28, R8=28, R9=14, R10=28, R11=14
Look up from the suggestion's rule_id. User never sees these values. -->

Execute the required store methods using the **Bash** tool:

```javascript
node -e "
const { InboxStore } = require('./lib/inbox-store');
const store = new InboxStore('cc');
// call the appropriate methods here based on action
"
```

After printing the confirmation, re-display the next pending suggestions (Step 4 again, paginating forward). If all suggestions for the current batch of 3 have been acted on and more remain, show the next batch. If none remain, show the empty state message.

## Step 5: All Skills View

Read the `inventory` array from setup-state.json. For each skill entry, determine its status:

**Activity** — based on usage data from `lib/usage-reader.js`:
- `活跃(N次/周)`: `use_count_7d > 0` — show the 7-day count
- `活跃(N次/2周)`: `use_count_7d = 0` but `use_count_14d > 0` — show the 14-day count
- `闲置`: `ever_used` is true but `use_count_14d = 0`
- `从未使用`: `ever_used` is false

Load usage data by running via the **Bash** tool:

```javascript
node -e "
const { UsageReader } = require('./lib/usage-reader');
const reader = new UsageReader('cc');
const allSignals = reader.getAllSignals();
console.log(JSON.stringify(allSignals));
"
```

`allSignals` is a map keyed by skill name. If the script fails or returns `{}`, treat all skills as `从未使用`.

Activity and usage data from `lib/usage-reader.js`. Run via Bash `node -e` with UsageReader.getAllSignals().

**Special status** — check `inboxData.skillCache` for the skill name:
- If `skillCache[name].pinned === true` → label `已 pin`
- If `skillCache[name].disabled === true` → label `已忽略`
  Special status overrides activity label.

**Group skills by category** using the `purpose` field from the inventory entry (Code/Dev, Deploy/Ops, Data/API, Productivity, Other). Assign the same way as `/setup`: keyword-match on `description` if `purpose` is absent.

**Quality badge** — for each skill, determine `badge` and `eval_info`:

Badge logic:
1. Check `.skill-compass/cc/{name}/manifest.json` or `.skill-compass/{name}/manifest.json` for full eval scores
   - Has `scores.overall` → use total score + verdict symbol + "eval {date}"
   - verdict symbol: `✓` if PASS (overall >= 70), `⚠` if CAUTION (50–69), `✗` if FAIL (< 50)
2. If no manifest with `scores.overall`, check `.skill-compass/cc/quick-scan-cache.json` for quick scan results
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
  - If manifest has full eval: `{score}分 · eval {date}`
  - If only quick-scan-cache: `D1={d1} · scan {date}`
  - If neither: empty

Then prompt:

```
选择一个 skill 查看详情，或告诉我你想做什么（比如"把没用过的列出来"、"superpowers 评估一下"）。
输入 inbox 返回建议视图。
```

### Handle Skill Selection

When the user enters a number, look up the corresponding skill from the numbered list. Show detail:

```
{name} {version}  ·  {status}  ·  最后活动 {modified_at|从未}

路径：{path}
分类：{purpose}
安装于：{first_seen_at}
版本数：{version_count|1}

  [保留（pin）]
  [不再关注]
  [评估质量]
  [优化]
  [删除]
  [返回列表]
```

Wait for the user's action input. Handle each action (no suggestion ID here — update skill cache directly):

| Action | What to execute | Confirmation output |
|--------|-----------------|---------------------|
| pin / 保留 | `store.pinSkill(name)` | `✓ 已保留` |
| 不再关注 / mute | `store.disableSkill(name)` | `✓ 已标记为不再关注。SkillCompass 不再为此 skill 生成建议，但不影响 skill 本身的运行。` |
| 评估 / eval | (no store call) | `运行 /eval-skill {name}` |
| 优化 / improve | (no store call) | `运行 /eval-improve {name}` |
| 删除 / delete | (no store call) | `确认删除请手动移除 SKILL.md 文件` |
| 返回 / back | (no store call) | Return to All Skills View (Step 5) |

Execute pin/disable actions via the **Bash** tool:

```javascript
node -e "
const { InboxStore } = require('./lib/inbox-store');
const store = new InboxStore('cc');
// call store.pinSkill(name) or store.disableSkill(name)
"
```

After the action confirmation, ask if the user wants to select another skill or return to a view:

```
继续查看其他 skill？输入编号，或输入 inbox 返回建议视图，或直接按 Enter 退出。
```
