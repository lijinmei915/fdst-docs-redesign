import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fixture, readReport, runBundledTool } from "./helpers.mjs";

test("单色 background 保留声明、注释和 fallback，apply 后 verify 与重复执行稳定", async () => {
  const original = '<template><div style="background: #fff" /></template>\r\n<style lang="less">\r\n.x { background: /* keep */ var(--color-neutrals05, #dee1e8) !important; }\r\n</style>';
  const ctx = await fixture({ "component.vue": original });
  const expected = original.replace('background: #fff', 'background: var(--fds-g-color-gray-1, #fff)').replace('var(--color-neutrals05, #dee1e8)', 'var(--fds-g-color-gray-5, var(--color-neutrals05, #dee1e8))');
  assert.equal(runBundledTool('apply', ctx.paths['component.vue'], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths['component.vue'], 'utf8'), expected);
  const verified = runBundledTool('verify', ctx.paths['component.vue'], ctx.reportDir);
  assert.equal(verified.status, 0, verified.stderr);
  assert.equal(runBundledTool('apply', ctx.paths['component.vue'], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths['component.vue'], 'utf8'), expected);
});

test("JS background 保留组件变量优先级，不把普通数据当样式，拒绝错误 FDS 链", async () => {
  const original = 'const data = {background: "#fff"}; const view = <div style={{background: "var(--bc-bg, var(--color-neutrals05, #dee1e8))"}} />; const bad = <div style={{background: "var(--fds-g-font-size-3, 14px)"}} />;';
  const ctx = await fixture({ "component.jsx": original });
  assert.equal(runBundledTool('apply', ctx.paths['component.jsx'], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths['component.jsx'], 'utf8'), original.replace('var(--color-neutrals05, #dee1e8)', 'var(--fds-g-color-gray-5, var(--color-neutrals05, #dee1e8))'));
  assert.deepEqual((await readReport(ctx.reportDir)).findings.map(f => f.status), ['replaced', 'invalid-token']);
});

test("图片、渐变、多层和动态背景不改写，未知背景变量明确待人工检查", async () => {
  const values = ['url("a.png")', 'linear-gradient(#fff, #000)', 'url("a.png"), #fff', 'red no-repeat center', 'none', 'transparent', 'currentColor', 'inherit', 'var(--unknown, #fff)', 'var(--bc-bg)', 'var(--bc-bg, url("a.png"))', 'var(--color-neutrals05, url("a.png"))'];
  const original = values.map(value => `.x { background: ${value}; }`).join('\n');
  const ctx = await fixture({ "component.css": original });
  assert.equal(runBundledTool('apply', ctx.paths['component.css'], ctx.reportDir).status, 0);
  assert.equal(await readFile(ctx.paths['component.css'], 'utf8'), original);
  assert.deepEqual((await readReport(ctx.reportDir)).findings.map(f => f.status), ['exempt', 'unsupported', 'unsupported', 'unsupported', ...Array(4).fill('exempt'), ...Array(4).fill('unsupported')]);
});
