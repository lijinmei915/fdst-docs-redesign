# FDS Global Token 源文件项目

本目录是 FDS Global CSS Token 的工程化维护入口。`tokens/fds-global.yml` 的 import 图是唯一 Token 事实源；CSS、catalog 和 Token 目录均由它生成。业务和组件只消费构建产物，不直接读取或修改 YAML。

Token 的详细设计说明与工程文档统一在本仓库维护。SDS 继续维护宏观 FDS、Components 和其他非 Token 设计规范，并通过链接引用本仓库文档，不再维护第二份 Token 名称、取值或色板。

## 开始使用

- [FDS Global Token 文档首页](docs/README.md)
- [FDS Token 可视化文档站](public/index.html)
- [面向设计读者的 Foundation 入口](docs/foundations/README.md)
- [快速开始](docs/getting-started/快速开始.md)
- [ShareDev 接入](docs/getting-started/ShareDev接入.md)
- [分层模型](docs/concepts/分层模型.md)
- [Token 目录](docs/reference/Token目录.md)，自动生成，请勿手工编辑
- [工程维护](docs/engineering/YAML源文件.md)
- [文档维护](docs/engineering/文档维护.md)

历史计划和已迁移的旧版资料统一保存在 [internal](internal/README.md)，不进入正式文档导航。

## 层级边界

```text
Atomic/Seed -> Atomic/Map -> Semantic/Base -> Semantic/Scene
```

Component Token 由组件包自行维护，不进入 FDS Global Token。当前维护 Base Palette 和 10 个固定公司色系的 Dark Map，但尚未提供暗色 Semantic 或主题切换；栅格、响应式断点和业务私有场景不在本包范围内。

CSS Variable 使用两套公开前缀：Atomic/Map 与 Semantic/Base 使用 `--fds-g-*`，Semantic/Scene 使用 `--fds-s-*`。Scene Token ID 不再重复包含 `scene` 名称段。

有彩色 Base Palette 与固定 Dark Palette 统一使用 `0-11` 索引，例如 `--fds-g-color-brand-8`、`--fds-g-color-yellow-dark-9`；Gray 独立使用 `1-20`，Special 使用 `1-4`。有彩色第 `11` 阶和 Gray 第 `20` 阶是扩展档；旧名称不保留兼容别名。

## 生成产物

| 产物 | 路径 | 用途 |
| --- | --- | --- |
| CSS Variables | `release/fds-global-tokens.css` | 浏览器运行时消费 |
| Minified CSS Variables | `release/fds-global-tokens.min.css` | 生产环境按需直接引入 |
| Hash CSS Variables | `release/fds-global-tokens.<hash>.css` | 按内容版本引入普通版 CSS |
| Hash Minified CSS Variables | `release/fds-global-tokens.min.<hash>.css` | 按内容版本引入生产版 CSS |
| 资源入口清单 | `release/tpl_config` | `fdstCssEntry` 映射到当次 min hash CSS 文件名 |
| Catalog JSON | `release/fds-token-catalog.json` | 确定性查询和文档生成 |
| FDS Apply 索引 | `skills/fds-apply/references/fds-token-search.jsonl` | `fds-apply` 查询和推荐使用的单行索引，由 catalog 自动刷新 |
| FDS Migrate 快照 | `skills/fds-migrate/references/fds-token-catalog.jsonl` | `fds-migrate` 自带的完整 Token 数据，由 catalog 自动刷新 |
| FDS Migrate | `skills/fds-migrate` | 独立扫描并迁移 CSS/WXSS、Vue/HTML/WXML、JS/TS 与受控 CSS-in-JS，输出审计报告 |
| Token 目录 | `docs/reference/Token目录.md` | 开发者可读的完整索引 |
| 可视化文档站 | `public/` | 由 `docs/` 同源生成，提供导航、搜索和正文内嵌 Demo |

## 常用命令

需要 Python 3.10+、PyYAML 和 Python-Markdown：

```powershell
python -m pip install -r requirements.txt
python tools/build.py --check
python -m unittest discover -s tests -p "test_*.py"
python tools/build.py
python tools/export_catalog.py --output release/fds-token-catalog.json
python tools/export_catalog.py
python tools/export_catalog.py --check-docs
python tools/build_docs.py
python tools/build_docs.py --check
```

`python tools/build.py` 会同时生成普通版和 min 版 CSS，两者变量与运行时行为一致，不得手工维护。`python tools/export_catalog.py` 会同时更新 `release` catalog、`fds-apply` 查询 JSONL、`fds-migrate` 完整 Token JSONL 和 Token 目录。`python tools/build_docs.py` 将 Markdown、站点资产和当前 CSS 生成到 `public/`，该目录同样不得手工编辑。Token 更新后重新执行三个生成命令即可刷新全部产物。两个 Skill 均不在运行时读取 FDST 仓库中的 YAML 或 `release`。Python、PyYAML 和 Python-Markdown 只用于 FDS 源码维护端；`fds-apply` 使用蜂巢平台预置 Bash 的内建能力，不依赖 Python、Node.js、`grep`、`rg`、`sed`、`awk` 或 `jq`。`fds-migrate` 因需要多语法 AST，独立要求 Node.js 16+，依赖锁定在其自身目录。

构建还会为普通版和 min 版各追加一份带 hash 的 CSS，内容与对应固定名文件逐字节一致。`<hash>` 为各自文件内容的 SHA-256 前 12 位；相同内容重复构建名称不变，内容变化时生成新名称。构建不删除历史 hash 文件，发布侧按引用情况管理保留周期；`--check` 不写入任何产物。

输出目录统一为 `release/`。`build.py` 同时写入 `release/tpl_config`，沿用 `fx-paas-components` 的纯文本 `入口名:文件名` 格式：`fdstCssEntry:fds-global-tokens.min.<hash>.css`，行末保留换行。入口始终指向当次生成的压缩版 CSS，文件名不含目录。原先使用 `dist/` 的消费方需同步更新路径。

完整维护流程和错误排查见 [构建与校验](docs/engineering/构建与校验.md)；版本、发布与回退边界见 [版本与发布](docs/engineering/版本与发布.md)。

## 设计依据

当前 YAML schema 借鉴 DTCG 的显式类型和引用思想，但不是 DTCG 标准交换文件。源结构参考 SLDS 固定提交中的 `global + imports + props` 组织方式，不把外部平台作为运行时依赖。

- [DTCG Design Tokens Format 2025.10](https://www.designtokens.org/TR/2025.10/format/)
- [SLDS primitive/base.yml](https://github.com/salesforce-ux/design-system/blob/9bc6a4046d10d95b4f3fb9cee7c7dc036bf43ad2/design-tokens/primitive/base.yml)
- [SLDS Token 构建脚本](https://github.com/salesforce-ux/design-system/blob/9bc6a4046d10d95b4f3fb9cee7c7dc036bf43ad2/scripts/gulp/generate/tokens.js)

颜色基础来源固定于 [sharecrm-design-system 提交 38667a8f](https://git.firstshare.cn/bigfe/sharecrm-design-system/-/commit/38667a8f693ef0682560c18f782156d5a644c42d)。FDS 保持现有 Token 命名，并将设计确认的 Base 与 Dark Map 保存为具体 Hex。`tools/generate_color_palettes.py --check` 仅用于人工复核设计公式，不参与正式构建，也不覆盖 Palette YAML。
