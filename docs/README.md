# FDS Global Token 文档

FDS Global Token 为 ShareDev 页面、平台能力和组件提供统一的全局设计变量。业务代码优先消费 Semantic Token；只有在没有合适语义或维护底层体系时，才直接查看 Atomic Token。

Token 是否存在、类型、源值和解析值，以 `tokens/fds-global.yml` 的 import 图生成的 [Token 目录](reference/Token目录.md) 和 [catalog JSON](../dist/fds-token-catalog.json) 为准。本文档不手工维护第二份 Token 清单。

## 按角色开始

| 读者 | 建议先读 | 解决的问题 |
| --- | --- | --- |
| ShareDev 业务开发者 | [快速开始](getting-started/快速开始.md)、[ShareDev 接入](getting-started/ShareDev接入.md) | 如何引入 CSS、选择 Token、处理业务私有样式 |
| 组件和平台开发者 | [分层模型](concepts/分层模型.md)、[引用与边界](concepts/引用与边界.md) | Global、Scene、组件 Token 的职责如何划分 |
| Token 维护者 | [YAML 源文件](engineering/YAML源文件.md)、[构建与校验](engineering/构建与校验.md) | 如何修改源文件并同步生成物 |

## 核心原则

- 唯一源入口是 `tokens/fds-global.yml`，加载顺序由 YAML imports 决定。
- 依赖方向固定为 `Atomic/Seed -> Atomic/Map -> Semantic/Base -> Semantic/Scene`。
- 业务样式优先使用 Semantic/Base；通用页面组合优先使用 Semantic/Scene。
- `--fds-g-` 是 Atomic/Map 与 Semantic/Base 的 CSS 命名空间，`--fds-s-` 是 Semantic/Scene 的 CSS 命名空间；二者都不写入 YAML Token ID。
- Component Token 由组件包维护，业务私有变量由业务作用域维护。
- 当前只维护统一亮色色系，不承诺暗色主题、栅格、响应式断点或组件 Token。

## 文档目录

### 开始使用

- [快速开始](getting-started/快速开始.md)
- [ShareDev 接入](getting-started/ShareDev接入.md)

### 概念

- [分层模型](concepts/分层模型.md)
- [命名规则](concepts/命名规则.md)
- [引用与边界](concepts/引用与边界.md)

### Foundation

- [颜色](foundations/颜色.md)
- [排版](foundations/排版.md)
- [间距与尺寸](foundations/间距与尺寸.md)
- [圆角与边框](foundations/圆角与边框.md)
- [阴影与层级](foundations/阴影与层级.md)
- [动效](foundations/动效.md)

### Semantic

- [基础语义](semantics/基础语义.md)
- [场景语义](semantics/场景语义.md)

### 工程维护

- [YAML 源文件](engineering/YAML源文件.md)
- [构建与校验](engineering/构建与校验.md)
- [版本与发布](engineering/版本与发布.md)

### Reference

- [Token 目录](reference/Token目录.md)
- [迁移与常见问题](reference/迁移与常见问题.md)

## 来源

- [工程入口](../README.md)
- [YAML 包入口](../tokens/fds-global.yml)
