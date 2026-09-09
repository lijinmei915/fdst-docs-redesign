---
name: fds-migrate
description: 使用 Skill 内置的完整 FDS Token 快照扫描 CSS、SCSS、Sass、Less、Vue、HTML、JS、JSX、TS、TSX 和受控 CSS-in-JS 样式节点，生成可审计报告，并在用户明确要求时将唯一、属性兼容的值替换为带原值 fallback 的 FDS Token。处理 FDS Token 合规迁移、相近 Token 推荐或迁移复核时使用；创建、修改或发布 Token 时不使用。
---

# FDS Token 迁移

## Goal / 目标

基于 Skill 内置的完整 FDS Token JSONL 快照做保守迁移：默认只扫描并输出报告；只有用户明确要求执行迁移时，才把 `auto-replace` 项改成带原值 fallback 的 FDS Token。CSS Custom Property 的定义声明不迁移；组件扫描单元内定义的变量和既有 `--bc-*` 保持高于 FDS，老品牌色 `--color-blue00` 至 `--color-blue10` 保持低于 FDS。值相同但语义不唯一、只有相近候选、跨越 Token 所有权边界或无法由 AST 静态证明的节点不得自动修改。

## When to Use / 使用场景

- 扫描 `.css/.pcss/.scss/.sass/.less` 样式表。
- 扫描 `.vue` 的 `<style>`、template 内联样式和 `<script>/<script setup>` 样式节点。
- 扫描 `.html/.htm` 静态内联 `style`。
- 扫描 `.js/.jsx/.ts/.tsx` 中明确的 JSX style、`CSSProperties` 和白名单 CSS-in-JS。
- 校验现有 `--fds-g-*` / `--fds-s-*` 是否真实存在。
- 输出已替换项、不符合规范项、相近 Token 推荐和无法静态判定项。

不要用于创建、修改、删除或发布 FDS Token。普通业务字符串、普通数据对象、动态变量、spread、函数返回值和带插值模板不得通过正则猜测为样式。完整矩阵见 [语法支持范围](references/syntax-support.md)。

## Preconditions / 前置条件

1. 在目标项目根目录运行；无显式目标时默认扫描 `src`，并自动读取可选的 `.fdst/migrate.json`。
2. Token 数据默认读取本 Skill 的 `references/fds-token-catalog.jsonl`，不得从其他仓库、Markdown、CSS 示例或命名规律构造 Token。
3. 检查工作树状态并保留用户已有修改。
4. 使用 Node.js 16+，首次运行先在本 Skill 目录执行 `npm ci --ignore-scripts`。
5. 修改源码前必须得到明确授权；“扫描”“检查”“生成报告”只授权 `scan`，不授权 `apply`。

## ToolsList / 工具列表

在目标项目根目录执行，将 `<skill-root>` 替换为本 Skill 的实际路径：

```powershell
node <skill-root>/scripts/migrate_styles.mjs scan
node <skill-root>/scripts/migrate_styles.mjs apply
node <skill-root>/scripts/migrate_styles.mjs verify
```

- `scan`：默认模式；不修改源码，生成 JSON 与自包含 HTML 报告。
- `apply`：只写入 `auto-replace`，保留原始值 fallback；`ambiguous`、`similar` 和 `unsupported` 永不自动写入。
- `verify`：不修改源码；存在可迁移、不合规、解析错误或无法静态判定项时返回退出码 `3`。
- 默认使用 Skill 自带的完整 Token JSONL，不要求调用方提供 FDST 仓库或外部 Catalog；`--catalog <json|jsonl>` 仅用于测试和受控调试覆盖。
- 默认入口为 `src`；默认报告目录为 `.fdst/reports/migrate/<mode>/`。
- 每个配置 `entry` 或命令行目标都是一个组件报告单元；批量执行时根目录只生成索引，明细分别写入 `components/<组件名>/`。
- 组件 HTML 报告中的每条结果都可生成状态化处理提示词；复制提示词不代表问题已修复，修改后仍须重新执行 `verify`。
- 项目级配置固定放在 `.fdst/migrate.json`；配置字段、CLI 参数和覆盖顺序见 [项目配置与 CLI](references/configuration.md)。
- `--context card` 等显式场景可让匹配器考虑对应 Scene Token；不得仅凭文件名猜测 Scene。
- `--include <glob>` 可重复指定扫描范围；未指定时扫描支持矩阵中的全部文件，并跳过 `.git/node_modules/dist/build/coverage`。

