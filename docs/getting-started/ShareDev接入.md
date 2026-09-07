# ShareDev 接入

## 适用范围

本页说明 ShareDev 页面或 PWC 样式如何消费已构建的 FDS Global Token。具体应用的资源目录、构建插件和发布责任人尚未统一，不能据此推断某个业务仓库的接入路径。

## 接入前提

消费方必须先保证 `fds-global-tokens.css` 在业务样式执行前加载。可以由平台公共资源统一注入，也可以由应用样式入口引入，但同一页面只应有一个受控来源。

接入完成后，可在浏览器中验证：

```js
getComputedStyle(document.documentElement)
  .getPropertyValue('--fds-g-color-primary')
  .trim();
```

## 在页面样式中引用

```css
.work-area {
  color: var(--fds-g-color-text-primary);
  background: var(--fds-g-background-main);
}

.work-area__content {
  padding: var(--fds-g-scene-content-padding);
}

.work-area__panel {
  background: var(--fds-g-scene-card-background);
  border: var(--fds-g-scene-card-border-width) solid
    var(--fds-g-scene-card-border-color);
  border-radius: var(--fds-g-scene-card-radius);
}
```

页面上的业务区域可以消费 Scene 默认协议。组件内部状态应继续由组件公开 API 或组件 Token 控制，不要用页面选择器穿透组件实现。

## 业务私有覆盖

业务需要不同场景节奏时，在业务根节点覆盖已有 Scene Token，或定义业务自己的变量；不要创建新的 `--fds-g-*` 名称。

```css
.sales-dashboard {
  --sales-dashboard-card-gap: var(--fds-g-size-4);
  gap: var(--sales-dashboard-card-gap);
}
```

只有跨业务稳定、语义明确且经过评审的能力，才考虑进入 FDS Global Token。

## 常见错误

| 错误 | 原因 | 应对 |
| --- | --- | --- |
| 复制 `:root` 变量到页面 CSS | 形成不可追踪的第二份事实 | 引入构建产物 |
| 根据颜色外观直接选色阶 | 语义变化时业务无法统一迁移 | 优先选择状态、文本或表面语义 |
| 用 `--fds-g-scene-card-*` 改组件内部结构 | Scene 不拥有 Card 组件实现 | 使用组件 API 或组件 Token |
| 猜测不存在的变量名 | 命名相似不代表已经发布 | 查询自动生成的 Token 目录 |
| 在客户或业务作用域定义新 `--fds-g-*` | 冒充全局公开契约 | 使用业务私有前缀 |

## 边界

- 本项目不定义 ShareDev 资源上传、缓存刷新或灰度发布流程，这些环节仍为待确认。
- 不允许直接读取 YAML 作为浏览器运行时依赖。
- 不把 HTML 分享页作为接入源。

## 来源

- [快速开始](快速开始.md)
- [场景语义](../semantics/场景语义.md)
- [版本与发布](../engineering/版本与发布.md)

