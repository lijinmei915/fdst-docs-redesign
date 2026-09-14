# FDS 非颜色梯度与 Heading 6 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `fspec-dev-impelement-fe` or `executing-plans` to implement this plan task-by-task.

**Goal:** 保留现有固定行高契约，新增相对行高、20px 圆角、长时长梯度和 Heading 6，并同步所有生成产物、文档与 Skill。

**Architecture:** `tokens/fds-global.yml` 的 YAML import 图继续作为唯一事实源。固定行高保持 `line-height-*`，单位无关倍率使用新的 `line-height-ratio-*`，生成链统一刷新 CSS、Catalog、Token 目录、两个 Skill 索引和静态文档站。

**Tech Stack:** YAML、Python 3、PyYAML、Python-Markdown、Node.js test runner。

---

### Task 1: 锁定新增 Token 契约

**Files:**
- Modify: `tests/test_build.py`
- Modify: `tests/test_export_catalog.py`
- Modify: `skills/fds-migrate/test/helpers.mjs`
- Modify: `skills/fds-migrate/test/stylesheet.test.mjs`

1. 为相对行高、20px 圆角、500/600/800/1000ms 和 Heading 6 增加断言。
2. 先运行目标测试，确认当前源尚未满足新契约。

### Task 2: 更新 YAML 与 Skill 规则

**Files:**
- Modify: `tokens/atomic/map/typography.yml`
- Modify: `tokens/atomic/map/shape.yml`
- Modify: `tokens/atomic/map/motion.yml`
- Modify: `tokens/semantic/base/typography.yml`
- Modify: `skills/fds-migrate/references/migration-policy.json`

1. 新增 `line-height-ratio-1..6`、`radius-7`、`motion-duration-5..8` 和 `heading-6-*`。
2. 让 `fds-migrate` 的 `line-height` 规则同时识别 `dimension` 与 `number`。
3. 运行目标测试，确认契约通过。

### Task 3: 更新正式文档并生成产物

**Files:**
- Modify: `docs/foundations/排版.md`
- Modify: `docs/foundations/圆角与边框.md`
- Modify: `docs/foundations/动效.md`
- Modify: `docs/semantics/基础语义.md`
- Modify: `docs/concepts/命名规则.md`
- Modify: `docs/reference/迁移与常见问题.md`
- Modify: `skills/fds-apply/references/css-usage.md`
- Generate: `dist/`、`docs/reference/Token目录.md`、`skills/*/references/*.jsonl`、`public/`

1. 说明固定行高与相对倍率的命名及使用边界，记录 Heading 6、20px 圆角和长时长的适用范围。
2. 依次运行 `python tools/build.py`、`python tools/export_catalog.py`、`python tools/build_docs.py`。

### Task 4: 验证并发布 Git

1. 运行 Python、Node、Skill 合约、文档一致性和 `git diff --check`。
2. 审查变更范围，只提交本任务文件。
3. 推送 `master`，核对本地、`origin/master` 与远端 SHA 一致。
