# Salesforce SLDS Skill 官方快照

本目录保存 Salesforce 官方 Skill 的固定版本，供 FDS 方案研究、实现对照和离线阅读。上游文件保持原始字节内容；本地说明和来源清单独立保存。

## 来源

- 官方仓库：[forcedotcom/sf-skills](https://github.com/forcedotcom/sf-skills)
- 固定提交：[`91488fd1660b95a31911214187d76229f2610135`](https://github.com/forcedotcom/sf-skills/tree/91488fd1660b95a31911214187d76229f2610135)
- 下载日期：2026-09-16；使用本次调研确认的固定提交，不随上游 main 自动漂移。
- 许可证：[Apache License 2.0](LICENSE.txt)，保留上游原件。
- 文件来源、大小和 SHA-256：[source-manifest.json](source-manifest.json)。

## Skill 入口

| Skill | 用途 | 原始文件数 |
|---|---|---:|
| [design-systems-slds-apply](skills/design-systems-slds-apply/SKILL.md) | 组件构建、Blueprint、Styling Hook、Utility 和 Icon 使用 | 151 |
| [design-systems-slds-validate](skills/design-systems-slds-validate/SKILL.md) | SLDS 合规检查、评分和人工审查门禁 | 4 |
| [design-systems-slds2-migrate](skills/design-systems-slds2-migrate/SKILL.md) | SLDS 1 到 SLDS 2 迁移与 Linter 编排 | 10 |
| [experience-accessibility-validate](skills/experience-accessibility-validate/SKILL.md) | SLDS Validate 显式关联的 WCAG 无障碍审查 | 30 |

共 195 个 Skill 文件，另含 1 份上游许可证。完整保留 references、assets、scripts 和目录关系；Apply 包含 85 份 Blueprint YAML、3 个 JSON 索引和 4 个 CJS 脚本。

## 使用边界

- 这是内部参考快照，FDST 自有 Skill 的实现入口仍为仓库根目录 `skills/`。
- 迁移 Skill 调用的 `@salesforce-ux/slds-linter` 是外部运行工具，不在此源码快照中；本次未安装 npm 依赖或执行上游脚本。
- 上游 `SKILL.md` 是被保存的研究资料，其中的执行步骤不作为本仓库当前任务的授权或自动运行入口。
- 无障碍 Skill 为 SLDS Validate 直接关联的质量检查资料；通用 LWC 生成等其他 Salesforce 能力不属于本次快照范围。

## 更新方式

先选定新的官方提交，按同一范围核对上游增删和关联关系，再更新快照、来源清单及本说明。不要直接修改快照内的上游代码或文档；FDS 自身结论和实现应维护在自己的资料与 Skill 中。
