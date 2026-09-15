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
    ...(options.comment ? { comment: options.comment } : {}),
  };
}

export const CATALOG = {
  schema: "fds-token-catalog/v1",
  tokens: [
    token("color-danger", "--fds-g-color-danger", "#FF522A"),
    token("border-error", "--fds-g-border-error", "#FF522A"),
    token("color-red-6", "--fds-g-color-red-6", "#FF8569", { layer: "atomic", tier: "map" }),
    token("color-brand-3", "--fds-g-color-brand-3", "#FFCAAD", { layer: "atomic", tier: "map" }),
    token("color-blue-6", "--fds-g-color-blue-6", "#64B5FF", { layer: "atomic", tier: "map" }),
    token("background-container", "--fds-g-background-container", "#FFFFFF", { category: "layout" }),
    token("background-elevated", "--fds-g-background-elevated", "#FFFFFF", { category: "layout" }),
    token("spacing-4", "--fds-g-spacing-4", "16px", { layer: "atomic", tier: "map", category: "spacing", type: "dimension" }),
    token("card-padding", "--fds-s-card-padding", "16px", { tier: "scene", category: "scene", type: "dimension" }),
    token("radius-2", "--fds-g-radius-2", "4px", { layer: "atomic", tier: "map", category: "shape", type: "dimension" }),
    token("radius-4", "--fds-g-radius-4", "8px", { layer: "atomic", tier: "map", category: "shape", type: "dimension" }),
    token("radius-5", "--fds-g-radius-5", "12px", { layer: "atomic", tier: "map", category: "shape", type: "dimension" }),
    token("radius-7", "--fds-g-radius-7", "20px", { layer: "atomic", tier: "map", category: "shape", type: "dimension" }),
    token("card-radius", "--fds-s-card-radius", "4px", { tier: "scene", category: "scene", type: "dimension" }),
    token("font-size-1", "--fds-g-font-size-1", "12px", { layer: "atomic", tier: "map", category: "typography", type: "dimension" }),
    token("font-size-5", "--fds-g-font-size-5", "16px", { layer: "atomic", tier: "map", category: "typography", type: "dimension" }),
    token("font-size-6", "--fds-g-font-size-6", "18px", { layer: "atomic", tier: "map", category: "typography", type: "dimension" }),
    token("font-size-14", "--fds-g-font-size-14", "48px", { layer: "atomic", tier: "map", category: "typography", type: "dimension" }),
    token("line-height-5", "--fds-g-line-height-5", "24px", { layer: "atomic", tier: "map", category: "typography", type: "dimension" }),
    token("opacity-25", "--fds-g-opacity-25", "0.25", { layer: "atomic", tier: "map", category: "effects", type: "number", comment: "较强弱化档" }),
    token("opacity-50", "--fds-g-opacity-50", "0.5", { layer: "atomic", tier: "map", category: "effects", type: "number", comment: "半透明档" }),
    token("opacity-65", "--fds-g-opacity-65", "0.65", { layer: "atomic", tier: "map", category: "effects", type: "number", comment: "加载弱化档" }),
    token("opacity-80", "--fds-g-opacity-80", "0.8", { layer: "atomic", tier: "map", category: "effects", type: "number", comment: "轻度弱化档" }),
    token("line-height-ratio-3", "--fds-g-line-height-ratio-3", "1.2", { layer: "atomic", tier: "map", category: "typography", type: "number" }),
    token("line-height-ratio-5", "--fds-g-line-height-ratio-5", "1.4", { layer: "atomic", tier: "map", category: "typography", type: "number" }),
    token("line-height-ratio-6", "--fds-g-line-height-ratio-6", "1.5", { layer: "atomic", tier: "map", category: "typography", type: "number" }),
    token("line-height-ratio-7", "--fds-g-line-height-ratio-7", "1.6", { layer: "atomic", tier: "map", category: "typography", type: "number" }),
    token("line-height-ratio-9", "--fds-g-line-height-ratio-9", "1.8", { layer: "atomic", tier: "map", category: "typography", type: "number" }),
    token("density-compact-line-height", "--fds-s-density-compact-line-height", "1.2", { tier: "scene", category: "scene", type: "number", comment: "紧凑密度" }),
    token("density-comfortable-line-height", "--fds-s-density-comfortable-line-height", "1.5", { tier: "scene", category: "scene", type: "number", comment: "舒适密度" }),
    token("density-spacious-line-height", "--fds-s-density-spacious-line-height", "1.8", { tier: "scene", category: "scene", type: "number", comment: "宽松密度" }),
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
  const direct = path.join(reportDir, "fds-token-migration-report.json");
  try {
    return JSON.parse(await readFile(direct, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const index = JSON.parse(await readFile(path.join(reportDir, "fds-token-migration-index.json"), "utf8"));
  if (index.components.length !== 1) throw new Error("readReport 仅支持单组件报告");
  return JSON.parse(await readFile(path.join(reportDir, index.components[0].jsonReport), "utf8"));
}
