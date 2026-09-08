# FDS Token 迁移匹配策略

## 核心原则

迁移遵循“先用途和属性，后比较值”。值相等只能证明视觉值当前一致，不能证明页面背景、容器背景、文字色、边框色或组件状态语义一致。

## 自动替换门槛

声明只有同时满足以下条件才进入 `auto-replace`：

1. CSS property 命中 `migration-policy.json` 中的规则。
2. 值能够按对应 Token 类型完整解析，不是复合 shorthand 或动态表达式。
3. 候选 Token 的 `resolvedValue` 与原值精确等价。
4. 候选名称和类型均与 property 规则兼容。
5. Semantic/Base 候选唯一；如果没有 Semantic/Base，只有规则明确允许时才考虑 Atomic/Map。
6. Semantic/Scene 只有通过 `--context` 显式提供场景后才参与自动决策。
7. 原始值可以原样嵌入 `var(--token, 原值)`，不需要格式化源文件。

自动替换时保留原始字面量，包括大小写、单位和函数写法：

```css
color: #FF522A;
color: var(--fds-g-color-danger, #FF522A);
```

## 候选优先级

优先级由每类 CSS property 单独定义，不能全局套用“Semantic 永远优先”：

1. 颜色属性本身已提供较强语义，优先 Semantic/Base；Scene 仍需显式 `--context`。
2. spacing、radius、typography 等通用尺度在没有语义上下文时优先 Atomic/Map，避免把相同数值误解释为 Card、Control、Heading 或 Disabled。
3. sizing、layer 等强场景属性必须由 `--context` 指向 `control`、`icon`、`modal` 等用途，否则不自动替换。
4. Atomic/Seed 只用于解释引用链，不进入自动替换。

如果同一优先级有多个精确候选，结果是 `ambiguous`。工具不得根据数组顺序选择第一个。

## 相近推荐

- 颜色使用 OKLab 感知距离排序，默认阈值为 `0.08`。
- dimension、duration 和 number 仅在单位可比较且相对差异不超过 `25%` 时推荐。
- shadow、easing 和复合值不做近似猜测。
- 相近候选始终是 `similar`，不会进入 `apply`。

阈值是候选召回边界，不是语义正确性的证明。调整阈值必须通过代表性样本评估，不能为了提高替换数量而放宽。

## 所有权边界

- FDS Global Catalog 只证明 Global/Scene Token 存在，不证明某个组件内部允许直接使用。
- Scene Token 必须由调用方显式提供场景上下文。
- Component Token 不在当前 Catalog 中；工具不得构造 `--fds-c-*` 或虚构组件 Token。
- 无等价语义时保留原值，并报告 `missing-token`；不能用 Atomic 颜色冒充 Semantic Token。

## 语法证据边界

CSS、SCSS、Sass、Less、Vue、HTML、JS、JSX、TS、TSX 和白名单 CSS-in-JS 分别由专用 AST 适配器定位。适配器只能提交完整样式值及其原文件 offset，不参与 Token 选择。

普通字符串和普通数据对象不扫描。动态表达式、spread、跨变量引用、数值 style 和模板插值标记为 `unsupported`，不因文件扩展名已支持而自动改写。详见 [语法支持范围](syntax-support.md)。
