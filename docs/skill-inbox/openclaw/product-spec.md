# SkillCompass OpenClaw 版 — 产品功能规格

> 基于 OpenClaw 源码调研（github.com/openclaw/openclaw）和 Claude Code 版 v1.1.0 的经验，
> 定义 OC 端的完整功能范围。

## 一、平台能力对比

| 能力 | Claude Code | OpenClaw | 对 SkillCompass 的影响 |
|------|-----------|----------|---------------------|
| 定时任务 | SessionStart 懒加载 | **持久化 cron**（jobs.json，重启不丢） | OC 可后台跑 digest，CC 需用户在线 |
| Plugin 系统 | 无（只有 hooks.json） | **完整 TypeScript SDK**，200+ subpath | OC 可注册为原生 plugin |
| Hook 深度 | PostToolUse/SessionStart/End | **双系统**（internal + plugin），before/after agent/tool | OC 可捕获 skill 执行结果 |
| 消息推送 | statusLine（被动） | **24+ 渠道**（Telegram/Slack/Discord/WhatsApp） | OC 可主动推送到 IM |
| Web UI | 无 | registerHttpRoute / registerService | OC 未来可做 dashboard |
| 模型 | Claude Opus/Sonnet | **多模型**（GPT-4/Gemini/Llama/Mistral 等） | 评测引擎需适配弱模型 |
| Skill 来源 | ~/.claude/skills/ | **ClawHub marketplace** + 本地 | OC 有版本更新 API |
| 状态持久化 | 文件（session 内） | **跨 session plugin state** + SQLite | OC 状态管理更可靠 |
| 任务系统 | 无 | **SQLite task registry**（7 天保留） | OC 可追踪后台任务 |

## 二、功能清单：与 CC 版的异同

### 共享（代码级复用）

| 模块 | 文件 | 说明 |
|------|------|------|
| Inbox 数据层 | `lib/inbox-store.js` | 读写 inbox.json，状态机，cooldown。传 `platform: 'oc'` |
| 规则引擎 | `lib/inbox-engine.js` | 8 条规则（R1-R10 去 R3/R4/R11，去 R12 改用 R15）。通过规则注册模式扩展 |
| 使用数据读取 | `lib/usage-reader.js` | 解析 usage.jsonl，计算派生信号 |
| 快检 | `lib/quick-scan.js` | D1+D2+D3 本地 validator。完全复用 |
| 更新检查 | `lib/update-checker.js` | git-based 检查。完全复用 |
| 安全 patterns | `lib/patterns.js` | 含嵌入式 shell 检测。完全复用 |
| 评分规则 | `shared/scoring.md` | D1-D6 权重和评分逻辑 |

### OC 独有

| 功能 | CC 版 | OC 版 | 差异原因 |
|------|------|------|---------|
| **Plugin 注册** | hooks.json 静态配置 | `register(api)` TypeScript SDK | OC 是原生 plugin 架构 |
| **使用追踪 hook** | PostToolUse Skill（加载阶段） | `after_agent_tool`（执行完成后） | **OC 可拿到执行结果** |
| **Cron 调度** | SessionStart 检查 last_digest_at | `api.cron.register()` 持久化 weekly 定时任务 | OC 后台运行，不需用户在线 |
| **推送渠道** | statusLine 🧭 N pending | cron announce → Telegram/Slack/Discord | OC 主动推送到 IM |
| **安装检测** | SessionStart + 版本文件比较 | `plugin_installed` / `plugin_updated` hook | OC 有原生生命周期事件 |
| **更新检查** | R12 git fetch（用户主动触发） | **R15 ClawHub marketplace API**（替代 R12，自动检查） | OC 默认 ClawHub 来源 |
| **交互方式** | CLI slash 命令 + 键盘选择 | **结构化命令 + inline button** | OC 运行在聊天平台中 |
| **执行结果追踪** | 不可用（只有加载阶段） | `after_agent_tool` 采集（v1 仅存储，不触发规则） | **OC 独有数据源** |
| **评测引擎** | Claude 全维度 D1-D6 | **D1+D2+D3 本地 + D4/D5/D6 降级** | OC 模型能力受限 |

### OC 不做（与 CC 不同的部分）

