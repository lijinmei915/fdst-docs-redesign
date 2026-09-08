# 语法支持范围

“支持文件”表示工具能够用对应 AST 定位其中明确的样式容器，不表示会扫描或改写文件中的任意字符串。

| 文件 / 容器 | 扫描 | 自动改写 | 首版边界 |
| --- | --- | --- | --- |
| `.css/.pcss` | 是 | 是 | 仅完整 declaration value；不拆多值 shorthand |
| `.scss` | 是 | 是 | 变量和插值不是静态单一值时不改写 |
| `.less` | 是 | 是 | 变量、mixin 和动态表达式不改写 |
| `.sass` | 是 | 是 | `postcss-sass` 可解析的缩进语法；解析失败阻止整次 `apply` |
| `.vue` `<style>` | 是 | 是 | 按 `lang=css/scss/sass/less` 路由；未知 `lang` 进入解析错误 |
| `.vue` 静态 `style="..."` | 是 | 是 | 按 CSS declaration list 解析 |
| `.vue` 简单 `:style="{...}"` | 是 | 是 | 只改写字符串或无插值模板字面量 |
| `.vue` `<script>/<script setup>` | 是 | 是 | 与对应 JS/TS 规则一致 |
| `.html/.htm` 静态 `style="..."` | 是 | 是 | 不解析普通属性字符串或 `<script>` 内容 |
| `.js/.jsx/.ts/.tsx` JSX `style={{...}}` | 是 | 是 | 字符串或无插值模板字面量；引用变量只报告 |
| `CSSProperties` 类型对象 | 是 | 是 | 支持直接类型标注、`as`、`satisfies` 及嵌套对象 |
| `css/createStyles/makeStyles` 对象参数 | 是 | 是 | 支持直接对象及函数直接返回的对象 |
| 静态 `css\`...\`` / `styled.*\`...\`` | 是 | 是 | 整个模板无插值时按 CSS 解析 |
| 普通字符串、普通数据对象 | 否 | 否 | 防止颜色数据、文案和序列化内容误报 |
| 动态表达式、spread、跨变量引用、模板插值 | 报告 | 否 | 状态为 `unsupported`，`verify` 返回 `3` |
| 数值 style 值 | 报告 | 否 | React/Vue 的运行时单位语义不同，首版不猜测 |
| 未知 CSS-in-JS API | 否 | 否 | 需先加入受评审白名单和专用 fixture |

## 安全边界

- 所有自动替换都必须有 AST 节点、完整值和精确源码 offset 三项证据。
- 工具不使用 Babel generator、全文件 formatter 或正则扫描任意字符串。
- 任一文件出现 parser error，`apply` 不写入任何目标文件，但仍输出报告。
- `postcss-sass` 官方明确说明并非覆盖全部 Sass 语法，因此 `.sass` 支持必须以实际解析结果为准。
