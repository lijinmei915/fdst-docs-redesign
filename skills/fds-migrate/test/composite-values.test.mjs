import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fixture, readReport, runBundledTool } from "./helpers.mjs";

test("JS 多值与曲线参数保持源码区间正确，透明语义不产生颜色缺口", async () => {
  const original = 'const data = {borderRadius: "4px 8px"}; const view = <div style={{borderRadius: "4px 8px", transition: "opacity 200ms cubic-bezier(0.3, 0, 0.15, 1)", backgroundColor: "transparent", borderColor: "currentColor"}} />;';
  const ctx = await fixture({ 'component.jsx': original });
  assert.equal(runBundledTool('apply', ctx.paths['component.jsx'], ctx.reportDir).status, 0);
  const output = await readFile(ctx.paths['component.jsx'], 'utf8');
  assert.match(output, /const data = \{borderRadius: "4px 8px"\}/);
  assert.match(output, /borderRadius: "var\(--fds-g-radius-2, 4px\) var\(--fds-g-radius-4, 8px\)"/);
  assert.match(output, /var\(--fds-g-motion-easing-1, cubic-bezier\(0.3, 0, 0.15, 1\)\)/);
  const verified = runBundledTool('verify', ctx.paths['component.jsx'], ctx.reportDir);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(runBundledTool('apply', ctx.paths['component.jsx'], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths['component.jsx'], 'utf8'), output);
});

test("圆角、颜色多值和动效列表逐值报告，保留斜杠、注释与声明数量", async () => {
  const original = '.x {\r\n border-radius: 4px /* keep */ 8px / 12px 50%;\r\n border-color: var(--color-neutrals05) var(--color-neutrals07);\r\n transition-duration: 200ms, 1000ms;\r\n}';
  const ctx = await fixture({ 'component.css': original });
  assert.equal(runBundledTool('apply', ctx.paths['component.css'], ctx.reportDir).status, 0);
  const output = await readFile(ctx.paths['component.css'], 'utf8');
  assert.match(output, /var\(--fds-g-radius-2, 4px\) \/\* keep \*\/ var\(--fds-g-radius-4, 8px\) \/ var\(--fds-g-radius-5, 12px\) 50%/);
  assert.match(output, /var\(--fds-g-color-gray-5, var\(--color-neutrals05\)\) var\(--fds-g-color-gray-7, var\(--color-neutrals07\)\)/);
  const report = await readReport(ctx.reportDir);
  assert.equal(report.summary.declarationCount, 3);
  assert.equal(report.summary.occurrenceCount, 8);
  assert.equal(runBundledTool('verify', ctx.paths['component.css'], ctx.reportDir).status, 0);
  assert.equal(runBundledTool('apply', ctx.paths['component.css'], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths['component.css'], 'utf8'), output);
});

test("font 和 transition 只迁移受管值，不改字体名、属性名或 delay", async () => {
  const original = '.x { font: italic 500 14px/1.5 "Open Sans", sans-serif; transition: opacity 200ms ease 0.3s, color 1000ms linear; }';
  const ctx = await fixture({ 'component.css': original });
  assert.equal(runBundledTool('apply', ctx.paths['component.css'], ctx.reportDir).status, 0);
  const output = await readFile(ctx.paths['component.css'], 'utf8');
  assert.match(output, /font: italic var\(--fds-g-font-weight-medium, 500\) var\(--fds-g-font-size-3, 14px\)\/var\(--fds-g-line-height-ratio-6, 1.5\) "Open Sans", sans-serif/);
  assert.match(output, /opacity var\(--fds-g-motion-duration-2, 200ms\) ease 0.3s/);
  assert.equal(runBundledTool('verify', ctx.paths['component.css'], ctx.reportDir).status, 3);
  assert.deepEqual((await readReport(ctx.reportDir)).findings.filter(f => f.status === 'missing-token').map(f => f.originalValue), ['ease', 'linear']);
  assert.equal(runBundledTool('apply', ctx.paths['component.css'], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths['component.css'], 'utf8'), output);
});

test("逻辑边框和分栏边框复用颜色映射，动态及复杂语法显式报告", async () => {
  const original = '.x { border-inline-start: 1px dashed var(--color-neutrals05); column-rule: thin solid var(--color-neutrals07); animation: slide 200ms ease; font: var(--font); border-radius: calc(2px + 1vw) 4px; background-image: linear-gradient(#fff, #000); box-shadow: 0 0 12px rgba(1, 2, 3, 0.2); margin: 1px 2px; }';
  const ctx = await fixture({ 'component.css': original });
  assert.equal(runBundledTool('apply', ctx.paths['component.css'], ctx.reportDir).status, 0);
  const output = await readFile(ctx.paths['component.css'], 'utf8');
  assert.equal(output, original.replace('var(--color-neutrals05)', 'var(--fds-g-color-gray-5, var(--color-neutrals05))').replace('var(--color-neutrals07)', 'var(--fds-g-color-gray-7, var(--color-neutrals07))').replace('margin: 1px 2px', 'margin: 1px var(--fds-g-spacing-1, 2px)'));
  assert.deepEqual((await readReport(ctx.reportDir)).findings.map(f => f.status), ['replaced', 'replaced', 'unsupported', 'unsupported', 'unsupported', 'unsupported', 'exempt', 'exempt', 'replaced']);
});
