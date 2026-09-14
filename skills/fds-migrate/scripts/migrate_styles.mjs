#!/usr/bin/env node
import { createHash } from "node:crypto";
import { TextDecoder } from "node:util";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyOccurrence, compileLegacyColorIndex, compilePolicy, MigrationError, NONCOMPLIANT_STATUSES } from "./lib/matcher.mjs";
import { parseMarkup, parseVue } from "./lib/markup-adapter.mjs";
import { buildReport, writeReportSet } from "./lib/report.mjs";
import { parseScript } from "./lib/script-adapter.mjs";
import { parseStylesheet } from "./lib/stylesheet-adapter.mjs";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.dirname(SCRIPT_DIR);
const DEFAULT_POLICY = path.join(SKILL_ROOT, "references", "migration-policy.json");
const DEFAULT_CATALOG = path.join(SKILL_ROOT, "references", "fds-token-catalog.jsonl");
const DEFAULT_LEGACY_COLOR_INDEX = path.join(SKILL_ROOT, "references", "legacy-color-index.json");
const DEFAULT_CONFIG = path.join(".fdst", "migrate.json");
const DEFAULT_ENTRY = "src";
const DEFAULT_REPORT_ROOT = path.join(".fdst", "reports", "migrate");
const CONFIG_SCHEMA = "fds-migrate-config/v1";
const STYLESHEET_EXTENSIONS = new Set([".css", ".pcss", ".scss", ".sass", ".less", ".wxss"]);
const MARKUP_EXTENSIONS = new Set([".html", ".htm", ".wxml"]);
const SCRIPT_EXTENSIONS = new Set([".js", ".jsx", ".ts", ".tsx"]);
const SUPPORTED_EXTENSIONS = new Set([...STYLESHEET_EXTENSIONS, ...MARKUP_EXTENSIONS, ...SCRIPT_EXTENSIONS, ".vue"]);
const UNSUPPORTED_STYLE_EXTENSIONS = new Set([".styl", ".stylus", ".svelte"]);
const IGNORED_DIRECTORIES = new Set([".git", "node_modules", "dist", "build", "coverage"]);

function usage() {
  return "用法：node scripts/migrate_styles.mjs <scan|apply|verify> [目标...] [--project-root <项目根目录>] [--config <配置文件>] [--report-dir <目录>] [--include <glob>] [--exclude <glob>] [--context <场景>]";
}

function parseArguments(argv) {
  if (!argv.length || !["scan", "apply", "verify"].includes(argv[0])) throw new MigrationError(usage());
  const options = {
    mode: argv[0],
    targets: [],
    catalog: DEFAULT_CATALOG,
    policy: DEFAULT_POLICY,
    includes: [],
    excludes: [],
    contexts: [],
  };
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (["--catalog", "--report-dir", "--policy", "--include", "--exclude", "--context", "--project-root", "--config"].includes(argument)) {
      const value = argv[++index];
      if (!value) throw new MigrationError(`${argument} 缺少值`);
      if (argument === "--catalog") options.catalog = value;
      else if (argument === "--report-dir") options.reportDir = value;
      else if (argument === "--policy") options.policy = value;
      else if (argument === "--include") options.includes.push(value);
      else if (argument === "--exclude") options.excludes.push(value);
      else if (argument === "--context") options.contexts.push(value);
      else if (argument === "--project-root") options.projectRoot = value;
      else options.config = value;
    } else if (argument.startsWith("--")) {
      throw new MigrationError(`未知参数：${argument}`);
    } else {
      options.targets.push(argument);
    }
  }
  return options;
}

async function readJson(file, label) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    throw new MigrationError(`无法读取 ${label}：${file}: ${error.message}`);
  }
}

function validateStringList(value, field) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new MigrationError(`项目配置 ${field} 必须是非空字符串数组`);
  }
  return value;
}