| CC 功能 | OC 处理 | 原因 |
|---------|--------|------|
| statusLine 集成 | 不需要 | OC 用 IM 推送替代 |
| hud-extra.js | 不需要 | 无 claude-hud |
| SessionStart additionalContext 注入 | plugin hook 替代 | OC 有更好的注入机制 |
| SKILL.md Post-Install Onboarding | plugin onInstall hook | OC 有原生生命周期 |

## 三、OC 独有功能详细设计

### 3.1 ClawHub 版本更新检查（替代 R12 git-based）

CC 版的 R12 靠 `git fetch` 检查更新。OC 的 skill 主要来自 ClawHub marketplace，有原生 API：

```typescript
// OC plugin 内
import { clawhub } from 'openclaw/infra/clawhub';

async function checkUpdates(inventory) {
  for (const skill of inventory) {
    if (skill.source === 'clawhub') {
      const latest = await clawhub.getLatestVersion(skill.slug);
      if (latest.version !== skill.version) {
        // 有更新
        store.addSuggestion({
          rule_id: 'R12-check-update',
          skill_name: skill.name,
          reason: `New version ${latest.version} available (current: ${skill.version})`,
          evidence: [{ field: 'latest_version', value: latest.version }]
        });
      }
    }
  }
}
```

不需要 git fetch，不需要用户主动触发。Cron 定时自动检查。

### 3.2 执行结果追踪（OC 独有信号）

CC 版拿不到的数据，OC 通过 `after_agent_tool` hook 可以拿到：

```typescript
api.registerHook('after_agent_tool', async (event) => {
  if (event.tool_name === 'skill' || event.tool_type === 'skill') {
    const record = {
      type: 'skill_used',
      skill: event.skill_name,
      timestamp: new Date().toISOString(),
      success: !event.error,
      output_length: event.result?.length || 0,
      error_message: event.error?.message || null,
      duration_ms: event.duration_ms || null
    };
    appendToUsageLog(record);
  }
});
```

v1 **不基于执行结果触发规则**——归因困难（错误可能来自模型而非 skill，执行时间受模型/网络/负载影响，空输出可能是正常行为）。数据先攒着，未来规则成熟后再启用。

用途：
- 丰富 R7/R8 的使用频次信号（比 CC 仅统计加载更精确）
- 未来分析的数据储备

### 3.3 IM 推送（替代 statusLine）

CC 版：用户看 statusLine 🧭 → 输入 /skillcompass → 查看建议

OC 版：建议主动推送到用户的 IM（仅 weekly digest，不做 daily）：

```typescript
// Weekly digest cron job
api.cron.register({
  name: 'skillcompass-weekly',
  cron: '0 10 * * 1', // 每周一 10:00
  session: 'isolated',
  handler: async () => {
    const engine = new InboxEngine('oc');
    const result = engine.runDigest(inventory);
    
    if (result.added > 0) {
      // 推送到用户配置的渠道
      await api.channels.announce({
        message: formatDigest(result),
        channel: userConfig.preferredChannel // telegram/slack/discord
      });
    }
  }
});
```

**推送频率控制：**
- 仅 weekly digest，不做 daily
- 同一小时内多条消息合并为一条
- 每日推送上限 3 条（超出进队列等下次）
- 支持 quiet hours 配置（默认 22:00-09:00 不推送）

用户在 IM 中看到：

```
🧭 SkillCompass Weekly — 3 suggestions

1. old-formatter — installed 30 days, never invoked
2. k8s-deploy — usage declined sharply this week
3. code-review — 50 uses, never evaluated

[Handle #1] [Handle #2] [Handle #3] [Dismiss All]
```

### 3.4 安装时自动检测（替代 SessionStart 版本检测）

```typescript
api.registerHook('plugin_installed', async (event) => {
  // 新 skill 安装时自动快检 D1+D2+D3
  const scanner = new QuickScanner('oc');
  const result = scanner.scanOne(event.skillPath, event.skillName);
  
  // 仅 D3 Critical/High 时立即推送安全告警
  // D1/D2 结构/触发问题纳入下次 weekly digest，不单独推送
  if (result.d3_score <= 6 || result.has_critical_finding) {
    await api.channels.announce({
      message: `⚠ Security risk in ${event.skillName}: ${result.findings[0]}`,
      channel: userConfig.preferredChannel
    });
  }
});

api.registerHook('plugin_updated', async (event) => {
  // 更新后自动重新快检
  // ... 同上
});
```

