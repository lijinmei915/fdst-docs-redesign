# FDST 可视化文档站

## 目标

将 `docs/` 从 Markdown 文件集合升级为面向设计读者的可展示文档站，同时继续保持 YAML import 图为唯一 Token 事实源。

## 架构

```text
docs/**/*.md                     内容源
docs/site-assets/*               文档站壳层与可复用 Demo
dist/fds-global-tokens.css       Demo 运行时视觉值
tools/build_docs.py              静态站生成与一致性校验
public/                          可直接部署的生成产物
```

- Markdown 负责规范正文，不维护第二份 Token 值表。
- Foundation 页面通过 `data-demo` 容器在正文位置加载可交互示例。
- Demo 只保存需要展示的 Token 名称，实际值从 CSS Variable 读取。
- `public/` 包含导航、面包屑、页内目录、全文搜索和内嵌 Demo，可独立部署。
- SDS 只需要链接 FDST 文档站，不读取 catalog 重建 Token 页面。

## 页面体验

- 桌面端使用顶部栏、分组侧栏、正文和页内目录。
- 移动端折叠侧栏，正文与示例保持单列，不产生横向溢出。
- 颜色页支持 Base / Dark Map 切换并展示完整色阶。
- 排版、间距、圆角、阴影、层级和动效均在对应规范正文中原位展示。
- 示例工作台复用同一组 Demo，不单独维护视觉实现。

## 验证

1. `python tools/build_docs.py` 生成站点。
2. `python tools/build_docs.py --check` 校验生成物无漂移。
3. `python tools/export_catalog.py --check-docs` 校验文档链接和 Token 变量。
4. `python -m unittest discover -s tests -p "test_*.py"` 执行回归测试。
5. 使用浏览器在桌面和移动视口检查首页、颜色页和工作台。
