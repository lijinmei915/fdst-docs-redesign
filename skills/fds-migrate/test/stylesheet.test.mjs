import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { renderHtml } from "../scripts/lib/report.mjs";
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
  const html = await readFile(path.join(context.reportDir, "components", "component", "fds-token-migration-report.html"), "utf8");
  assert.match(html, /<h2>已替换内容<\/h2>/);
  assert.match(html, /<h2>不符合规范<\/h2>/);
  assert.doesNotMatch(html, /<h2>相近 Token 推荐<\/h2>/);
  assert.match(html, /data-status-filter="similar"/);
  assert.match(html, /data-status="similar"/);
  assert.equal((html.match(/class="status status-similar"/g) || []).length, 2);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /data-prompt-drawer/);
  assert.match(html, /data-prompt-trigger=/);
  const promptData = JSON.parse(html.match(/<script id="finding-prompt-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(promptData.length, 5);
  assert.match(promptData.find((item) => item.status === "auto-replace").prompt, /var\(--fds-g-color-danger, #FF522A\)/);
  assert.match(promptData.find((item) => item.status === "ambiguous").prompt, /无法消除歧义时保持源码不变/);
  assert.match(promptData.find((item) => item.status === "similar").prompt, /不得仅凭数值或颜色距离接近直接替换/);
  assert.match(promptData.find((item) => item.status === "invalid-token").prompt, /真实、属性兼容且语义一致的 Token/);
  assert.match(promptData[0].prompt, /只处理这一项及其必要上下文/);
  const executableScript = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .find((match) => !match[0].includes('type="application/json"'))[1];
  assert.doesNotThrow(() => new Function(executableScript));
});

test("HTML 内嵌提示词数据会转义 script 结束标签", () => {
  const unsafeValue = "</script><script>alert(1)</script>";
  const finding = {
    id: "safe-id",
    file: "src/example.css",
    line: 1,
    column: 10,
    syntax: "css",
    container: ".example",
    selector: ".example",
    property: "color",
    originalValue: unsafeValue,
    writable: false,
    status: "missing-token",
    rule: "color",
    reason: "没有可靠候选",
    candidates: [],
  };
  const html = renderHtml({
    mode: "scan",
    generatedAt: "2026-09-08T00:00:00.000Z",
    catalog: { schema: "fds-token-catalog/v1", sha256: "1234567890abcdef" },
    targets: ["src"],
    applyBlocked: false,
    summary: { fileCount: 1, occurrenceCount: 1, unsupportedNodeCount: 0, parseErrorCount: 0, statusCounts: { "missing-token": 1 } },
    findings: [finding],
    parseErrors: [],
    unsupportedFiles: [],
  });
  assert.doesNotMatch(html, /<\/script><script>alert/);
  assert.match(html, /\\u003c\/script\\u003e\\u003cscript\\u003ealert/);
  const promptData = JSON.parse(html.match(/<script id="finding-prompt-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(promptData[0].originalValue, unsafeValue);
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

test("CSS 变量定义保持原样，消费链按组件变量、FDS、老品牌色和原值排序", async () => {
  const original = `:root {
  --component-color: #FF522A;
  --color-blue06: #189DFF;
}
.sample {
  color: var(--component-color, #FF522A);
  padding: var(--bc-c-padding, var(--bc-g-padding, 16px));
  border-color: var(--color-blue06, #FF522A);
  outline-color: var(--component-color, var(--color-blue06, #FF522A));
  background-color: var(--bc-c-background);
}
`;
  const context = await fixture({ "component.css": original });

  let result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  let report = await readReport(context.reportDir);
  const find = (selector, property) => report.findings.find((finding) => finding.selector === selector && finding.property === property);
  assert.equal(find(":root", "--component-color").status, "exempt");
  assert.equal(find(":root", "--color-blue06").status, "exempt");
  assert.match(find(":root", "--component-color").reason, /定义不属于声明值迁移范围/);
  assert.equal(find(".sample", "color").replacement, "var(--component-color, var(--fds-g-color-danger, #FF522A))");
  assert.deepEqual(find(".sample", "color").componentVariables, ["--component-color"]);
  assert.equal(find(".sample", "padding").replacement, "var(--bc-c-padding, var(--bc-g-padding, var(--fds-g-spacing-4, 16px)))");
  assert.deepEqual(find(".sample", "padding").componentVariables, ["--bc-c-padding", "--bc-g-padding"]);
  assert.equal(find(".sample", "border-color").replacement, "var(--fds-g-border-error, var(--color-blue06, #FF522A))");
  assert.deepEqual(find(".sample", "border-color").legacyBrandVariables, ["--color-blue06"]);
  assert.equal(find(".sample", "outline-color").replacement, "var(--component-color, var(--fds-g-border-error, var(--color-blue06, #FF522A)))");
  assert.equal(find(".sample", "background-color").status, "exempt");
  assert.equal(find(".sample", "background-color").priorityProtected, true);
  assert.match(find(".sample", "background-color").reason, /未提供可验证的末端原值/);
  const scanHtml = await readFile(path.join(context.reportDir, "components", "component", "fds-token-migration-report.html"), "utf8");
  assert.match(scanHtml, />变量优先级<\/span>/);

  result = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  assert.match(migrated, /--component-color: #FF522A;/);
  assert.match(migrated, /--color-blue06: #189DFF;/);
  assert.match(migrated, /color: var\(--component-color, var\(--fds-g-color-danger, #FF522A\)\);/);
  assert.match(migrated, /padding: var\(--bc-c-padding, var\(--bc-g-padding, var\(--fds-g-spacing-4, 16px\)\)\);/);
  assert.match(migrated, /border-color: var\(--fds-g-border-error, var\(--color-blue06, #FF522A\)\);/);
  assert.match(migrated, /outline-color: var\(--component-color, var\(--fds-g-border-error, var\(--color-blue06, #FF522A\)\)\);/);

  result = runTool("verify", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  report = await readReport(context.reportDir);
  const verified = (property) => report.findings.find((finding) => finding.selector === ".sample" && finding.property === property);
  assert.equal(verified("color").status, "compliant");
  assert.equal(verified("padding").status, "compliant");
  assert.equal(verified("border-color").status, "compliant");
  assert.equal(verified("outline-color").status, "compliant");
  assert.match(verified("color").reason, /组件自定义变量在 FDS 外层/);
  assert.match(verified("border-color").reason, /FDS 在老品牌色变量之前/);
  const html = await readFile(path.join(context.reportDir, "components", "component", "fds-token-migration-report.html"), "utf8");
  assert.match(html, /<h2>变量优先级<\/h2>/);
  assert.match(html, /class="status status-priority-protected"/);
  const promptData = JSON.parse(html.match(/<script id="finding-prompt-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const outlinePrompt = promptData.find((item) => item.property === "outline-color").prompt;
  assert.match(outlinePrompt, /--component-color > --fds-g-border-error > --color-blue06 > 原值/);
  assert.match(outlinePrompt, /组件变量 > FDS Token > --color-blueXX > 原值/);
});

test("已有变量链优先级错误时只报告不自动重排", async () => {
  const original = `:root { --component-color: #FF522A; }
.sample { color: var(--color-blue06, var(--component-color, var(--fds-g-color-danger, #FF522A))); }
`;
  const context = await fixture({ "component.css": original });
  const scan = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(scan.status, 0, scan.stderr);
  const report = await readReport(context.reportDir);
  const finding = report.findings.find((item) => item.property === "color");
  assert.equal(finding.status, "invalid-token");
  assert.match(finding.reason, /组件变量 > FDS Token > --color-blueXX > 原值/);

  const apply = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(apply.status, 0, apply.stderr);
  assert.equal(await readFile(context.paths["component.css"], "utf8"), original);
});

test("组件变量所有权按报告单元隔离", async () => {
  const context = await fixture({
    "src/components/alpha/a.css": ":root { --component-color: #FF522A; }\n.alpha { color: var(--component-color, #FF522A); }\n",
    "src/components/beta/b.css": ".beta { color: var(--component-color, #FF522A); }\n",
    ".fdst/migrate.json": `${JSON.stringify({
      schema: "fds-migrate-config/v1",
      entry: ["src/components/alpha", "src/components/beta"],
    }, null, 2)}\n`,
  });
  const result = runProjectTool("scan", context.root, "--catalog", context.catalog);
  assert.equal(result.status, 0, result.stderr);
  const reportDir = path.join(context.root, ".fdst", "reports", "migrate", "scan");
  const index = JSON.parse(await readFile(path.join(reportDir, "fds-token-migration-index.json"), "utf8"));
  const reports = Object.fromEntries(await Promise.all(index.components.map(async (component) => [
    component.name,
    JSON.parse(await readFile(path.join(reportDir, component.jsonReport), "utf8")),
  ])));
  const alpha = reports.alpha.findings.find((finding) => finding.property === "color");
  const beta = reports.beta.findings.find((finding) => finding.property === "color");
  assert.equal(alpha.status, "auto-replace");
  assert.deepEqual(alpha.componentVariables, ["--component-color"]);
  assert.equal(beta.status, "exempt");
  assert.match(beta.reason, /来源未知|私有契约/);
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
  assert.match(result.stdout, /报告索引 HTML：\.fdst\/reports\/migrate\/scan\/fds-token-migration-index\.html/);
  const reportDir = path.join(context.root, ".fdst", "reports", "migrate", "scan");
  const report = await readReport(reportDir);
  assert.deepEqual(report.targets, ["src"]);
  assert.equal(report.project.pathBase, "project-root");
  assert.equal(report.findings[0].file, "src/component.css");
  const html = await readFile(path.join(reportDir, "components", "src", "fds-token-migration-report.html"), "utf8");
  assert.match(html, /<code class="file-path">src\/component\.css<\/code>/);
  assert.match(html, /data-label="位置"/);
  assert.doesNotMatch(html, new RegExp(context.root.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
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

test("HTML 按文件分组、转义容器并移除 CRLF 回车", async () => {
  const source = ".button {\r\n  &:hover,\r\n  &:focus { box-shadow: 0 0 12px #000; }\r\n}\r\n";
  const context = await fixture({ "src/component.less": source });
  const result = runProjectTool("scan", context.root, "--catalog", context.catalog);
  assert.equal(result.status, 0, result.stderr);
  const html = await readFile(path.join(context.root, ".fdst", "reports", "migrate", "scan", "components", "src", "fds-token-migration-report.html"), "utf8");
  assert.match(html, /<code class="file-path">src\/component\.less<\/code>/);
  assert.match(html, /&amp;:hover,\s+&amp;:focus/);
  assert.doesNotMatch(html, /\r/);
});

test("批量入口按组件分别生成报告并只在根目录保留索引", async () => {
  const context = await fixture({
    "src/components/alpha/a.css": ".alpha { color: #FF522A; }\n",
    "src/components/beta/b.css": ".beta { padding: 16px; }\n",
    ".fdst/migrate.json": `${JSON.stringify({
      schema: "fds-migrate-config/v1",
      entry: ["src/components/alpha", "src/components/beta"],
    }, null, 2)}\n`,
  });
  const result = runProjectTool("scan", context.root, "--catalog", context.catalog);
  assert.equal(result.status, 0, result.stderr);
  const reportDir = path.join(context.root, ".fdst", "reports", "migrate", "scan");
  const index = JSON.parse(await readFile(path.join(reportDir, "fds-token-migration-index.json"), "utf8"));
  assert.equal(index.schema, "fds-token-migration-index/v2");
  assert.deepEqual(index.components.map((item) => item.name), ["alpha", "beta"]);
  assert.equal(index.summary.componentCount, 2);
  assert.equal(index.components[0].htmlReport, "components/alpha/fds-token-migration-report.html");
  const indexHtml = await readFile(path.join(reportDir, "fds-token-migration-index.html"), "utf8");
  assert.match(indexHtml, /href="components\/alpha\/fds-token-migration-report\.html"/);
  assert.match(indexHtml, /data-label="组件">alpha/);
  const alpha = JSON.parse(await readFile(path.join(reportDir, index.components[0].jsonReport), "utf8"));
  const beta = JSON.parse(await readFile(path.join(reportDir, index.components[1].jsonReport), "utf8"));
  assert.deepEqual(new Set(alpha.findings.map((item) => item.file)), new Set(["src/components/alpha/a.css"]));
  assert.deepEqual(new Set(beta.findings.map((item) => item.file)), new Set(["src/components/beta/b.css"]));

  await writeFile(path.join(reportDir, "fds-token-migration-index.md"), "legacy", "utf8");
  await writeFile(path.join(reportDir, "components", "alpha", "fds-token-migration-report.md"), "legacy", "utf8");
  await writeFile(context.paths[".fdst/migrate.json"], `${JSON.stringify({
    schema: "fds-migrate-config/v1",
    entry: ["src/components/alpha"],
  }, null, 2)}\n`, "utf8");
  const rerun = runProjectTool("scan", context.root, "--catalog", context.catalog);
  assert.equal(rerun.status, 0, rerun.stderr);
  const refreshedIndex = JSON.parse(await readFile(path.join(reportDir, "fds-token-migration-index.json"), "utf8"));
  assert.deepEqual(refreshedIndex.components.map((item) => item.name), ["alpha"]);
  await assert.rejects(readFile(path.join(reportDir, "components", "beta", "fds-token-migration-report.json"), "utf8"), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(reportDir, "fds-token-migration-index.md"), "utf8"), { code: "ENOENT" });
  await assert.rejects(readFile(path.join(reportDir, "components", "alpha", "fds-token-migration-report.md"), "utf8"), { code: "ENOENT" });
});

test("批量 apply 分组件报告但保持整批解析错误保护", async () => {
  const original = ".alpha { color: #FF522A; }\n";
  const context = await fixture({
    "src/components/alpha/a.css": original,
    "src/components/beta/b.css": ".beta { color: #FF522A; broken }\n",
    ".fdst/migrate.json": `${JSON.stringify({
      schema: "fds-migrate-config/v1",
      entry: ["src/components/alpha", "src/components/beta"],
    }, null, 2)}\n`,
  });
  const result = runProjectTool("apply", context.root, "--catalog", context.catalog);
  assert.equal(result.status, 1);
  assert.equal(await readFile(context.paths["src/components/alpha/a.css"], "utf8"), original);
  const reportDir = path.join(context.root, ".fdst", "reports", "migrate", "apply");
  const index = JSON.parse(await readFile(path.join(reportDir, "fds-token-migration-index.json"), "utf8"));
  assert.equal(index.applyBlocked, true);
  for (const component of index.components) {
    const report = JSON.parse(await readFile(path.join(reportDir, component.jsonReport), "utf8"));
    assert.equal(report.applyBlocked, true);
  }
});
