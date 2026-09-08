import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NONCOMPLIANT_STATUSES, publicFinding } from "./matcher.mjs";

export const REPORT_JSON = "fds-token-migration-report.json";
export const REPORT_MARKDOWN = "fds-token-migration-report.md";

function countStatuses(findings) {
  return Object.fromEntries([...findings.reduce((counts, finding) => {
    counts.set(finding.status, (counts.get(finding.status) || 0) + 1);
    return counts;
  }, new Map()).entries()].sort(([a], [b]) => a.localeCompare(b)));
}

function relativePath(file, projectRoot) {
  return path.relative(projectRoot, path.resolve(file)).replaceAll("\\", "/") || ".";
}

export async function buildReport({ mode, catalogPath, catalogSource, catalog, projectRoot, configPath, targets, findings, parseErrors, unsupportedFiles, fileCount, applyBlocked }) {
  const catalogBytes = await readFile(catalogPath);
  return {
    schema: "fds-token-migration-report/v2",
    mode,
    generatedAt: new Date().toISOString(),
    catalog: {
      source: catalogSource,
      path: catalogSource === "bundled"
        ? "references/fds-token-catalog.jsonl"
        : relativePath(catalogPath, projectRoot),
      schema: catalog.schema,
      tokenCount: catalog.tokens.length,
      sha256: createHash("sha256").update(catalogBytes).digest("hex"),
    },
    project: {
      pathBase: "project-root",
      config: configPath ? relativePath(configPath, projectRoot) : null,
    },
    targets: targets.map((target) => relativePath(target, projectRoot)),
    applyBlocked,
    summary: {
      fileCount,
      occurrenceCount: findings.length,
      declarationCount: findings.length,
      parseErrorCount: parseErrors.length,
      unsupportedFileCount: unsupportedFiles.length,
      unsupportedNodeCount: findings.filter((finding) => finding.status === "unsupported").length,
      statusCounts: countStatuses(findings),
    },
    findings: findings.map((finding) => ({ ...publicFinding(finding), file: relativePath(finding.file, projectRoot) })),
    parseErrors: parseErrors.map((error) => ({ ...error, file: relativePath(error.file, projectRoot) })),
    unsupportedFiles: unsupportedFiles.map((file) => relativePath(file, projectRoot)),
  };
}

function escapeCell(value) {
  return String(value).replaceAll("|", "\\|").replace(/\r\n?|\n/g, " ");
}

function candidateSummary(finding) {
  return finding.candidates?.map((candidate) => {
    const suffix = candidate.distance === undefined ? "" : ` (distance=${candidate.distance})`;
    return `\`${candidate.cssVariable}\` = \`${candidate.resolvedValue}\`${suffix}`;
  }).join("<br>") || "-";
}

function findingTable(findings) {
  const lines = [
    "| 行 | 列 | 语法 / 容器 | 属性 | 原值 | 状态 | Token / 候选 | 原因 |",
    "| ---: | ---: | --- | --- | --- | --- | --- | --- |",
  ];
  for (const finding of findings) {
    lines.push(`| ${finding.line} | ${finding.column} | \`${escapeCell(finding.syntax)} / ${escapeCell(finding.container)}\` | \`${escapeCell(finding.property)}\` | \`${escapeCell(finding.originalValue)}\` | \`${finding.status}\` | ${candidateSummary(finding)} | ${escapeCell(finding.reason)} |`);
  }
  lines.push("");
  return lines;
}

function groupedFindingTables(findings) {
  if (!findings.length) return ["无。", ""];
  const byFile = new Map();
  for (const finding of findings) {
    const values = byFile.get(finding.file) || [];
    values.push(finding);
    byFile.set(finding.file, values);
  }
  return [...byFile.entries()].flatMap(([file, fileFindings]) => [
    `### \`${file}\``,
    "",
    ...findingTable(fileFindings),
  ]);
}

export function renderMarkdown(report) {
  const findings = report.findings;
  const noncompliant = findings.filter((item) => NONCOMPLIANT_STATUSES.has(item.status) && item.status !== "auto-replace");
  const lines = [
    "# FDS Token 迁移报告", "",
    `- 模式：\`${report.mode}\``,
    `- Catalog：\`${report.catalog.schema}\` / \`${report.catalog.sha256.slice(0, 12)}\``,
    `- 扫描文件：${report.summary.fileCount}`,
    `- 样式 occurrence：${report.summary.occurrenceCount}`,
    `- 解析错误：${report.summary.parseErrorCount}`,
    `- 不支持节点：${report.summary.unsupportedNodeCount}`,
    `- Apply 已阻止：${report.applyBlocked ? "是" : "否"}`, "",
    "## 已替换内容", "", ...groupedFindingTables(findings.filter((item) => item.status === "replaced")),
    "## 可自动替换", "", ...groupedFindingTables(findings.filter((item) => item.status === "auto-replace")),
    "## 不符合规范", "", ...groupedFindingTables(noncompliant),
    "## 相近 Token 推荐", "", ...groupedFindingTables(findings.filter((item) => item.status === "similar")),
    "## 需人工检查", "", ...groupedFindingTables(findings.filter((item) => item.status === "unsupported")),
    "## 状态统计", "", "| 状态 | 数量 |", "| --- | ---: |",
    ...Object.entries(report.summary.statusCounts).map(([status, count]) => `| \`${status}\` | ${count} |`),
    "", "## 解析与适配器边界", "",
  ];
  if (report.parseErrors.length) {
    lines.push(...report.parseErrors.map((error) => `- \`${error.file}:${error.line}:${error.column}\`：${error.message}`));
  } else {
    lines.push("- 未发现解析错误。");
  }
  if (report.unsupportedFiles.length) {
    lines.push("- 以下文件类型尚无适配器：", ...report.unsupportedFiles.map((file) => `  - \`${file}\``));
  } else {
    lines.push("- 输入范围内的文件类型均有适配器。");
  }
  lines.push("", "> 静态报告不能替代页面功能、视觉、主题和可访问性验证。", "");
  return lines.join("\n");
}

export async function writeReport(reportDir, report) {
  await mkdir(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, REPORT_JSON);
  const markdownPath = path.join(reportDir, REPORT_MARKDOWN);
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, renderMarkdown(report), "utf8");
  return [jsonPath, markdownPath];
}
