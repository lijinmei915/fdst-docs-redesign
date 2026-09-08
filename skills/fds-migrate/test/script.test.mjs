import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fixture, readReport, runTool } from "./helpers.mjs";

test("TSX 支持 JSX style、CSSProperties、白名单调用和静态模板", async () => {
  const source = `import type { CSSProperties } from 'react'
const note = 'color: #FF522A'
const typed: CSSProperties = { color: '#FF522A' }
const classes = createStyles({ root: { padding: '16px' } })
const block = css\`div { color: #FF522A; }\`
const Styled = styled.div\`padding: 16px;\`
export const View = () => <div style={{ color: '#FF522A', padding: '16px' }} data-note={note} />
`;
  const context = await fixture({ "view.tsx": source });
  const result = runTool("apply", context.paths["view.tsx"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["view.tsx"], "utf8");
  assert.equal((migrated.match(/var\(/g) || []).length, 6);
  assert.match(migrated, /const note = 'color: #FF522A'/);
});

test("动态值、数值样式、spread 和模板插值只报告且 verify 失败", async () => {
  const source = `const dynamic = '#FF522A'
const extra = { color: dynamic }
const block = css\`color: \${dynamic};\`
export const View = () => <div style={{ color: dynamic, padding: 16, ...extra }} />
`;
  const context = await fixture({ "view.jsx": source });
  const result = runTool("verify", context.paths["view.jsx"], context.catalog, context.reportDir);
  assert.equal(result.status, 3, result.stderr);
  const report = await readReport(context.reportDir);
  assert.equal(report.findings.filter((item) => item.status === "unsupported").length, 4);
  assert.ok(report.findings.every((item) => item.writable === false));
});

test("JS 普通对象和普通字符串不会被当作样式扫描", async () => {
  const source = "const payload = { color: '#FF522A' }; const text = 'padding: 16px';\n";
  const context = await fixture({ "data.js": source });
  const result = runTool("scan", context.paths["data.js"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const report = await readReport(context.reportDir);
  assert.equal(report.findings.length, 0);
});

test("JS css 对象和函数返回对象可安全改写", async () => {
  const source = "const direct = css({ color: '#FF522A' }); const themed = makeStyles(() => ({ root: { padding: '16px' } }));\n";
  const context = await fixture({ "styles.js": source });
  const result = runTool("apply", context.paths["styles.js"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["styles.js"], "utf8");
  assert.equal((migrated.match(/var\(/g) || []).length, 2);
});

test("TS 支持类型标注、as 和 satisfies CSSProperties", async () => {
  const source = `type CSSProperties = import('react').CSSProperties
const first: CSSProperties = { color: '#FF522A' }
const second = { padding: '16px' } as CSSProperties
const third = { color: '#FF522A' } satisfies CSSProperties
`;
  const context = await fixture({ "styles.ts": source });
  const result = runTool("apply", context.paths["styles.ts"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["styles.ts"], "utf8");
  assert.equal((migrated.match(/var\(/g) || []).length, 3);
});
