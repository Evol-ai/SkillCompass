# Git & PR Rules

- **Branch names**: English only, use `kebab-case` (e.g., `fix/d5-delta-override`, `feat/d6-rubric-band`). Never use pinyin or Chinese characters.
- **PR titles**: English only. Keep under 70 characters.
- **Commit messages**: English only.
- **Code and technical files**: English only. No Chinese comments or strings.
  - Exception: `commands/*.md` contain bilingual user-facing text by design (Chinese default + `EN:` annotations). This follows the root CLAUDE.md locale convention. The structural/logic parts of command specs should still be in English.

---

# SkillCompass 全量评测任务：按安装量排名逐批评测

三个独立阶段，可分开执行。每阶段的 prompt 直接粘贴给 Codex 即可。

## skills-by-installs 目录结构

```
skills-by-installs/
├── index.json                        # 汇总索引，899 个 skill 按安装量降序排列
├── {slug}/                           # 每个 skill 一个同名目录，共 899 个
│   ├── SKILL.md                      # skill 主体（评测目标）
│   ├── _clawhub_meta.json            # ClawHub 平台元数据
│   ├── _meta.json                    # 本地元数据
│   └── ...                           # 其他文件（assets/hooks/scripts 等，因 skill 而异）
├── {slug}.json                       # 每个 skill 还有一个同名 JSON 文件（详细信息）
└── ...
```

`index.json` 结构（每条记录）：
```json
{
  "rank": 1,
  "slug": "self-improving-agent",
  "displayName": "self-improving-agent",
  "ownerHandle": "pskoett",
  "installs_all_time": 4160,
  "installs_current": 4001,
  "downloads": 255172,
  "stars": 2344,
  "latestVersion": "3.0.5",
  "file": "self-improving-agent.json"
}
```

**目录约定**（根据实际情况调整）：
- `SKILLS_DIR`：`skills-by-installs/` 目录的路径
- `INDEX_FILE`：`skills-by-installs/index.json`
- `OUTPUT_DIR`：评测结果输出目录（会自动创建）

---

---

# Phase 1 Prompt — 逐 skill 评测（支持断点恢复）

---

使用 SkillCompass 对指定范围内的 skill 逐一评测，结果保存在每个 skill 自己的目录下。

**执行前确认**：
- SkillCompass 已安装（`/eval-skill` 命令可用）
- `index.json` 路径：`{INDEX_FILE}`
- skill 根目录：`{SKILLS_DIR}`
- 本次评测范围：rank **{START}**–**{END}**

**步骤：**

1. 读取 `index.json`，提取 rank {START} 到 {END} 的 skill 列表，按 rank 升序排列。

2. 对每个 skill 依次执行：

   a. **断点恢复检查**：若 `{SKILLS_DIR}/{slug}/.skill-compass/eval-result.json` 已存在，打印 `[{rank}] {slug} → SKIP (already done)` 并跳过。

   b. 若 `{SKILLS_DIR}/{slug}/SKILL.md` 不存在：写入以下内容到 `{SKILLS_DIR}/{slug}/.skill-compass/eval-result.json`：
      ```json
      {"error": "SKILL.md not found", "rank": {rank}, "slug": "{slug}"}
      ```
      打印 `[{rank}] {slug} → SKIP (missing)` 后继续。

   c. 调用 SkillCompass `/eval-skill` 对 `{SKILLS_DIR}/{slug}/SKILL.md` 进行全量评测（`--scope full`）。

   d. 将评测结果 JSON 写入 `{SKILLS_DIR}/{slug}/.skill-compass/eval-result.json`，并在 JSON 根部追加以下字段（值从 `index.json` 读取）：
      ```
      rank, installs_all_time, installs_current, downloads, stars
      ```

   e. 打印进度：`[{rank}] {slug} → {verdict} ({score})`

3. 全部完成后打印小结：
   ```
   批次完成：rank {START}–{END}
   评测 {n} 个 | PASS {p} / CAUTION {c} / FAIL {f} / SKIP {s}
   均分 {mean} | 最高 {max_slug}({max}) | 最低 {min_slug}({min})
   ```

> 建议每次只跑 100 个（一个批次），跑完再开新会话继续下一批。

---

---

# Phase 2 Prompt — 生成批次报告

---

读取已完成的评测结果，生成指定批次的汇总报告。

**执行前确认**：
- `index.json` 路径：`{INDEX_FILE}`
- skill 根目录：`{SKILLS_DIR}`
- 输出目录：`{OUTPUT_DIR}/batch-reports/`
- 本次批次范围：rank **{START}**–**{END}**

**步骤：**

1. 读取 `index.json`，提取 rank {START}–{END} 的 slug 列表。

2. 逐一读取 `{SKILLS_DIR}/{slug}/.skill-compass/eval-result.json`。若文件不存在或含 `"error"` 字段，标记为 SKIP，不纳入统计。

3. 聚合统计：n / PASS / CAUTION / FAIL / SKIP / mean / median / min / max / stddev / 各维度均值 D1–D6 / weakest_dimension 频次 / skill type 分布（atom/composite/meta）/ security findings（Critical/High/Medium 计数）。

4. 生成批次报告，写入 `{OUTPUT_DIR}/batch-reports/batch-{START}-{END}.md`，格式如下：