async function resolveOptions(cliOptions) {
  const projectRoot = path.resolve(cliOptions.projectRoot || process.cwd());
  const configPath = path.resolve(projectRoot, cliOptions.config || DEFAULT_CONFIG);
  const configExists = Boolean(await stat(configPath).catch(() => null));
  if (cliOptions.config && !configExists) throw new MigrationError(`配置文件不存在：${configPath}`);
  const config = configExists ? await readJson(configPath, "项目配置") : {};
  if (configExists && config.schema !== CONFIG_SCHEMA) {
    throw new MigrationError(`项目配置 schema 必须是 ${CONFIG_SCHEMA}`);
  }
  const allowedFields = new Set(["schema", "entry", "reportRoot", "include", "exclude", "contexts"]);
  const unknownFields = Object.keys(config).filter((field) => !allowedFields.has(field));
  if (unknownFields.length) throw new MigrationError(`项目配置包含未知字段：${unknownFields.join(", ")}`);

  const configuredEntries = config.entry === undefined
    ? [DEFAULT_ENTRY]
    : Array.isArray(config.entry)
      ? (config.entry.length
        ? validateStringList(config.entry, "entry")
        : (() => { throw new MigrationError("项目配置 entry 不能为空数组"); })())
      : typeof config.entry === "string" && config.entry.trim()
        ? [config.entry]
        : (() => { throw new MigrationError("项目配置 entry 必须是非空字符串或字符串数组"); })();
  if (config.reportRoot !== undefined && (typeof config.reportRoot !== "string" || !config.reportRoot.trim())) {
    throw new MigrationError("项目配置 reportRoot 必须是非空字符串");
  }
  const resolveProjectPath = (value) => path.resolve(projectRoot, value);
  const targetInputs = cliOptions.targets.length ? cliOptions.targets : configuredEntries;
  return {
    ...cliOptions,
    projectRoot,
    configPath: configExists ? configPath : null,
    targets: targetInputs.map(resolveProjectPath),
    reportDir: cliOptions.reportDir
      ? resolveProjectPath(cliOptions.reportDir)
      : resolveProjectPath(path.join(config.reportRoot || DEFAULT_REPORT_ROOT, cliOptions.mode)),
    catalog: cliOptions.catalog === DEFAULT_CATALOG ? DEFAULT_CATALOG : resolveProjectPath(cliOptions.catalog),
    policy: cliOptions.policy === DEFAULT_POLICY ? DEFAULT_POLICY : resolveProjectPath(cliOptions.policy),
    includes: cliOptions.includes.length ? cliOptions.includes : validateStringList(config.include, "include"),
    excludes: cliOptions.excludes.length ? cliOptions.excludes : validateStringList(config.exclude, "exclude"),
    contexts: cliOptions.contexts.length ? cliOptions.contexts : validateStringList(config.contexts, "contexts"),
  };
}

async function readCatalog(file) {
  if (path.extname(file).toLowerCase() !== ".jsonl") return readJson(file, "Catalog");
  let text;
  try {
    text = await readFile(file, "utf8");
  } catch (error) {
    throw new MigrationError(`无法读取 Catalog：${file}: ${error.message}`);
  }
  const tokens = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    try {
      tokens.push(JSON.parse(line));
    } catch (error) {
      throw new MigrationError(`Catalog JSONL 第 ${index + 1} 行无效：${file}: ${error.message}`);
    }
  }
  return { schema: "fds-token-catalog/v1", tokens };
}

function validateCatalog(catalog) {
  if (!String(catalog.schema || "").startsWith("fds-token-catalog/") || !Array.isArray(catalog.tokens) || !catalog.tokens.length) {
    throw new MigrationError("Catalog schema 或 tokens 无效");
  }
  const required = ["name", "cssVariable", "layer", "tier", "category", "type", "resolvedValue"];
  catalog.tokens.forEach((token, index) => {
    if (!token || required.some((key) => !(key in token))) throw new MigrationError(`Catalog tokens[${index}] 缺少必要字段`);
  });
}

function globToRegex(pattern) {
  const normalized = pattern.replaceAll("\\", "/");
  let output = "^";
  for (let index = 0; index < normalized.length; index += 1) {
    const char = normalized[index];
    if (char === "*" && normalized[index + 1] === "*") {
      index += 1;
      output += normalized[index + 1] === "/" ? "(?:.*/)?" : ".*";
      if (normalized[index + 1] === "/") index += 1;
    } else if (char === "*") output += "[^/]*";
    else if (char === "?") output += "[^/]";
    else output += char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`${output}$`, "i");
}

