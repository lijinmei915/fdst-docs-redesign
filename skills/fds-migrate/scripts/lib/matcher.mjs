import { createHash } from "node:crypto";
import valueParser from "postcss-value-parser";
import { converter, parse as parseColor } from "culori";

const SELECTION_GROUPS = new Set([
  "scene-context",
  "semantic-context",
  "semantic-base",
  "atomic-context",
  "atomic-map",
]);
const toRgb = converter("rgb");
const toOklab = converter("oklab");

export const NONCOMPLIANT_STATUSES = new Set([
  "auto-replace",
  "ambiguous",
  "similar",
  "missing-token",
  "invalid-token",
]);

export class MigrationError extends Error {}

export function compilePolicy(policy) {
  if (policy.schema !== "fds-token-migration-policy/v1" || !Array.isArray(policy.rules) || !policy.rules.length) {
    throw new MigrationError("迁移策略 schema 或 rules 无效");
  }
  for (const rule of policy.rules) {
    rule._propertyRegexes = rule.propertyPatterns.map((pattern) => new RegExp(pattern, "i"));
    rule._tokenRegexes = rule.tokenNamePatterns.map((pattern) => new RegExp(pattern, "i"));
    const unknown = (rule.selectionOrder || []).filter((group) => !SELECTION_GROUPS.has(group));
    if (unknown.length) throw new MigrationError(`迁移策略包含未知 selectionOrder：${unknown.join(", ")}`);
  }
  return policy;
}

function findRule(property, policy) {
  return policy.rules.find((rule) => rule._propertyRegexes.some((pattern) => pattern.test(property)));
}

function tokenAllowed(token, rule) {
  return rule.types.includes(token.type) && rule._tokenRegexes.some((pattern) => pattern.test(token.name));
}

function significantNodes(value) {
  return valueParser(value).nodes.filter((node) => node.type !== "space" && node.type !== "comment");
}

function parseTypedValue(value, tokenType) {
  const stripped = value.trim();
  if (tokenType === "color") {
    const nodes = significantNodes(stripped);
    if (nodes.length !== 1) return null;
    const color = toRgb(parseColor(stripped));
    if (!color) return null;
    return { kind: "color", comparable: [color.r, color.g, color.b, color.alpha ?? 1] };
  }

  const dimension = stripped.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))([a-z%]+)$/i);
  const number = stripped.match(/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/);
  if (tokenType === "dimension") {
    return dimension && dimension[2] !== "%"
      ? { kind: "dimension", comparable: [Number(dimension[1]), dimension[2].toLowerCase()] }
      : null;
  }
  if (tokenType === "duration") {
    if (!dimension || !["ms", "s"].includes(dimension[2].toLowerCase())) return null;
    const amount = Number(dimension[1]) * (dimension[2].toLowerCase() === "s" ? 1000 : 1);
    return { kind: "duration", comparable: amount };
  }
  if (tokenType === "number" || tokenType === "font-weight") {
    if (number) return { kind: tokenType, comparable: Number(stripped) };
    if (tokenType === "font-weight" && /^(normal|bold)$/i.test(stripped)) {
      return { kind: tokenType, comparable: stripped.toLowerCase() === "bold" ? 700 : 400 };
    }
    return null;
  }
  if (tokenType === "shadow" || tokenType === "cubic-bezier") {
    return { kind: tokenType, comparable: stripped.replace(/\s+/g, " ").toLowerCase() };
  }
  return null;
}

function valuesEqual(first, second) {
  if (!first || !second || first.kind !== second.kind) return false;
  if (first.kind === "color") {
    return first.comparable.every((value, index) => Math.abs(value - second.comparable[index]) <= 1 / 510);
  }
  if (first.kind === "dimension") {
    return first.comparable[1] === second.comparable[1] && Math.abs(first.comparable[0] - second.comparable[0]) <= 1e-9;
  }
  return typeof first.comparable === "number"
    ? Math.abs(first.comparable - second.comparable) <= 1e-9
    : first.comparable === second.comparable;
}

function similarityDistance(first, second) {
  if (!first || !second || first.kind !== second.kind) return null;
  if (first.kind === "color") {
    const a = toOklab({ mode: "rgb", r: first.comparable[0], g: first.comparable[1], b: first.comparable[2], alpha: first.comparable[3] });
    const b = toOklab({ mode: "rgb", r: second.comparable[0], g: second.comparable[1], b: second.comparable[2], alpha: second.comparable[3] });
    if (!a || !b || Math.abs((a.alpha ?? 1) - (b.alpha ?? 1)) > 1 / 255) return null;
    return Math.hypot(a.l - b.l, a.a - b.a, a.b - b.b);
  }
  if (first.kind === "dimension") {
    if (first.comparable[1] !== second.comparable[1]) return null;
    return Math.abs(first.comparable[0] - second.comparable[0]) /
      Math.max(Math.abs(first.comparable[0]), Math.abs(second.comparable[0]), 1e-9);
  }
  if (first.kind === "duration" || first.kind === "number") {
    return Math.abs(first.comparable - second.comparable) /
      Math.max(Math.abs(first.comparable), Math.abs(second.comparable), 1e-9);
  }
  return null;
}

