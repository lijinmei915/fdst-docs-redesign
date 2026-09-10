# FDS Token YAML 同步实施计划

**目标：** 以当前 485 个 Token 的 YAML 为唯一事实源，同步 Token 契约、文档、Skills 和全部生成物。

**架构：** 不修改用户已经调整的 YAML。`tools/build.py` 从 YAML import 图生成 CSS，`tools/export_catalog.py` 从同一 Token 模型生成 catalog、Token 目录和查询 Skill 索引；人工文档只描述当前仍存在的 Token。

**代码目录：** `tokens/`、`tools/`

**测试目录：** `tests/`

---

## 任务 1：锁定最新 YAML 契约

**文件：**
- 修改：`tests/test_build.py`

1. 保留当前生成物与 YAML 不一致的 RED 基线：源码为 485 个 Token，旧生成物仍包含 502 个 Token。
2. 将数量断言更新为 485，并锁定 36 个叶子源文件、13 个 Scene Token。
3. 增加 `heading-*`、`text-*` 存在，以及 17 个已删除 Token、20 个旧 Typography 名称不存在的断言。

## 任务 2：同步人工维护文档

**文件：**
- 修改：`docs/foundations/排版.md`
- 修改：`docs/concepts/命名规则.md`
- 修改：`docs/reference/迁移与常见问题.md`
- 修改：`skills/fds-apply/SKILL.md`
- 修改：`skills/fds-apply/references/*.md`

1. 删除 Font Family、Code 字体族和已删除 recipe 的描述。
2. 将 `typography-*` 示例更新为 `heading-*` / `text-*`。
3. 记录本次删除和重命名；无替代项不得臆测映射。
4. 保证文档只引用当前 YAML 中存在的公开变量。

## 任务 3：重新生成全部产物

**文件：**
- 生成：`dist/fds-global-tokens.css`
- 生成：`dist/fds-token-catalog.json`
- 生成：`docs/reference/Token目录.md`
- 生成：`skills/fds-apply/references/fds-token-search.jsonl`
- 生成：`skills/fds-migrate/references/fds-token-catalog.jsonl`
- 生成：`public/`

1. 运行 `python tools/generate_color_palettes.py --check`，确认 Palette 与 Seed/算法一致。
2. 运行 `python tools/build.py` 重新生成 CSS。
3. 运行 `python tools/export_catalog.py` 重新生成 catalog、Token 目录和 Skill 索引。
4. 运行 `python tools/build_docs.py` 重新生成可视化文档站。

## 任务 4：完整验证

1. 运行 `python tools/build.py --check`。
2. 运行 `python tools/export_catalog.py --check-docs`。
3. 运行 `python tools/build_docs.py --check`。
4. 运行 `python -m unittest discover -s tests -p "test_*.py"`。
5. 运行 `D:\Program Files\Git\bin\bash.exe tests/skill-contract/test-fds-apply.sh`。
6. 在 `skills/fds-migrate` 运行 `npm test`。
7. 运行 `git diff --check` 并复核 Token 数量、移除/重命名集合及工作树范围。
