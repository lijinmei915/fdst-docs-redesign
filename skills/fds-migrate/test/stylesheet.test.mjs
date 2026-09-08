import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { fixture, readReport, runBundledTool, runProjectTool, runTool } from "./helpers.mjs";

test("CSS 扫描保持首版匹配行为并输出三类报告", async () => {
  const original = ".sample {\n  color: #FF522A;\n  background-color: #FFFFFF;\n  border-color: #FF542C;\n  padding: 16px;\n  width: 100%;\n  display: flex;\n  outline-color: var(--fds-g-missing, #000);\n}\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(context.paths["component.css"], "utf8"), original);
  const report = await readReport(context.reportDir);
  const statuses = Object.fromEntries(report.findings.map((item) => [item.property, item.status]));
  assert.deepEqual(statuses, {
    color: "auto-replace",
    "background-color": "ambiguous",
    "border-color": "similar",
    padding: "auto-replace",
    width: "exempt",
    display: "exempt",
    "outline-color": "invalid-token",
  });
  const markdown = await readFile(`${context.reportDir}/fds-token-migration-report.md`, "utf8");
  assert.match(markdown, /## 已替换内容/);
  assert.match(markdown, /## 不符合规范/);
  assert.match(markdown, /## 相近 Token 推荐/);
});

test("CSS apply 仅替换唯一精确候选并保留原值及 CRLF", async () => {
  const original = ".sample {\r\n  color: #FF522A;\r\n  background-color: #FFFFFF;\r\n  padding: 16px;\r\n}\r\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  assert.match(migrated, /color: var\(--fds-g-color-danger, #FF522A\);/);
  assert.match(migrated, /padding: var\(--fds-g-spacing-4, 16px\);/);
  assert.match(migrated, /background-color: #FFFFFF;/);
  assert.ok(migrated.includes("\r\n"));
});

for (const [extension, source] of [
  ["pcss", ".card { padding: 16px; }\n"],
  ["scss", "$space: 16px;\n.card { padding: 16px; }\n"],
  ["less", "@space: 16px;\n.card { padding: 16px; }\n"],
  ["sass", "$space: 16px\n.card\n  padding: 16px\n"],
]) {
  test(`${extension} 能按语法 AST 定位并局部替换`, async () => {
    const context = await fixture({ [`component.${extension}`]: source });
    const result = runTool("apply", context.paths[`component.${extension}`], context.catalog, context.reportDir);
    assert.equal(result.status, 0, result.stderr);
    const migrated = await readFile(context.paths[`component.${extension}`], "utf8");
    assert.match(migrated, /padding:\s*var\(--fds-g-spacing-4, 16px\)/);
    if (extension !== "pcss") assert.match(migrated, /\$space: 16px|@space: 16px/);
  });
}

test("任一解析错误会阻止整批 apply 并仍输出报告", async () => {
  const context = await fixture({
    "good.css": ".good { color: #FF522A; }\n",
    "broken.css": ".bad { color: #FF522A; broken }\n",
  });
  const result = runTool("apply", context.root, context.catalog, context.reportDir);
  assert.equal(result.status, 1);
  assert.equal(await readFile(context.paths["good.css"], "utf8"), ".good { color: #FF522A; }\n");
  const report = await readReport(context.reportDir);
  assert.equal(report.applyBlocked, true);
  assert.ok(report.parseErrors.length > 0);
});

test("显式 Scene context 优先于 Atomic Token", async () => {
  const context = await fixture({ "component.css": ".card { padding: 16px; }\n" });
  const result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir, "--context", "card");
  assert.equal(result.status, 0, result.stderr);
  const [finding] = (await readReport(context.reportDir)).findings;
  assert.equal(finding.selectedToken.cssVariable, "--fds-s-card-padding");
});

test("sizing 需要上下文，radius 按规则可选择 Atomic Map", async () => {
  const context = await fixture({ "component.css": ".sample { width: 16px; border-radius: 4px; }\n" });
  let result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  let report = await readReport(context.reportDir);
  assert.equal(report.findings.find((item) => item.property === "width").status, "ambiguous");
  assert.equal(report.findings.find((item) => item.property === "border-radius").selectedToken.cssVariable, "--fds-g-radius-2");

  result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir, "--context", "icon");
  assert.equal(result.status, 0, result.stderr);
  report = await readReport(context.reportDir);
  assert.equal(report.findings.find((item) => item.property === "width").selectedToken.cssVariable, "--fds-g-icon-size-1");
});

test("verify 区分合规 Token、私有变量、复合表达式和失效 FDS 变量", async () => {
  const context = await fixture({
    "component.css": `.sample {
  color: var(--fds-g-color-danger, #FF522A);
  background-color: var(--business-surface);
  width: calc(100% - var(--fds-g-spacing-4));
  height: calc(100% - var(--fds-g-does-not-exist));
}
`,
  });
  const result = runTool("verify", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 3, result.stderr);
  const report = await readReport(context.reportDir);
  assert.deepEqual(report.findings.map((item) => item.status), ["compliant", "exempt", "exempt", "invalid-token"]);
});

test("Skill 内置完整 Token 快照且默认选择当前 danger Token", async () => {
  const context = await fixture({ "component.css": ".danger { color: #FF522A; }\n" });
  const result = runBundledTool("scan", context.paths["component.css"], context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const report = await readReport(context.reportDir);
  const [finding] = report.findings;
  assert.equal(finding.selectedToken.cssVariable, "--fds-g-color-danger");
  assert.equal(report.catalog.source, "bundled");
  assert.equal(report.catalog.path, "references/fds-token-catalog.jsonl");
  assert.ok(report.catalog.tokenCount > 0);
});

test("项目默认扫描 src 并将相对路径报告写入 .fdst", async () => {
  const context = await fixture({
    "src/component.css": ".sample { color: #FF522A; }\n",
  });
  const result = runProjectTool("scan", context.root, "--catalog", context.catalog);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /JSON 报告：\.fdst\/reports\/migrate\/scan\/fds-token-migration-report\.json/);
  const reportDir = path.join(context.root, ".fdst", "reports", "migrate", "scan");
  const report = await readReport(reportDir);
  assert.deepEqual(report.targets, ["src"]);
  assert.equal(report.project.pathBase, "project-root");
  assert.equal(report.findings[0].file, "src/component.css");
  const markdown = await readFile(path.join(reportDir, "fds-token-migration-report.md"), "utf8");
  assert.match(markdown, /### `src\/component\.css`/);
  assert.match(markdown, /\| 行 \| 列 \|/);
  assert.doesNotMatch(markdown, new RegExp(context.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("项目配置支持入口、报告目录、排除项和场景上下文", async () => {
  const context = await fixture({
    "app/card.css": ".card { padding: 16px; }\n",
    "app/skip.css": ".skip { color: #FF522A; }\n",
    ".fdst/migrate.json": `${JSON.stringify({
      schema: "fds-migrate-config/v1",
      entry: "app",
      reportRoot: ".fdst/custom-reports",
      exclude: ["**/skip.css"],
      contexts: ["card"],
    }, null, 2)}\n`,
  });
  const result = runProjectTool("scan", context.root, "--catalog", context.catalog);
  assert.equal(result.status, 0, result.stderr);
  const reportDir = path.join(context.root, ".fdst", "custom-reports", "scan");
  const report = await readReport(reportDir);
  assert.equal(report.project.config, ".fdst/migrate.json");
  assert.equal(report.summary.fileCount, 1);
  assert.equal(report.findings[0].selectedToken.cssVariable, "--fds-s-card-padding");
});

test("Markdown 按文件分组并移除 CRLF 容器中的回车", async () => {
  const source = ".button {\r\n  &:hover,\r\n  &:focus { box-shadow: 0 0 12px #000; }\r\n}\r\n";
  const context = await fixture({ "src/component.less": source });
  const result = runProjectTool("scan", context.root, "--catalog", context.catalog);
  assert.equal(result.status, 0, result.stderr);
  const markdown = await readFile(path.join(context.root, ".fdst", "reports", "migrate", "scan", "fds-token-migration-report.md"), "utf8");
  assert.match(markdown, /### `src\/component\.less`/);
  assert.match(markdown, /&:hover,\s+&:focus/);
  assert.doesNotMatch(markdown, /\r/);
});
