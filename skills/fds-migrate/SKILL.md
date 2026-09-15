---
name: fds-migrate
description: 使用 Skill 内置的完整 FDS Token 与旧色板索引快照扫描 CSS、SCSS、Sass、Less、WXSS、Vue、HTML、WXML、JS、JSX、TS、TSX 和受控 CSS-in-JS 样式节点，生成可审计报告，并在用户明确要求时将旧颜色按索引、其他值按唯一属性兼容候选替换为带原值 fallback 的 FDS Token。处理 FDS Token 合规迁移、相近非颜色 Token 推荐或迁移复核时使用；创建、修改或发布 Token 时不使用。
---

# FDS Token 迁移

## Goal / 目标

基于 Skill 内置的完整 FDS Token JSONL 与旧 `fx-style` 色板索引快照做保守迁移：默认只扫描并输出报告；只有用户明确要求执行迁移时，才把 `auto-replace` 项改成带原值 fallback 的 FDS Token。CSS Custom Property 的定义声明不迁移；组件扫描单元内定义的变量和既有 `--bc-*` 保持高于 FDS，旧色板变量保持低于 FDS。颜色不与当前 FDS 色值做相等或相似度匹配，而是按色板和索引一对一迁移：有彩色 `00–10 -> 0–10`、`neutrals01–19 -> gray-1–19`、`special01–04 -> special-1–4`；有彩色第 `11` 阶和 Gray 第 `20` 阶是扩展档，不接收旧色阶自动迁移。字号、圆角和透明度按各自规则选择最近档，相对行高只精确替换；明确保留的硬编码直接归为 `exempt`，不进入 HTML 迁移问题。

## When to Use / 使用场景

- 扫描 `.css/.pcss/.scss/.sass/.less/.wxss` 样式表。
- 扫描 `.vue` 的 `<style>`、template 内联样式和 `<script>/<script setup>` 样式节点。
- 扫描 `.html/.htm/.wxml` 静态内联 `style`；WXML 模板插值只报告，不自动改写。
- 扫描 `.js/.jsx/.ts/.tsx` 中明确的 JSX style、`CSSProperties` 和白名单 CSS-in-JS。
- 校验现有 `--fds-g-*` / `--fds-s-*` 是否真实存在。
- 支持 `border`、`border-top/right/bottom/left` 和 `outline` 简写中的确定颜色节点；保留宽度、线型、注释及原值 fallback，动态或多义简写只报告。
- 支持单色 `background`、逻辑方向边框及 `column-rule`；多值圆角、边框色/宽度和动效列表逐值报告，静态 `font` / `transition` 提取受管值。详见 [复合样式支持矩阵](references/composite-values.md)，无法安全解析的受管复合值明确报告 `unsupported`。
- 输出已替换项、不符合规范项、相近 Token 推荐和无法静态判定项。

不要用于创建、修改、删除或发布 FDS Token。普通业务字符串、普通数据对象、动态变量、spread、函数返回值和带插值模板不得通过正则猜测为样式。完整矩阵见 [语法支持范围](references/syntax-support.md)。

## Preconditions / 前置条件

1. 在目标项目根目录运行；无显式目标时默认扫描 `src`，并自动读取可选的 `.fdst/migrate.json`。
2. Token 数据默认读取本 Skill 的 `references/fds-token-catalog.jsonl`；旧有彩色定位读取 `references/legacy-color-index.json`。不得从调用方仓库、Markdown、CSS 示例或命名规律构造 Token。
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
- `apply`：只写入 `auto-replace`，包括规则允许的最近档替换，并保留原始值 fallback；`ambiguous`、`similar` 和 `unsupported` 永不自动写入。
- `verify`：不修改源码；存在可迁移、不合规、解析错误或无法静态判定项时返回退出码 `3`。
- 默认使用 Skill 自带的完整 Token JSONL，不要求调用方提供 FDST 仓库或外部 Catalog；`--catalog <json|jsonl>` 仅用于测试和受控调试覆盖。
- 默认入口为 `src`；默认报告目录为 `.fdst/reports/migrate/<mode>/`。
- 每个配置 `entry` 或命令行目标都是一个组件报告单元；批量执行时根目录只生成索引，明细分别写入 `components/<组件名>/`。
- 组件 HTML 报告中的每条结果都可生成状态化处理提示词；只有最近档自动替换项提供候选 Token 下拉，唯一精确命中的自动替换项只展示确定结果，其他需人工处理项可填写处理说明，并统一汇总为一份可局部编辑的处理提示词。人工选择、编辑和复制不代表问题已修复，修改后仍须重新执行 `verify`。
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

