import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fixture, readReport, runBundledTool } from "./helpers.mjs";

test("JS 简写保留字符串与非样式数据，边框颜色遵循组件变量优先级", async () => {
  const original = 'const data = {border: "1px solid var(--color-neutrals07)"};\nconst view = <div style={{borderRight: "1px solid var(--bc-border, var(--color-neutrals07))", borderBottom: "1px solid var(--fds-g-missing)", borderLeft: "1px solid var(--color-neutrals07, var(--fds-g-color-gray-7))"}} />;';
  const ctx = await fixture({ "component.jsx": original });
  const result = runBundledTool("apply", ctx.paths["component.jsx"], ctx.reportDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(ctx.paths["component.jsx"], "utf8"), original.replace('var(--bc-border, var(--color-neutrals07))', 'var(--bc-border, var(--fds-g-color-gray-7, var(--color-neutrals07)))'));
  const report = await readReport(ctx.reportDir);
  assert.deepEqual(report.findings.map(f => f.status), ['replaced', 'invalid-token', 'invalid-token']);
});

test("边框简写只替换颜色，保留格式、fallback、important，verify 与二次 apply 稳定", async () => {
  const original = '<template><div /></template><style lang="less">\r\n.x {\r\n  border: 1px /* keep */ dashed var(--color-neutrals07, #d8dbe1) !important;\r\n  border-top: #c1c5ce solid 2px;\r\n  outline: thin dotted var(--color-neutrals07);\r\n}\r\n</style>';
  const ctx = await fixture({ "component.vue": original });
  const expected = original
    .replace('var(--color-neutrals07, #d8dbe1)', 'var(--fds-g-color-gray-7, var(--color-neutrals07, #d8dbe1))')
    .replace('border-top: #c1c5ce', 'border-top: var(--fds-g-color-gray-7, #c1c5ce)')
    .replace('dotted var(--color-neutrals07)', 'dotted var(--fds-g-color-gray-7, var(--color-neutrals07))');
  const applied = runBundledTool("apply", ctx.paths["component.vue"], ctx.reportDir);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(await readFile(ctx.paths["component.vue"], "utf8"), expected);
  assert.equal(runBundledTool("verify", ctx.paths["component.vue"], ctx.reportDir).status, 0);
  assert.equal(runBundledTool("apply", ctx.paths["component.vue"], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths["component.vue"], "utf8"), expected);
});

test("边框动态或多义值不改写，无颜色和透明边框保持原样", async () => {
  const values = ['var(--border)', 'var(--width) solid #d8dbe1', '1px solid var(--unknown)', '1px solid #d8dbe1 red', 'none', '1px dashed', '1px solid transparent', '1px solid currentColor'];
  const original = values.map(value => `.x { border: ${value}; }`).join('\n');
  const ctx = await fixture({ "component.css": original });
  assert.equal(runBundledTool("apply", ctx.paths["component.css"], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths["component.css"], "utf8"), original);
  const report = await readReport(ctx.reportDir);
  assert.deepEqual(report.findings.map(f => f.status), ['unsupported', 'unsupported', 'unsupported', 'unsupported', 'exempt', 'exempt', 'exempt', 'exempt']);
});
