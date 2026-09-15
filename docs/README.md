---
layer: knowledge
type: index
last_verified: 2026-09-08
teaches: "FDS Token 的设计规则、使用场景、CSS 接入方式与工程维护入口"
use_when: "查询颜色、排版、间距、圆角、阴影、层级、动效或接入 FDS CSS 时"
---

# FDS Token 文档

这里是 FDS Token 的统一文档入口，面向设计师、产品、业务开发者、组件开发者和 Token 维护者。详细 Token 规范在 `fdst` 维护；SDS 保留宏观 FDS、Components 和其他非 Token 设计规范，并链接到这里。

正式阅读入口是由本目录同源生成的 [FDS Token 可视化文档站](../public/index.html)。Markdown 保存可审查的规范正文，文档站提供导航、搜索、页内目录和与正文原位结合的视觉示例。

页面和组件运行时使用 [FDS CSS](../release/fds-global-tokens.css)。Token 是否存在、类型、源值和解析值，以 `tokens/fds-global.yml` 的 import 图及其生成物为准；catalog JSON 只服务文档生成、查询和校验，不要求设计读者或普通业务接入。

<div class="fds-demo" data-demo="overview"></div>

## 按角色开始

| 读者 | 建议先读 | 解决的问题 |
| --- | --- | --- |
| 设计师、产品 | [Foundation 设计规范](foundations/README.md)、[颜色](foundations/颜色.md) | 为什么这样使用、适用场景和视觉结果 |
| ShareDev 业务开发者 | [快速开始](getting-started/快速开始.md)、[ShareDev 接入](getting-started/ShareDev接入.md) | 如何引入 CSS、选择 Token、处理业务私有样式 |
| 组件和平台开发者 | [分层模型](concepts/分层模型.md)、[引用与边界](concepts/引用与边界.md) | Global、Scene、组件 Token 的职责如何划分 |
| Token 维护者 | [YAML 源文件](engineering/YAML源文件.md)、[构建与校验](engineering/构建与校验.md) | 如何修改源文件并同步生成物 |

## 文档职责

| 内容 | 维护位置 |
| --- | --- |
| Token 设计原则、使用场景、名称、值、语义和视觉示例 | `fdst/docs` |
| Token YAML、CSS、catalog、版本和发布 | `fdst` |
| 宏观 FDS、Components、布局、栅格、图标、图表和其他设计规范 | SDS |

SDS 中涉及具体 Token 的页面只保留入口链接。Icons、Charts 等混合主题按内容拆分：图标或图表的设计规范留在 SDS，其中引用的颜色、间距等 Token 回到本仓库查询。

## 交付方式

| 交付物 | 面向对象 | 用途 |
| --- | --- | --- |
| `release/fds-global-tokens.css` | 页面、组件、文档预览 | 浏览器运行时直接消费 |
| `release/fds-global-tokens.min.css` | 生产环境 | 与普通版等价的压缩产物 |
| `docs/` | 设计、产品、开发 | 设计规则、场景和接入说明 |
| `public/` | 设计、产品、开发 | 从 `docs/` 生成的可展示站点 |
| `release/fds-token-catalog.json` | 生成器、校验器、查询工具 | 机器读取的派生数据，不是设计侧接入要求 |

## 核心原则

- 唯一源入口是 `tokens/fds-global.yml`，加载顺序由 YAML imports 决定。
- 依赖方向固定为 `Atomic/Seed -> Atomic/Map -> Semantic/Base -> Semantic/Scene`。
- 业务样式优先使用 Semantic/Base；通用页面组合优先使用 Semantic/Scene。
- `--fds-g-` 是 Atomic/Map 与 Semantic/Base 的 CSS 命名空间，`--fds-s-` 是 Semantic/Scene 的 CSS 命名空间；二者都不写入 YAML Token ID。
- Component Token 由组件包维护，业务私有变量由业务作用域维护。
- 当前维护 Base Palette 和固定公司色系 Dark Map，但不承诺暗色 Semantic、主题切换、栅格、响应式断点或组件 Token。

## 文档目录

### 开始使用

- [快速开始](getting-started/快速开始.md)
- [ShareDev 接入](getting-started/ShareDev接入.md)

### 概念

- [分层模型](concepts/分层模型.md)
- [命名规则](concepts/命名规则.md)
- [引用与边界](concepts/引用与边界.md)

### Foundation

- [Foundation 设计规范](foundations/README.md)
- [颜色](foundations/颜色.md)
- [排版](foundations/排版.md)
- [间距与尺寸](foundations/间距与尺寸.md)
- [圆角与边框](foundations/圆角与边框.md)
- [阴影与层级](foundations/阴影与层级.md)
- [动效](foundations/动效.md)
- [Foundation 视觉工作台](examples/README.md)

### Semantic

- [基础语义](semantics/基础语义.md)
- [场景语义](semantics/场景语义.md)

### 工程维护

- [YAML 源文件](engineering/YAML源文件.md)
- [构建与校验](engineering/构建与校验.md)
- [版本与发布](engineering/版本与发布.md)
- [文档维护](engineering/文档维护.md)

### Reference

- [Token 目录](reference/Token目录.md)
- [迁移与常见问题](reference/迁移与常见问题.md)

## 来源

- [工程入口](../README.md)
- [YAML 包入口](../tokens/fds-global.yml)
