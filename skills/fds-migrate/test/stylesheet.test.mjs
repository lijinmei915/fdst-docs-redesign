import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import test from "node:test";
import path from "node:path";
import { buildDecisionPrompt, renderHtml } from "../scripts/lib/report.mjs";
import { fixture, readReport, runBundledTool, runProjectTool, runTool } from "./helpers.mjs";

test("CSS 扫描对颜色使用旧色板索引，对非颜色保持值匹配", async () => {
  const original = ".sample {\n  color: #FF522A;\n  background-color: #FFFFFF;\n  border-color: #FF542C;\n  padding: 16px;\n  width: 100%;\n  display: flex;\n  outline-color: var(--fds-g-missing, #000);\n}\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(context.paths["component.css"], "utf8"), original);
  const report = await readReport(context.reportDir);
  const statuses = Object.fromEntries(report.findings.map((item) => [item.property, item.status]));
  assert.deepEqual(statuses, {
    color: "auto-replace",
    "background-color": "missing-token",
    "border-color": "missing-token",
    padding: "exempt",
    width: "exempt",
    display: "exempt",
    "outline-color": "invalid-token",
  });
  const html = await readFile(path.join(context.reportDir, "components", "component", "fds-token-migration-report.html"), "utf8");
  assert.match(html, /<h2>已替换内容<\/h2>/);
  assert.match(html, /<h2>不符合规范<\/h2>/);
  assert.doesNotMatch(html, /<h2>相近 Token 推荐<\/h2>/);
  assert.match(html, /data-status-filter="similar"/);
  assert.doesNotMatch(html, /data-status="similar"/);
  assert.equal((html.match(/class="status status-similar"/g) || []).length, 0);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /data-prompt-drawer/);
  assert.match(html, /data-prompt-trigger=/);
  assert.doesNotMatch(html, /data-decision-select=/);
  assert.match(html, /确定性自动替换/);
  assert.match(html, /<code>--fds-g-color-red-6<\/code>/);
  assert.match(html, /data-decision-note=/);
  assert.match(html, /data-batch-prompt-open/);
  assert.match(html, /data-batch-prompt-drawer/);
  assert.match(html, /data-batch-prompt-regenerate/);
  assert.match(html, /data-batch-prompt-text spellcheck="false"><\/textarea>/);
  assert.doesNotMatch(html, /data-batch-prompt-text readonly/);
  assert.match(html, /data-decision-count>0<\/span>/);
  assert.match(html, /data-decision-storage-key="fds-migrate-decisions:v1:/);
  const promptData = JSON.parse(html.match(/<script id="finding-prompt-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(promptData.length, 4);
  assert.match(promptData.find((item) => item.status === "auto-replace").prompt, /var\(--fds-g-color-red-6, #FF522A\)/);
  assert.match(promptData.find((item) => item.status === "missing-token").prompt, /没有可靠 Token 时保持源码不变/);
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
  assert.match(html, /data-decision-note="safe-id"/);
  const promptData = JSON.parse(html.match(/<script id="finding-prompt-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(promptData[0].originalValue, unsafeValue);
});

test("汇总提示词同时包含人工选定 Token 和无候选处理说明", () => {
  const baseItem = {
    id: "finding-1",
    file: "src/example.css",
    line: 2,
    column: 3,
    property: "color",
    selector: ".example",
    originalValue: "#FF522A",
    status: "ambiguous",
    statusLabel: "存在歧义",
    reason: "存在多个精确候选",
  };
  const prompt = buildDecisionPrompt([
    {
      item: baseItem,
      candidate: { cssVariable: "--fds-g-color-danger", resolvedValue: "#FF522A", match: "exact" },
      note: null,
    },
    {
      item: { ...baseItem, id: "finding-2", line: 3, property: "box-shadow", originalValue: "none", status: "missing-token", statusLabel: "缺少 Token" },
      candidate: null,
      note: "保留原值，并登记 Token 缺口。",
    },
  ]);
  assert.match(prompt, /请按以下人工决策处理 FDS Token 迁移（2 项）/);
  assert.match(prompt, /\[finding-1\] src\/example\.css:2:3/);
  assert.match(prompt, /使用 --fds-g-color-danger（#FF522A）/);
  assert.match(prompt, /说明：保留原值，并登记 Token 缺口。/);
  assert.match(prompt, /组件变量 > FDS Token > 旧色板变量 > 原值/);
  assert.doesNotMatch(prompt, /报告状态|判定原因|匹配类型/);
  assert.ok(prompt.split("\n").length <= 13, prompt);
});

test("CSS apply 按旧色板索引替换颜色并保留原值及 CRLF", async () => {
  const original = ".sample {\r\n  color: #FF522A;\r\n  background-color: #FFFFFF;\r\n  padding: 16px;\r\n}\r\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  assert.match(migrated, /color: var\(--fds-g-color-red-6, #FF522A\);/);
  assert.match(migrated, /padding: 16px;/);
  assert.match(migrated, /background-color: #FFFFFF;/);
  assert.ok(migrated.includes("\r\n"));
});

test("CSS apply 可将无单位行高替换为相对行高 Token", async () => {
  const original = ".sample { line-height: 1.5; }\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(
    await readFile(context.paths["component.css"], "utf8"),
    ".sample { line-height: var(--fds-g-line-height-ratio-6, 1.5); }\n",
  );
});

test("字号排除小于 12px 和超过 48px，区间内按最近档自动替换", async () => {
  const original = ".ten { font-size: 10px; }\n.eleven { font-size: 11px; }\n.lower { font-size: 12px; }\n.nearest { font-size: 17px; }\n.upper { font-size: 48px; }\n.above { font-size: 49px; }\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  assert.match(migrated, /\.ten \{ font-size: 10px; \}/);
  assert.match(migrated, /\.eleven \{ font-size: 11px; \}/);
  assert.match(migrated, /\.lower \{ font-size: var\(--fds-g-font-size-1, 12px\); \}/);
  assert.match(migrated, /\.nearest \{ font-size: var\(--fds-g-font-size-5, 17px\); \}/);
  assert.match(migrated, /\.upper \{ font-size: var\(--fds-g-font-size-14, 48px\); \}/);
  assert.match(migrated, /\.above \{ font-size: 49px; \}/);
  const report = await readReport(context.reportDir);
  const find = (selector) => report.findings.find((item) => item.selector === selector);
  const nearest = find(".nearest");
  assert.equal(nearest.status, "replaced");
  assert.equal(nearest.selectedToken.match, "nearest");
  assert.deepEqual(nearest.valueChange, { from: "17px", to: "16px" });
  assert.deepEqual(nearest.candidates.slice(0, 2).map((item) => item.cssVariable), ["--fds-g-font-size-5", "--fds-g-font-size-6"]);
  assert.equal(find(".ten").status, "exempt");
  assert.equal(find(".eleven").status, "exempt");
  assert.equal(find(".lower").selectedToken.match, "exact");
  assert.equal(find(".upper").selectedToken.match, "exact");
  assert.equal(find(".above").status, "exempt");
});

test("固定行高不替换，已有固定 Token 保留，相对行高只精确替换", async () => {
  const original = ".fixed { font-size: 16px; line-height: 24px; }\n.existing { line-height: var(--fds-g-line-height-5, 24px); }\n.relative { line-height: 1.5; }\n.imprecise { line-height: 1.55; }\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  assert.match(migrated, /\.fixed \{ font-size: var\(--fds-g-font-size-5, 16px\); line-height: 24px; \}/);
  assert.match(migrated, /\.existing \{ line-height: var\(--fds-g-line-height-5, 24px\); \}/);
  assert.match(migrated, /\.relative \{ line-height: var\(--fds-g-line-height-ratio-6, 1\.5\); \}/);
  assert.match(migrated, /\.imprecise \{ line-height: 1\.55; \}/);
  assert.doesNotMatch(migrated, /line-height: var\(--fds-g-line-height-ratio-6, 24px\)/);
  const report = await readReport(context.reportDir);
  const find = (selector) => report.findings.find((item) => item.selector === selector && item.property === "line-height");
  assert.equal(find(".fixed").status, "exempt");
  assert.match(find(".fixed").reason, /固定行高维持现状/);
  assert.equal(find(".existing").status, "compliant");
  assert.equal(find(".relative").status, "replaced");
  assert.equal(find(".relative").selectedToken.match, "exact");
  assert.equal(find(".imprecise").status, "similar");
  assert.equal(find(".imprecise").selectedToken, undefined);
});

test("圆角和透明度只有最近档自动替换提供下拉，精确命中不提供", async () => {
  const original = ".sample { border-radius: 10px; opacity: 0.7; }\n.ends { opacity: 0; }\n.full { opacity: 1.0; }\n.twenty { border-radius: 20px; }\n.half { opacity: 0.5; }\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  assert.match(migrated, /border-radius: var\(--fds-g-radius-4, 10px\)/);
  assert.match(migrated, /opacity: var\(--fds-g-opacity-65, 0\.7\)/);
  assert.match(migrated, /border-radius: var\(--fds-g-radius-7, 20px\)/);
  assert.match(migrated, /opacity: var\(--fds-g-opacity-50, 0\.5\)/);
  const report = await readReport(context.reportDir);
  const opacity = report.findings.find((item) => item.originalValue === "0.7");
  const exactRadius = report.findings.find((item) => item.originalValue === "20px");
  const exactOpacity = report.findings.find((item) => item.originalValue === "0.5");
  assert.equal(opacity.selectedToken.cssVariable, "--fds-g-opacity-65");
  assert.ok(opacity.candidates.every((item) => !["0", "1"].includes(item.resolvedValue)));
  assert.equal(opacity.selectedToken.comment, "加载弱化档");
  assert.equal(exactRadius.selectedToken.match, "exact");
  assert.equal(exactOpacity.selectedToken.match, "exact");
  assert.deepEqual(report.findings.filter((item) => item.property === "opacity").map((item) => item.status), ["replaced", "exempt", "exempt", "replaced"]);
  const html = await readFile(path.join(context.reportDir, "components", "component", "fds-token-migration-report.html"), "utf8");
  const rowFor = (finding) => {
    const start = html.indexOf(`id="finding-${finding.id}"`);
    return html.slice(start, html.indexOf("</tr>", start));
  };
  assert.match(rowFor(opacity), /data-decision-select=/);
  assert.doesNotMatch(rowFor(exactRadius), /data-decision-select=|data-decision-note=/);
  assert.doesNotMatch(rowFor(exactOpacity), /data-decision-select=|data-decision-note=/);
  assert.match(rowFor(exactRadius), /确定性自动替换/);
});

test("硬编码间距及非标准层级和阴影直接排除迁移报告", async () => {
  const original = ".sample { padding: 16px; gap: 7px; z-index: 42; box-shadow: 0 0 12px #000; }\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const report = await readReport(context.reportDir);
  assert.ok(report.findings.every((item) => item.status === "exempt"));
  assert.match(report.findings.find((item) => item.property === "padding").reason, /布局、尺寸或组件内部特殊关系/);
  assert.match(report.findings.find((item) => item.property === "z-index").reason, /保留硬编码/);
  assert.match(report.findings.find((item) => item.property === "box-shadow").reason, /保留硬编码/);
  const html = await readFile(path.join(context.reportDir, "components", "component", "fds-token-migration-report.html"), "utf8");
  const promptData = JSON.parse(html.match(/<script id="finding-prompt-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(promptData.length, 0);
});

test("内置 Catalog 支持 20px 圆角和 500/600/800/1000ms 动效时长", async () => {
  const original = ".sample { border-radius: 20px; transition-duration: 500ms; animation-duration: 600ms; }\n.a { transition-duration: 800ms; }\n.b { animation-duration: 1000ms; }\n";
  const context = await fixture({ "component.css": original });
  const result = runBundledTool("apply", context.paths["component.css"], context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  for (const variable of ["radius-7", "motion-duration-5", "motion-duration-6", "motion-duration-7", "motion-duration-8"]) {
    assert.match(migrated, new RegExp(`--fds-g-${variable}`));
  }
});

test("有彩色按旧索引直接映射，不要求新旧值相等", async () => {
  const original = ".sample { color: #FFCA7A; border-color: #123456; }\n";
  const context = await fixture({ "component.css": original });
  const result = runTool("apply", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  assert.match(migrated, /color: var\(--fds-g-color-brand-3, #FFCA7A\);/);
  assert.match(migrated, /border-color: #123456;/);
  const report = await readReport(context.reportDir);
  const color = report.findings.find((finding) => finding.property === "color");
  const border = report.findings.find((finding) => finding.property === "border-color");
  assert.equal(color.status, "replaced");
  assert.equal(color.selectedToken.match, "legacy-index");
  assert.equal(report.legacyColorIndex.schema, "fds-legacy-color-index/v2");
  assert.equal(report.legacyColorIndex.indexRule, "chromatic 00-10 -> 0-10; neutrals 01-19 -> gray 1-19; special 01-04 -> special 1-4");
  assert.deepEqual(report.legacyColorIndex.indexRules, {
    chromatic: "legacy k -> current k",
    gray: "legacy n -> current n",
    special: "legacy n -> current n",
  });
  assert.equal(report.legacyColorIndex.familyCount, 11);
  assert.equal(report.legacyColorIndex.scaleCount, 2);
  assert.equal(report.legacyColorIndex.recordCount, 144);
  assert.match(report.legacyColorIndex.sha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(color.legacyColors, [{
    family: "primary",
    index: "03",
    cssVariable: "--color-primary03",
    resolvedValue: "#FFCA7A",
    targetFamily: "brand",
    targetIndex: 3,
  }]);
  assert.equal(border.status, "missing-token");
  assert.equal(border.candidates.length, 0);
  assert.match(border.reason, /不按当前 FDS 值或颜色距离猜测/);
});

test("11 套旧有彩色变量统一按同索引映射，且无 fallback 也可保留旧变量", async () => {
  const pairs = [
    ["primary", "brand"], ["warning", "amber"], ["yellow", "yellow"],
    ["yellow-green", "yellow-green"], ["success", "green"], ["teal", "teal"],
    ["blue", "blue"], ["info", "indigo"], ["purple", "purple"],
    ["magenta", "magenta"], ["danger", "red"],
  ];
  const original = `.sample { ${pairs.map(([legacy]) => `--sample-${legacy}: 1; color: var(--color-${legacy}06);`).join(" ")} }\n`;
  const context = await fixture({ "component.css": original });
  let result = runBundledTool("apply", context.paths["component.css"], context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  for (const [legacy, current] of pairs) {
    assert.match(migrated, new RegExp(`color: var\\(--fds-g-color-${current}-6, var\\(--color-${legacy}06\\)\\);`));
  }
  result = runBundledTool("verify", context.paths["component.css"], context.reportDir);
  assert.equal(result.status, 0, result.stderr);
});

test("旧 Gray 与 Special 保留用户索引并逐项一对一迁移", async () => {
  const original = ".sample { color: var(--color-neutrals19); border-color: var(--color-special04); background-color: #F2F4FB; }\n";
  const context = await fixture({ "component.css": original });
  const result = runBundledTool("apply", context.paths["component.css"], context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["component.css"], "utf8");
  assert.match(migrated, /color: var\(--fds-g-color-gray-19, var\(--color-neutrals19\)\);/);
  assert.match(migrated, /border-color: var\(--fds-g-color-special-4, var\(--color-special04\)\);/);
  assert.match(migrated, /background-color: var\(--fds-g-color-special-1, #F2F4FB\);/);
  const report = await readReport(context.reportDir);
  assert.deepEqual(
    report.findings.map((finding) => finding.selectedToken.cssVariable),
    ["--fds-g-color-gray-19", "--fds-g-color-special-4", "--fds-g-color-special-1"],
  );
});

test("CSS 变量定义保持原样，消费链按组件变量、FDS、旧色板变量和原值排序", async () => {
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
  assert.equal(find(".sample", "color").replacement, "var(--component-color, var(--fds-g-color-red-6, #FF522A))");
  assert.deepEqual(find(".sample", "color").componentVariables, ["--component-color"]);
  assert.equal(find(".sample", "padding").status, "exempt");
  assert.equal(find(".sample", "padding").replacement, undefined);
  assert.deepEqual(find(".sample", "padding").componentVariables, ["--bc-c-padding", "--bc-g-padding"]);
  assert.equal(find(".sample", "border-color").replacement, "var(--fds-g-color-blue-6, var(--color-blue06, #FF522A))");
  assert.deepEqual(find(".sample", "border-color").legacyColorVariables, ["--color-blue06"]);
  assert.equal(find(".sample", "outline-color").replacement, "var(--component-color, var(--fds-g-color-blue-6, var(--color-blue06, #FF522A)))");
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
  assert.match(migrated, /color: var\(--component-color, var\(--fds-g-color-red-6, #FF522A\)\);/);
  assert.match(migrated, /padding: var\(--bc-c-padding, var\(--bc-g-padding, 16px\)\);/);
  assert.match(migrated, /border-color: var\(--fds-g-color-blue-6, var\(--color-blue06, #FF522A\)\);/);
  assert.match(migrated, /outline-color: var\(--component-color, var\(--fds-g-color-blue-6, var\(--color-blue06, #FF522A\)\)\);/);

  result = runTool("verify", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  report = await readReport(context.reportDir);
  const verified = (property) => report.findings.find((finding) => finding.selector === ".sample" && finding.property === property);
  assert.equal(verified("color").status, "compliant");
  assert.equal(verified("padding").status, "exempt");
  assert.equal(verified("border-color").status, "compliant");
  assert.equal(verified("outline-color").status, "compliant");
  assert.match(verified("color").reason, /组件自定义变量在 FDS 外层/);
  assert.match(verified("border-color").reason, /FDS 在旧色板变量之前/);
  const html = await readFile(path.join(context.reportDir, "components", "component", "fds-token-migration-report.html"), "utf8");
  assert.match(html, /<h2>变量优先级<\/h2>/);
  assert.match(html, /class="status status-priority-protected"/);
  const promptData = JSON.parse(html.match(/<script id="finding-prompt-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const outlinePrompt = promptData.find((item) => item.property === "outline-color").prompt;
  assert.match(outlinePrompt, /--component-color > --fds-g-color-blue-6 > --color-blue06 > 原值/);
  assert.match(outlinePrompt, /组件变量 > FDS Token > 旧色板变量 > 原值/);
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
  assert.match(finding.reason, /组件变量 > FDS Token > 旧色板变量 > 原值/);

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
  ["pcss", ".card { border-radius: 4px; }\n"],
  ["wxss", ".card { border-radius: 4px; width: 32rpx; }\n"],
  ["scss", "$radius: 4px;\n.card { border-radius: 4px; }\n"],
  ["less", "@radius: 4px;\n.card { border-radius: 4px; }\n"],
  ["sass", "$radius: 4px\n.card\n  border-radius: 4px\n"],
]) {
  test(`${extension} 能按语法 AST 定位并局部替换`, async () => {
    const context = await fixture({ [`component.${extension}`]: source });
    const result = runTool("apply", context.paths[`component.${extension}`], context.catalog, context.reportDir);
    assert.equal(result.status, 0, result.stderr);
    const migrated = await readFile(context.paths[`component.${extension}`], "utf8");
    assert.match(migrated, /border-radius:\s*var\(--fds-g-radius-2, 4px\)/);
    if (!["pcss", "wxss"].includes(extension)) assert.match(migrated, /\$radius: 4px|@radius: 4px/);
    if (extension === "wxss") assert.match(migrated, /width: 32rpx/);
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
  const context = await fixture({ "component.css": ".card { border-radius: 4px; }\n" });
  const result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir, "--context", "card");
  assert.equal(result.status, 0, result.stderr);
  const [finding] = (await readReport(context.reportDir)).findings;
  assert.equal(finding.selectedToken.cssVariable, "--fds-s-card-radius");
});

test("Scene context 只在同为最近档时提升优先级", async () => {
  const context = await fixture({ "component.css": ".card { border-radius: 10px; }\n" });
  const result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir, "--context", "card");
  assert.equal(result.status, 0, result.stderr);
  const [finding] = (await readReport(context.reportDir)).findings;
  assert.equal(finding.selectedToken.cssVariable, "--fds-g-radius-4");
});

test("通用尺寸不推荐 icon-size，已有图标尺寸 Token 仍保持合规", async () => {
  const context = await fixture({ "component.css": ".sample { height: 16px; border-radius: 4px; }\n.icon { width: var(--fds-g-icon-size-1, 16px); }\n" });
  let result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  let report = await readReport(context.reportDir);
  assert.equal(report.findings.find((item) => item.property === "height").status, "missing-token");
  assert.equal(report.findings.find((item) => item.property === "width").status, "compliant");
  assert.equal(report.findings.find((item) => item.property === "border-radius").selectedToken.cssVariable, "--fds-g-radius-2");

  result = runTool("scan", context.paths["component.css"], context.catalog, context.reportDir, "--context", "icon");
  assert.equal(result.status, 0, result.stderr);
  report = await readReport(context.reportDir);
  const height = report.findings.find((item) => item.property === "height");
  assert.equal(height.status, "missing-token");
  assert.ok(height.candidates.every((item) => !item.cssVariable.includes("icon-size")));
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

test("Skill 内置完整 Token 快照且颜色按旧索引选择当前色板 Token", async () => {
  const context = await fixture({ "component.css": ".danger { color: #FF522A; }\n" });
  const result = runBundledTool("scan", context.paths["component.css"], context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const report = await readReport(context.reportDir);
  const [finding] = report.findings;
  assert.equal(finding.selectedToken.cssVariable, "--fds-g-color-red-6");
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
    "app/card.css": ".card { border-radius: 4px; }\n",
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
  assert.equal(report.findings[0].selectedToken.cssVariable, "--fds-s-card-radius");
});

test("HTML 按文件分组、转义容器并移除 CRLF 回车", async () => {
  const source = ".button {\r\n  &:hover,\r\n  &:focus { border-radius: 10px; }\r\n}\r\n";
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
