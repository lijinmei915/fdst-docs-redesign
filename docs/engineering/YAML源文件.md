# YAML 源文件

## 适用范围

本页面向 Token 维护者，说明源文件入口、目录职责、schema 和引用语法。YAML 是维护入口，业务和组件运行时只消费构建产物。

## 唯一入口与 import 图

`tokens/fds-global.yml` 是唯一包入口：

```yaml
schema: fds-token-package/v1
global:
  name: fds-global
  namespace: --fds-g-
  scope: global
imports:
- ./atomic/base.yml
- ./semantic/base.yml
```

聚合文件使用 `fds-token-group/v1`，只维护 imports；叶子文件使用 `fds-token-source/v1`，才维护 props。新增叶子文件时，把它加入最近一级聚合入口，不在构建脚本中维护另一份加载清单。

## 叶子文件结构

```yaml
schema: fds-token-source/v1
global:
  layer: semantic
  tier: base
  category: color
  type: color
  scope: global
  primitive: false
imports:
- ../../atomic/map/color/palette/base.yml
props:
  color-primary:
    value: '{!color-brand-9}'
```

| 字段 | 规则 |
| --- | --- |
| `global.layer` | `atomic` 或 `semantic` |
| `global.tier` | Atomic 使用 `seed/map`；Semantic 使用 `base/scene` |
| `global.category` | 文件负责的领域，如 `color`、`layout`、`motion` |
| `global.type` | 文件内统一时提供默认类型，单个 Token 可覆盖 |
| `global.scope` | 当前固定为 `global` |
| `global.primitive` | Atomic 为 `true`，Semantic 为 `false` |
| `global.namespace` | Semantic/Scene 必须显式使用 `--fds-s-`；其他层省略并使用包级 `--fds-g-` |
| `global.source` | 可选的维护来源：`manual/generated/derived` |
| `imports` | 相对当前 YAML 文件的直接依赖 |
| `props` | Token ID 到定义的映射，Key 为小写 kebab-case |
| `value` | 原始值或 `{!token-id}` 源引用 |
| `comment` | 只解释名称无法表达的约束和边界 |

## 引用规则

YAML 中只使用 `{!token-id}`，不写 CSS `var()`。构建器按被引用 Token 的 namespace 生成 CSS：Base 引用转换为 `var(--fds-g-color-brand-9)`，Scene 引用 Base/Map 时同样指向 `--fds-g-*`。

依赖只允许沿 `Atomic/Seed -> Atomic/Map -> Semantic/Base -> Semantic/Scene` 正向或同级流动，禁止反向和循环引用。引用的类型必须一致；Shadow 组合 Color 是当前受支持的例外。

## 修改流程

1. 从包入口沿 imports 找到对应叶子文件。
2. 修改 props，不编辑 `release`、catalog 或自动生成的 Token 目录。
3. 运行 [构建与校验](构建与校验.md) 中的完整命令。
4. 评审 YAML、CSS、catalog 和文档 diff 是否一致。

## 边界

- 当前 schema 借鉴 DTCG 的显式类型和引用思想，但不是 DTCG 标准交换文件。
- 源文件禁止 `rem`、`calc()` 和长度 Seed。
- 生成色阶以具体值写入 YAML；浏览器运行时不执行颜色生成算法。
- 色板索引保留各自认知：有彩色 Base/Dark Map 使用 `0-11`，Gray 使用 `1-20`，Special 使用 `1-4`。

## 来源

- [包入口](../../tokens/fds-global.yml)
- [构建器](../../tools/build.py)
- [DTCG Design Tokens Format 2025.10](https://www.designtokens.org/TR/2025.10/format/)
