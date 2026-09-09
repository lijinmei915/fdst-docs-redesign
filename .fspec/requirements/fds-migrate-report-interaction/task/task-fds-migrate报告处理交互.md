# fds-migrate 报告处理交互实现计划

> **执行约束：** 在当前 `fdst` 工作树中做最小修改，保留已有未提交内容，不自动格式化；后续经用户明确授权后提交并推送。

**目标：** 让用户在迁移报告列表中选择具体候选 Token 或填写无候选处理说明，并统一生成所有人工决策的处理提示词。

**架构：** 保持 JSON 报告为只读事实源，在自包含 HTML 中增加浏览器端决策状态。服务端只负责从 finding 生成候选控件和安全嵌入数据；浏览器端负责状态恢复、汇总提示词生成和复制。

**技术栈：** Node.js ESM、自包含 HTML/CSS/JavaScript、Node test runner。

**代码目录：** `skills/fds-migrate/scripts/lib/`

**测试目录：** `skills/fds-migrate/test/`

---

## 任务 1：定义报告交互契约

**文件：**

- 修改：`skills/fds-migrate/references/report-schema.md`
- 修改：`skills/fds-migrate/SKILL.md`

**步骤：**

1. 明确候选选择、无候选说明、纳入汇总、本地状态和 JSON 事实边界。
2. 明确汇总提示词必须保留的定位信息与迁移安全约束。

## 任务 2：先补报告结构测试

**文件：**

- 修改：`skills/fds-migrate/test/stylesheet.test.mjs`

**步骤：**

1. 断言有候选 finding 输出候选选择控件且选项逐字来自报告候选。
2. 断言无候选 finding 输出处理说明控件。
3. 断言统一汇总入口、汇总抽屉和稳定的本地状态键存在。
4. 运行 `node --test test/stylesheet.test.mjs`，确认新增断言先失败。

## 任务 3：实现报告处理交互

**文件：**

- 修改：`skills/fds-migrate/scripts/lib/report.mjs`

**步骤：**

1. 在 finding 行中渲染候选下拉框或无候选处理说明输入框。
2. 增加顶部汇总按钮、已处理计数和汇总提示词抽屉。
3. 增加决策状态读取、校验、保存、清空与候选合法性保护。
4. 根据已处理项生成统一提示词，并复用剪贴板失败降级逻辑。
5. 完善桌面、窄屏、键盘和打印样式。

## 任务 4：验证与记录

**文件：**

- 修改：`task/2026-09-08-FDS-Token迁移Skill.md`
- 修改：`CONTEXT.md`

**步骤：**

1. 运行 `node --test test/stylesheet.test.mjs`。
2. 运行 `npm test`。
3. 运行 `quick_validate.py skills/fds-migrate`。
4. 生成测试报告并完成桌面、窄屏交互验收。
5. 记录真实通过项、未验证项和影响范围。
