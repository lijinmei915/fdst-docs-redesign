import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { NONCOMPLIANT_STATUSES, publicFinding } from "./matcher.mjs";

export const REPORT_JSON = "fds-token-migration-report.json";
export const REPORT_HTML = "fds-token-migration-report.html";
export const INDEX_JSON = "fds-token-migration-index.json";
export const INDEX_HTML = "fds-token-migration-index.html";

const LEGACY_REPORT_MARKDOWN = "fds-token-migration-report.md";
const LEGACY_INDEX_MARKDOWN = "fds-token-migration-index.md";

const STATUS_LABELS = {
  "auto-replace": "可自动替换",
  replaced: "已替换",
  ambiguous: "存在歧义",
  similar: "相近推荐",
  "missing-token": "缺少 Token",
  "invalid-token": "无效 Token",
  compliant: "符合规范",
  "priority-protected": "变量优先级",
  unsupported: "人工检查",
  exempt: "不适用",
};

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

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
    .replace(/\r\n?|\n/g, " ");
}

function jsonForHtmlScript(value) {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function statusLabel(status) {
  return STATUS_LABELS[status] || status;
}

function statusBadge(status, count) {
  const suffix = count === undefined ? "" : `<strong>${count}</strong>`;
  return `<span class="status status-${escapeHtml(status)}"><span>${escapeHtml(statusLabel(status))}</span>${suffix}</span>`;
}

const PAGE_STYLES = `
:root {
  color-scheme: light;
  --canvas: #f4f6f8;
  --surface: #ffffff;
  --surface-muted: #f8fafb;
  --ink: #182026;
  --ink-muted: #5f6b76;
  --line: #d8dee4;
  --line-strong: #bdc7d0;
  --accent: #d9480f;
  --accent-soft: #fff1e8;
  --success: #16794c;
  --success-soft: #eaf7f0;
  --warning: #9a6700;
  --warning-soft: #fff7d6;
  --danger: #c9362b;
  --danger-soft: #fff0ee;
  --info: #1769aa;
  --info-soft: #edf6ff;
  --teal: #0f766e;
  --teal-soft: #e8f7f5;
  --manual: #7253a6;
  --manual-soft: #f4effb;
  font-family: Inter, "Segoe UI", "Microsoft YaHei", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  letter-spacing: 0;
}
* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; color: var(--ink); background: var(--canvas); }
a { color: var(--info); text-decoration: none; }
a:hover { text-decoration: underline; }
code { font-family: "Cascadia Code", Consolas, monospace; font-size: 12px; overflow-wrap: anywhere; }
.topbar { background: #20272c; color: #fff; }
.topbar-inner { width: min(1440px, calc(100% - 40px)); min-height: 52px; margin: 0 auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.brand { display: flex; align-items: center; gap: 10px; font-size: 14px; font-weight: 700; }
.brand-mark { width: 26px; height: 26px; display: grid; place-items: center; border-radius: 5px; background: var(--accent); color: #fff; font-size: 12px; }
.topbar a { color: #fff; font-size: 13px; }
main { width: min(1440px, calc(100% - 40px)); margin: 0 auto; padding: 30px 0 56px; }
.report-heading { padding: 0 0 24px; border-bottom: 1px solid var(--line); }
.eyebrow { margin: 0 0 6px; color: var(--accent); font-size: 12px; font-weight: 700; text-transform: uppercase; }
h1 { margin: 0; font-size: 28px; line-height: 1.3; letter-spacing: 0; }
.target { margin: 8px 0 0; color: var(--ink-muted); overflow-wrap: anywhere; }
.meta { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 8px; }
.meta-item { padding: 4px 8px; border: 1px solid var(--line); border-radius: 4px; background: var(--surface); color: var(--ink-muted); font-size: 12px; }
.metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin: 20px 0; }
.metric { min-height: 82px; padding: 14px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
.metric-value { display: block; font-size: 24px; font-weight: 700; line-height: 1.2; }
.metric-label { display: block; margin-top: 6px; color: var(--ink-muted); font-size: 12px; }
.status-strip { display: flex; flex-wrap: wrap; gap: 8px; margin: 0 0 24px; }
.status { display: inline-flex; align-items: center; gap: 7px; min-height: 28px; padding: 3px 9px; border: 1px solid var(--line); border-radius: 999px; background: var(--surface-muted); color: var(--ink-muted); font-size: 12px; white-space: nowrap; }
.status strong { color: inherit; font-size: 13px; }
.status-replaced, .status-compliant { border-color: #a9d8bf; background: var(--success-soft); color: var(--success); }
.status-priority-protected { border-color: #b6d8f2; background: var(--info-soft); color: var(--info); }
.status-auto-replace { border-color: #b6d8f2; background: var(--info-soft); color: var(--info); }
.status-ambiguous { border-color: #ead38a; background: var(--warning-soft); color: var(--warning); }
.status-similar { border-color: #9edbd5; background: var(--teal-soft); color: var(--teal); }
.status-missing-token, .status-invalid-token { border-color: #efb7b1; background: var(--danger-soft); color: var(--danger); }
.status-unsupported { border-color: #d1c2e8; background: var(--manual-soft); color: var(--manual); }
.section-nav { position: sticky; top: 0; z-index: 5; display: flex; gap: 4px; overflow-x: auto; margin: 0 -8px 24px; padding: 8px; border-bottom: 1px solid var(--line); background: rgba(244, 246, 248, 0.96); }
.section-nav a { flex: 0 0 auto; padding: 7px 10px; border-radius: 4px; color: var(--ink-muted); font-size: 13px; font-weight: 600; }
.section-nav a:hover { background: var(--surface); color: var(--ink); text-decoration: none; }
.report-section { scroll-margin-top: 60px; margin: 34px 0 0; }
.section-title { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin: 0 0 12px; }
.section-title h2 { margin: 0; font-size: 19px; letter-spacing: 0; }
.count { color: var(--ink-muted); font-size: 13px; }
.filter-bar { display: inline-flex; flex-wrap: wrap; gap: 3px; margin: 0 0 12px; padding: 3px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
.filter-button { min-height: 32px; padding: 5px 10px; border: 0; border-radius: 4px; background: transparent; color: var(--ink-muted); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer; }
.filter-button:hover { background: var(--surface-muted); color: var(--ink); }
.filter-button[aria-pressed="true"] { background: #20272c; color: #fff; }
.filter-button:disabled { color: #9aa4ad; cursor: default; }
.filter-button:disabled:hover { background: transparent; }
[hidden] { display: none !important; }
.empty { padding: 18px; border: 1px dashed var(--line-strong); border-radius: 6px; color: var(--ink-muted); background: var(--surface-muted); }
.file-group { margin: 10px 0; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); overflow: hidden; }
.file-group > summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; cursor: pointer; background: var(--surface-muted); font-size: 13px; font-weight: 600; list-style: none; }
.file-group > summary::-webkit-details-marker { display: none; }
.file-group > summary::before { content: "+"; flex: 0 0 18px; color: var(--ink-muted); font-size: 18px; font-weight: 400; }
.file-group[open] > summary::before { content: "-"; }
.file-path { flex: 1; overflow-wrap: anywhere; }
.file-count { color: var(--ink-muted); font-size: 12px; font-weight: 400; white-space: nowrap; }
.table-wrap { width: 100%; overflow-x: auto; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { padding: 9px 10px; border-bottom: 1px solid var(--line-strong); background: #fbfcfd; color: var(--ink-muted); font-size: 11px; font-weight: 700; text-align: left; }
td { padding: 10px; border-bottom: 1px solid #e9edf0; vertical-align: top; font-size: 12px; overflow-wrap: anywhere; }
tbody tr:last-child td { border-bottom: 0; }
tbody tr:hover { background: #fffdfb; }
.col-position { width: 72px; }
.col-context { width: 17%; }
.col-property { width: 10%; }
.col-value { width: 12%; }
.col-status { width: 108px; }
.col-token { width: 25%; }
.position { color: var(--ink-muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.context { color: var(--ink-muted); }
.token-list { display: grid; gap: 6px; }
.token { padding-left: 8px; border-left: 2px solid var(--line-strong); }
.token-value { display: block; margin-top: 2px; color: var(--ink-muted); }
.reason { color: #39434c; }
.finding-row { cursor: pointer; }
.finding-row:focus-within { outline: 2px solid var(--info); outline-offset: -2px; }
.finding-row.is-active { background: var(--accent-soft); }
.col-action { width: 104px; }
.prompt-trigger, .prompt-copy, .prompt-nav-button, .prompt-close { border: 1px solid var(--line-strong); border-radius: 4px; background: var(--surface); color: var(--ink); font: inherit; font-weight: 600; cursor: pointer; }
.prompt-trigger { min-height: 30px; padding: 4px 9px; font-size: 12px; white-space: nowrap; }
.prompt-trigger:hover, .prompt-nav-button:hover, .prompt-close:hover { border-color: var(--accent); color: var(--accent); }
.prompt-backdrop { position: fixed; inset: 0; z-index: 20; background: rgba(24, 32, 38, 0.34); }
.prompt-drawer { position: fixed; top: 0; right: 0; z-index: 21; width: min(560px, calc(100% - 40px)); height: 100dvh; display: grid; grid-template-rows: auto minmax(0, 1fr) auto; border-left: 1px solid var(--line); background: var(--surface); box-shadow: -10px 0 30px rgba(24, 32, 38, 0.16); }
.prompt-drawer-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; padding: 18px 20px; border-bottom: 1px solid var(--line); }
.prompt-drawer-title { margin: 0; font-size: 18px; line-height: 1.4; }
.prompt-drawer-id { display: block; margin-top: 4px; color: var(--ink-muted); font-size: 11px; font-family: "Cascadia Code", Consolas, monospace; }
.prompt-close { flex: 0 0 32px; width: 32px; height: 32px; padding: 0; font-size: 20px; line-height: 1; }
.prompt-drawer-body { min-height: 0; overflow-y: auto; padding: 18px 20px; }
.prompt-summary { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px 18px; margin: 16px 0 18px; }
.prompt-summary div { min-width: 0; }
.prompt-summary dt { margin: 0 0 3px; color: var(--ink-muted); font-size: 11px; font-weight: 700; }
.prompt-summary dd { margin: 0; font-size: 13px; overflow-wrap: anywhere; }
.prompt-summary .prompt-summary-wide { grid-column: 1 / -1; }
.prompt-preview-label { display: block; margin-bottom: 7px; color: var(--ink-muted); font-size: 11px; font-weight: 700; }
.prompt-preview { width: 100%; min-height: 330px; resize: vertical; padding: 12px; border: 1px solid var(--line); border-radius: 5px; background: var(--surface-muted); color: var(--ink); font: 12px/1.65 "Cascadia Code", Consolas, monospace; letter-spacing: 0; }
.prompt-preview:focus { border-color: var(--info); outline: 2px solid rgba(23, 105, 170, 0.16); }
.prompt-drawer-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 14px 20px; border-top: 1px solid var(--line); background: var(--surface-muted); }
.prompt-navigation { display: flex; gap: 6px; }
.prompt-nav-button { min-height: 36px; padding: 6px 10px; font-size: 12px; }
.prompt-nav-button:disabled { color: #9aa4ad; cursor: default; border-color: var(--line); }
.prompt-copy { min-height: 38px; padding: 7px 14px; border-color: #20272c; background: #20272c; color: #fff; font-size: 13px; }
.prompt-copy:hover { border-color: var(--accent); background: var(--accent); }
.prompt-toast { position: fixed; right: 20px; bottom: 20px; z-index: 30; max-width: min(360px, calc(100% - 40px)); padding: 10px 13px; border-radius: 5px; background: #20272c; color: #fff; font-size: 12px; box-shadow: 0 6px 20px rgba(24, 32, 38, 0.2); }
.prompt-open { overflow: hidden; }
.boundary { margin-top: 36px; padding-top: 22px; border-top: 1px solid var(--line); }
.boundary h2 { margin: 0 0 12px; font-size: 19px; }
.boundary h2:not(:first-child) { margin-top: 24px; }
.boundary-list { margin: 0; padding-left: 20px; color: var(--ink-muted); }
.notice { margin-top: 18px; padding: 12px 14px; border-left: 3px solid var(--warning); background: var(--warning-soft); color: #614600; font-size: 13px; }
.component-table { margin-top: 24px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); overflow: hidden; }
.component-table table { table-layout: auto; }
.component-table th, .component-table td { padding: 13px 14px; }
.component-name { font-weight: 700; }
.component-target { color: var(--ink-muted); }
.report-link { display: inline-flex; align-items: center; justify-content: center; min-height: 30px; padding: 4px 10px; border: 1px solid var(--line-strong); border-radius: 4px; color: var(--ink); font-size: 12px; font-weight: 600; white-space: nowrap; }
.report-link:hover { border-color: var(--accent); color: var(--accent); text-decoration: none; }
.footer { margin-top: 36px; color: var(--ink-muted); font-size: 12px; }
@media (max-width: 820px) {
  .topbar-inner, main { width: min(100% - 24px, 1440px); }
  main { padding-top: 22px; }
  h1 { font-size: 23px; }
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .finding-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .finding-table, .finding-table tbody, .finding-table tr, .finding-table td { display: block; width: 100%; }
  .finding-table tbody { padding: 8px; }
  .finding-table tr { margin: 0 0 8px; padding: 6px 10px; border: 1px solid var(--line); border-radius: 5px; }
  .finding-table tr:last-child { margin-bottom: 0; }
  .finding-table td { display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 8px; padding: 6px 0; border: 0; }
  .finding-table td::before { content: attr(data-label); color: var(--ink-muted); font-size: 11px; font-weight: 700; }
  .prompt-drawer { top: auto; bottom: 0; width: 100%; height: min(86dvh, 760px); border-top: 1px solid var(--line); border-left: 0; box-shadow: 0 -10px 30px rgba(24, 32, 38, 0.16); }
  .prompt-summary { grid-template-columns: 1fr; }
  .prompt-summary .prompt-summary-wide { grid-column: auto; }
  .prompt-preview { min-height: 260px; }
  .prompt-drawer-footer { align-items: stretch; }
  .prompt-copy { flex: 1; }
  .component-table { border: 0; background: transparent; overflow: visible; }
  .component-table thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .component-table table, .component-table tbody, .component-table tr, .component-table td { display: block; width: 100%; }
  .component-table tr { margin-bottom: 10px; padding: 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--surface); }
  .component-table td { display: grid; grid-template-columns: 84px minmax(0, 1fr); gap: 8px; padding: 5px 0; border: 0; }
  .component-table td::before { content: attr(data-label); color: var(--ink-muted); font-size: 11px; font-weight: 700; }
}
@media print {
  body { background: #fff; }
  .topbar, .section-nav, .prompt-trigger, .prompt-backdrop, .prompt-drawer, .prompt-toast { display: none; }
  main { width: 100%; padding: 0; }
  .file-group { break-inside: avoid; }
}
`;

function pageShell({ title, topbarAction = "", content }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>${PAGE_STYLES}</style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <div class="brand"><span class="brand-mark">FDS</span><span>Token Migration</span></div>
      ${topbarAction}
    </div>
  </header>
  ${content}
</body>
</html>
`;
}

function candidateHtml(finding) {
  if (!finding.candidates?.length) return '<span class="context">-</span>';
  return `<div class="token-list">${finding.candidates.map((candidate) => {
    const distance = candidate.distance === undefined ? "" : ` / distance ${escapeHtml(candidate.distance)}`;
    return `<div class="token"><code>${escapeHtml(candidate.cssVariable)}</code><span class="token-value">${escapeHtml(candidate.resolvedValue)}${distance}</span></div>`;
  }).join("")}</div>`;
}

function candidatePromptLines(finding) {
  if (!finding.candidates?.length) return ["- 候选 Token：无可靠候选"];
  return ["- 候选 Token：", ...finding.candidates.map((candidate) => {
    const details = [
      `解析值 ${candidate.resolvedValue}`,
      candidate.match ? `匹配类型 ${candidate.match}` : null,
      candidate.distance === undefined ? null : `差异 ${candidate.distance}`,
    ].filter(Boolean).join("，");
    return `  - ${candidate.cssVariable}（${details}）`;
  })];
}

function hasPriorityRule(finding) {
  return Boolean(finding.componentVariables?.length || finding.legacyBrandVariables?.length);
}

function priorityDescription(finding) {
  if (!hasPriorityRule(finding)) return null;
  const existingFds = (finding.priorityVariables || []).filter((name) => name.startsWith("--fds-"));
  const fds = existingFds.length ? existingFds : [finding.selectedToken?.cssVariable || "FDS Token"];
  return [
    ...(finding.componentVariables || []),
    ...fds,
    ...(finding.legacyBrandVariables || []),
    ...(finding.fallbackValue ? ["原值"] : []),
  ].join(" > ");
}

function statusPromptRequirements(finding) {
  const selected = finding.selectedToken?.cssVariable;
  const replacement = finding.replacement || (selected ? `var(${selected}, ${finding.originalValue})` : null);
  if (finding.priorityProtected && finding.status === "exempt") {
    return [
      "保留组件自定义变量及其优先级，不得用 FDS Token 覆盖或替换外层变量。",
      "当前没有可安全迁移的末端原值，保持源码不变；如需继续处理，先补充变量来源和运行时 fallback 证据。",
    ];
  }
  switch (finding.status) {
    case "auto-replace":
      return [
        "确认源码上下文仍与报告一致后，执行唯一、属性兼容的确定性替换。",
        replacement ? `替换结果必须为：${replacement}` : "使用报告中的唯一精确候选，并保留原值作为 fallback。",
      ];
    case "replaced":
      return [
        "复核已完成的替换是否使用了正确的 FDS Token。",
        "确认 var() 保留原始值作为 fallback，且没有改变选择器、优先级或组件行为。",
      ];
    case "compliant":
      return ["复核现有 FDS Token 是否真实存在、适用于当前属性，并确认 fallback 合理。"];
    case "ambiguous":
      return [
        "结合组件职责、DOM 语义、状态和相邻样式判断候选 Token 的设计含义。",
        "只有能够证明某个候选语义正确时才替换；无法消除歧义时保持源码不变并说明缺少的证据。",
      ];
    case "similar":
      return [
        "评估相近候选的设计语义，不得仅凭数值或颜色距离接近直接替换。",
        "只有确认允许视觉值变化且语义一致时才采用候选；否则保持源码不变并说明原因。",
      ];
    case "missing-token":
      return [
        "查询 fds-migrate 内置的完整 FDS Token 快照，确认是否存在语义匹配的 Token。",
        "禁止根据命名规律编造 Token；没有可靠 Token 时保持源码不变，并记录 Token 能力缺口。",
      ];
    case "invalid-token":
      return [
        "核对变量是否不存在、与当前 CSS property 不兼容或 fallback 优先级错误，并检查是否属于拼写或历史变量问题。",
        "只有找到真实、属性兼容且语义一致的 Token 才替换；否则保留源码并说明问题。",
      ];
    case "unsupported":
      return [
        "追踪动态值、spread、插值或跨变量数据流的最终来源，人工确认运行时实际值。",
        "静态证据不足时不得猜测或修改；补充证据后再决定是否使用 FDS Token。",
      ];
    default:
      return ["判断当前值是否需要 Token 化；证据不足时保持源码不变。"];
  }
}

function findingPrompt(finding, mode) {
  const location = `${finding.line}:${finding.column}`;
  const requirements = statusPromptRequirements(finding);
  const priority = priorityDescription(finding);
  const lines = [
    "请处理以下一项 FDS Token 迁移问题。",
    "",
    "定位：",
    `- Finding ID：${finding.id}`,
    `- 文件：${finding.file}`,
    `- 行列：${location}`,
    `- 语法：${finding.syntax}`,
    `- 容器：${finding.container}`,
    `- 选择器：${finding.selector || finding.container}`,
    `- 属性：${finding.property}`,
    `- 原值：${finding.originalValue}`,
    `- 报告模式：${mode}`,
    `- 当前状态：${statusLabel(finding.status)}（${finding.status}）`,
    `- 判定原因：${finding.reason}`,
    ...(priority ? [`- 变量优先级目标：${priority}`] : []),
    ...candidatePromptLines(finding),
    "",
    "处理要求：",
    ...requirements.map((requirement, index) => `${index + 1}. ${requirement}`),
  ];
  const offset = requirements.length;
  const fallbackRequirement = hasPriorityRule(finding)
    ? "保持“组件变量 > FDS Token > --color-blueXX > 原值”的相对顺序；组件变量位于 FDS 外层，老品牌色变量位于 FDS fallback 内层，并继续保留原值。"
    : "任何替换都必须使用 var(--fds-*, 原值) 形式保留当前原值作为 fallback。";
  lines.push(
    `${offset + 1}. 只处理这一项及其必要上下文，不格式化文件，不修改无关代码。`,
    `${offset + 2}. ${fallbackRequirement}`,
    `${offset + 3}. 如果源码已与报告定位不一致，停止修改并重新运行扫描，不按旧行号强行处理。`,
    `${offset + 4}. 修改后按项目配置重新运行 fds-migrate verify，并执行该组件已有的相关测试。`,
    `${offset + 5}. 最终说明实际修改或保持不变的内容、判断依据和验证结果。`,
  );
  return lines.join("\n");
}

function promptItem(finding, mode) {
  return {
    id: finding.id,
    status: finding.status,
    statusLabel: statusLabel(hasPriorityRule(finding) && ["compliant", "exempt"].includes(finding.status) ? "priority-protected" : finding.status),
    file: finding.file,
    line: finding.line,
    column: finding.column,
    syntax: finding.syntax,
    container: finding.container,
    property: finding.property,
    originalValue: finding.originalValue,
    priorityVariables: finding.priorityVariables || [],
    componentVariables: finding.componentVariables || [],
    legacyBrandVariables: finding.legacyBrandVariables || [],
    candidates: finding.candidates || [],
    prompt: findingPrompt(finding, mode),
  };
}

function findingRows(findings) {
  const displayStatus = (finding) => hasPriorityRule(finding) && ["compliant", "exempt"].includes(finding.status)
    ? "priority-protected"
    : finding.status;
  return findings.map((finding) => `<tr class="finding-row" id="finding-${escapeHtml(finding.id)}" data-finding-id="${escapeHtml(finding.id)}" data-status="${escapeHtml(finding.status)}">
    <td data-label="位置"><span class="position">${escapeHtml(finding.line)}:${escapeHtml(finding.column)}</span></td>
    <td data-label="语法 / 容器"><div>${escapeHtml(finding.syntax)}</div><code class="context">${escapeHtml(finding.container)}</code></td>
    <td data-label="属性"><code>${escapeHtml(finding.property)}</code></td>
    <td data-label="原值"><code>${escapeHtml(finding.originalValue)}</code></td>
    <td data-label="状态">${statusBadge(displayStatus(finding))}${hasPriorityRule(finding) && !["compliant", "exempt"].includes(finding.status) ? ` ${statusBadge("priority-protected")}` : ""}</td>
    <td data-label="Token / 候选">${candidateHtml(finding)}</td>
    <td data-label="原因"><span class="reason">${escapeHtml(finding.reason)}</span></td>
    <td data-label="操作"><button class="prompt-trigger" type="button" data-prompt-trigger="${escapeHtml(finding.id)}">生成提示词</button></td>
  </tr>`).join("");
}

function groupedFindingHtml(findings) {
  if (!findings.length) return '<div class="empty">无</div>';
  const byFile = new Map();
  for (const finding of findings) {
    const values = byFile.get(finding.file) || [];
    values.push(finding);
    byFile.set(finding.file, values);
  }
  return [...byFile.entries()].map(([file, fileFindings]) => `<details class="file-group" data-file-group open>
    <summary><code class="file-path">${escapeHtml(file)}</code><span class="file-count" data-file-count>${fileFindings.length} 项</span></summary>
    <div class="table-wrap">
      <table class="finding-table">
        <thead><tr>
          <th class="col-position">位置</th><th class="col-context">语法 / 容器</th><th class="col-property">属性</th><th class="col-value">原值</th><th class="col-status">状态</th><th class="col-token">Token / 候选</th><th>原因</th><th class="col-action">操作</th>
        </tr></thead>
        <tbody>${findingRows(fileFindings)}</tbody>
      </table>
    </div>
  </details>`).join("");
}

function reportSection(id, title, findings, controls = "") {
  return `<section class="report-section" id="${id}">
    <div class="section-title"><h2>${escapeHtml(title)}</h2><span class="count" data-section-count>${findings.length} 项</span></div>
    ${controls}
    ${groupedFindingHtml(findings)}
  </section>`;
}

function metric(value, label) {
  return `<div class="metric"><span class="metric-value">${escapeHtml(value)}</span><span class="metric-label">${escapeHtml(label)}</span></div>`;
}

function statusStrip(statusCounts) {
  return `<div class="status-strip">${Object.entries(statusCounts).map(([status, count]) => statusBadge(status, count)).join("")}</div>`;
}

function noncompliantFilters(findings) {
  if (!findings.length) return "";
  const counts = countStatuses(findings);
  const filters = [
    ["all", "全部", findings.length],
    ["ambiguous", statusLabel("ambiguous"), counts.ambiguous || 0],
    ["similar", statusLabel("similar"), counts.similar || 0],
    ["missing-token", statusLabel("missing-token"), counts["missing-token"] || 0],
    ["invalid-token", statusLabel("invalid-token"), counts["invalid-token"] || 0],
  ];
  return `<div class="filter-bar" role="group" aria-label="不符合规范状态筛选">${filters.map(([status, label, count], index) => `<button class="filter-button" type="button" data-status-filter="${status}" aria-pressed="${index === 0 ? "true" : "false"}"${count === 0 ? " disabled" : ""}>${escapeHtml(label)} ${count}</button>`).join("")}</div>`;
}

const REPORT_SCRIPT = `<script>
(() => {
  const section = document.getElementById("noncompliant");
  const buttons = section ? [...section.querySelectorAll("[data-status-filter]")] : [];
  const rows = section ? [...section.querySelectorAll("tr[data-status]")] : [];
  const groups = section ? [...section.querySelectorAll("[data-file-group]")] : [];
  const sectionCount = section?.querySelector("[data-section-count]");
  const total = rows.length;
  const applyFilter = (filter) => {
    let visibleTotal = 0;
    for (const row of rows) {
      const visible = filter === "all" || row.dataset.status === filter;
      row.hidden = !visible;
      if (visible) visibleTotal += 1;
    }
    for (const group of groups) {
      const visibleRows = group.querySelectorAll("tr[data-status]:not([hidden])").length;
      group.hidden = visibleRows === 0;
      const count = group.querySelector("[data-file-count]");
      if (count) count.textContent = visibleRows + " 项";
    }
    if (sectionCount) sectionCount.textContent = filter === "all" ? total + " 项" : visibleTotal + " / " + total + " 项";
    for (const button of buttons) button.setAttribute("aria-pressed", String(button.dataset.statusFilter === filter));
    if (activeId) {
      const activeRow = allRows.find((row) => row.dataset.findingId === activeId);
      if (!activeRow || activeRow.hidden || activeRow.closest("[data-file-group]")?.hidden) closeDrawer();
      else updateNavigation();
    }
  };
  for (const button of buttons) button.addEventListener("click", () => applyFilter(button.dataset.statusFilter));

  const dataElement = document.getElementById("finding-prompt-data");
  const drawer = document.querySelector("[data-prompt-drawer]");
  const backdrop = document.querySelector("[data-prompt-backdrop]");
  const promptText = document.querySelector("[data-prompt-text]");
  const closeButton = document.querySelector("[data-prompt-close]");
  const previousButton = document.querySelector('[data-prompt-nav="previous"]');
  const nextButton = document.querySelector('[data-prompt-nav="next"]');
  const copyButton = document.querySelector("[data-prompt-copy]");
  const toast = document.querySelector("[data-prompt-toast]");
  const allRows = [...document.querySelectorAll("tr[data-finding-id]")];
  let promptItems = [];
  try { promptItems = JSON.parse(dataElement?.textContent || "[]"); } catch { promptItems = []; }
  const promptById = new Map(promptItems.map((item) => [item.id, item]));
  let activeId = null;
  let returnFocus = null;
  let toastTimer = null;

  const visibleRows = () => allRows.filter((row) => !row.hidden && !row.closest("[data-file-group]")?.hidden);
  const updateNavigation = () => {
    const currentRows = visibleRows();
    const index = currentRows.findIndex((row) => row.dataset.findingId === activeId);
    previousButton.disabled = index <= 0;
    nextButton.disabled = index < 0 || index >= currentRows.length - 1;
  };
  const setText = (name, value) => {
    const element = drawer.querySelector('[data-prompt-field="' + name + '"]');
    if (element) element.textContent = value || "-";
  };
  const openDrawer = (id, trigger) => {
    const item = promptById.get(id);
    if (!item) return;
    returnFocus = trigger || document.activeElement;
    activeId = id;
    for (const row of allRows) row.classList.toggle("is-active", row.dataset.findingId === id);
    setText("id", item.id);
    setText("status", item.statusLabel + "（" + item.status + "）");
    setText("file", item.file);
    setText("position", item.line + ":" + item.column);
    setText("syntax", item.syntax);
    setText("container", item.container);
    setText("property", item.property);
    setText("value", item.originalValue);
    setText("candidates", item.candidates.length
      ? item.candidates.map((candidate) => candidate.cssVariable + " = " + candidate.resolvedValue).join("；")
      : "无可靠候选");
    promptText.value = item.prompt;
    backdrop.hidden = false;
    drawer.hidden = false;
    document.body.classList.add("prompt-open");
    updateNavigation();
    closeButton.focus();
  };
  const closeDrawer = () => {
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    backdrop.hidden = true;
    document.body.classList.remove("prompt-open");
    for (const row of allRows) row.classList.remove("is-active");
    activeId = null;
    if (returnFocus?.isConnected) returnFocus.focus();
  };
  const navigate = (direction) => {
    const currentRows = visibleRows();
    const index = currentRows.findIndex((row) => row.dataset.findingId === activeId);
    const nextRow = currentRows[index + direction];
    if (nextRow) openDrawer(nextRow.dataset.findingId, nextRow.querySelector("[data-prompt-trigger]"));
  };
  const showToast = (message) => {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 2200);
  };
  const copyPrompt = async () => {
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(promptText.value);
        copied = true;
      }
    } catch {}
    if (!copied) {
      promptText.focus();
      promptText.select();
      try { copied = document.execCommand("copy"); } catch {}
    }
    showToast(copied ? "提示词已复制" : "已选中提示词，请手动复制");
  };

  for (const trigger of document.querySelectorAll("[data-prompt-trigger]")) {
    trigger.addEventListener("click", (event) => {
      event.stopPropagation();
      openDrawer(trigger.dataset.promptTrigger, trigger);
    });
  }
  for (const row of allRows) {
    row.addEventListener("click", (event) => {
      if (event.target.closest("button, a, input, textarea, select")) return;
      if (window.getSelection()?.toString()) return;
      openDrawer(row.dataset.findingId, row.querySelector("[data-prompt-trigger]"));
    });
  }
  closeButton?.addEventListener("click", closeDrawer);
  backdrop?.addEventListener("click", closeDrawer);
  previousButton?.addEventListener("click", () => navigate(-1));
  nextButton?.addEventListener("click", () => navigate(1));
  copyButton?.addEventListener("click", copyPrompt);
  document.addEventListener("keydown", (event) => {
    if (!drawer || drawer.hidden) return;
    if (event.key === "Escape") closeDrawer();
  });
})();
</script>`;

function promptDrawer(promptItems) {
  return `<div class="prompt-backdrop" data-prompt-backdrop hidden></div>
  <aside class="prompt-drawer" data-prompt-drawer role="dialog" aria-modal="true" aria-labelledby="prompt-drawer-title" hidden>
    <header class="prompt-drawer-header">
      <div><h2 class="prompt-drawer-title" id="prompt-drawer-title">处理提示词</h2><span class="prompt-drawer-id" data-prompt-field="id"></span></div>
      <button class="prompt-close" type="button" data-prompt-close aria-label="关闭" title="关闭">×</button>
    </header>
    <div class="prompt-drawer-body">
      <span class="status" data-prompt-field="status"></span>
      <dl class="prompt-summary">
        <div class="prompt-summary-wide"><dt>文件</dt><dd><code data-prompt-field="file"></code></dd></div>
        <div><dt>位置</dt><dd data-prompt-field="position"></dd></div>
        <div><dt>语法</dt><dd data-prompt-field="syntax"></dd></div>
        <div><dt>属性</dt><dd><code data-prompt-field="property"></code></dd></div>
        <div><dt>原值</dt><dd><code data-prompt-field="value"></code></dd></div>
        <div class="prompt-summary-wide"><dt>容器</dt><dd><code data-prompt-field="container"></code></dd></div>
        <div class="prompt-summary-wide"><dt>候选 Token</dt><dd><code data-prompt-field="candidates"></code></dd></div>
      </dl>
      <label class="prompt-preview-label" for="finding-prompt-text">标准提示词</label>
      <textarea class="prompt-preview" id="finding-prompt-text" data-prompt-text readonly spellcheck="false"></textarea>
    </div>
    <footer class="prompt-drawer-footer">
      <div class="prompt-navigation">
        <button class="prompt-nav-button" type="button" data-prompt-nav="previous">上一项</button>
        <button class="prompt-nav-button" type="button" data-prompt-nav="next">下一项</button>
      </div>
      <button class="prompt-copy" type="button" data-prompt-copy>复制提示词</button>
    </footer>
  </aside>
  <div class="prompt-toast" data-prompt-toast role="status" aria-live="polite" hidden></div>
  <script id="finding-prompt-data" type="application/json">${jsonForHtmlScript(promptItems)}</script>`;
}

export function renderHtml(report) {
  const findings = report.findings;
  const replaced = findings.filter((item) => item.status === "replaced");
  const autoReplace = findings.filter((item) => item.status === "auto-replace");
  const noncompliant = findings.filter((item) => NONCOMPLIANT_STATUSES.has(item.status) && item.status !== "auto-replace");
  const unsupported = findings.filter((item) => item.status === "unsupported");
  const priorityCount = findings.filter((item) => hasPriorityRule(item)).length;
  const priorityResolved = findings.filter((item) => hasPriorityRule(item) && ["compliant", "exempt"].includes(item.status));
  const promptItems = [...replaced, ...autoReplace, ...noncompliant, ...priorityResolved, ...unsupported].map((finding) => promptItem(finding, report.mode));
  const parseItems = report.parseErrors.length
    ? `<ul class="boundary-list">${report.parseErrors.map((error) => `<li><code>${escapeHtml(error.file)}:${escapeHtml(error.line)}:${escapeHtml(error.column)}</code> ${escapeHtml(error.message)}</li>`).join("")}</ul>`
    : '<div class="empty">未发现解析错误</div>';
  const unsupportedFiles = report.unsupportedFiles.length
    ? `<ul class="boundary-list">${report.unsupportedFiles.map((file) => `<li><code>${escapeHtml(file)}</code></li>`).join("")}</ul>`
    : '<div class="empty">输入范围内的文件类型均有适配器</div>';
  const target = report.targets.join(", ");
  const content = `<main>
    <section class="report-heading">
      <p class="eyebrow">${escapeHtml(report.mode.toUpperCase())} REPORT</p>
      <h1>FDS Token 迁移报告</h1>
      <p class="target"><code>${escapeHtml(target)}</code></p>
      <div class="meta">
        <span class="meta-item">Catalog ${escapeHtml(report.catalog.schema)}</span>
        <span class="meta-item">SHA ${escapeHtml(report.catalog.sha256.slice(0, 12))}</span>
        <span class="meta-item">${escapeHtml(report.generatedAt)}</span>
        <span class="meta-item">Apply 阻止：${report.applyBlocked ? "是" : "否"}</span>
      </div>
    </section>
    <section class="metrics" aria-label="汇总">
      ${metric(report.summary.fileCount, "扫描文件")}
      ${metric(report.summary.occurrenceCount, "样式项")}
      ${metric(replaced.length, "已替换")}
      ${metric(noncompliant.length, "不符合规范")}
      ${metric(priorityCount, "变量优先级")}
      ${metric(report.summary.unsupportedNodeCount, "人工检查")}
      ${metric(report.summary.parseErrorCount, "解析错误")}
    </section>
    ${statusStrip(report.summary.statusCounts)}
    <nav class="section-nav" aria-label="报告章节">
      <a href="#replaced">已替换 ${replaced.length}</a>
      <a href="#auto-replace">可自动替换 ${autoReplace.length}</a>
      <a href="#noncompliant">不符合规范 ${noncompliant.length}</a>
      ${priorityResolved.length ? `<a href="#priority-protected">变量优先级 ${priorityResolved.length}</a>` : ""}
      <a href="#unsupported">人工检查 ${unsupported.length}</a>
      <a href="#boundary">解析边界</a>
    </nav>
    ${reportSection("replaced", "已替换内容", replaced)}
    ${reportSection("auto-replace", "可自动替换", autoReplace)}
    ${reportSection("noncompliant", "不符合规范", noncompliant, noncompliantFilters(noncompliant))}
    ${priorityResolved.length ? reportSection("priority-protected", "变量优先级", priorityResolved) : ""}
    ${reportSection("unsupported", "需人工检查", unsupported)}
    <section class="boundary" id="boundary">
      <h2>解析错误</h2>${parseItems}
      <h2>适配器边界</h2>${unsupportedFiles}
      <div class="notice">静态报告不能替代页面功能、视觉、主题和可访问性验证。</div>
    </section>
    <footer class="footer">FDS Token Migration / ${escapeHtml(report.mode)}</footer>
  </main>${promptDrawer(promptItems)}${REPORT_SCRIPT}`;
  return pageShell({
    title: `FDS Token 迁移报告 - ${target}`,
    topbarAction: '<a href="../../fds-token-migration-index.html">返回报告索引</a>',
    content,
  });
}

export async function writeReport(reportDir, report) {
  await mkdir(reportDir, { recursive: true });
  const jsonPath = path.join(reportDir, REPORT_JSON);
  const htmlPath = path.join(reportDir, REPORT_HTML);
  await rm(path.join(reportDir, LEGACY_REPORT_MARKDOWN), { force: true });
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(htmlPath, renderHtml(report), "utf8");
  return [jsonPath, htmlPath];
}

function aggregateSummary(reports) {
  const statusCounts = {};
  const summary = {
    componentCount: reports.length,
    fileCount: 0,
    occurrenceCount: 0,
    declarationCount: 0,
    parseErrorCount: 0,
    unsupportedFileCount: 0,
    unsupportedNodeCount: 0,
    statusCounts,
  };
  for (const { report } of reports) {
    for (const field of ["fileCount", "occurrenceCount", "declarationCount", "parseErrorCount", "unsupportedFileCount", "unsupportedNodeCount"]) {
      summary[field] += report.summary[field];
    }
    for (const [status, count] of Object.entries(report.summary.statusCounts)) {
      statusCounts[status] = (statusCounts[status] || 0) + count;
    }
  }
  summary.statusCounts = Object.fromEntries(Object.entries(statusCounts).sort(([first], [second]) => first.localeCompare(second)));
  return summary;
}

function renderIndexHtml(index) {
  const content = `<main>
    <section class="report-heading">
      <p class="eyebrow">${escapeHtml(index.mode?.toUpperCase())} INDEX</p>
      <h1>FDS Token 迁移报告</h1>
      <p class="target">组件级审查索引</p>
      <div class="meta">
        <span class="meta-item">Catalog ${escapeHtml(index.catalog?.schema)}</span>
        <span class="meta-item">SHA ${escapeHtml(index.catalog?.sha256?.slice(0, 12))}</span>
        <span class="meta-item">${escapeHtml(index.generatedAt)}</span>
        <span class="meta-item">Apply 阻止：${index.applyBlocked ? "是" : "否"}</span>
      </div>
    </section>
    <section class="metrics" aria-label="汇总">
      ${metric(index.summary.componentCount, "组件")}
      ${metric(index.summary.fileCount, "扫描文件")}
      ${metric(index.summary.occurrenceCount, "样式项")}
      ${metric(index.summary.parseErrorCount, "解析错误")}
      ${metric(index.summary.unsupportedNodeCount, "人工检查")}
    </section>
    ${statusStrip(index.summary.statusCounts)}
    <section class="component-table" aria-label="组件报告">
      <table>
        <thead><tr><th>组件</th><th>入口</th><th>文件</th><th>样式项</th><th>解析错误</th><th>报告</th></tr></thead>
        <tbody>${index.components.map((component) => `<tr>
          <td class="component-name" data-label="组件">${escapeHtml(component.name)}</td>
          <td data-label="入口"><code class="component-target">${escapeHtml(component.target)}</code></td>
          <td data-label="文件">${escapeHtml(component.summary.fileCount)}</td>
          <td data-label="样式项">${escapeHtml(component.summary.occurrenceCount)}</td>
          <td data-label="解析错误">${escapeHtml(component.summary.parseErrorCount)}</td>
          <td data-label="报告"><a class="report-link" href="${escapeHtml(component.htmlReport)}">查看报告</a></td>
        </tr>`).join("")}</tbody>
      </table>
    </section>
    <div class="notice">批量执行遵循全局 apply 保护；任一组件存在解析错误时，本批次不写入源码。</div>
    <footer class="footer">FDS Token Migration / ${escapeHtml(index.mode)}</footer>
  </main>`;
  return pageShell({ title: "FDS Token 迁移报告索引", content });
}

export async function writeReportSet(reportDir, reports) {
  await mkdir(reportDir, { recursive: true });
  await rm(path.join(reportDir, "components"), { recursive: true, force: true });
  await rm(path.join(reportDir, LEGACY_INDEX_MARKDOWN), { force: true });
  for (const item of reports) {
    item.relativeDir = `components/${item.name}`;
    await writeReport(path.join(reportDir, item.relativeDir), item.report);
  }
  const summary = aggregateSummary(reports);
  const firstReport = reports[0]?.report;
  const index = {
    schema: "fds-token-migration-index/v2",
    mode: firstReport?.mode,
    generatedAt: new Date().toISOString(),
    catalog: firstReport?.catalog,
    project: firstReport?.project,
    applyBlocked: reports.some(({ report }) => report.applyBlocked),
    summary,
    components: reports.map((item) => ({
      name: item.name,
      target: item.report.targets[0],
      jsonReport: `${item.relativeDir}/${REPORT_JSON}`,
      htmlReport: `${item.relativeDir}/${REPORT_HTML}`,
      summary: item.report.summary,
    })),
  };
  const jsonPath = path.join(reportDir, INDEX_JSON);
  const htmlPath = path.join(reportDir, INDEX_HTML);
  await writeFile(jsonPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");
  await writeFile(htmlPath, renderIndexHtml(index), "utf8");
  return [jsonPath, htmlPath, summary];
}
