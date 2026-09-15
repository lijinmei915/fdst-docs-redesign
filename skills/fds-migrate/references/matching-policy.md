# FDS Token 迁移匹配策略

## 核心原则

迁移先判断 property，再区分颜色与非颜色。旧颜色通过内置 `fx-style` 色板定位色板和索引，再映射到当前 FDS 的对应索引；不比较新旧颜色值，也不按颜色距离猜测。非颜色仍以类型化精确值作为候选证据。

## 自动替换门槛

声明只有同时满足以下条件才进入 `auto-replace`：

1. CSS property 命中 `migration-policy.json` 中的规则。
2. 颜色必须由旧变量名直接给出色板/索引，或由硬编码色值在内置旧色板中唯一定位；目标固定为该色板规则对应的 Atomic/Map Token。
3. 非颜色值必须能够按对应 Token 类型完整解析；字号、圆角和透明度可按下述专项规则选择最近档，相对行高及其他类型要求候选 `resolvedValue` 与原值精确等价。
4. 候选名称和类型与 property 规则兼容；颜色索引目标只要求 property 属于颜色规则且 Catalog 中存在目标 Token。
5. 非颜色候选按各 property 的层级顺序选择；Scene 只有通过 `--context` 显式提供场景后才参与自动决策。
6. 原始值可以原样嵌入 `var(--token, 原值)`，不需要格式化源文件。

## 非颜色专项规则

- Font Size：小于 `12px` 与超过 `48px` 的值保留硬编码并归为 `exempt`；`12px–48px` 的同单位值按绝对距离选择最近档，等距时选择较小值。
- Line Height：固定硬编码行高直接归为 `exempt`，不换算、不替换；已使用的固定 `line-height-*` Token 继续按 Catalog 校验。无单位相对行高只精确匹配 `line-height-ratio-*` 或显式 Scene Line Height；非精确值可报告相近候选，但不得自动替换。
- Spacing：margin、padding、gap 及方向属性逐值精确匹配；唯一且属性、层级兼容的候选自动替换，保留原值 fallback。未精确命中的硬编码为 `exempt`，不推荐相近档；多义候选和动态表达式保持人工检查边界。
- Border Radius：包含 `20px` 档，精确值可自动替换；其他同单位 px 值按绝对距离选择最近档，等距时选择较小值。自动替换要求绝对偏差 ≤ `2px`，不限制相对百分比；超过阈值保留原值，归为 `similar` 并报告候选，不生成 replacement。`5→4px`、`7→6px`、`14→12px` 可替换，`27→20px` 不替换；无法按 px 比较的近似值不自动替换。
- Opacity：源值 `0`、`1` 保留硬编码；最近档候选排除解析值为 `0`、`1` 的 Token，其他数值按绝对距离选择最近档，等距时选择较小值。
- Layer / Shadow：精确命中按现有上下文边界处理；无精确候选时归为 `exempt` 并保留硬编码，不补充梯度。
- Motion Duration：Atomic Map 已包含 `500/600/800/1000ms`，精确值按既有自动迁移规则处理，非精确值不提升为最近档自动替换。

最近档自动替换必须在 finding 中记录原值和目标解析值。HTML 同时展示值变化提示、Catalog `comment` 和候选下拉；精确命中的自动替换只展示选定 Token，不提供下拉。源码只改声明值并保留 fallback，不额外插入迁移注释。

自动替换时保留原始字面量，包括大小写、单位和函数写法：

```css
color: #FFCA7A;
color: var(--fds-g-color-brand-3, #FFCA7A);
```

## CSS 变量定义与消费优先级

CSS Custom Property 的定义声明不属于迁移对象。工具会保留定义位置的原始值，只收集变量名作为当前组件报告单元的所有权证据：

```css
.button {
  --button-text-color: #FF522A;
}
```

普通 CSS property 消费变量时，优先级固定为“组件自定义变量 / `--bc-*` > FDS > 旧色板变量 > 原值”。旧色板变量覆盖 primary、warning、yellow、yellow-green、success、teal、blue、info、purple、magenta、danger 的 `00–10`，以及 `neutrals01–19`、`special01–04`；不含 RGB 和 Dark。组件自定义变量必须在当前组件报告单元内存在定义；`--bc-*` 作为既有组件/搭建协议兼容识别。颜色可从旧变量名直接取得索引，因此不要求末端存在具体色值：

