---
name: fxiaoke-design-system-token-query
description: 查询并推荐 Fxiaoke Design System Tokens（FDS）。当用户询问 FDS Token、--fds-g-*、--fds-s-*、页面背景、文字颜色、间距、圆角、阴影、层级或动效应使用哪个变量，并需要 CSS 示例、层级或引用链时使用；新增、修改、发布 Token 或设计组件 Token 时不使用。
---

# Fxiaoke Design System Tokens 查询

## Goal / 目标

从随 Skill 打包的搜索 reference 中确定性查询 FDS Global Token，优先推荐业务可消费的 Semantic Token，并返回可复制的 CSS 用法、层级和引用链。

本 Skill 只读，不创建、修改或发布 Token，也不修改业务代码、文档或远端数据。

## When to Use / 使用场景

以下请求使用本 Skill：

- 查询 Token 名称或 `--fds-g-*`、`--fds-s-*` CSS Variable 的定义、层级、值或引用链。
- 按用途查找页面背景、文本色、状态色、间距、尺寸、圆角、阴影、层级或动效 Token。
- 为页面或应用推荐 FDS Global Token 并给出 CSS 示例。
- 确认某个 Token 是否属于 FDS Global Token。

以下请求不使用本 Skill：

- 新增、修改、删除、构建或发布 FDS Token。
- 设计 Button、Input、Card 等组件 Token 或组件内部状态协议。
- 生成完整页面、审计全部样式或维护 Markdown Token 文档。

## What I Need From You / 输入要求

用户至少提供以下一种信息：

- Token 名或 `--fds-g-*`、`--fds-s-*` CSS Variable；
- CSS 属性、界面用途或使用场景；
- 需要筛选的层级、类别或类型。

能从上下文确定 CSS 属性时不要重复追问；如果同一用途存在多个合理候选，只询问会改变推荐结果的场景差异。

## ToolsList / 工具列表

所有查询都在本 Skill 目录运行 `scripts/query_tokens.sh`：

```bash
bash scripts/query_tokens.sh --name "<Token 名或 --fds-g-* / --fds-s-* 变量>"
bash scripts/query_tokens.sh --search "<用途关键词>" --limit 5
bash scripts/query_tokens.sh --search "<用途关键词>" --category "<category>" --tier "<tier>" --limit 5
```

- `--name`：精确查询；同时接受裸 Token 名和完整 CSS Variable。
- `--search`：查询名称、类别、类型、注释和内置用途词映射。
- `--layer`、`--tier`、`--category`、`--type`：按索引字段过滤。
- 输出：每行一个完整 JSON 对象，顺序已按 Semantic/Base、Semantic/Scene、Atomic/Map、Atomic/Seed 排好。

脚本只使用 Bash 内建语法逐行读取索引，不调用 Python、Node.js、`grep`、`rg`、`sed`、`awk` 或 `jq`。脚本退出码：`0` 表示查询成功，包括零结果；`1` 表示索引不可读；`2` 表示参数非法。失败时不得改为猜测 Token。

## Workflow / 工作流

1. 识别用户是在精确查名称，还是按属性或用途求推荐。
2. 精确名称使用 `--name ...`；用途查询使用 `--search ... --limit 5`。需要收窄时添加索引已有的过滤字段；用户同时询问字号、行高、字重等多个独立 CSS 属性时分别查询，再合并回答。
3. 检查脚本结果：每个候选必须含 `name`、`cssVariable`、`layer`、`tier`、`category`、`type`、`resolvedValue` 和 `referenceChain`。
4. 按以下优先级选择少量候选：精确命中 > Semantic/Base > Semantic/Scene > Atomic/Map > Atomic/Seed。
5. 业务用途优先推荐 Semantic/Base；页面画布、内容区、场景卡片或卡片标题等公共组合可推荐 Semantic/Scene。Atomic/Map 只在没有合适语义入口或用户明确查询原子值时返回；Atomic/Seed 只解释值的引用链，不作为业务 CSS 首选。
6. 根据用户提到的 CSS 属性生成用法，变量必须逐字取自查询结果。CSS 规则见 `references/css-usage.md`。
7. 返回固定格式的结论。多个候选接近时说明用途差异，不倾倒完整索引。
8. 零结果时明确回答“未找到”，并按 `references/layer-boundaries.md` 说明它可能属于组件或业务私有范围；不得按命名规律补全变量。

## Resources / 资源

### Scripts / 脚本

- `scripts/query_tokens.sh`
  - 使用时机：每次精确查询、用途推荐或层级筛选时。
  - 输入：上述完整命令参数。
  - 输出：零行或多行 JSONL；每一行都包含 CSS 示例、层级和引用链。
  - 依赖：仅使用蜂巢平台预置 Bash 的内建能力，不调用其他可执行程序或语言运行时。
  - 失败处理：报告 stderr 中的具体错误并停止，不直接扫描或修改资产补救。

### References / 参考资料

- `references/fds-token-search.jsonl`
  - 使用时机：仅由查询脚本逐行读取，不直接加载全文。
  - 内容：每行一个完整 Token 记录，附带 CSS 示例和检索词，并按业务推荐优先级预排序。
  - 更新：查询脚本每次运行都读取当前文件，不缓存；reference 被替换后无需修改脚本。
  - 失败处理：文件缺失或不可读时停止查询；不得转用 Markdown、HTML 或 CSS 反向构造结果。
- `references/layer-boundaries.md`
  - 使用时机：需要在 Semantic、Atomic、组件 Token 和业务私有值之间判断边界时。
- `references/css-usage.md`
  - 使用时机：需要把命中的变量写成 CSS，或区分背景、文本、边框、尺寸、层级、阴影和动效属性时。

## Output / 输出

单个推荐按以下结构回答：

```text
推荐：<查询结果中的 cssVariable>
用法：<CSS 属性>: var(<查询结果中的 cssVariable>);
层级：<Layer> / <Tier> / <Category>
适用：<结合用户场景和 Token 注释的简短说明>
引用：<referenceChain，用 -> 连接>
```

零结果按以下结构回答：

```text
未找到：<用户查询的名称或用途>
边界：查询索引中没有该 FDS Global Token；若它描述组件内部结构或状态，应查询对应组件 Token。
处理：不生成近似名称，不用 Atomic 值冒充不存在的 Semantic Token。
```
