# FDS 默认场景 Token 设计

> 内部历史设计记录；正式使用说明见 `docs/semantics/场景语义.md`。

> 2026-09-07 起，本记录中的 `scene-*` / `--fds-g-scene-*` 命名已由 `2026-09-07-scene-namespace.md` 替代，仅保留用于追溯历史决策。

## 决策

FDS Scene 层发布 `scene-*` 默认协议，不发布 `workbench-*`、`detail-*`、`dashboard-*` 等具体业务场景名称。

## 原因

- Scene 层需要提供可直接消费和覆盖的公共定义，不能只作为空目录存在。
- `workbench-*` 会把 FDS 全局契约绑定到具体业务场景，并与业务项目的私有定义重叠。
- `scene-*` 只组合已有 Base/Map，提供稳定入口，不重复保存颜色、尺寸或其他原始值。

## 范围

首版只包含页面背景、内容留白、卡片间距、场景卡片容器和场景卡片标题，共 14 个 Token。字体族属于全局排版约束，不在 Scene 层重新定义。

Button、Tab、搜索框、指标、图表、进度条、状态标签和单张特殊卡片不进入 Scene。`scene-card-*` 表达页面中多个内容卡片共享的场景规则，不替代 Card 组件 Token。

## 消费关系

```text
Atomic/Map -> Semantic/Base -> Semantic/Scene(scene-*) -> 业务私有场景
```

具体工作台可以直接消费 `--fds-g-scene-*`，也可以在自身作用域内覆盖或建立私有别名。业务私有定义不反向进入 FDS Base。