### 3.5 评测引擎降级策略

OC 用户可能使用 GPT-4o-mini、Gemini Flash、Llama 等模型。评测策略：

| 维度 | 实现方式 | 模型依赖 | OC 策略 |
|------|---------|---------|---------|
| D1 结构 | structure-validator.js | 无 | 完全本地，不降级 |
| D2 触发 | trigger-validator.js | 无 | 完全本地，不降级 |
| D3 安全 | security-validator.js + patterns.js | 无 | 完全本地，不降级 |
| D4 功能 | LLM 分析 | **高** | 标注模型名称 + 精度警告 |
| D5 对比 | LLM with/without 实验 | **极高** | 仅在强模型下可用，否则跳过 |
| D6 独特 | 关键词重叠 + LLM 分析 | 中 | 本地关键词部分可用，LLM 部分降级 |

**评测命令自动检测模型能力：**

```
模型能力判断：
  GPT-4o / Gemini Pro / Claude Sonnet → D1-D6 全维度
  GPT-4o-mini / Gemini Flash / Llama 70B → D1-D3 + D4(标注精度有限) + D6(本地部分)
  Llama 8B / 小模型 → 仅 D1-D3
```

## 四、OC 版 Plugin 架构

```
skillcompass-oc/
  package.json
  src/
    plugin.ts              — Plugin 入口：register(api)
    hooks/
      after-tool.ts        — 使用追踪（含执行结果）
      plugin-lifecycle.ts  — 安装/更新检测
      session-lifecycle.ts — session 事件
    cron/
      weekly-digest.ts     — 每周规则检查（唯一定时推送）
      update-check.ts      — ClawHub 版本检查（R15）
    commands/
      sc.ts                 — /sc 结构化命令（status/eval/report/dismiss/snooze）
      eval-skill.ts         — /eval-skill 适配
    renderers/
      im-message.ts        — IM 渠道消息格式化 + inline button 构建
      digest-formatter.ts  — Digest 摘要格式
  lib/                      — 从 CC 版共享（symlink 或 copy）
    inbox-store.js
    inbox-engine.js
    usage-reader.js
    quick-scan.js
    update-checker.js
    patterns.js
```

## 五、数据隔离

```
.skill-compass/
  cc/                    ← Claude Code 数据（如果同时安装）
    inbox.json
    usage.jsonl
    setup-state.json
    ...
  oc/                    ← OpenClaw 数据
    inbox.json
    usage.jsonl
    setup-state.json
    package-skill-map.json
    ...
```

CC 和 OC 的数据完全独立。同一台机器可以同时安装两个版本。

## 六、UX 交互设计

> **设计原则**：OC 端使用结构化命令 + inline button，不依赖自然语言解析（弱模型下不可靠）。

### 6.1 引导流程

CC 版：SessionStart hook 注入 → Claude 看到后主动引导

OC 版：`plugin_installed` hook 直接推送到 IM：

```
[Telegram / Slack / Discord]

🧭 SkillCompass installed!

Evaluate skill quality, find the weakest area, and improve it.
Also tracks usage to spot idle or risky skills.

Scanning your skills...
Found 12 skills, 1 with security risk (old-formatter).

[View Risk Details] [Skip]
```

### 6.2 日常交互

使用结构化命令，不依赖自然语言意图解析：

```
User: /sc status
Bot: 🧭 12 skills tracked. 2 suggestions pending.

  1. old-formatter — 30 days, never invoked
  2. code-review — used 50 times, never evaluated
  
  [Handle #1] [Handle #2] [View All]

User: /sc eval code-review
Bot: Running D1+D2+D3 quick scan...
     ✓ D1=9 D2=8 D3=9 Clean.
     
     Full D4-D6 evaluation requires a capable model.
     Current model: gpt-4o-mini (limited accuracy for D4/D5).
     [Run full eval anyway] [Run D1-D3 only] [Skip]

User: [Run full eval anyway]
Bot: ⚠ Note: D4/D5 results may be less accurate with gpt-4o-mini.
     Running...
     
     ✓ Eval complete: 78/100 PASS
     Weakest: Trigger (6.5/10)
     
     Improve trigger quality? This is your most-used skill (12x/week).
     [Improve] [Skip]
```

