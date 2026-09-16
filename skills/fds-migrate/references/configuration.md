# 项目配置与 CLI

## 默认约定

从目标项目根目录运行 `fds-migrate`。没有位置参数和配置文件时：

- 扫描入口：`src`
- 配置文件：`.fdst/migrate.json`（可选）
- 报告目录：`.fdst/reports/migrate/<mode>/`
- Token Catalog：已安装的 `@sharecrm/sds-linter` 包内完整快照；首次在 Skill 目录执行 SKILL.md 中的 npm ci 命令

建议提交 `.fdst/migrate.json`，并创建 `.fdst/.gitignore` 忽略 `reports/`。报告需要作为审计记录提交时，使用 `--report-dir` 指向项目的正式文档目录。

每个 `entry` 或命令行目标是一个独立报告单元。组件库应将组件目录逐项写入 `entry` 数组；批量执行时会生成一个轻量索引，并在 `components/<组件名>/` 下分别保存明细。工具不根据目录名猜测组件边界。

## 配置示例

```json
{
  "schema": "fds-migrate-config/v1",
  "entry": [
    "src/components/button",
    "src/components/table"
  ],
  "reportRoot": ".fdst/reports/migrate",
  "include": ["src/**/*.vue", "src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["src/**/__tests__/**", "src/**/*.spec.ts"],
  "contexts": []
}
```

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `schema` | string | 必填 | 固定为 `fds-migrate-config/v1` |
| `entry` | string 或 string[] | `src` | 一个或多个扫描入口，相对项目根目录 |
| `reportRoot` | string | `.fdst/reports/migrate` | 报告根目录；工具自动追加 `scan/apply/verify` |
| `include` | string[] | `[]` | 只扫描匹配的项目根目录相对路径 |
| `exclude` | string[] | `[]` | 排除匹配的项目根目录相对路径，优先于 `include` |
| `contexts` | string[] | `[]` | 显式 Scene/组件语义，例如 `card`、`icon` |

不要在项目配置中维护 `catalog` 或 `policy`。业务项目不应形成第二套 Token 事实源或迁移规则；这两个覆盖项只保留为测试和受控调试 CLI 参数。

## CLI 参数

| 参数 | 作用 |
| --- | --- |
| 位置参数 `[目标...]` | 覆盖配置中的 `entry` |
| `--project-root <目录>` | 指定项目根目录；默认是当前工作目录 |
| `--config <文件>` | 指定配置文件；相对项目根目录，文件不存在时报错 |
| `--report-dir <目录>` | 指定本次报告的精确输出目录，不再自动追加 mode |
| `--include <glob>` | 可重复；只要提供 CLI 值，就覆盖配置中的 `include` |
| `--exclude <glob>` | 可重复；只要提供 CLI 值，就覆盖配置中的 `exclude` |
| `--context <场景>` | 可重复；只要提供 CLI 值，就覆盖配置中的 `contexts` |
| `--catalog <文件>` | 仅用于测试和受控调试覆盖 |
| `--policy <文件>` | 仅用于测试和受控调试覆盖 |

优先级为：CLI 显式参数 > `.fdst/migrate.json` > 内置默认值。相对路径均以项目根目录为基准。

报告结构：

```text
.fdst/reports/migrate/scan/
├─ fds-token-migration-index.json
├─ fds-token-migration-index.md
└─ components/
   ├─ button/
   │  ├─ fds-token-migration-report.json
   │  └─ fds-token-migration-report.md
   └─ table/
      ├─ fds-token-migration-report.json
      └─ fds-token-migration-report.md
```

不同入口不能重复或互相包含，避免同一源码在一次批量 `apply` 中被重复处理。批量 `apply` 仍保持全局保护：任一组件存在解析错误时，整批不写入。