async function discoverFiles(targets, includes, excludes, projectRoot) {
  const files = new Set();
  const unsupported = new Set();
  const includePatterns = includes.map(globToRegex);
  const excludePatterns = excludes.map(globToRegex);
  async function visit(current) {
    const info = await stat(current).catch(() => null);
    if (!info) throw new MigrationError(`目标不存在：${current}`);
    if (info.isDirectory()) {
      for (const entry of await readdir(current, { withFileTypes: true })) {
        if (entry.isDirectory() && IGNORED_DIRECTORIES.has(entry.name)) continue;
        await visit(path.join(current, entry.name));
      }
      return;
    }
    if (!info.isFile()) return;
    const extension = path.extname(current).toLowerCase();
    const relative = path.relative(projectRoot, current).replaceAll("\\", "/") || path.basename(current);
    if (excludePatterns.some((pattern) => pattern.test(relative))) return;
    if (includePatterns.length && !includePatterns.some((pattern) => pattern.test(relative))) return;
    if (SUPPORTED_EXTENSIONS.has(extension)) files.add(path.resolve(current));
    else if (UNSUPPORTED_STYLE_EXTENSIONS.has(extension)) unsupported.add(path.resolve(current));
    else if (targets.some((target) => path.resolve(current) === path.resolve(target))) throw new MigrationError(`不支持的目标文件：${current}`);
  }
  for (const target of targets) await visit(path.resolve(target));
  return { files: [...files].sort(), unsupported: [...unsupported].sort() };
}

function reportUnitNames(targets) {
  const used = new Map();
  return targets.map((target, index) => {
    const rawName = path.basename(target, path.extname(target));
    const baseName = rawName.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || `component-${index + 1}`;
    const count = (used.get(baseName) || 0) + 1;
    used.set(baseName, count);
    return count === 1 ? baseName : `${baseName}-${count}`;
  });
}

function assertIndependentTargets(targets) {
  const normalized = targets.map((target) => path.resolve(target));
  for (let first = 0; first < normalized.length; first += 1) {
    for (let second = first + 1; second < normalized.length; second += 1) {
      const relative = path.relative(normalized[first], normalized[second]);
      const reverse = path.relative(normalized[second], normalized[first]);
      if (!relative || (!relative.startsWith("..") && !path.isAbsolute(relative)) || (!reverse.startsWith("..") && !path.isAbsolute(reverse))) {
        throw new MigrationError(`组件入口不能重复或互相包含：${targets[first]} / ${targets[second]}`);
      }
    }
  }
}

async function readSource(file) {
  const bytes = await readFile(file);
  const hasBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(hasBom ? bytes.subarray(3) : bytes);
    return { file, text, hasBom, digest: createHash("sha256").update(bytes).digest("hex") };
  } catch (error) {
    throw new MigrationError(`源码必须是 UTF-8：${file}: ${error.message}`);
  }
}

function parseSource(source) {
  const extension = path.extname(source.file).toLowerCase();
  const file = source.file.replaceAll("\\", "/");
  if (STYLESHEET_EXTENSIONS.has(extension)) {
    return parseStylesheet({ text: source.text, file, syntax: extension.slice(1), container: "stylesheet" });
  }
  if (MARKUP_EXTENSIONS.has(extension)) {
    return parseMarkup({ text: source.text, file, syntax: extension === ".wxml" ? "wxml" : "html" });
  }
  if (SCRIPT_EXTENSIONS.has(extension)) return parseScript({ text: source.text, file, extension });
  if (extension === ".vue") return parseVue({ text: source.text, file });
  throw new MigrationError(`缺少语法适配器：${source.file}`);
}

function attachStyleContext(occurrences) {
  const groups = new Map();
  for (const occurrence of occurrences) {
    if (!occurrence._styleGroup) continue;
    const properties = groups.get(occurrence._styleGroup) || new Map();
    properties.set(occurrence.property.toLowerCase(), occurrence.originalValue);
    groups.set(occurrence._styleGroup, properties);
  }
  for (const occurrence of occurrences) {
    occurrence._contextProperties = groups.get(occurrence._styleGroup) || new Map();
  }
}

async function applyReplacements(findings, sources) {
  const byFile = new Map();
  for (const finding of findings.filter((item) => item.status === "auto-replace")) {
    const values = byFile.get(finding.file) || [];
    values.push(finding);
    byFile.set(finding.file, values);
  }
  for (const [file, fileFindings] of byFile) {
    const source = sources.get(file);
    const current = await readFile(source.file);
    if (createHash("sha256").update(current).digest("hex") !== source.digest) {
      throw new MigrationError(`应用前文件已变化，停止写入：${source.file}`);
    }
    for (const finding of fileFindings) {
      const [start, end] = finding._span;
      if (source.text.slice(start, end) !== finding.originalValue) {
        throw new MigrationError(`源码位置校验失败，停止写入：${source.file}:${finding.line}`);
      }
    }
  }
  for (const [file, fileFindings] of byFile) {
    const source = sources.get(file);
    let text = source.text;
    for (const finding of fileFindings.sort((a, b) => b._span[0] - a._span[0])) {
      const [start, end] = finding._span;
      text = text.slice(0, start) + finding.replacement + text.slice(end);
      finding.status = "replaced";
      finding.reason = finding.selectedToken?.match === "legacy-index"
        ? "已按旧色板索引映射，并保留原始值 fallback"
        : finding.selectedToken?.match?.includes("nearest") || finding.selectedToken?.match === "relative"
        ? `已就近替换为 ${finding.selectedToken.cssVariable}（${finding.selectedToken.resolvedValue}），并保留原始值 fallback`
        : "已替换为唯一精确候选，并保留原始值 fallback";
    }
    const encoded = Buffer.from(text, "utf8");
    await writeFile(source.file, source.hasBom ? Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), encoded]) : encoded);
  }
}

