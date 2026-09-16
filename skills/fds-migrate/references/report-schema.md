# FDS Token 迁移报告契约

复合值补充：一个声明可对应多个 finding。`property` 为原声明属性，`matchedProperty` 为子值匹配属性，`declarationId` 为不透明分组标识。`originalValue` 和行列指向子值。`occurrenceCount` 为值项数，`declarationCount` 为去重声明数，详见 [复合样式支持矩阵](composite-values.md)。

## JSON

每个组件目录下的 `fds-token-migration-report.json` 是机器可读事实源，schema 为 `fds-token-migration-report/v2`。批量执行根目录同时生成 `fds-token-migration-index.json`，schema 为 `fds-token-migration-index/v2`，只保存汇总、组件入口及各明细报告相对链接；组件项使用 `jsonReport` 和 `markdownReport` 指向两类产物。

顶层字段：

| 字段 | 说明 |
| --- | --- |
| `schema` | 报告 schema |
| `mode` | `scan`、`apply` 或 `verify` |
| `generatedAt` | UTC ISO 8601 时间 |
| `catalog` | Token 快照来源（`bundled` / `override`）、路径、schema、Token 数和 SHA-256 |
| `legacyColorIndex` | 内置旧色板快照的路径、schema、原始来源、各色板索引规则、有彩色色系数、独立尺度数、记录数和 SHA-256 |
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
- `candidates`：最多五项，包含 `cssVariable`、`resolvedValue`、`layer`、`tier`、`category`、`match`，以及可选的 `distance` 和 Catalog `comment`；颜色索引映射的 `match` 为 `legacy-index`，最近档为 `nearest`。
- `valueChange`：可选；最近档替换记录 `from` 和 `to`。
- `priorityProtected`：可选；为 `true` 表示声明包含组件自定义变量或 `--bc-*`，FDS 不得取得更高优先级。
- `priorityVariables`：可选；按源码中的实际 fallback 顺序记录已有 CSS Variables。
- `componentVariables`：可选；记录高于 FDS 的组件自定义变量和兼容识别的 `--bc-*`。
- `legacyColorVariables`：可选；记录应放在 FDS 之后的旧有彩色 `--color-<family>00..10`、`--color-neutrals01..19` 和 `--color-special01..04`。兼容字段 `legacyBrandVariables` 仅继续记录其中的 `--color-blueXX`。
- `legacyColors`：可选；记录颜色迁移所用的旧色系、旧索引、旧变量/色值、目标色系和目标索引。
- `fallbackValue`：可选；AST 能静态证明的末端具体原值。颜色只用它定位内置旧色板索引，不与当前 FDS 值比较；非颜色匹配和推荐仍基于该值。

`targets`、`findings[].file`、`parseErrors[].file`、`unsupportedFiles[]` 和覆盖 Catalog 路径均使用项目根目录相对路径，不写入机器绝对路径。

`unsupported` 表示“已定位样式容器，但无法静态证明最终值”，不是合规结论，也不能直接描述为不符合 Token 规范。`verify` 遇到该状态返回 `3`，强制调用方处理验证缺口。

## Markdown

每个组件生成 `fds-token-migration-report.md`，批量索引为 `fds-token-migration-index.md`。索引仅汇总组件并通过相对链接指向明细。

明细按文件分组，列出行列、状态、属性/选择器、原值、替换或选定 Token、候选解析值/层级/匹配类型/注释和判定原因。解析错误及未支持文件独立列出。exempt 只计入统计和 JSON，不列入迁移问题。

源码、路径和候选中的 Markdown 特殊字符须转义，换行折叠为空格，不能注入表格、链接或 HTML。JSON 仍保存完整原始值。报告不包含 HTML、浏览器脚本、候选下拉或本地决策状态；编辑报告不代表源码已修复，修改源码后须重新 verify。

索引 JSON 保持 v2，组件链接字段从 htmlReport 改为 markdownReport；读取该字段的消费者须更新。重新生成同一报告目录时清理旧 HTML 产物。
