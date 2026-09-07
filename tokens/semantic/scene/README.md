# 场景语义边界

本目录属于 Semantic 语义层的 Scene 子层。

本层维护跨业务可复用的默认场景协议。它把 Base 和 Map 中分散的背景、容器、间距及排版能力组合成页面型场景可以直接消费、局部覆盖的一组 Token。

当前发布 `scene-*` 默认协议，不发布 `workbench-*`、`detail-*`、`dashboard-*` 等具体业务场景名称。工作台、详情页、驾驶舱等业务场景可以直接消费 `scene-*`，也可以在自己的作用域内覆盖或建立私有别名。

当前默认协议覆盖：

| 范围 | Scene Token | 引用的全局底座 |
|---|---|
| 页面与布局 | `scene-background`、`scene-content-padding`、`scene-card-gap` | `background-main`、`size-*` |
| 场景卡片 | `scene-card-background`、`scene-card-border-*`、`scene-card-radius`、`scene-card-padding`、`scene-card-shadow` | 容器、边框、圆角、间距和阴影底座 |
| 场景卡片标题 | `scene-card-title-*` | `typography-heading-5-*`、`size-*` |

`scene-card-*` 表达页面场景中多个内容卡片共同遵循的布局规则，不替代 Card 组件 Token。Button、Tab、搜索框、指标、图表、进度条、状态标签以及单张特殊卡片的细节不进入本层。

Scene Token 只引用 `Semantic/Base` 或 `Atomic/Map`，不保存新的色值、尺寸或其他原始值。具体业务场景的私有定义也不应反向进入 FDS Base。
