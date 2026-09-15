# FDS Token CSS 使用说明

## 基本写法

只使用查询结果中的 `cssVariable`：

```css
.example {
  background-color: var(--fds-g-background-main);
}
```

不得把 `resolvedValue` 的 Hex、px、ms 或其他具体值复制为业务硬编码。`resolvedValue` 用于解释和核验，CSS 应继续引用变量。

## 属性映射

根据用户实际描述选择 CSS 属性，不根据 Token 名强行改变用途：

| 用户用途 | 常见 CSS 属性 |
| --- | --- |
| 页面、容器、状态背景 | `background-color` |
| 文本和图标颜色 | `color` |
| 边框颜色、边框宽度 | `border-color`、`border-width` |
| 字号、行高、字重 | `font-size`、`line-height`、`font-weight` |
| 间距和留白 | `gap`、`padding`、`margin` |
| 圆角 | `border-radius` |
| 透明度、层级、阴影 | `opacity`、`z-index`、`box-shadow` |
| 动效时长、缓动 | `transition-duration`、`transition-timing-function` |

`line-height-*` 是固定 `px` 行高，`line-height-ratio-*` 是无单位字号倍率。不要在两套值之间按数字档位对应；优先使用 Heading/Text 语义 recipe，只有组件或排版适配层明确需要随字号缩放时才查询 Ratio Map。

Global Token 不提供控件高度或图标尺寸；这类尺寸由组件 Size API、Component Token 或图标实现负责，不按硬编码值从 Global Catalog 猜测。

## 示例

危险状态浅背景：

```css
.danger-surface {
  color: var(--fds-g-color-danger);
  background-color: var(--fds-g-color-danger-background);
}
```

场景卡片标题：

```css
.scene-card__title {
  color: var(--fds-s-card-title-color);
  font-size: var(--fds-s-card-title-size);
  line-height: var(--fds-s-card-title-line-height);
  font-weight: var(--fds-s-card-title-weight);
}
```

紧凑密度场景：

```css
.dense-region {
  line-height: var(--fds-s-density-compact-line-height);
  gap: var(--fds-s-density-compact-spacing);
}
```

密度场景的 Line Height 与 Spacing 成对选择。Spacing 可按实际布局用于 `gap`、`padding` 或 `margin`，不替代组件 Size API 或控件高度 Token。

Dropdown 动效应查询 `Semantic/Base/Motion` 中的 Context Duration、Enter Easing 和 Exit Easing；组件仍负责选择实际过渡属性、关键帧和触发状态。

`motion-duration-5..8` 的 `500/600/800/1000ms` 是受限 Atomic Map，仅在用户给出大型元素、复杂结构、分阶段演示或长距离过渡等明确场景时返回，不把它们解释为通用 slow recipe。

## 边界

- 示例只演示 Global Token 消费，不定义组件内部结构。
- Dark Map 仅在用户明确查询原子色阶时返回；不要据此补造暗色 Semantic 或主题切换示例。
- 一个查询结果可用于多个合法 CSS 属性时，以用户场景为准；不确定时先返回查询结果中的 `var(--fds-g-*)` 或 `var(--fds-s-*)`，并说明需确认具体属性。
- 禁止为了让示例看起来完整而加入查询索引中不存在的变量。
