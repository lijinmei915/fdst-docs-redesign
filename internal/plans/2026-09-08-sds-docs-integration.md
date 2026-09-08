# SDS Token 文档接入 fdst

当前状态：第一阶段与第二阶段已在本地实施；第三阶段、第四阶段待设计侧协作。

## 目标

将 Token 详细文档及其面向设计读者的表达方式统一迁入 `fdst`。SDS 只保留宏观 FDS、Components 和其他非 Token 设计规范，并链接到 `fdst` 对应专题页。

## 边界

- Token 源、CSS、详细文档、catalog、版本和发布由 `fdst` 管理。
- CSS 是运行时和视觉预览的主要交付物。
- catalog JSON 只用于生成、查询和校验，不要求设计侧消费。
- SDS 不读取 catalog 重建详细 Token 页面，不维护 Token 副本。
- Grid、Layout、Icons、Charts 等混合页面仅拆出具体 Token 内容。

## 推进阶段

### 第一阶段：入口与样板

- 调整 `docs/README.md`，增加设计读者入口和职责边界。
- 建立 `docs/foundations/README.md`。
- 为 Foundation 页面补齐 `teaches`、`use_when` 元信息。
- 将颜色页改造成包含原则、场景、Do / Don't 和视觉预览的样板。
- 建立文档维护手册。

### 第二阶段：Foundation 专题迁移

- 按颜色页结构完善排版、间距、圆角、阴影、层级、透明度和动效。
- 每页只保留当前 `fdst` 能验证的 Token 事实。
- 为尺寸、排版、阴影和动效增加可感知的视觉示例。

### 第三阶段：SDS 收口

- SDS 的详细 Token 页面替换为 `fdst` 链接。
- SDS 清理旧 Token 真相源、旧值表和运行时计算描述。
- Components 和非 Token 设计规范保持原有导航与维护方式。

### 第四阶段：文档站能力

- 设计侧提供 SDS 当前文档站的可维护源码或模板后，再评估复用导航、搜索和展示组件。
- 在源码缺失期间，以 Markdown 和无依赖静态预览保证内容可读、可审查。

## 验收

- 设计读者从 `fdst/docs` 可以直接进入 Foundation 专题，不需要先理解工程目录。
- Token 名称和值只在 YAML 事实源及生成物中维护一次。
- 所有 Markdown 相对链接和 CSS Variable 示例通过校验。
- SDS 不再保留详细 Token 副本。
- 最新 Token 与文档完成提交和发布后，才对外声明接入完成。
