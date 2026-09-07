# FDS Scene Namespace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use `executing-plans` to implement this plan task-by-task.

**Goal:** 将 Semantic/Scene 公共变量从 `--fds-g-scene-*` 迁移为不含 `scene` 名称段的 `--fds-s-*`。

**Architecture:** `tokens/semantic/scene/default.yml` 显式声明 `namespace: --fds-s-`，Scene Token ID 删除 `scene-` 前缀。构建器为每个 Token 保存 namespace，并按被引用 Token 的 namespace 生成 CSS `var()`，从而支持 `--fds-s-card-padding: var(--fds-g-spacing-4)` 这类跨 namespace 引用。

**Tech Stack:** Python 3.10+、PyYAML、YAML Token 源、CSS Custom Properties、Bash 查询 Skill。

---

### Task 1: 固化多 Namespace 构建契约

**Files:**
- Modify: `tests/test_build.py`
- Modify: `tests/test_export_catalog.py`
- Modify: `tests/test_query_tokens.py`

1. 增加 Scene 必须使用 `--fds-s-`、其他层必须使用 `--fds-g-` 的失败测试。
2. 增加 Scene 声明与跨 namespace 引用的 CSS 断言。
3. 增加 catalog 和查询脚本对 `--fds-s-*` 的断言，并确认旧 `--fds-g-scene-*` 无结果。
4. 运行目标测试，确认当前实现失败。

### Task 2: 实现 Token 级 Namespace

**Files:**
- Modify: `tools/build.py`
- Modify: `tools/export_catalog.py`
- Modify: `tokens/semantic/scene/default.yml`

1. Token 模型记录 namespace，校验各层允许的 namespace。
2. CSS 声明使用当前 Token namespace，引用使用目标 Token namespace。
3. catalog 的 `cssVariable` 读取 Token namespace，文档变量扫描同时识别 `--fds-g-*` 与 `--fds-s-*`。
4. 将 14 个 Scene ID 删除 `scene-` 前缀并声明 `--fds-s-`。

### Task 3: 同步文档、Skill 与生成产物

**Files:**
- Modify: `docs/**`
- Modify: `skills/fxiaoke-design-system-token-query/**`
- Generate: `dist/fds-global-tokens.css`
- Generate: `dist/fds-token-catalog.json`
- Generate: `docs/reference/Token目录.md`
- Generate: `skills/fxiaoke-design-system-token-query/references/fds-token-search.jsonl`

1. 将正式 Scene 示例和名称改为 `--fds-s-*`，保留 Semantic/Scene 层级概念。
2. 查询 Skill 同时接受 `--fds-g-*` 与 `--fds-s-*`。
3. 重新生成 CSS、catalog、Token 目录和查询索引。

### Task 4: 完整验证

1. 运行 `python tools/build.py --check`。
2. 运行 `python tools/export_catalog.py --check-docs`。
3. 运行 `python -m unittest discover -s tests -p "test_*.py"`。
4. 运行 `tests/skill-contract/test-fxiaoke-design-system-token-query.sh`。
5. 扫描正式源码和本地业务仓库中的旧 `--fds-g-scene-*` 消费并记录发布风险。