function candidateRecord(token, match, distance) {
  const record = {
    name: token.name,
    cssVariable: token.cssVariable,
    resolvedValue: token.resolvedValue,
    layer: token.layer,
    tier: token.tier,
    category: token.category,
    match,
  };
  if (distance !== undefined) record.distance = Number(distance.toFixed(6));
  return record;
}

function tokenMatchesContext(token, contexts) {
  const name = token.name.toLowerCase();
  return contexts.some((rawContext) => {
    const context = rawContext.trim().toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return context && new RegExp(`(?:^|-)${context}(?:-|$)`).test(name);
  });
}

function candidateInGroup(token, group, contexts) {
  if (group === "scene-context") return token.tier === "scene" && tokenMatchesContext(token, contexts);
  if (group === "semantic-context") return token.layer === "semantic" && token.tier === "base" && tokenMatchesContext(token, contexts);
  if (group === "semantic-base") return token.layer === "semantic" && token.tier === "base";
  if (group === "atomic-context") return token.layer === "atomic" && token.tier === "map" && tokenMatchesContext(token, contexts);
  if (group === "atomic-map") return token.layer === "atomic" && token.tier === "map";
  throw new MigrationError(`迁移策略包含未知 selectionOrder：${group}`);
}

function selectExactCandidate(candidates, rule, contexts) {
  for (const groupName of rule.selectionOrder || ["scene-context", "semantic-base"]) {
    if (groupName.startsWith("atomic") && !rule.allowAtomicAuto) continue;
    const group = candidates.filter((token) => candidateInGroup(token, groupName, contexts));
    if (group.length === 1) return [group[0], "unique"];
    if (group.length > 1) return [null, "multiple"];
  }
  return [null, "boundary"];
}

function collectCssVariables(value) {
  const names = [];
  valueParser(value).walk((node) => {
    if (node.type !== "function" || node.value.toLowerCase() !== "var") return;
    const first = node.nodes.find((child) => child.type !== "space" && child.type !== "comment" && child.type !== "div");
    if (first?.type === "word") names.push(first.value);
  });
  return names;
}

function findStandaloneFdsVariable(value) {
  const nodes = significantNodes(value);
  if (nodes.length !== 1 || nodes[0].type !== "function" || nodes[0].value.toLowerCase() !== "var") return null;
  const first = nodes[0].nodes.find((node) => node.type !== "space" && node.type !== "comment" && node.type !== "div");
  return first?.type === "word" && first.value.startsWith("--fds-") ? first.value : null;
}

function makeId(occurrence) {
  return createHash("sha256")
    .update(`${occurrence.file}:${occurrence.line}:${occurrence.column}:${occurrence.property}:${occurrence.originalValue}`)
    .digest("hex")
    .slice(0, 16);
}

