# FDS Token 迁移报告契约

## JSON

`fds-token-migration-report.json` 是机器可读事实源，schema 为 `fds-token-migration-report/v2`。

顶层字段：

| 字段 | 说明 |
| --- | --- |
| `schema` | 报告 schema |
| `mode` | `scan`、`apply` 或 `verify` |
| `generatedAt` | UTC ISO 8601 时间 |
| `catalog` | Token 快照来源（`bundled` / `override`）、路径、schema、Token 数和 SHA-256 |
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

`unsupported` 表示“已定位样式容器，但无法静态证明最终值”，不是合规结论，也不能直接描述为不符合 Token 规范。`verify` 遇到该状态返回 `3`，强制调用方处理验证缺口。

## Markdown

Markdown 报告必须区分：

1. 已替换内容：只有 `apply` 实际写入的项目。
2. 可自动替换：`scan` / `verify` 识别但未写入的项目。
3. 不符合规范：`ambiguous`、`similar`、`missing-token` 和 `invalid-token`。
4. 相近 Token 推荐：列出差异及未自动替换原因。
5. 需人工检查：动态表达式、spread、插值模板、数值样式等 `unsupported` 节点。
6. 统计与边界：`compliant`、`exempt`、解析错误和无适配器文件。

报告不得把 `exempt` 或未知动态值描述为违规，也不得用“扫描通过”代替页面视觉和功能验收。
