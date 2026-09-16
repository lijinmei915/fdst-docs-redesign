import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const skill = path.join(root, "skills/fds-migrate");
const manifest = JSON.parse(await readFile(path.join(skill, "bin/sds-linter.manifest.json"), "utf8"));
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const installed = path.join(skill, "node_modules/@sharecrm/sds-linter");
const skillPackage = JSON.parse(await readFile(path.join(skill, "package.json"), "utf8"));
const installedPackage = JSON.parse(await readFile(path.join(installed, "package.json"), "utf8"));
assert.equal(installedPackage.version, skillPackage.dependencies["@sharecrm/sds-linter"]);
const lock = JSON.parse(await readFile(path.join(skill, "package-lock.json"), "utf8"));
assert.equal(new URL(lock.packages["node_modules/@sharecrm/sds-linter"].resolved).origin, "https://registry-npm.firstshare.cn");
for (const file of manifest.metadata.files) {
  assert.equal(hash(await readFile(path.join(installed, file.path))), file.sha256, `npm 包快照不一致：${file.path}`);
}
assert.equal(hash(await readFile(path.join(skill, "bin/sds-linter.mjs"))), manifest.artifact.sha256);
for (const file of manifest.metadata.files) {
  assert.equal(hash(await readFile(path.join(root, file.sourcePath))), file.sha256, `bundle 已过期，请同步新数据并重新构建：${file.sourcePath}`);
}
const temporary = await mkdtemp(path.join(os.tmpdir(), "fds-single-file-"));
try {
  const entry = path.join(temporary, "engine.mjs");
  await copyFile(path.join(skill, "bin/sds-linter.mjs"), entry);
  await mkdir(path.join(temporary, "src"));
  const source = "\uFEFF.sample { border-radius: 4px; }\r\n";
  const file = path.join(temporary, "src/example.css");
  await writeFile(file, source);
  const run = (command, expected = 0, cli = entry) => {
    const result = spawnSync(process.execPath, [cli, command], { cwd: temporary, encoding: "utf8", env: { ...process.env, NODE_PATH: "" } });
    assert.equal(result.status, expected, result.stderr);
    return result;
  };
  assert.match(run("--version").stdout, /@sharecrm\/sds-linter/);
  run("scan");
  assert.equal(await readFile(file, "utf8"), source);
  run("verify", 3);
  // apply 仅修改本测试创建的临时样例。
  run("apply");
  const migrated = await readFile(file, "utf8");
  assert.equal(migrated, "\uFEFF.sample { border-radius: var(--fds-g-radius-2, 4px); }\r\n");
  run("verify");
  run("apply");
  assert.equal(await readFile(file, "utf8"), migrated);
  run("verify", 0, path.join(skill, "scripts/migrate_styles.mjs"));
  const index = JSON.parse(await readFile(path.join(temporary, ".fdst/reports/migrate/verify/fds-token-migration-index.json"), "utf8"));
  const reportDirectory = path.join(temporary, ".fdst/reports/migrate/verify");
  assert.match(await readFile(path.join(reportDirectory, "fds-token-migration-index.md"), "utf8"), /# FDS Token 迁移报告索引/);
  assert.match(await readFile(path.join(reportDirectory, index.components[0].markdownReport), "utf8"), /符合规范/);
  await assert.rejects(readFile(path.join(reportDirectory, "fds-token-migration-index.html")), { code: "ENOENT" });
  const report = JSON.parse(await readFile(path.join(temporary, ".fdst/reports/migrate/verify", index.components[0].jsonReport), "utf8"));
  assert.equal(report.catalog.sha256, manifest.metadata.files.find((item) => item.path.endsWith("fds-token-catalog.jsonl")).sha256);
  assert.equal(report.legacyColorIndex.sha256, manifest.metadata.files.find((item) => item.path.endsWith("legacy-color-index.json")).sha256);
  console.log("fds-migrate 单文件契约通过：快照一致、无 npm/node_modules/外部数据、旧入口兼容、scan/apply/verify、报告哈希与幂等性。");
} finally {
  await rm(temporary, { recursive: true, force: true, maxRetries: 3 });
}
