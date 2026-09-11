#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
SKILL_DIR="$ROOT_DIR/skills/fds-migrate"

for file in \
    "$SKILL_DIR/SKILL.md" \
    "$SKILL_DIR/agents/openai.yaml" \
    "$SKILL_DIR/package.json" \
    "$SKILL_DIR/package-lock.json" \
    "$SKILL_DIR/scripts/migrate_styles.mjs" \
    "$SKILL_DIR/references/fds-token-catalog.jsonl" \
    "$SKILL_DIR/references/legacy-color-index.json" \
    "$SKILL_DIR/references/migration-policy.json" \
    "$SKILL_DIR/references/matching-policy.md" \
    "$SKILL_DIR/references/configuration.md" \
    "$SKILL_DIR/references/report-schema.md" \
    "$SKILL_DIR/references/syntax-support.md"
do
    [[ -f "$file" ]] || { echo "Missing required Skill file: $file" >&2; exit 1; }
done

if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    echo "Node.js 16+ and npm are required" >&2
    exit 1
fi

node -e 'const major = Number(process.versions.node.split(".")[0]); if (major < 16) { throw new Error("Node.js 16+ is required") }'

node - "$SKILL_DIR" <<'JS'
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[2];
const skill = fs.readFileSync(path.join(root, "SKILL.md"), "utf8");
const frontmatter = skill.match(/^---\n([\s\S]*?)\n---\n/);
if (!frontmatter) throw new Error("SKILL.md 缺少 YAML frontmatter");
if (!frontmatter[0].includes("name: fds-migrate")) throw new Error("Skill name 不正确");
if (/TODO|EXAMPLE/.test(skill)) throw new Error("SKILL.md 包含占位内容");
for (const term of ["scan", "apply", "verify", "auto-replace", "ambiguous", "similar", "unsupported", "fallback", ".fdst/migrate.json", "components/<组件名>", ".wxss", ".wxml"]) {
  if (!skill.includes(term)) throw new Error(`SKILL.md 缺少关键契约：${term}`);
}
const configuration = fs.readFileSync(path.join(root, "references", "configuration.md"), "utf8");
for (const term of ["fds-migrate-config/v1", "src", "reportRoot", "include", "exclude", "contexts", "fds-token-migration-index.json", "fds-token-migration-index.html"]) {
  if (!configuration.includes(term)) throw new Error(`项目配置文档缺少关键契约：${term}`);
}
const policy = JSON.parse(fs.readFileSync(path.join(root, "references", "migration-policy.json"), "utf8"));
if (policy.schema !== "fds-token-migration-policy/v1" || !policy.rules?.length) throw new Error("迁移策略无效");
const legacyColorIndex = JSON.parse(fs.readFileSync(path.join(root, "references", "legacy-color-index.json"), "utf8"));
if (legacyColorIndex.schema !== "fds-legacy-color-index/v2") throw new Error("旧色板索引 schema 无效");
if (Object.keys(legacyColorIndex.familyMappings || {}).length !== 11) throw new Error("旧色板色系映射必须为 11 套");
if (Object.keys(legacyColorIndex.scales || {}).length !== 2) throw new Error("旧色板独立尺度必须包含 Gray 和 Special");
for (const [family, palette] of Object.entries(legacyColorIndex.palettes || {})) {
  if (!Array.isArray(palette) || palette.length !== 11) throw new Error(`旧色板 ${family} 必须包含 11 阶`);
}
const tokenLines = fs.readFileSync(path.join(root, "references", "fds-token-catalog.jsonl"), "utf8").trim().split(/\r?\n/);
if (!tokenLines.length) throw new Error("Skill 内置 Token 快照为空");
const tokenVariables = new Set();
for (const [index, line] of tokenLines.entries()) {
  const token = JSON.parse(line);
  for (const field of ["name", "cssVariable", "layer", "tier", "category", "type", "value", "resolvedValue", "referenceChain", "sourceFile"]) {
    if (!(field in token)) throw new Error(`Token 第 ${index + 1} 行缺少字段：${field}`);
  }
  tokenVariables.add(token.cssVariable);
}
for (const [legacyFamily, currentFamily] of Object.entries(legacyColorIndex.familyMappings)) {
  for (let legacyIndex = 0; legacyIndex <= 10; legacyIndex += 1) {
    const target = `--fds-g-color-${currentFamily}-${legacyIndex}`;
    if (!tokenVariables.has(target)) throw new Error(`旧色板 ${legacyFamily}${String(legacyIndex).padStart(2, "0")} 缺少目标：${target}`);
  }
}
let recordCount = Object.keys(legacyColorIndex.familyMappings).length * 11;
for (const [legacyFamily, scale] of Object.entries(legacyColorIndex.scales)) {
  if (!Number.isInteger(scale.legacyStart) || !Number.isInteger(scale.currentStart) || !scale.currentFamily || !Array.isArray(scale.values) || !scale.values.length) {
    throw new Error(`旧色板 ${legacyFamily} 的独立尺度无效`);
  }
  scale.values.forEach((_, offset) => {
    const target = `--fds-g-color-${scale.currentFamily}-${scale.currentStart + offset}`;
    if (!tokenVariables.has(target)) throw new Error(`旧色板 ${legacyFamily} 缺少目标：${target}`);
  });
  recordCount += scale.values.length;
}
if (recordCount !== 144) throw new Error(`旧色板记录数应为 144，实际 ${recordCount}`);
JS

npm --prefix "$SKILL_DIR" ci --ignore-scripts --no-audit --no-fund
npm --prefix "$SKILL_DIR" test
echo 'fds-migrate Skill contract passed'
