# FDS Token Source Schema Implementation Plan

> 内部历史实施计划；当前维护规则见 `docs/engineering/YAML源文件.md`。

> **For Codex:** REQUIRED SUB-SKILL: Use `fspec-dev-impelement-fe` or `executing-plans` to implement this plan task-by-task.

**Goal:** 将 FDS Token 重构为参考 SLDS `global/imports/props` 的 YAML 源文件模型，明确 Atomic/Seed、Atomic/Map、Semantic/Base、Semantic/Scene 边界，并稳定生成现有 CSS Variables 契约。

**Architecture:** `tokens/fds-global.yml` 是唯一构建入口，聚合文件通过 `imports` 组成依赖图；叶子文件使用 `global` 声明层级、分类、类型和作用域，`props` 只维护不带 CSS 命名空间的 Token 标识和值。构建器校验引用方向、类型、重复定义和循环依赖，再输出 `--fds-g-*` CSS Variables。

**Tech Stack:** Python 3.10+、PyYAML、CSS Custom Properties

---

### Task 1: 固化 YAML schema 和入口结构

**Files:**
- Create: `tokens/fds-global.yml`
- Create: `tokens/atomic/base.yml`
- Create: `tokens/atomic/seed/base.yml`
- Create: `tokens/atomic/map/base.yml`
- Create: `tokens/semantic/base.yml`
- Create: `tokens/semantic/base/base.yml`

1. 建立只包含 `imports` 的聚合文件。
2. 规定叶子文件必须包含 `global` 和 `props`。
3. 规定 `global.layer/tier/category/scope/primitive` 必填，`global.type` 可在类型统一时继承。

### Task 2: 迁移 Atomic 源文件

**Files:**
- Create: `tokens/atomic/seed/color.yml`
- Create: `tokens/atomic/seed/motion.yml`
- Create: `tokens/atomic/map/color/base.yml`
- Create: `tokens/atomic/map/color/palette/*.yml`
- Create: `tokens/atomic/map/color/{gray,rgb}.yml`
- Create: `tokens/atomic/map/{typography,spacing,sizing,shape,effects,motion}.yml`

1. 移除 Token Key 中的 `--fds-g-`，保留稳定 Token 标识。
2. 将 CSS `var(--fds-g-x)` 转为源文件引用 `{!x}`。
3. 删除全部迁移占位描述，只保留 `value` 和必要的类型覆盖。
4. 核对迁移前后 Token 名和值一一对应。

### Task 3: 迁移 Semantic 源文件

**Files:**
- Create: `tokens/semantic/base/{color,typography,layout,motion}.yml`
- Keep: `tokens/semantic/scene/README.md`

1. 将现有语义 Token 按领域合并为四个基础语义文件。
2. 设置 `layer: semantic`、`tier: base`、`primitive: false`。
3. Scene 不创建空 Token 文件，只保留进入条件和引用边界。

### Task 4: 重写构建和校验

**Files:**
- Modify: `tools/build.py`
- Modify: `tools/import_css_snapshot.py`

1. 从 `tokens/fds-global.yml` 递归解析 imports。
2. 检查导入文件存在、循环导入、重复 Token 和 schema 字段。
3. 检查 Atomic/Seed -> Atomic/Map -> Semantic/Base -> Semantic/Scene 单向引用。
4. 将 `{!token-id}` 转换为 `var(--fds-g-token-id)`。
5. 生成 `dist/fds-global-tokens.css`。

### Task 5: 回归验证和文档同步

**Files:**
- Modify: `README.md`
- Modify: `CONTEXT.md`

1. 运行 `python tools/build.py --check`，预期 421 个 Token 校验通过。
2. 运行 `python tools/build.py`，预期生成 CSS。
3. 确认统一色系的变量名和值不变，构建产物只包含当前正式维护的色板。
4. 检查 YAML 中不存在迁移占位描述和 CSS 命名空间 Key。
5. 运行 `git diff --check`。
