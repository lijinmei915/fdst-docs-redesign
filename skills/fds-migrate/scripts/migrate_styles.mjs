#!/usr/bin/env node
// 每次调用先更新内部最新版；不把调用方参数传入安装命令。
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const update = spawnSync("npm", [
  "install", "--save-exact", "@sharecrm/sds-linter@latest", "--ignore-scripts",
  "--registry=https://registry-npm.firstshare.cn/", "--no-audit", "--no-fund",
  "--prefer-online", "--fetch-retries=1", "--fetch-timeout=30000",
], {
  cwd: fileURLToPath(new URL("..", import.meta.url)),
  shell: process.platform === "win32",
  stdio: "inherit",
  timeout: 120000,
});
if (update.error || update.status !== 0) {
  console.error(`FDS linter 更新失败，未执行迁移命令：${update.error?.message || `npm exit ${update.status}`}`);
  process.exitCode = 1;
} else {
  await import("../node_modules/@sharecrm/sds-linter/bin/sds-linter.mjs");
}
