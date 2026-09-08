import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const SCRIPT = path.join(SKILL_ROOT, "scripts", "migrate_styles.mjs");

function token(name, cssVariable, resolvedValue, options = {}) {
  return {
    name,
    cssVariable,
    resolvedValue,
    layer: options.layer || "semantic",
    tier: options.tier || "base",
    category: options.category || "color",
    type: options.type || "color",
  };
}

export const CATALOG = {
  schema: "fds-token-catalog/v1",
  tokens: [
    token("color-danger", "--fds-g-color-danger", "#FF522A"),
    token("border-error", "--fds-g-border-error", "#FF522A"),
    token("background-container", "--fds-g-background-container", "#FFFFFF", { category: "layout" }),
    token("background-elevated", "--fds-g-background-elevated", "#FFFFFF", { category: "layout" }),
    token("spacing-4", "--fds-g-spacing-4", "16px", { layer: "atomic", tier: "map", category: "spacing", type: "dimension" }),
    token("card-padding", "--fds-s-card-padding", "16px", { tier: "scene", category: "scene", type: "dimension" }),
    token("icon-size-1", "--fds-g-icon-size-1", "16px", { layer: "atomic", tier: "map", category: "sizing", type: "dimension" }),
    token("control-height-default", "--fds-g-control-height-default", "16px", { category: "layout", type: "dimension" }),
    token("radius-2", "--fds-g-radius-2", "4px", { layer: "atomic", tier: "map", category: "shape", type: "dimension" }),
    token("control-radius", "--fds-g-control-radius", "4px", { category: "layout", type: "dimension" }),
  ],
};

export async function fixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "fds-token-migrate-"));
  const catalog = path.join(root, "catalog.json");
  const reportDir = path.join(root, "report");
  await writeFile(catalog, JSON.stringify(CATALOG), "utf8");
  const paths = {};
  for (const [name, content] of Object.entries(files)) {
    const file = path.join(root, name);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content, "utf8");
    paths[name] = file;
  }
  return { root, catalog, reportDir, paths };
}

export function runTool(mode, target, catalog, reportDir, ...extra) {
  return spawnSync(process.execPath, [SCRIPT, mode, target, "--catalog", catalog, "--report-dir", reportDir, ...extra], {
    cwd: SKILL_ROOT,
    encoding: "utf8",
  });
}

export function runBundledTool(mode, target, reportDir, ...extra) {
  return spawnSync(process.execPath, [SCRIPT, mode, target, "--report-dir", reportDir, ...extra], {
    cwd: SKILL_ROOT,
    encoding: "utf8",
  });
}

export function runProjectTool(mode, projectRoot, ...extra) {
  return spawnSync(process.execPath, [SCRIPT, mode, ...extra], {
    cwd: projectRoot,
    encoding: "utf8",
  });
}

export async function readReport(reportDir) {
  return JSON.parse(await readFile(path.join(reportDir, "fds-token-migration-report.json"), "utf8"));
}