```css
color: var(--button-text-color, #FF522A);
color: var(--button-text-color, var(--fds-g-color-danger, #FF522A));

border-color: var(--color-blue06, #189DFF);
border-color: var(--fds-g-color-blue-6, var(--color-blue06, #189DFF));

outline-color: var(--button-text-color, var(--color-blue06));
outline-color: var(--button-text-color, var(--fds-g-color-blue-6, var(--color-blue06)));
```

不得在变量定义声明里直接写入 FDS，也不得生成 `var(--fds-*, var(--component-*, 原值))` 或 `var(--color-<family>XX, var(--fds-*, 原值))`。如果链中已有真实、property 兼容且顺序正确的 FDS Token，结果为 `compliant`，不得重复包裹；索引色 Token 必须与链内旧色板变量的映射目标一致。非法、property 不兼容或优先级错误的 FDS Token 仍为 `invalid-token`，但工具不自动重排已有链。

非颜色链没有末端原值、末端是动态/复合表达式或具体值本身无需 Token 化时，保留原链。颜色硬编码值不在内置旧色板时归为 `missing-token`，不生成相似候选。未在当前组件报告单元内定义、且不属于 `--bc-*`、FDS 或明确旧色板变量的变量，仍视为来源未知，不自动套用优先级规则。

## 旧色板索引映射

- 11 套有彩色：旧 `00–10` 逐项映射到新 `0–10`。色系名称映射为 primary → brand、warning → amber、success → green、info → indigo、danger → red；yellow、yellow-green、teal、blue、purple、magenta 保持同名。新第 `11` 阶是扩展档。
- Gray：旧 `neutrals01–19` 逐项映射到新 `gray-1–19`，保持用户已有的 1 起始认知。新 `gray-20` 是扩展档。
- Special：旧 `special01–04` 逐项映射到新 `special-1–4`。

这三套规则分别维护，不为了统一成同一起始数字而人为错位。旧 RGB 和 Dark 不进入自动迁移。

## 候选优先级

优先级由每类 CSS property 单独定义，不能全局套用“Semantic 永远优先”：

1. 旧颜色固定选择索引映射得到的 Atomic/Map Palette Token，不再从相同新色值的 Semantic/Base 候选中选择。
2. radius、typography 等通用尺度在没有语义上下文时优先 Atomic/Map，避免把相同数值误解释为 Card、Heading 或 Disabled。
3. layer 等强场景属性必须由 `--context` 指向 `modal` 等用途，否则不自动替换。
4. Atomic/Seed 只用于解释引用链，不进入自动替换。

如果同一优先级有多个精确候选，结果是 `ambiguous`。工具不得根据数组顺序选择第一个。

## 相近推荐

- 颜色不做相似推荐；无法定位旧色板索引时直接报告 `missing-token`。
- 未启用最近档自动替换的 dimension、duration 和 number，仅在单位可比较且相对差异不超过 `25%` 时推荐。
- shadow、easing 和复合值不做近似猜测。
- 相近候选始终是 `similar`，不会进入 `apply`。

阈值是候选召回边界，不是语义正确性的证明。调整阈值必须通过代表性样本评估，不能为了提高替换数量而放宽。

## 所有权边界

- FDS Global Catalog 只证明 Global/Scene Token 存在，不证明某个组件内部允许直接使用。
- Scene Token 必须由调用方显式提供场景上下文。
- Component Token 不在当前 Catalog 中；工具不得构造 `--fds-c-*` 或虚构组件 Token。
- 无等价语义时保留原值，并报告 `missing-token`；不能用 Atomic 颜色冒充 Semantic Token。

## 语法证据边界

CSS、SCSS、Sass、Less、WXSS、Vue、HTML、WXML、JS、JSX、TS、TSX 和白名单 CSS-in-JS 分别由专用 AST 适配器定位。适配器只能提交完整样式值及其原文件 offset，不参与 Token 选择。

普通字符串和普通数据对象不扫描。动态表达式、spread、跨变量引用、数值 style 和模板插值标记为 `unsupported`，不因文件扩展名已支持而自动改写。详见 [语法支持范围](syntax-support.md)。
