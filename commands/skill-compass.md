# /skillcompass — Natural Language Dispatcher

This command accepts free-form natural language and routes to the appropriate SkillCompass command. Also accessible as `/skill-compass`.

> **Locale**: 所有用户可见文本跟随会话语言。运行时默认英文；若宿主提供 locale，或检测到用户使用受支持的其他语言，则切换到对应语言。本文件中的中文示例仅用于说明。维度标签见 SKILL.md。
> EN: All user-facing text follows session language. Runtime defaults to English and switches to the host-provided locale or detected supported user language when available. Chinese examples in this spec are illustrative only. Dimension labels: see SKILL.md.

## Arguments

- `<message>` (required): Natural language description of what the user wants to do.

## Step 0: Setup-State Check

Before dispatching, check whether `.skill-compass/setup-state.json` exists.

- **If NOT exist**: inform the user and guide to `/inbox` (which auto-initializes):
  - "SkillCompass 尚未初始化。输入 /inbox 开始。"
  - EN: "SkillCompass is not set up yet. Type /inbox to get started."
- **If exists**: proceed to Step 1.

## Step 1: Skill Name Detection

Before keyword matching, check if the user's message contains a **known skill name**.

Read `.skill-compass/setup-state.json` → `inventory` array. Build a list of all skill names (including collection children's `qualified` names like `superpowers:writing-plans`).

Scan the user's message for any exact match against this list. If a known skill name is found, extract it as `target_skill` and proceed to intent inference:

| 动作词 | 推断路由 | 说明 |
|--------|---------|------|
| 评测, 怎么样, 看看质量, 检查, evaluate, check, assess | eval-skill `target_skill` | 评测该 skill |
| 优化, 改进, 修一下, improve, fix, upgrade | eval-improve `target_skill` | 优化该 skill |
| 删掉, 移除, 不要了, 不用了, remove, delete | skill-inbox（定位到 `target_skill`） | 引导删除 |
| 不再关注, mute | skill-inbox（mute `target_skill`） | 标记不再关注 |
| 回滚, 恢复, rollback, revert | eval-rollback `target_skill` | 回滚版本 |
| 安全, security, 扫描安全 | eval-security `target_skill` | 安全扫描 |
| 对比, 比较, compare, diff | eval-compare `target_skill` | 版本对比 |
| 更新, update, 检查更新, 有没有新版本 | skill-update `target_skill` | 检查该 skill 更新 |
| （无动作词，只提了名字） | skill-inbox（展示 `target_skill` 详情） | 展示详情 + 操作选项 |

示例：
- "评测一下 superpowers" → eval-skill superpowers
- "old-formatter 删掉" → skill-inbox locate old-formatter
- "code-review" → skill-inbox 展示 code-review 详情
- "更新 superpowers" → skill-update superpowers
- "superpowers:writing-plans 怎么样" → eval-skill superpowers（归到父级）

**集合子 skill 处理：** 如果匹配到 qualified name（如 `superpowers:writing-plans`），提取父级名称（`superpowers`）作为 `target_skill`。评测和操作针对父级集合进行。

如果检测到 skill 名称且推断了路由 → 跳过 Step 2，直接进入 Step 3 Dispatch。

## Step 2: Keyword Intent Matching

如果 Step 1 未匹配到 skill 名称，用关键词匹配意图。**所有关键词都带 "skill" 限定，避免和编程对话冲突：**

| Intent keywords | Maps to | Command file |
|-----------------|---------|-------------|
| setup, skill inventory, skill health check, scan my skills, what skills do I have | setup | `commands/setup.md` |
| evaluate skill, score skill, assess skill, rate skill, diagnose skill, 评测 skill | eval-skill | `commands/eval-skill.md` |
| improve skill, optimize skill, fix skill, upgrade skill, 优化 skill, 改进 skill | eval-improve | `commands/eval-improve.md` |
| skill security, skill vulnerability, skill 安全 | eval-security | `commands/eval-security.md` |
| audit skills, batch evaluate, evaluate all skills, 批量评测 | eval-audit | `commands/eval-audit.md` |
| compare skill versions, skill diff, skill 对比 | eval-compare | `commands/eval-compare.md` |
| skill merge, merge skill with upstream, skill 合并 | eval-merge | `commands/eval-merge.md` |
| rollback skill, revert skill, restore skill version, skill 回滚 | eval-rollback | `commands/eval-rollback.md` |
| evolve skill, auto-improve skill, keep improving until pass | eval-evolve | `commands/eval-evolve.md` |
| inbox, skill 建议, skill suggestions, 待处理, manage skills | skill-inbox | `commands/skill-inbox.md` |
| 右下角, 下面的数字, 下面提示, pending, 🧭, 状态栏 | skill-inbox | `commands/skill-inbox.md` |
| 我有哪些 skill, 全部 skill, show all skills, 看看所有 skill | skill-inbox | `commands/skill-inbox.md` (arg: all) |
| 没用过的 skill, 闲置 skill, unused skills, idle skills | skill-inbox | `commands/skill-inbox.md` (arg: all, filter unused) |
| 删掉 skill, 移除 skill, remove skill, 不想用 skill | skill-inbox | `commands/skill-inbox.md` (locate skill) |
| skill report, skill 报告, skill portfolio, skill 体检 | skill-report | `commands/skill-report.md` |
| 上下文不够, skill 太多, skill 占空间, context pressure | skill-report | `commands/skill-report.md` |
| skill 使用情况, skill usage, 哪些 skill 用得多 | skill-report | `commands/skill-report.md` |
| 检查更新, 更新 skill, check update, update skill, 有没有新版本 | skill-update | `commands/skill-update.md` |
| 重新扫描 skill, 刷新 skill 清单, 安装了新 skill, rescan skills | setup | `commands/setup.md` |

**匹配优先级：** Step 1（skill 名称 + 动作词） > Step 2（关键词匹配）

**If no intent matches:**

```
没有匹配到操作。你可以告诉我具体的 skill 名称，或选择：
[查看 skill 建议 / 查看 skill 报告 / 评测某个 skill]
```
EN: "Not sure what you'd like to do. You can mention a specific skill name, or choose: [View skill suggestions / View skill report / Evaluate a skill]"

## Step 3: Extract Arguments

From the user's message, extract:
- **Skill name / path**: from Step 1 detection or explicit path in message
- **Flags**: any explicit flags (e.g., `--scope gate`, `--ci`)
- **Version references**: version numbers or words like "previous", "last"

If the matched command requires a skill path but none was found (and Step 1 didn't detect a name):
- "请指定 skill 名称，或从列表中选择。[查看全部 skill]"
- EN: "Please specify a skill name, or choose from the list. [Show all skills]"

## Step 4: Dispatch

Use the **Read** tool to load `{baseDir}/commands/{matched-command}.md` and execute it with the extracted arguments.