async function main() {
  const options = await resolveOptions(parseArguments(process.argv.slice(2)));
  const catalogPath = path.resolve(options.catalog);
  const catalog = await readCatalog(catalogPath);
  validateCatalog(catalog);
  const policy = compilePolicy(await readJson(path.resolve(options.policy), "迁移策略"));
  const legacyColorIndex = compileLegacyColorIndex(await readJson(DEFAULT_LEGACY_COLOR_INDEX, "旧色板索引"));
  assertIndependentTargets(options.targets);
  const unitNames = reportUnitNames(options.targets);
  const units = [];
  const sources = new Map();
  for (const [index, target] of options.targets.entries()) {
    const { files, unsupported } = await discoverFiles([target], options.includes, options.excludes, options.projectRoot);
    const occurrences = [];
    const parseErrors = [];
    for (const file of files) {
      const source = await readSource(file);
      const result = parseSource(source);
      sources.set(file.replaceAll("\\", "/"), source);
      parseErrors.push(...result.parseErrors);
      occurrences.push(...result.occurrences);
    }
    attachStyleContext(occurrences);
    const componentVariables = new Set(occurrences
      .map((occurrence) => occurrence.property)
      .filter((property) => property.startsWith("--")));
    const findings = occurrences.map((occurrence) => classifyOccurrence(
      occurrence,
      catalog.tokens,
      policy,
      legacyColorIndex,
      options.contexts,
      componentVariables,
    ));
    findings.sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line || a.column - b.column);
    units.push({ name: unitNames[index], target, files, unsupported, findings, parseErrors });
  }
  const findings = units.flatMap((unit) => unit.findings);
  const parseErrors = units.flatMap((unit) => unit.parseErrors);
  const unsupported = units.flatMap((unit) => unit.unsupported);
  const applyBlocked = options.mode === "apply" && parseErrors.length > 0;
  if (options.mode === "apply" && !applyBlocked) await applyReplacements(findings, sources);
  const reports = await Promise.all(units.map(async (unit) => ({
    name: unit.name,
    report: await buildReport({
      mode: options.mode,
      catalogPath,
      catalogSource: catalogPath === path.resolve(DEFAULT_CATALOG) ? "bundled" : "override",
      catalog,
      legacyColorIndexPath: DEFAULT_LEGACY_COLOR_INDEX,
      legacyColorIndex,
      projectRoot: options.projectRoot,
      configPath: options.configPath,
      targets: [unit.target],
      findings: unit.findings,
      parseErrors: unit.parseErrors,
      unsupportedFiles: unit.unsupported,
      fileCount: unit.files.length,
      applyBlocked,
    }),
  })));
  const [jsonPath, htmlPath, summary] = await writeReportSet(options.reportDir, reports);
  const displayPath = (file) => path.relative(options.projectRoot, file).replaceAll("\\", "/") || ".";
  console.log(`FDS Token 迁移 ${options.mode} 完成：${reports.length} 个组件，${summary.fileCount} 个文件，${summary.occurrenceCount} 个样式 occurrence，状态 ${JSON.stringify(summary.statusCounts)}`);
  console.log(`报告索引 JSON：${displayPath(jsonPath)}`);
  console.log(`报告索引 HTML：${displayPath(htmlPath)}`);
  if (applyBlocked) {
    console.error("存在解析错误；为避免部分迁移，apply 未写入任何源码");
    return 1;
  }
  if (options.mode === "verify" && (unsupported.length || parseErrors.length || findings.some((finding) => NONCOMPLIANT_STATUSES.has(finding.status) || finding.status === "unsupported"))) return 3;
  return 0;
}

try {
  process.exitCode = await main();
} catch (error) {
  console.error(`FDS Token 迁移失败：${error.message}`);
  process.exitCode = 1;
}
