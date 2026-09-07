# FDS Token 维度目录

> 旧版维度汇总，已由 `docs/` 正式文档体系和自动生成的 `docs/reference/Token目录.md` 取代，仅作迁移追溯。

## 1. 展开规则

本文用于说明 FDS Global Token 当前维护的全部维度及其边界，不展示具体取值表。

- 颜色展开到具体色系，不展开每个色阶及其生成结果。
- 排版、间距、尺寸、形状、效果和动效展开到可维护的末端类别，不继续列举数字档位。
- 基础语义和场景语义展开到实际用途，不重复列出其引用的原始值。
- 文件夹只用于拆分维护职责，不形成新的 Token 层级。

## 2. 总体维度树

```text
FDS Global Token
├─ Atomic 原子层
│  ├─ Seed
│  │  └─ Color 颜色基准
│  └─ Map
│     ├─ Color 颜色值域
│     ├─ Typography 排版
│     ├─ Spacing 通用间距
│     ├─ Sizing 元素尺寸
│     ├─ Shape 形状
│     ├─ Effects 视觉效果
│     └─ Motion 动效时长与缓动
└─ Semantic 语义层
   ├─ Base
   │  ├─ Color 颜色语义
   │  ├─ Typography 排版语义
   │  ├─ Layout 布局语义
   │  ├─ Effects 效果语义
   │  └─ Motion 动效语义
   └─ Scene
      ├─ Page 页面与内容区
      ├─ Card 场景卡片
      └─ Card Title 场景卡片标题
```

组件层由组件自行维护，不进入 FDS Global Token。

## 3. Atomic / Seed

Seed 只保存会参与后续派生的最小输入。当前只有颜色 Seed；长度和动效时长均作为设计确认的离散值直接进入 Map。

| 维度 | 定义 | 末端内容 |
|---|---|---|
| Color | 各真实色系生成色阶时使用的基准颜色 | Brand、Deep Orange、Amber、Yellow、Lime、Yellow Green、Green、Teal、Cyan、Light Blue、Blue、Indigo、Purple、Magenta、Pink、Red |

### 颜色色系

```text
Color
├─ Brand
├─ Deep Orange
├─ Amber
├─ Yellow
├─ Lime
├─ Yellow Green
├─ Green
├─ Teal
├─ Cyan
├─ Light Blue
├─ Blue
├─ Indigo
├─ Purple
├─ Magenta
├─ Pink
└─ Red
```

这些色系名称是颜色维度的末端；本文不继续展开对应色阶。

## 4. Atomic / Map

Map 发布可直接引用的值域和固定枚举。除颜色外，下表中的“末端类别”不继续展开数字档位。

| 维度 | 定义 | 末端类别 |
|---|---|---|
| Color / Palette | 由颜色 Seed 派生并在构建结果中发布的有彩色色板 | Brand、Deep Orange、Amber、Yellow、Lime、Yellow Green、Green、Teal、Cyan、Light Blue、Blue、Indigo、Purple、Magenta、Pink、Red |
| Color / Gray | 由设计直接维护的灰度色板，不参与有彩色生成逻辑 | Gray，包含 White 与 Black 别名 |
| Color / RGB | 为透明度等 CSS 使用方式提供的 RGB 通道值 | 各有彩色色系的基准色阶 RGB；不为其他色阶重复维护 |
| Typography | 全局排版原子值 | Font Family、Font Size、Line Height、Font Weight |
| Spacing | 页面和组件可以共同消费的通用间距值域 | Size；供 Padding、Margin、Gap 等属性按语义引用 |
| Sizing | 不属于通用间距的元素尺寸 | Control Height、Icon Size |
| Shape | 容器及控件的几何边界 | Radius、Border Width |
| Effects | 不改变布局尺寸的视觉与层级效果 | Opacity；Z-Index 静态区间；Shadow 具体配方 |
| Motion | 可供语义层 recipe 引用的动效时长与缓动值域 | Duration 0-4：0/100/200/300/400ms；Easing 1-3：Standard、Enter、Exit |

## 5. Semantic / Base

Base 将 Atomic 值映射为跨页面、跨业务成立的基础用途。

### 5.1 Color

