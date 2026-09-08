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
    "$SKILL_DIR/references/migration-policy.json" \
    "$SKILL_DIR/references/matching-policy.md" \
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
for (const term of ["scan", "apply", "verify", "auto-replace", "ambiguous", "similar", "unsupported", "fallback"]) {
  if (!skill.includes(term)) throw new Error(`SKILL.md 缺少关键契约：${term}`);
}
const policy = JSON.parse(fs.readFileSync(path.join(root, "references", "migration-policy.json"), "utf8"));
if (policy.schema !== "fds-token-migration-policy/v1" || !policy.rules?.length) throw new Error("迁移策略无效");
const tokenLines = fs.readFileSync(path.join(root, "references", "fds-token-catalog.jsonl"), "utf8").trim().split(/\r?\n/);
if (!tokenLines.length) throw new Error("Skill 内置 Token 快照为空");
for (const [index, line] of tokenLines.entries()) {
  const token = JSON.parse(line);
  for (const field of ["name", "cssVariable", "layer", "tier", "category", "type", "value", "resolvedValue", "referenceChain", "sourceFile"]) {
    if (!(field in token)) throw new Error(`Token 第 ${index + 1} 行缺少字段：${field}`);
  }
}
JS

npm --prefix "$SKILL_DIR" ci --ignore-scripts --no-audit --no-fund
npm --prefix "$SKILL_DIR" test
echo 'fds-migrate Skill contract passed'