**可用命令：**
| 命令 | 说明 |
|------|------|
| `/sc status` | 查看 skill 总览和 pending 建议 |
| `/sc eval <skill>` | 评测指定 skill |
| `/sc report` | 生成 skill 报告 |
| `/sc dismiss <id>` | 忽略某条建议 |
| `/sc snooze <id>` | 延后某条建议 |

### 6.3 定时推送

```
[每周一 10:00 — weekly digest]

🧭 SkillCompass Weekly Digest

Changes this week:
  · code-review used 12 times (↑ from 8 last week)
  · k8s-deploy dropped to 0 (was 5 last week)
  · New: doc-writer installed and used 3 times

Suggestions:
  1. k8s-deploy — usage declined. Issue or replaced?
  2. code-review — high frequency, last eval 45 days ago

[Handle #1] [Handle #2] [Dismiss All]
```

### 6.4 更新推送

```
[ClawHub 更新检测 — R15 触发]

🧭 Update available

code-review: v1.2.0 → v1.3.0
Changelog: "Fixed trigger for Python files, improved security checks"

[Update + re-scan] [View changelog] [Skip]
```

## 七、OC 规则集

CC 共享规则（去 R3/R4/R11/R12）+ OC 独有 R15：

| Rule ID | 来源 | 说明 |
|---------|------|------|
| R1 never-used | 共享 | 安装 >7 天未使用 |
| R2 idle | 共享 | >14 天未使用 |
| R5 declining | 共享 | 使用量骤降 |
| R6 undo-2x | 共享 | 7 天内 ≥2 次回滚 |
| R7 heavy-no-eval | 共享 | 高频使用但从未评测 |
| R8 stale-eval | 共享 | 高频使用但评测过期 |
| R9 duplicate-loser | 共享 | 重复 skill 中使用量较低的 |
| R10 one-and-done | 共享 | 仅用过一次且 >14 天 |
| **R15 clawhub-update** | **OC 独有** | ClawHub 有新版本可用（替代 CC 的 R12 git-based） |

**不做的规则（v1）：**
| 规则 | 不做原因 |
|------|---------|
| R12 git-based update | OC 默认 ClawHub 来源，R15 替代 |
| R13 error-rate | 归因困难：错误可能来自模型而非 skill |
| R14 slow-execution | 执行时间受 skill/模型/网络/负载多因素影响，无法归因 |
| R-empty-output | 空输出可能是正常行为（如 lint 无发现），定义不明确 |

## 八、开发优先级

### P0（核心）
1. Plugin 骨架：register(api) + hook 注册
2. 使用追踪：after_agent_tool hook → usage.jsonl（仅采集，不触发规则）
3. Cron 定时 digest：weekly only（不做 daily）
4. IM 推送：formatDigest → channels.announce + 频率控制（合并窗口 / 每日上限 / quiet hours）
5. `/sc` 结构化命令注册 + inline button 交互

### P1（完整体验）
6. 安装/更新生命周期 hook（D3 Critical/High 时才推送告警）
7. ClawHub 版本检查（R15）
8. 评测引擎模型适配（D4/D5 降级策略）
9. eval-skill / eval-improve OC 适配

### P2（增强）
10. 多渠道配置 UI
11. Web dashboard（registerHttpRoute）
12. 基于执行结果的规则（待归因问题解决后再启用）

## 九、与 CC 版的开发关系

```
skillcompass/
  lib/                 ← 共享核心（两端都用）
  commands/            ← CC 专用命令文件
  hooks/               ← CC 专用 hook 脚本
  scripts/             ← CC 专用脚本
  oc/                  ← OC 专用（新目录）
    src/
      plugin.ts
      hooks/
      cron/
      commands/
      renderers/
    package.json
    tsconfig.json
```

共享 `lib/` 目录，OC 专用代码在 `oc/` 子目录。两端可以独立发版。
