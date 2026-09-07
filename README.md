# FDS Global Token 源文件项目

本目录是 FDS Global CSS Token 的工程化维护入口。`tokens/fds-global.yml` 的 import 图是唯一 Token 事实源；CSS、catalog 和 Token 目录均由它生成。业务和组件只消费构建产物，不直接读取或修改 YAML。

## 开始使用

- [FDS Global Token 文档首页](docs/README.md)
- [快速开始](docs/getting-started/快速开始.md)
- [ShareDev 接入](docs/getting-started/ShareDev接入.md)
- [分层模型](docs/concepts/分层模型.md)
- [Token 目录](docs/reference/Token目录.md)，自动生成，请勿手工编辑
- [工程维护](docs/engineering/YAML源文件.md)

历史计划和已迁移的旧版资料统一保存在 [internal](internal/README.md)，不进入正式文档导航。

## 层级边界

```text
Atomic/Seed -> Atomic/Map -> Semantic/Base -> Semantic/Scene
```

Component Token 由组件包自行维护，不进入 FDS Global Token。当前只维护统一亮色色系，不包含暗色主题、栅格、响应式断点或业务私有场景。

## 生成产物

| 产物 | 路径 | 用途 |
| --- | --- | --- |
| CSS Variables | `dist/fds-global-tokens.css` | 浏览器运行时消费 |
| Catalog JSON | `dist/fds-token-catalog.json` | 确定性查询和文档生成 |
| 查询 Skill JSONL | `skills/fxiaoke-design-system-token-query/references/fds-token-search.jsonl` | 纯 Bash 查询使用的单行索引，由 catalog 自动刷新 |
| Token 目录 | `docs/reference/Token目录.md` | 开发者可读的完整索引 |

## 常用命令

需要 Python 3.10+ 和 PyYAML：

```powershell
python -m pip install -r requirements.txt
python tools/build.py --check
python -m unittest discover -s tests -p "test_*.py"
python tools/build.py
python tools/export_catalog.py --output dist/fds-token-catalog.json
python tools/export_catalog.py
python tools/export_catalog.py --check-docs
```

`python tools/export_catalog.py` 会同时更新 `dist` catalog、查询 Skill JSONL reference 和 Token 目录；这些文件都是生成产物，不得手工维护。Token 更新后重新执行该命令即可刷新 Skill reference，查询脚本无需修改。Python 和 PyYAML 只用于 FDS 源码维护端；交付给客户的 Skill 使用蜂巢平台预置 Bash 的内建能力查询，不依赖 Python、Node.js、`grep`、`rg`、`sed`、`awk` 或 `jq`。

完整维护流程和错误排查见 [构建与校验](docs/engineering/构建与校验.md)；版本、发布与回退边界见 [版本与发布](docs/engineering/版本与发布.md)。

## 设计依据

当前 YAML schema 借鉴 DTCG 的显式类型和引用思想，但不是 DTCG 标准交换文件。源结构参考 SLDS 固定提交中的 `global + imports + props` 组织方式，不把外部平台作为运行时依赖。

- [DTCG Design Tokens Format 2025.10](https://www.designtokens.org/TR/2025.10/format/)
- [SLDS primitive/base.yml](https://github.com/salesforce-ux/design-system/blob/9bc6a4046d10d95b4f3fb9cee7c7dc036bf43ad2/design-tokens/primitive/base.yml)
- [SLDS Token 构建脚本](https://github.com/salesforce-ux/design-system/blob/9bc6a4046d10d95b4f3fb9cee7c7dc036bf43ad2/scripts/gulp/generate/tokens.js)

颜色基础来源固定于 [sharecrm-design-system 提交 38667a8f](https://git.firstshare.cn/bigfe/sharecrm-design-system/-/commit/38667a8f693ef0682560c18f782156d5a644c42d)。FDS 保持现有 Token 命名，按设计侧 Seed 和 `seed-anchored-oklch-v1` 公式在构建期固化具体色值。
