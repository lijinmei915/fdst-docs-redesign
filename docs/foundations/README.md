---
layer: knowledge
type: index
last_verified: 2026-09-08
teaches: "FDS Foundation 各类 Token 的设计目标、使用场景和阅读入口"
use_when: "设计或评审页面视觉，或需要确定颜色、排版、间距、圆角、阴影、层级和动效规则时"
---

# FDS Foundation 设计规范

Foundation 将视觉选择收敛为可复用的 Token 规则。设计和开发应先按用途选择 Semantic Token；只有维护底层体系或没有合适语义时，才直接选择 Atomic 数值档。

## 按设计任务查阅

| 任务 | 文档 | 当前内容 |
| --- | --- | --- |
| 选择品牌色、状态色、文字色和表面色 | [颜色](颜色.md) | 设计原则、场景、状态组合、视觉预览和固定色板边界 |
| 确定标题、正文、标签的字号组合 | [排版](排版.md) | 字号、行高、字重和 Semantic recipe |
| 安排页面留白并判断元素尺寸归属 | [间距与尺寸](间距与尺寸.md) | Spacing 与组件尺寸边界 |
| 选择场景卡片、组件和胶囊圆角 | [圆角与边框](圆角与边框.md) | Radius、Border Width 和职责边界 |
| 处理浮层、拖拽、层级和透明度 | [阴影与层级](阴影与层级.md) | Shadow、Z-Index 和 Opacity |
| 设计反馈、浮层和展开收起动效 | [动效](动效.md) | Duration、Easing 和四类语义动效 |

Foundation 六个专题已按同一结构补充设计原则、典型场景、Do / Don't 和视觉示例入口。完整 Token 值仍由自动生成目录承载，不在专题页复制维护。

## 页面统一结构

Foundation 专题页按以下顺序组织：

1. 这项规范解决什么问题。
2. 设计原则和适用场景。
3. 推荐与不推荐的使用方式。
4. 可感知的视觉示例。
5. 当前 Token 与工程边界。
6. 来源、版本和维护信息。

设计读者不需要先理解 YAML、schema 或构建命令。完整值表由 [Token 目录](../reference/Token目录.md) 自动生成；工程维护信息集中在 [文档维护](../engineering/文档维护.md)。

需要从基础值进入页面用途时，继续阅读 [基础语义](../semantics/基础语义.md) 和 [场景语义](../semantics/场景语义.md)。

## 与 SDS 的边界

- 本目录维护 Token 相关的详细设计规范。
- SDS 维护宏观 FDS、Components、Grid、Layout、Icons、Charts、无障碍和其他非 Token 规范。
- SDS 不复制本目录的 Token 名称和值；需要引用时直接链接到对应专题页。
- Components 页面中的设计语境留在 SDS，具体 Component Token 在 `fdst` 发布后由本仓库提供详情入口。

## 来源

- [FDS Token 文档首页](../README.md)
- [分层模型](../concepts/分层模型.md)
- [引用与边界](../concepts/引用与边界.md)
- [文档维护](../engineering/文档维护.md)
