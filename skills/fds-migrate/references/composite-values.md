# 复合样式支持矩阵

使用 value AST 定位受管值，复用现有匹配器，不改变 Catalog、旧色板索引和各类迁移政策。

| 声明 | 自动处理 | 保留或人工检查边界 |
| --- | --- | --- |
| background | 单一颜色、可确认的颜色变量链 | 单独 URL 和结构值保留；渐变、多层、混合背景和未知变量为 unsupported |
| border、物理/逻辑方向边框、outline、column-rule | 确定颜色节点 | 动态宽度、多义值为 unsupported |
| border-color / border-width | 1–4 值、逻辑双方向 1–2 值 | 超出数量或类型不明时人工检查 |
| border-radius | 1–4 值及斜杠两组值，物理/逻辑角 1–2 值 | 复用最近档；0 和百分比保留；calc 等不可比较值为 unsupported |
| transition/animation-duration、timing-function | 逗号分隔的值列表 | 无 Token 的值保留 missing-token/similar，不补造 Token |
| transition | 每组第一个时间 duration 和独立 easing | 属性名和第二个时间 delay 保留；角色不明的变量为 unsupported |
| font | 静态 weight、size 和 /line-height | 不改字体族；固定行高保留；系统字体保留；动态或复杂语法为 unsupported |
| text-decoration-color、text-emphasis-color | 独立颜色属性按前景色匹配 | 对应简写须人工检查 |
| box-shadow | 整体精确匹配 | 非标准硬编码按既定规则保留，不拆颜色强行替换 |
| animation、background-image、text-shadow、文字装饰简写、filter、backdrop-filter、border-image、mask、mask-image | 本轮不自动拆解 | 非结构值标 unsupported，避免静默漏检；none 等结构值保留 |
| margin、padding、gap | 单值、物理 1–4 值、逻辑方向及 gap 1–2 值逐项精确匹配 | 未命中值、0、auto、百分比保留；动态表达式及非法数量为 unsupported |
| 固定行高、非标准层级和阴影 | 沿用已确认的保留政策 | 不因复合值支持而扩大迁移 |

## 报告与写入

- 多值声明按受管子值生成独立 finding，每项分别保留候选、nearest 选择与 fallback。
- `property` 保留原声明属性；`matchedProperty` 记录匹配属性；`declarationId` 为不含源路径的不透明分组标识。
- `occurrenceCount` 是值项数，`declarationCount` 是去重声明数；数量增长不一定代表新增声明。
- 行列、原值和替换范围指向子值。apply 校验源码区间并倒序写入，保留其余空白、注释、分隔符和 important。
- 颜色仍按旧色板索引迁移。transparent、currentColor 和全局关键字保留语义，不换成色板色。
- 已迁移目录需重新扫描；静态结果不证明真实运行入口可达或页面验收通过。
