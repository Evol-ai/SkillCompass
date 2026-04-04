# /skill-update — 检查和更新 Skill

> **Locale**: 所有用户可见文本跟随会话语言。中文为默认示例，英文等效表述标注为 `EN:`。维度标签见 SKILL.md。

检查已安装 skill 的远程更新，引导用户更新并评测。

## Arguments

- (no args): 列出所有需要检查的 skill，让用户选择
- `<skill-name>`: 检查指定 skill 的更新
- `all`: 检查全部 git 仓库 skill

## Step 1: Load Inventory and Check Git Status

Use `lib/update-checker.js` to scan all skills:

```javascript
const { UpdateChecker } = require('./lib/update-checker');
const checker = new UpdateChecker();
const stale = checker.getStale(inventory, 7); // 7 天未检查的
const allGit = checker.checkAll(inventory);    // 所有 git 仓库 skill
```

Execute via **Bash** `node -e`.

If no git-based skills found:
```
未发现基于 git 仓库的 skill，无法检查更新。
手动安装的 skill 请前往来源页面查看是否有新版本。
```
EN: "No git-based skills found. For manually installed skills, check the source for updates."

Stop.

## Step 2: Display and Select

**If called with `all`**: skip selection, check all git skills.

**If called with `<skill-name>`**: skip selection, check that skill only.

**If called with no args**: show the list and let user choose. Follow gstack's AskUserQuestion pattern — re-ground context, simplify, recommend, show options with effort scale.

```
{N} 个 skill 可检查更新（基于 git 仓库）：

  1. code-review     上次检查: 12 天前   github.com/user/code-review
  2. superpowers     上次检查: 9 天前    github.com/obra/superpowers
  3. doc-writer      上次检查: 15 天前   github.com/user/doc-writer
  4. ecc             上次检查: 8 天前    github.com/affaan-m/everything-claude-code

检查更新需要联网（git fetch），每个约 5 秒。

输入编号、名称或逗号分隔多个（如 1,3），也可以输入"全部"。
直接输入其他 skill 名称也可以。

[全部检查 / 选择 / 跳过]
```

User can respond:
- "1,3" or "code-review, doc-writer" → check selected
- "全部" or "all" → check all
- "superpowers" → check just superpowers
- Any natural language like "前两个" → parse intent

## Step 3: Fetch and Report

For each selected skill, run `checker.fetchAndCheck(skillPath)` via **Bash** `node -e`. Show results one by one:

**Has updates:**
```
正在检查 code-review...
  ✓ fetch 完成 · 发现 2 个新提交（v1.2.0 → v1.3.0）

  [更新并评测（推荐）/ 查看变更 / 跳过]
```

If user chooses "查看变更", run `git log HEAD..FETCH_HEAD --oneline` and show, then re-offer the choice.

**Already up to date:**
```
正在检查 superpowers...
  ✓ 已是最新
```

**Fetch failed (network error):**
```
正在检查 doc-writer...
  ⚠ 无法连接远程仓库（网络问题或仓库已移除）
```

## Step 4: Apply Update

When user chooses "更新并评测":

1. Run `checker.pullUpdate(skillPath)` via **Bash** `node -e`
2. If pull fails (conflict):
   ```
   ⚠ 更新冲突——你可能对此 skill 有本地修改。
   [查看冲突 / 放弃更新并恢复 / 手动处理]
   ```
3. If pull succeeds:
   - PostToolUse Write hook 自动触发快检（eval-gate.js）
   - Show result:
   ```
   ✓ code-review 已更新到 v1.3.0
     D1=9 D2=8 D3=9 ✓ 快检通过

   上次完整评测 82分（v1.2.0），版本已变更，建议重新评测确认质量。
   [完整评测（推荐）/ 跳过]
   ```
4. If user chooses "完整评测":
   - Load and execute `commands/eval-skill.md` with `--internal` on the skill
   - Show result + follow-up choices

## Step 5: Summary

After all selected skills are checked:

```
✓ 更新检查完成
  检查 {N} 个 · 有更新 {U} 个 · 已更新 {A} 个 · 跳过 {S} 个

[返回 /skillcompass / 结束]
```

## Error Handling

- **git not installed**: "需要 git 命令行工具。" Stop.
- **Network timeout**: Show per-skill warning, continue with next.
- **Pull conflict**: Offer resolve/abort/manual options.
- **SKILL.md missing after update**: "更新后 SKILL.md 文件缺失，可能仓库结构已变更。[回滚 / 手动检查]"
