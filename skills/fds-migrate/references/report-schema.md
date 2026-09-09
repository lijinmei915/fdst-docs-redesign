# FDS Token 迁移报告契约

## JSON

每个组件目录下的 `fds-token-migration-report.json` 是机器可读事实源，schema 为 `fds-token-migration-report/v2`。批量执行根目录同时生成 `fds-token-migration-index.json`，schema 为 `fds-token-migration-index/v2`，只保存汇总、组件入口及各明细报告相对链接；组件项使用 `jsonReport` 和 `htmlReport` 指向两类产物。

顶层字段：

| 字段 | 说明 |
| --- | --- |
| `schema` | 报告 schema |
| `mode` | `scan`、`apply` 或 `verify` |
| `generatedAt` | UTC ISO 8601 时间 |
| `catalog` | Token 快照来源（`bundled` / `override`）、路径、schema、Token 数和 SHA-256 |
| `project` | 路径基准及实际读取的项目配置文件；路径基准固定为项目根目录 |
| `targets` | 本次输入路径 |
| `summary` | 文件、样式 occurrence、解析错误、不支持节点和各状态计数 |
| `findings` | 按文件和源码位置排序的逐项结果 |
| `parseErrors` | 解析器错误及其原文件位置、语法和容器 |
| `unsupportedFiles` | 输入范围内发现但没有适配器的样式载体 |
| `applyBlocked` | `apply` 是否因任一解析错误而阻止全部源码写入 |

每个 finding 至少包含：

- `id`：稳定定位 ID，由文件、行列、property 和原值计算。
- `file`、`line`、`column`、`syntax`、`container`、`property`。
- `originalValue`：源码中的原始值，不做格式化。
- `writable`：该 AST 节点是否具备安全局部改写区间。
- `status`：`replaced`、`auto-replace`、`ambiguous`、`similar`、`missing-token`、`invalid-token`、`compliant`、`unsupported` 或 `exempt`。
- `rule` 和 `reason`。
- `replacement`：只有 `replaced` / `auto-replace` 存在。
- `selectedToken`：唯一自动候选。
- `candidates`：最多五项，包含 `cssVariable`、`resolvedValue`、`layer`、`tier`、`category`、`match` 和可选的 `distance`。
- `priorityProtected`：可选；为 `true` 表示声明包含组件自定义变量或 `--bc-*`，FDS 不得取得更高优先级。
- `priorityVariables`：可选；按源码中的实际 fallback 顺序记录已有 CSS Variables。
- `componentVariables`：可选；记录高于 FDS 的组件自定义变量和兼容识别的 `--bc-*`。
- `legacyBrandVariables`：可选；记录应放在 FDS 之后的老品牌色 `--color-blueXX`。
- `fallbackValue`：可选；AST 能静态证明的末端具体原值，匹配和推荐只基于该值。

`targets`、`findings[].file`、`parseErrors[].file`、`unsupportedFiles[]` 和覆盖 Catalog 路径均使用项目根目录相对路径，不写入机器绝对路径。

`unsupported` 表示“已定位样式容器，但无法静态证明最终值”，不是合规结论，也不能直接描述为不符合 Token 规范。`verify` 遇到该状态返回 `3`，强制调用方处理验证缺口。

## HTML

`fds-token-migration-report.html` 是面向人工审查的离线报告，必须区分：

1. 已替换内容：只有 `apply` 实际写入的项目。
2. 可自动替换：`scan` / `verify` 识别但未写入的项目。
3. 不符合规范：统一展示 `ambiguous`、`similar`、`missing-token` 和 `invalid-token`，并提供上述状态筛选；`similar` 行直接列出相近 Token、差异及未自动替换原因，不再重复生成独立章节。
4. 变量优先级：展示因组件变量 / `--bc-*` 保护或老品牌色 fallback 保持不变，以及已经按“组件变量 > FDS > `--color-blueXX` > 原值”消费有效 FDS Token 的项目；不得与已替换、不符合规范重复展示。
5. 需人工检查：动态表达式、spread、插值模板、数值样式等 `unsupported` 节点。
6. 统计与边界：`compliant`、`exempt`、解析错误和无适配器文件。

各明细章节先按相对文件路径建立可折叠文件组，再渲染该文件的表格。表格位置列只保留行号和列号；CRLF、CR、LF 必须折叠为空格，所有源码和候选内容必须经过 HTML 转义。

HTML 必须自包含，不加载 CDN、远程字体、脚本或其他外部资源。桌面端以审查表格为主，窄屏将 finding 转为带字段标签的纵向布局；索引页提供组件汇总、状态分布和组件报告链接。

每条人工报告项必须提供“生成提示词”入口，点击报告行也可打开同一提示词抽屉，但用户正在选择表格文本时不得触发。提示词以 finding 的结构化数据生成，并按 `auto-replace`、`replaced`、`ambiguous`、`similar`、`missing-token`、`invalid-token`、`compliant` 和 `unsupported` 分别给出处理约束；所有修改类提示词都必须要求保留原值 fallback、限制修改范围并在源码定位失效时重新扫描。

提示词抽屉支持复制、上一项、下一项、`Esc` 关闭和 Clipboard API 失败时选中文本降级。复制只代表提示词已进入剪贴板，不得把 finding 标记为已修复；修复状态只由重新扫描或 `verify` 更新。嵌入 HTML 的 finding JSON 必须转义 `<`、`>`、`&`、U+2028 和 U+2029，避免源码内容结束 `<script type="application/json">` 数据块。

批量报告以配置 `entry` 或命令行目标为组件单元，明细路径为 `components/<组件名>/`。根索引只用于导航和状态汇总，不复制各组件 finding。入口不得重复或互相包含；`apply` 的解析错误保护仍覆盖整个批次。

每次生成会重建报告目录内由工具管理的 `components/` 子目录，并删除旧版 `fds-token-migration-index.md`，避免入口减少或格式升级后遗留旧报告；配置文件、同级其他文件及其他 mode 目录不受影响。

报告不得把 `exempt` 或未知动态值描述为违规，也不得用“扫描通过”代替页面视觉和功能验收。