export function classifyOccurrence(occurrence, tokens, policy, contexts = []) {
  const property = occurrence.property.toLowerCase();
  const rule = findRule(property, policy);
  const finding = {
    id: makeId(occurrence),
    file: occurrence.file,
    line: occurrence.line,
    column: occurrence.column,
    syntax: occurrence.syntax,
    container: occurrence.container,
    selector: occurrence.selector || occurrence.container,
    property,
    originalValue: occurrence.originalValue,
    writable: occurrence.writable,
    status: "exempt",
    rule: rule?.id || null,
    reason: "",
    candidates: [],
    _span: occurrence.start === undefined ? undefined : [occurrence.start, occurrence.end],
  };

  if (occurrence.unsupportedReason) {
    finding.status = "unsupported";
    finding.reason = occurrence.unsupportedReason;
    return finding;
  }
  if (property.startsWith("--")) {
    finding.reason = "CSS Custom Property 定义不属于声明值迁移范围";
    return finding;
  }
  if (!rule) {
    finding.reason = "该 CSS property 不属于当前 Token 迁移规则";
    return finding;
  }

  const tokenByVariable = new Map(tokens.map((token) => [token.cssVariable, token]));
  const standalone = findStandaloneFdsVariable(occurrence.originalValue);
  if (standalone) {
    const token = tokenByVariable.get(standalone);
    if (!token) {
      finding.status = "invalid-token";
      finding.reason = "FDS Catalog 中不存在该变量";
    } else if (!tokenAllowed(token, rule)) {
      finding.status = "invalid-token";
      finding.reason = "Token 存在，但与当前 CSS property 不兼容";
      finding.candidates = [candidateRecord(token, "invalid-property")];
    } else {
      finding.status = "compliant";
      finding.reason = "FDS Token 存在且 property 兼容";
      finding.candidates = [candidateRecord(token, "existing")];
    }
    return finding;
  }

  const variables = collectCssVariables(occurrence.originalValue);
  const invalid = [...new Set(variables.filter((name) => name.startsWith("--fds-") && !tokenByVariable.has(name)))].sort();
  if (invalid.length) {
    finding.status = "invalid-token";
    finding.reason = `FDS Catalog 中不存在变量：${invalid.join(", ")}`;
    return finding;
  }
  if (variables.length) {
    finding.reason = variables.every((name) => name.startsWith("--fds-"))
      ? "包含 FDS Token 的复合表达式，当前不对表达式语义做自动判断"
      : "非 FDS 动态变量可能属于组件或业务私有契约，需要显式映射后再判断";
    return finding;
  }
  if (policy.exemptValues.some((value) => value.toLowerCase() === occurrence.originalValue.trim().toLowerCase())) {
    finding.reason = "CSS 通用值或零值无需 Token 化";
    return finding;
  }

  let parsedSource = null;
  for (const tokenType of rule.types) {
    parsedSource = parseTypedValue(occurrence.originalValue, tokenType);
    if (parsedSource) break;
  }
  if (!parsedSource) {
    finding.reason = "当前值不是可完整比较的单一 Token 值，未处理 shorthand 或动态表达式";
    return finding;
  }

  const parsedCandidates = tokens
    .filter((token) => tokenAllowed(token, rule))
    .map((token) => [token, parseTypedValue(String(token.resolvedValue), token.type)])
    .filter(([, parsed]) => parsed);
  const exact = parsedCandidates
    .filter(([, parsed]) => valuesEqual(parsedSource, parsed))
    .map(([token]) => token)
    .sort((a, b) => a.cssVariable.localeCompare(b.cssVariable));
  const maxCandidates = Number(policy.similarity.maxCandidates);
  if (exact.length) {
    const [selected, selection] = selectExactCandidate(exact, rule, contexts);
    finding.candidates = exact.slice(0, maxCandidates).map((token) => candidateRecord(token, "exact"));
    if (selected && occurrence.writable && finding._span) {
      finding.status = "auto-replace";
      finding.reason = "唯一精确候选满足 property 和层级边界";
      finding.selectedToken = candidateRecord(selected, "exact");
      finding.replacement = `var(${selected.cssVariable}, ${occurrence.originalValue})`;
    } else if (selected) {
      finding.status = "unsupported";
      finding.reason = "存在唯一精确候选，但当前语法节点不能安全局部改写";
      finding.selectedToken = candidateRecord(selected, "exact");
    } else {
      finding.status = "ambiguous";
      finding.reason = selection === "multiple"
        ? "同一优先级存在多个精确候选，需要语义判断"
        : "精确候选存在，但超出自动消费层级或缺少 Scene 上下文";
    }
    return finding;
  }

  if (rule.allowSimilarity) {
    const scored = [];
    for (const [token, parsed] of parsedCandidates) {
      if (token.tier === "seed" || (token.layer === "atomic" && !rule.allowAtomicAuto) ||
          (token.tier === "scene" && !tokenMatchesContext(token, contexts))) continue;
      const distance = similarityDistance(parsedSource, parsed);
      const threshold = parsedSource.kind === "color"
        ? Number(policy.similarity.colorOklabMaxDistance)
        : Number(policy.similarity.dimensionRelativeMaxDifference);
      if (distance !== null && distance <= threshold) scored.push([distance, token]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].cssVariable.localeCompare(b[1].cssVariable));
    if (scored.length) {
      finding.status = "similar";
      finding.reason = "仅存在相近候选；数值接近不证明语义一致";
      finding.candidates = scored.slice(0, maxCandidates).map(([distance, token]) => candidateRecord(token, "similar", distance));
      return finding;
    }
  }

  finding.status = "missing-token";
  finding.reason = "该 property 属于 Token 管理范围，但没有可靠候选";
  return finding;
}

export function publicFinding(finding) {
  return Object.fromEntries(Object.entries(finding).filter(([key, value]) => !key.startsWith("_") && value !== undefined));
}
