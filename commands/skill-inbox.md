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

Show up to 3 suggestions at a time. For each suggestion (numbered from 1):

```
{n}. {skill_name} — {reason}
   规则: {rule_id} · 优先级: {priority} · 类别: {category}
   证据: {evidence[0].field}={evidence[0].value}
   可做：保留 / 评估 / 删除 / 稍后提醒 / 忽略
```

Then prompt:

```
输入编号 + 操作（例如："1 保留" 或 "2 评估"）：
```

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
| dismiss / 忽略 | 忽略 | `store.dismiss(sugId, cooldownDays)` | `✓ 已忽略，{cooldownDays} 天内不再提醒` |
| mute / 不再关注 | 不再关注 | `store.disableSkill(skillName)`, `store.accept(sugId)`, `store.resolve(sugId)` | `✓ 已标记为不再关注。SkillCompass 不再为此 skill 生成建议，但不影响 skill 本身的运行。` |

Cooldown days for `dismiss` (use doubled cooldown after user dismisses):

| Rule ID | Cooldown days (doubled) |
|---------|------------------------|
| R1 | 14 |
| R2 | 21 |
| R6 | 14 |
| R8 | 28 |
| R9 | 14 |

Look up `cooldownDays` from the suggestion's `rule_id` using the table above.

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
输入编号选择 skill，可执行：pin / 不再关注 / 评估 / 优化 / 删除。输入 inbox 返回建议视图
```

### Handle Skill Selection

When the user enters a number, look up the corresponding skill from the numbered list. Show detail:

```
{name} {version}  ·  {status}  ·  最后活动 {modified_at|从未}

路径：{path}
分类：{purpose}
安装于：{first_seen_at}
版本数：{version_count|1}

可做：pin（保留）/ 不再关注 / 评估 / 优化 / 删除 / 返回
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
