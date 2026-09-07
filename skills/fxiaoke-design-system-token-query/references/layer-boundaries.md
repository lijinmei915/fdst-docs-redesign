# FDS Token 层级与边界

## 层级模型

```text
Atomic / Seed -> Atomic / Map -> Semantic / Base -> Semantic / Scene
```

- `Atomic/Seed`：参与派生的最小输入。当前仅保留颜色 Seed，只用于解释值的派生起点。
- `Atomic/Map`：具体值域和固定枚举。用户明确查询色阶、尺寸档位或原子值时可返回。
- `Semantic/Base`：跨页面、跨业务成立的基础用途，是业务 CSS 的默认推荐层。
- `Semantic/Scene`：页面画布、内容区、场景卡片和卡片标题等公共组合协议。

同级引用允许；引用方向不能反向，也不能形成循环。查询脚本返回的 `referenceChain` 是该关系的机器可读证据。

## 推荐规则

1. 普通业务用途先找 `Semantic/Base`。
2. 页面画布、场景卡片和卡片标题等公共组合找 `Semantic/Scene`。
3. 没有合适语义入口，或用户明确询问具体值域时，才返回 `Atomic/Map`。
4. `Atomic/Seed` 只说明颜色派生起点，不作为业务 CSS API 推荐。
5. 查不到时说明缺口，不从相邻层级拼出一个新 Token。

## 不属于 FDS Global Token

- Button、Input、Card、Tab 等组件的内部结构、尺寸和交互状态 Token；
- Workbench、Dashboard、Detail 等具体业务私有命名；
- 暗色主题、响应式断点和栅格协议；
- 单个页面、单张卡片或单种图表的局部样式。

`scene-card-*` 描述页面场景中多张内容卡片共享的规则，不是 Card 组件 Token。组件 Token 由 FxUI、AvaUI 或对应组件包维护，并可引用 FDS Global Token。

## 禁止推断

- 不按 `--fds-g-` 命名模式猜测变量。
- 不把浏览器中可写的任意 CSS Variable 视为 FDS Token。
- 不把 Atomic 色阶包装成不存在的 Semantic Token。
- 不把组件或业务私有变量当作 FDS Global Token 返回。