- `auto-replace`：颜色命中唯一旧色板色系/索引并找到同索引目标；非颜色按以下规则命中精确值或最近档；同时要求 CSS property 兼容且源码区间可安全局部修改。
- 字号：小于 `12px` 和超过 `48px` 的值保留硬编码并从迁移问题中排除；`12px–48px` 的可比较值选择绝对距离最近的 Font Size Token，等距时选择较小档。
- 行高：固定硬编码行高维持现状，直接排除迁移，不换算为相对行高；已存在的固定 `line-height-*` Token 保留并继续校验。无单位相对行高只在精确命中 `line-height-ratio-*` 或显式场景候选时自动替换，非精确值只报告相近候选。
- 间距：margin、padding、gap（含方向属性和多值简写）逐值精确匹配；唯一且属性、层级兼容的 Token 自动替换并保留原值 fallback。未精确命中的硬编码归为 `exempt`，不推荐最近档、不补充 Token；多义候选或动态值不自动改写。
- 圆角：使用包含 `20px` 的当前 Radius 梯度，精确值可自动替换；其他可比较 px 尺寸选择最近档，等距时选择较小档，仅在绝对偏差 ≤ `2px` 时自动替换，不限制相对百分比。超过 `2px` 保留原值，归为 `similar` 仅推荐候选，例如 `5→4px`、`7→6px`、`14→12px` 可替换，`27→20px` 不替换。
- 透明度：`0` 和 `1` 保留硬编码，且不得作为最近档目标；其他数值在非端点 Opacity Token 中选择最近档，等距时选择较小档。
- 层级与阴影：精确命中仍按既有层级和上下文规则处理；不符合现有规范的硬编码保留为 `exempt`，不补充 Token。
- 动效时长：当前 Atomic Map 包含 `500ms`、`600ms`、`800ms` 和 `1000ms`；精确命中可自动替换，其他值保持既有相近推荐规则。
- `ambiguous`：存在多个精确候选，或候选需要未提供的 Scene/组件语义。
- `similar`：没有精确候选，但存在同 property、同类型的相近候选；仅报告。
- `missing-token`：属于 Token 管理范围，但没有可靠候选。
- `invalid-token`：代码使用了 Catalog 中不存在、property 不兼容或 fallback 优先级错误的 `--fds-*`。
- `compliant`：使用了 Catalog 中存在且 property 兼容的 FDS Token。
- `unsupported`：AST 已定位样式容器，但动态表达式、spread、插值或数值单位语义无法静态判定；需人工检查。
- `exempt`：不属于本规则管理的属性或合法结构值，不得描述成“不符合规范”。
- CSS Custom Property 定义：`--component-color: #fff` 等定义声明始终保持原样，只在普通 CSS property 的消费位置迁移。
- fallback 优先级链：固定为“组件自定义变量 / `--bc-*` > FDS > 旧色板变量 > 原值”。旧色板变量包括 11 套有彩色的 `--color-<family>00..10`、`--color-neutrals01..19` 和 `--color-special01..04`，不含 RGB 和 Dark。组件变量必须在当前组件报告单元内存在定义；`--bc-*` 作为既有组件协议兼容识别。颜色可直接从旧变量名取得索引，不要求变量链存在末端色值；链含未知变量、已有顺序错误或映射目标不唯一时不得自动改写。

颜色硬编码值只与内置旧色板快照核对以定位旧索引，不与新 FDS 值比较；非颜色匹配遵守上述逐类边界。最近档替换会在报告原因中提示原值与目标值，并在候选列表和下拉中展示 Catalog Token 注释；精确命中的自动替换不提供下拉。完整规则见 [匹配策略](references/matching-policy.md)。

## Output / 输出

每个组件单元生成：

- `fds-token-migration-report.json`：机器可读事实源，供 CI、复核和后续工具消费。
- `fds-token-migration-report.html`：面向人工审查，包含已替换、可自动替换、不符合规范、已有变量优先、需人工检查和解析错误；相近 Token 在“不符合规范”内筛选和展示，不重复生成独立章节。

批量执行另外生成 `fds-token-migration-index.json` 和 `fds-token-migration-index.html`，只汇总组件状态并链接各组件明细，不集中复制全部 finding。

报告中的源码路径全部相对项目根目录；HTML 先按文件分组，明细表内只保留行号和列号，并提供适合桌面与窄屏审查的自包含样式，不加载外部资源。候选选择和无候选处理说明只属于浏览器本地交互状态，不写回 JSON 事实源或源码。默认报告属于本地生成物，建议通过 `.fdst/.gitignore` 忽略 `reports/`；需要留档时使用 `--report-dir` 输出到受版本控制目录。

报告字段与状态含义见 [报告契约](references/report-schema.md)。报告中的候选必须逐字来自本次内置 Token 快照，包含 CSS Variable、解析值、层级、匹配类型和未自动替换原因。

## Resources / 资源

- `scripts/migrate_styles.mjs`：统一 CLI、受控写入和全局失败保护。
- `scripts/lib/`：确定性 matcher、报告和各语法 AST 适配器。
- `references/fds-token-catalog.jsonl`：随 Skill 打包的完整 Token 快照，每行一个 Token；由正式 YAML import 图自动生成，不手工维护。
- `references/legacy-color-index.json`：旧 `fx-style` 11 套有彩色 `00–10`、Gray `neutrals01–19` 和 `special01–04` 快照，以及各色板的一对一索引映射依据；排除 RGB 与 Dark。
- `references/migration-policy.json`：CSS property、Token 类型、命名边界和相似度阈值；不保存 Token 值。
- `references/matching-policy.md`：自动替换门槛、Scene/Atomic 边界和近似推荐规则。
- `references/syntax-support.md`：文件类型、样式容器和自动改写边界。
- `references/report-schema.md`：JSON 与 HTML 报告契约。
- `references/configuration.md`：`.fdst/migrate.json`、默认入口、报告目录和 CLI 覆盖规则。
