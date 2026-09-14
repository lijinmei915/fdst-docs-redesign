import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fixture, readReport, runTool } from "./helpers.mjs";

test("HTML 静态内联 style 可迁移，普通属性字符串不参与", async () => {
  const source = '<div title="color: #FF522A" style="color: #FF522A; padding: 16px"></div>\n';
  const context = await fixture({ "page.html": source });
  const result = runTool("apply", context.paths["page.html"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["page.html"], "utf8");
  assert.match(migrated, /title="color: #FF522A"/);
  assert.match(migrated, /style="color: var\(--fds-g-color-red-6, #FF522A\); padding: 16px"/);
});

test("WXML 静态内联 style 可迁移，小程序属性不参与", async () => {
  const source = '<view wx:if="{{visible}}" bindtap="onTap" data-note="color: #FF522A" style="color: #FF522A; padding: 16px"></view>\n';
  const context = await fixture({ "page.wxml": source });
  const result = runTool("apply", context.paths["page.wxml"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["page.wxml"], "utf8");
  assert.match(migrated, /wx:if="{{visible}}" bindtap="onTap" data-note="color: #FF522A"/);
  assert.match(migrated, /style="color: var\(--fds-g-color-red-6, #FF522A\); padding: 16px"/);
  const report = await readReport(context.reportDir);
  assert.deepEqual(new Set(report.findings.map((item) => item.syntax)), new Set(["wxml-inline-style"]));
});

test("WXML style 模板插值只报告人工检查，不阻止同文件静态 style 迁移", async () => {
  const source = '<view style="color: {{color}}; padding: 16px"></view>\n<view style="color: #FF522A"></view>\n';
  const context = await fixture({ "page.wxml": source });
  const result = runTool("apply", context.paths["page.wxml"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["page.wxml"], "utf8");
  assert.match(migrated, /style="color: {{color}}; padding: 16px"/);
  assert.match(migrated, /style="color: var\(--fds-g-color-red-6, #FF522A\)"/);
  const report = await readReport(context.reportDir);
  const unsupported = report.findings.find((item) => item.status === "unsupported");
  assert.equal(unsupported.property, "<style-interpolation>");
  assert.match(unsupported.reason, /WXML style 包含模板插值/);
  assert.equal(report.parseErrors.length, 0);
});

test("Vue 同时处理 style、template 与 script 的确定性样式节点", async () => {
  const source = `<template>
  <div style="border-radius: 4px" :style="{ color: '#FF522A' }" :data-note="'color: #FF522A'" />
</template>
<script setup lang="ts">
import type { CSSProperties } from 'vue'
const panelStyle: CSSProperties = { borderRadius: '4px' }
const note = 'color: #FF522A'
</script>
<style lang="scss">
.panel { color: #FF522A; }
</style>
`;
  const context = await fixture({ "Panel.vue": source });
  const result = runTool("apply", context.paths["Panel.vue"], context.catalog, context.reportDir);
  assert.equal(result.status, 0, result.stderr);
  const migrated = await readFile(context.paths["Panel.vue"], "utf8");
  assert.equal((migrated.match(/var\(/g) || []).length, 4);
  assert.match(migrated, /const note = 'color: #FF522A'/);
  const report = await readReport(context.reportDir);
  assert.deepEqual(new Set(report.findings.map((item) => item.syntax)), new Set(["vue-template-inline-style", "vue-template", "ts", "scss"]));
});

test("Vue 动态 :style 被单独报告，不能伪装成扫描通过", async () => {
  const source = '<template><div :style="computedStyle" /></template>\n';
  const context = await fixture({ "Panel.vue": source });
  const result = runTool("verify", context.paths["Panel.vue"], context.catalog, context.reportDir);
  assert.equal(result.status, 3, result.stderr);
  const report = await readReport(context.reportDir);
  assert.equal(report.findings[0].status, "unsupported");
  assert.match(report.findings[0].reason, /跨变量数据流/);
});

test("Vue 未知 style lang 明确报错并阻止 apply", async () => {
  const source = '<template><div /></template>\n<style lang="stylus">\n.panel\n  color #FF522A\n</style>\n';
  const context = await fixture({ "Panel.vue": source });
  const result = runTool("apply", context.paths["Panel.vue"], context.catalog, context.reportDir);
  assert.equal(result.status, 1);
  assert.equal(await readFile(context.paths["Panel.vue"], "utf8"), source);
  const report = await readReport(context.reportDir);
  assert.equal(report.applyBlocked, true);
  assert.match(report.parseErrors[0].message, /不支持的样式语法：stylus/);
});
