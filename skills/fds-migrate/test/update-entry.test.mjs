import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

for (const exit of [0, 7]) {
  test(`更新${exit ? '失败不运行旧引擎' : '成功后保持调用方目录与参数，每次调用均更新'}`, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "fds-update-entry-"));
    try {
      const skill = path.join(root, "skill");
      const caller = path.join(root, "caller");
      const fakeBin = path.join(root, "bin");
      for (const dir of [caller, fakeBin, path.join(skill, "scripts"), path.join(skill, "node_modules/@sharecrm/sds-linter/bin")]) await mkdir(dir, { recursive: true });
      await copyFile(new URL("../scripts/migrate_styles.mjs", import.meta.url), path.join(skill, "scripts/migrate_styles.mjs"));
      const log = path.join(root, "events.jsonl");
      await writeFile(path.join(fakeBin, "fake-npm.cjs"), `require('fs').appendFileSync(${JSON.stringify(log)}, JSON.stringify({step:'update',cwd:process.cwd(),args:process.argv.slice(2)})+'\\n');process.exit(${exit});`);
      const npm = path.join(fakeBin, process.platform === "win32" ? "npm.cmd" : "npm");
      await writeFile(npm, process.platform === "win32" ? `@"${process.execPath}" "%~dp0fake-npm.cjs" %*\r\n` : `#!/bin/sh\n"${process.execPath}" "${fakeBin}/fake-npm.cjs" "$@"\n`, { mode: 0o755 });
      await writeFile(path.join(skill, "node_modules/@sharecrm/sds-linter/bin/sds-linter.mjs"), `import fs from 'node:fs';fs.appendFileSync(${JSON.stringify(log)},JSON.stringify({step:'engine',cwd:process.cwd(),args:process.argv.slice(2)})+'\\n');`);
      const env = { ...process.env };
      const pathKey = Object.keys(env).find(k => k.toLowerCase() === "path") || "PATH";
      env[pathKey] = fakeBin + path.delimiter + env[pathKey];
      for (let i = 0; i < 2; i++) {
        const result = spawnSync(process.execPath, [path.join(skill, "scripts/migrate_styles.mjs"), "verify", "src"], { cwd: caller, env, encoding: "utf8" });
        assert.equal(result.status, exit ? 1 : 0, result.stderr);
        if (exit) assert.match(result.stderr, /更新失败，未执行迁移命令/);
      }
      const events = (await readFile(log, "utf8")).trim().split('\n').map(JSON.parse);
      assert.deepEqual(events.map(e => e.step), exit ? ['update', 'update'] : ['update', 'engine', 'update', 'engine']);
      for (const event of events) {
        assert.equal(event.cwd, event.step === 'update' ? skill : caller);
        if (event.step === 'update') {
          assert.ok(event.args.includes('@sharecrm/sds-linter@latest'));
          assert.ok(event.args.includes('--registry=https://registry-npm.firstshare.cn/'));
          assert.ok(event.args.includes('--ignore-scripts'));
        } else assert.deepEqual(event.args, ['verify', 'src']);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