## Workflow / 工作流

1. 先运行 `scan`，读取报告摘要和每项证据。
2. 对 `ambiguous` 检查 DOM、组件职责和状态；对 `similar` 只交给人工评估；对 `unsupported` 先补静态证据或人工判断。
3. 向用户说明预计修改的文件数和 occurrence 数；得到明确授权后运行 `apply`。
4. 审查实际 diff，确认每项保留原始文本 fallback，且未改动不相关格式。
5. 运行 `verify`。退出码 `0` 只表示静态迁移规则通过，不替代页面功能、视觉、主题和可访问性验证。

## Decision Rules / 决策规则

- `auto-replace`：当前值与唯一候选精确相等，CSS property 兼容，层级允许自动消费，且源码区间可安全局部修改。
- `ambiguous`：存在多个精确候选，或候选需要未提供的 Scene/组件语义。
- `similar`：没有精确候选，但存在同 property、同类型的相近候选；仅报告。
- `missing-token`：属于 Token 管理范围，但没有可靠候选。
- `invalid-token`：代码使用了 Catalog 中不存在、property 不兼容或 fallback 优先级错误的 `--fds-*`。
- `compliant`：使用了 Catalog 中存在且 property 兼容的 FDS Token。
- `unsupported`：AST 已定位样式容器，但动态表达式、spread、插值或数值单位语义无法静态判定；需人工检查。
- `exempt`：不属于本规则管理的属性或合法结构值，不得描述成“不符合规范”。
- CSS Custom Property 定义：`--component-color: #fff` 等定义声明始终保持原样，只在普通 CSS property 的消费位置迁移。
- fallback 优先级链：固定为“组件自定义变量 / `--bc-*` > FDS > `--color-blueXX` > 原值”。组件变量必须在当前组件报告单元内存在定义；`--bc-*` 作为既有组件协议兼容识别。没有末端原值、链含未知变量、已有顺序错误、fallback 为复合表达式或候选不唯一时不得自动改写。

精确值只是候选证据，不等于语义证据。颜色相似度和尺寸差异只用于排序。完整规则见 [匹配策略](references/matching-policy.md)。

## Output / 输出

每个组件单元生成：

- `fds-token-migration-report.json`：机器可读事实源，供 CI、复核和后续工具消费。
- `fds-token-migration-report.html`：面向人工审查，包含已替换、可自动替换、不符合规范、已有变量优先、需人工检查和解析错误；相近 Token 在“不符合规范”内筛选和展示，不重复生成独立章节。

批量执行另外生成 `fds-token-migration-index.json` 和 `fds-token-migration-index.html`，只汇总组件状态并链接各组件明细，不集中复制全部 finding。

报告中的源码路径全部相对项目根目录；HTML 先按文件分组，明细表内只保留行号和列号，并提供适合桌面与窄屏审查的自包含样式，不加载外部资源。默认报告属于本地生成物，建议通过 `.fdst/.gitignore` 忽略 `reports/`；需要留档时使用 `--report-dir` 输出到受版本控制目录。

报告字段与状态含义见 [报告契约](references/report-schema.md)。报告中的候选必须逐字来自本次内置 Token 快照，包含 CSS Variable、解析值、层级、匹配类型和未自动替换原因。

## Resources / 资源

- `scripts/migrate_styles.mjs`：统一 CLI、受控写入和全局失败保护。
- `scripts/lib/`：确定性 matcher、报告和各语法 AST 适配器。
- `references/fds-token-catalog.jsonl`：随 Skill 打包的完整 Token 快照，每行一个 Token；由正式 YAML import 图自动生成，不手工维护。
- `references/migration-policy.json`：CSS property、Token 类型、命名边界和相似度阈值；不保存 Token 值。
- `references/matching-policy.md`：自动替换门槛、Scene/Atomic 边界和近似推荐规则。
- `references/syntax-support.md`：文件类型、样式容器和自动改写边界。
- `references/report-schema.md`：JSON 与 HTML 报告契约。
- `references/configuration.md`：`.fdst/migrate.json`、默认入口、报告目录和 CLI 覆盖规则。