```
# SkillCompass Milestone Report: Rank {START}–{END}（按安装量）

> Date: {date}
> Skills evaluated: {n}（SKIP: {s}）
> Batch: Rank {START}–{END} by install count

---

## Statistical Summary

（紧凑代码块）
n={n}, mean={mean}, median={median}, min={min}({min_slug}), max={max}({max_slug})
Verdicts: PASS={p}  CAUTION={c}  FAIL={f}  SKIP={s}
Weakest dim freq: （按频次降序列出）
Dim means: D1={x}  D2={x}  D3={x}  D4={x}  D5={x}  D6={x}
Top5: {slug}({score}), ...
Bot5: {slug}({score}), ...

---

## Qualitative Analysis

### 1. Batch Overview
整体质量水位、通过率描述；与前批次对比（首批建立 baseline，后续批次说明变化趋势）。

### 2. Dimension Patterns
六维得分表（含 Interpretation 列）+ D2/D4 弱点具体模式分析。

### 3. Notable Skills
Top 3 / Bottom 3 点评，说明高分/低分原因。

### 4. Common Weaknesses
系统性问题，编号列出，注明影响 skill 数量。

### Security Deep-Dive
有 D3 Critical/High/FAIL 时：按严重级别分类详述，含受影响安装量估算和系统性模式分析。
无安全发现时：`> No Critical or High security findings in this batch.`

### 5. Skill Type Distribution
atom/composite/meta 分布表（Count / % / Mean Score / PASS Rate / Top Scorer）+ 各类型弱点模式对比。

### 6. Trend
首批：建立 baseline（mean / PASS率 / 各维度均值）。
后续批次：与上一批、与首批 baseline 的对比数据和趋势判断。

### Key Takeaway
一句话总结本批次核心特征。

---

## Raw Results Table

| Slug | Rank | Installs | Type | Score | Verdict | Weakest |
|------|------|----------|------|-------|---------|---------|
（按 rank 升序，本批次全部 skill，每行一个）
```

5. 生成 summary JSON，写入 `{OUTPUT_DIR}/batch-reports/batch-{START}-{END}-summary.json`：
```json
{
  "batch": "{START}-{END}",
  "rank_range": [{START}, {END}],
  "install_range": [max_installs_in_batch, min_installs_in_batch],
  "n": 0, "skip": 0, "pass": 0, "caution": 0, "fail": 0,
  "mean": 0.0, "median": 0.0, "min": 0, "max": 0, "stddev": 0.0,
  "dim_means": {"D1": 0.0, "D2": 0.0, "D3": 0.0, "D4": 0.0, "D5": 0.0, "D6": 0.0},
  "weakest_dim_freq": {"functional": 0, "trigger": 0, "security": 0, "comparative": 0, "uniqueness": 0, "structure": 0},
  "type_dist": {"atom": 0, "composite": 0, "meta": 0},
  "top5": [{"slug": "", "rank": 0, "score": 0}],
  "bot5": [{"slug": "", "rank": 0, "score": 0}],
  "fail_slugs": [{"slug": "", "rank": 0, "score": 0, "d3_score": 0}],
  "security_findings": {"critical": 0, "high": 0, "medium": 0}
}
```

---

---

# Phase 3 Prompt — 生成整体报告

---

读取所有批次的 summary JSON 聚合生成整体报告，不读取单个 skill 的评测文件。

**执行前确认**：
- summary JSON 所在目录：`{OUTPUT_DIR}/batch-reports/`
- 输出目录：`{OUTPUT_DIR}/overall-report/`
- 共 {TOTAL_BATCHES} 份 summary JSON 均已存在

**步骤：**

1. 读取 `{OUTPUT_DIR}/batch-reports/` 下所有 `*-summary.json` 文件，按 rank 范围升序排列。

2. 跨批次聚合：
   - 全量 n / PASS / CAUTION / FAIL / SKIP
   - 加权平均各维度均值（以各批次 n 为权重）
   - 合并 weakest_dim_freq / type_dist / security_findings
   - 合并所有批次的 fail_slugs
   - 从各批次 top5/bot5 提取全量 TOP 10 / BOTTOM 10
   - 构建批次趋势数组

3. 生成整体报告，写入 `{OUTPUT_DIR}/overall-report/report-overall.md`：

```
# SkillCompass 全量评测报告（按安装量排名）

> 评测日期：{date}
> 评测范围：Rank 1 → Rank {TOTAL}，共 {n} 个 skill

## 一、执行摘要
总数 / PASS / CAUTION / FAIL / 跳过 / 通过率 / 均分 / 中位数 / 标准差 / 范围 / 各维度均值

## 二、分数区间分布
区间表（90-100 / 80-89 / 70-79 / 60-69 / 50-59 / <50，含数量和占比）

## 三、按批次质量趋势
趋势表（批次 / Rank范围 / 安装量区间 / 均分 / PASS% / FAIL数 / vs首批均分）
+ 趋势分析：随安装量下降质量变化、拐点批次、"低安装量高质量"集群。

## 四、维度分析
全量六维均值排名 + 各维度弱点模式 + D3 安全发现汇总 + D6 重复集群识别

## 五、全量 TOP 10 / BOTTOM 10
各含：slug / rank / 安装量 / 分数 / 核心优势或问题

## 六、FAIL 与高风险 skill 完整名单
合并自各批次 fail_slugs，按 rank 排序，含：rank / slug / 安装量 / 总分 / D3分 / 风险描述

## 七、生态系统洞察
- 热门但低质（高安装量 + 低分）
- 被低估（低安装量 + 高分）
- skill 类型质量对比
- 生态整体健康度评估

## 八、对 skill 开发者的改进建议
针对 D2/D4 系统性弱点的可操作建议

## 附录：各批次报告索引
索引表（批次 / 文件 / 安装量区间 / 均分 / PASS%）
```

4. 同时写入 `{OUTPUT_DIR}/overall-report/report-overall-summary.json`（全量聚合统计，格式与批次 summary JSON 一致）。
