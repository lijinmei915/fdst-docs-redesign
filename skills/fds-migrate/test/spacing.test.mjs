import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fixture, readReport, runBundledTool } from "./helpers.mjs";

test("间距只迁移精确档位，混合简写保留未命中值并可重复执行", async () => {
  const original = `<template><div /></template><style lang="less">.popover { padding: 8px; padding: 8px /* keep */ 7px 12px 0; margin: auto 8px -7px 10%; padding-inline: 8px 7px; gap: 8px 7px; row-gap: 7px; }</style>`;
  const ctx = await fixture({ "OverflowButton.vue": original });
  let result = runBundledTool("scan", ctx.paths["OverflowButton.vue"], ctx.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const report = await readReport(ctx.reportDir);
  const exact = report.findings.filter(f => f.status === "auto-replace");
  assert.equal(exact.length, 6);
  assert.ok(exact.every(f => f.selectedToken.match === "exact" || f.candidates.every(c => c.match === "exact")));
  assert.ok(report.findings.filter(f => ["7px", "-7px", "0", "auto", "10%"].includes(f.originalValue)).every(f => f.status === "exempt"));
  result = runBundledTool("apply", ctx.paths["OverflowButton.vue"], ctx.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const changed = await readFile(ctx.paths["OverflowButton.vue"], "utf8");
  assert.match(changed, /padding: var\(--fds-g-spacing-\d+, 8px\);/);
  assert.match(changed, /\/\* keep \*\/ 7px var\(--fds-g-spacing-\d+, 12px\) 0/);
  assert.match(changed, /auto var\(--fds-g-spacing-\d+, 8px\) -7px 10%/);
  result = runBundledTool("verify", ctx.paths["OverflowButton.vue"], ctx.reportDir);
  assert.equal(result.status, 0, result.stderr);
  result = runBundledTool("apply", ctx.paths["OverflowButton.vue"], ctx.reportDir);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(await readFile(ctx.paths["OverflowButton.vue"], "utf8"), changed);
});

test("动态间距和非法简写保留原文供检查", async () => {
  const original = ".a { padding: calc(8px + 1vw); gap: 8px 12px 16px; margin: var(--unknown) 8px; }";
  const ctx = await fixture({ "a.css": original });
  const result = runBundledTool("scan", ctx.paths["a.css"], ctx.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const report = await readReport(ctx.reportDir);
  assert.ok(report.findings.some(f => f.originalValue.includes("calc(") && f.status === "unsupported"));
  assert.ok(report.findings.some(f => f.originalValue === "8px 12px 16px" && f.status === "unsupported"));
  assert.ok(report.findings.some(f => f.originalValue === "var(--unknown)" && f.status !== "auto-replace"));
  assert.equal(await readFile(ctx.paths["a.css"], "utf8"), original);
});
