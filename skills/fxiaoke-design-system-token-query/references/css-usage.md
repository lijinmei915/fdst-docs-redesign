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
| 字号、行高、字重、字体族 | `font-size`、`line-height`、`font-weight`、`font-family` |
| 间距和留白 | `gap`、`padding`、`margin` |
| 控件高度、图标尺寸 | `height`、`width`、`font-size` |
| 圆角 | `border-radius` |
| 透明度、层级、阴影 | `opacity`、`z-index`、`box-shadow` |
| 动效时长、缓动 | `transition-duration`、`transition-timing-function` |

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

Dropdown 动效应查询 `Semantic/Base/Motion` 中的 Context Duration、Enter Easing 和 Exit Easing；组件仍负责选择实际过渡属性、关键帧和触发状态。

## 边界

- 示例只演示 Global Token 消费，不定义组件内部结构。
- 一个查询结果可用于多个合法 CSS 属性时，以用户场景为准；不确定时先返回查询结果中的 `var(--fds-g-*)` 或 `var(--fds-s-*)`，并说明需确认具体属性。
- 禁止为了让示例看起来完整而加入查询索引中不存在的变量。