| 维度 | 定义 | 末端类别 |
|---|---|---|
| Primary | 品牌主操作及其状态 | 实心 Default、Hover、Active、Disabled；浅背景 Default、Hover、Active |
| Danger | 错误、危险或破坏性状态 | 实心 Default、Hover、Active、Disabled；浅背景 Default、Hover、Active |
| Warning | 警告或需要关注的状态 | 实心 Default、Hover、Active、Disabled；浅背景 Default、Hover、Active |
| Success | 成功或正向完成状态 | 实心 Default、Hover、Active、Disabled；浅背景 Default、Hover、Active |
| Info | 信息提示状态 | 实心 Default、Hover、Active、Disabled；浅背景 Default、Hover、Active |
| Text | 全局文本层级 | Primary、Secondary、Tertiary、Disabled、Inverse |
| Icon | 全局图标层级 | Primary、Secondary、Disabled |
| Surface | 页面和容器表面 | Page、Container、Elevated、Disabled |
| Mask | 遮罩表面 | Mask |
| Border | 全局边界状态 | Default、Subtle、Disabled、Focus、Error |

浅背景状态统一映射各自色系的 40 / 50 / 60，组件只消费 `color-*-background*` 语义，不直接选择 Brand、Red、Amber、Green 或 Blue 色阶。

### 5.2 Typography

| 维度 | 定义 | 末端类别 |
|---|---|---|
| Heading | 页面及内容层级标题 | Heading 1、Heading 2、Heading 3、Heading 4、Heading 5 |
| Body | 正文排版 | Body |
| Label | 标签及表单说明排版 | Label |
| Caption | 辅助说明和弱信息排版 | Caption |
| Code | 代码和等宽文本排版 | Code |

字体族属于全局排版约束，只在 Base 中维护，不进入 Scene。

### 5.3 Layout

| 维度 | 定义 | 末端类别 |
|---|---|---|
| Disabled Opacity | 全局禁用态透明度 | Opacity Disabled |
| Background | 常用页面和容器背景 | Main、Container、Elevated、Disabled、Mask |
| Control Height | 控件语义尺寸 | Compact、Default、Large |
| Radius | 常用形状语义 | Control、Container |
| Layer | 全局叠放层级 | Base、Sticky、Popup、Overlay、Modal、Feedback |

### 5.4 Effects

| 维度 | 定义 | 末端类别 |
|---|---|---|
| Shadow | 不让调用方按数字猜测阴影强度，只按稳定用途消费 | None、Active、Drag、Dropdown |

普通场景卡片默认使用 `shadow-none`，依靠背景和边框建立边界。Modal、Drawer 方向性阴影及其他组件私有投影不进入 FDS Global Token。

### 5.5 Motion

| 维度 | 定义 | 末端类别 |
|---|---|---|
| Feedback | Button 按压、Toggle 和选中标记等小范围即时反馈 | Duration、Easing |
| Context | Tooltip、Dropdown、Popover 等上下文浮层进入和退出 | Duration、Enter Easing、Exit Easing |
| Disclosure | Accordion、Tree、折叠区和侧栏等内容结构变化 | Duration、Easing |
| Prominent | 重要 Notification、较大遮罩或显著位移；限制使用频率 | Duration、Enter Easing、Exit Easing |

Motion Base 不提供脱离场景的 `fast/mid/slow`，也不使用一个全局 Enter 时长覆盖所有尺寸。组件决定实际过渡属性和关键帧；`500ms+` 的 Carousel、Progress、循环动画等由组件或业务场景私有维护。生成 CSS 在 `prefers-reduced-motion: reduce` 下把四类语义 Duration 统一覆盖为 `0ms`。

## 6. Semantic / Scene

Scene 将 Base 和 Map 组合成不绑定具体业务的默认页面场景协议。它不保存新的原始值，也不改变全局字体族。

| 维度 | 定义 | 末端类别 |
|---|---|---|
| Page | 页面型场景的画布与内容区节奏 | Background、Content Padding、Card Gap |
| Card | 同一页面场景中多个内容卡片共享的容器规则 | Background、Border Color、Border Width、Radius、Padding、Shadow |
| Card Title | 场景卡片标题的共享排版和内容间距 | Color、Size、Line Height、Weight、Gap |

`scene-card-*` 不是 Card 组件 Token。它只描述页面场景中多张内容卡片共同遵循的规则，具体 Card 组件内部结构和交互仍由组件维护。

## 7. 当前不包含

- 各颜色色阶明细及色阶生成过程；
- 暗色主题；
- 栅格和响应式断点；
- Button、Tab、Input、Card 等组件 Token；
- Workbench、Dashboard、Detail 等业务私有场景；
- 单个页面、单张卡片或单种图表的局部样式。
