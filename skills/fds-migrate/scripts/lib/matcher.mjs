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
    rule._excludedTargetRegexes = (rule.excludedTargetNamePatterns || []).map((pattern) => new RegExp(pattern, "i"));
    const unknown = (rule.selectionOrder || []).filter((group) => !SELECTION_GROUPS.has(group));
    if (unknown.length) throw new MigrationError(`迁移策略包含未知 selectionOrder：${unknown.join(", ")}`);
  }
  return policy;
}

export function compileLegacyColorIndex(index) {
  if (index?.schema !== "fds-legacy-color-index/v2" || !index.familyMappings || !index.palettes || !index.scales) {
    throw new MigrationError("旧色板索引 schema、familyMappings、palettes 或 scales 无效");
  }
  const records = [];
  const addRecord = ({ legacyFamily, legacyIndex, resolvedValue, currentFamily, currentIndex }) => {
    const indexLabel = String(legacyIndex).padStart(2, "0");
    const parsedValue = parseTypedValue(String(resolvedValue), "color");
    if (!parsedValue) throw new MigrationError(`旧色板 ${legacyFamily}${indexLabel} 不是有效颜色`);
    records.push({
      legacyFamily,
      legacyIndex,
      legacyIndexLabel: indexLabel,
      legacyVariable: `--color-${legacyFamily}${indexLabel}`,
      resolvedValue,
      parsedValue,
      currentFamily,
      currentIndex,
      targetVariable: `--fds-g-color-${currentFamily}-${currentIndex}`,
    });
  };
  for (const [legacyFamily, currentFamily] of Object.entries(index.familyMappings)) {
    const palette = index.palettes[legacyFamily];
    if (!Array.isArray(palette) || palette.length !== 11) {
      throw new MigrationError(`旧色板 ${legacyFamily} 必须包含 00 至 10 共 11 阶`);
    }
    palette.forEach((resolvedValue, legacyIndex) => addRecord({
      legacyFamily,
      legacyIndex,
      resolvedValue,
      currentFamily,
      currentIndex: legacyIndex,
    }));
  }
  for (const [legacyFamily, scale] of Object.entries(index.scales)) {
    if (!Number.isInteger(scale.legacyStart) || !Number.isInteger(scale.currentStart) || !scale.currentFamily || !Array.isArray(scale.values) || !scale.values.length) {
      throw new MigrationError(`旧色板 ${legacyFamily} 的起始索引、目标色系或 values 无效`);
    }
    scale.values.forEach((resolvedValue, offset) => addRecord({
      legacyFamily,
      legacyIndex: scale.legacyStart + offset,
      resolvedValue,
      currentFamily: scale.currentFamily,
      currentIndex: scale.currentStart + offset,
    }));
  }
  return {
    ...index,
    _records: records,
    _byVariable: new Map(records.map((record) => [record.legacyVariable, record])),
  };
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
  if (token.comment) record.comment = token.comment;
  return record;
}

function normalizedValue(value) {
  return String(value).trim().toLowerCase();
}

function sourceExcludedByRule(value, rule) {
  if ((rule.excludedSourceValues || []).some((excluded) =>
    normalizedValue(excluded) === normalizedValue(value) ||
    rule.types.some((tokenType) => valuesEqual(parseTypedValue(value, tokenType), parseTypedValue(excluded, tokenType))))) {
    return true;
  }
  if ((rule.excludedSourceTypes || []).some((tokenType) => parseTypedValue(value, tokenType))) return true;
  const source = parseTypedValue(value, "dimension");
  if (!source) return false;
  const below = rule.excludedSourceBelow ? parseTypedValue(rule.excludedSourceBelow, "dimension") : null;
  if (below?.kind === "dimension" && source.comparable[1] === below.comparable[1] && source.comparable[0] < below.comparable[0]) {
    return true;
  }
  const above = rule.excludedSourceAbove ? parseTypedValue(rule.excludedSourceAbove, "dimension") : null;
  return above?.kind === "dimension" && source.comparable[1] === above.comparable[1] && source.comparable[0] > above.comparable[0];
}

function targetAllowedByRule(token, rule) {
  if (rule._excludedTargetRegexes.some((pattern) => pattern.test(token.name))) return false;
  if ((rule.excludedTargetValues || []).some((excluded) => normalizedValue(excluded) === normalizedValue(token.resolvedValue))) {
    return false;
  }
  return true;
}

function scalarValue(parsed) {
  if (!parsed) return Number.POSITIVE_INFINITY;
  if (parsed.kind === "dimension") return parsed.comparable[0];
  return typeof parsed.comparable === "number" ? parsed.comparable : Number.POSITIVE_INFINITY;
}

function nearestDistance(first, second) {
  if (!first || !second || first.kind !== second.kind) return null;
  if (first.kind === "dimension") {
    return first.comparable[1] === second.comparable[1]
      ? Math.abs(first.comparable[0] - second.comparable[0])
      : null;
  }
  if (["duration", "number"].includes(first.kind)) {
    return Math.abs(first.comparable - second.comparable);
  }
  return null;
}

function scoredCandidates(parsedSource, parsedCandidates) {
  return parsedCandidates
    .map(([token, parsed]) => [nearestDistance(parsedSource, parsed), scalarValue(parsed), token])
    .filter(([distance]) => distance !== null)
    .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2].cssVariable.localeCompare(b[2].cssVariable));
}

function selectNearestCandidate(scored, rule, contexts) {
  const order = rule.selectionOrder || ["scene-context", "semantic-base"];
  const eligible = scored.filter(([, , token]) => order.some((groupName) =>
    !(groupName.startsWith("atomic") && !rule.allowAtomicAuto) && candidateInGroup(token, groupName, contexts)));
  if (!eligible.length) return null;
  const minimumDistance = eligible[0][0];
  const nearest = eligible.filter(([distance]) => Math.abs(distance - minimumDistance) <= 1e-9);
  for (const groupName of order) {
    if (groupName.startsWith("atomic") && !rule.allowAtomicAuto) continue;
    const group = nearest.filter(([, , token]) => candidateInGroup(token, groupName, contexts));
    if (group.length) return group[0];
  }
  return null;
}

function nearestReportCandidates(scored, selected, maxCandidates) {
  const ordered = [];
  const add = (entry) => {
    if (entry && !ordered.some((value) => value[2].cssVariable === entry[2].cssVariable)) ordered.push(entry);
  };
  add(selected);
  scored.forEach(add);
  return ordered.slice(0, maxCandidates);
}

function legacyColorRecord(record) {
  return {
    family: record.legacyFamily,
    index: record.legacyIndexLabel,
    cssVariable: record.legacyVariable,
    resolvedValue: record.resolvedValue,
    targetFamily: record.currentFamily,
    targetIndex: record.currentIndex,
  };
}

function findLegacyColorRecords(value, variables, legacyColorIndex) {
  const variableRecords = [...new Set(variables)]
    .map((name) => legacyColorIndex._byVariable.get(name.toLowerCase()))
    .filter(Boolean);
  if (variableRecords.length) return variableRecords;
  const parsedValue = parseTypedValue(value, "color");
  if (!parsedValue) return [];
  return legacyColorIndex._records.filter((record) => valuesEqual(parsedValue, record.parsedValue));
}

function indexedColorDecision(value, variables, tokens, legacyColorIndex) {
  const legacyRecords = findLegacyColorRecords(value, variables, legacyColorIndex);
  if (!legacyRecords.length) return null;
  const targetVariables = [...new Set(legacyRecords.map((record) => record.targetVariable))];
  const tokenByVariable = new Map(tokens.map((token) => [token.cssVariable, token]));
  return {
    legacyRecords,
    targetVariables,
    token: targetVariables.length === 1 ? tokenByVariable.get(targetVariables[0]) || null : null,
  };
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

function parseVariableChain(value) {
  const nodes = significantNodes(value);
  if (nodes.length !== 1 || nodes[0].type !== "function" || nodes[0].value.toLowerCase() !== "var") return null;

  const variables = [];
  const levels = [];
  let current = nodes[0];
  while (current?.type === "function" && current.value.toLowerCase() === "var") {
    const variable = current.nodes.find((node) => node.type !== "space" && node.type !== "comment" && node.type !== "div");
    if (variable?.type !== "word" || !variable.value.startsWith("--")) return null;
    variables.push(variable.value);
    const level = { name: variable.value };

    const separatorIndex = current.nodes.findIndex((node) => node.type === "div" && node.value === ",");
    if (separatorIndex < 0) {
      levels.push(level);
      return { variables, levels, fallback: null };
    }
    const separator = current.nodes[separatorIndex];
    let start = separator.sourceEndIndex;
    let end = current.sourceEndIndex - 1;
    while (start < end && /\s/.test(value[start])) start += 1;
    while (end > start && /\s/.test(value[end - 1])) end -= 1;
    level.fallback = { value: value.slice(start, end), start, end };
    levels.push(level);

    const fallbackNodes = current.nodes
      .slice(separatorIndex + 1)
      .filter((node) => node.type !== "space" && node.type !== "comment");
    const nested = fallbackNodes.length === 1 && fallbackNodes[0].type === "function" &&
      fallbackNodes[0].value.toLowerCase() === "var" &&
      fallbackNodes[0].sourceIndex === start && fallbackNodes[0].sourceEndIndex === end;
    if (nested) {
      current = fallbackNodes[0];
      continue;
    }
    return {
      variables,
      levels,
      fallback: start < end ? { value: value.slice(start, end), start, end } : null,
    };
  }
  return null;
}

function variableKind(name, componentVariables, legacyColorIndex) {
  if (name.startsWith("--fds-")) return "fds";
  if (legacyColorIndex._byVariable.has(name.toLowerCase())) return "legacy-color";
  if (name.startsWith("--bc-") || componentVariables.has(name)) return "component";
  return "unknown";
}

function analyzePriorityChain(chain, componentVariables, legacyColorIndex) {
  if (!chain) return null;
  const kinds = chain.variables.map((name) => variableKind(name, componentVariables, legacyColorIndex));
  if (kinds.includes("unknown")) return null;
  const component = chain.variables.filter((_, index) => kinds[index] === "component");
  const fds = chain.variables.filter((_, index) => kinds[index] === "fds");
  const legacyColor = chain.variables.filter((_, index) => kinds[index] === "legacy-color");
  const ranks = kinds.map((kind) => ({ component: 0, fds: 1, "legacy-color": 2 })[kind]);
  const orderValid = fds.length <= 1 && ranks.every((rank, index) => index === 0 || ranks[index - 1] <= rank);
  const leadingComponentCount = kinds.findIndex((kind) => kind !== "component");
  const componentCount = leadingComponentCount < 0 ? kinds.length : leadingComponentCount;
  const insertionSpan = componentCount
    ? chain.levels[componentCount - 1].fallback || null
    : { value: null, start: 0, end: null };
  return { ...chain, kinds, component, fds, legacyColor, orderValid, insertionSpan };
}

function priorityFallbackReplacement(originalValue, chain, token) {
  const { start, value } = chain.insertionSpan;
  const end = chain.insertionSpan.end ?? originalValue.length;
  const fallback = value ?? originalValue;
  return `${originalValue.slice(0, start)}var(${token.cssVariable}, ${fallback})${originalValue.slice(end)}`;
}

function makeId(occurrence) {
  return createHash("sha256")
    .update(`${occurrence.file}:${occurrence.line}:${occurrence.column}:${occurrence.property}:${occurrence.originalValue}`)
    .digest("hex")
    .slice(0, 16);
}

export function classifyOccurrence(occurrence, tokens, policy, legacyColorIndex, contexts = [], componentVariables = new Set()) {
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
  const priorityChain = analyzePriorityChain(parseVariableChain(occurrence.originalValue), componentVariables, legacyColorIndex);
  let comparisonValue = occurrence.originalValue;
  if (priorityChain) {
    if (priorityChain.component.length || priorityChain.legacyColor.length) {
      finding.priorityVariables = priorityChain.variables;
    }
    if (priorityChain.component.length) {
      finding.priorityProtected = true;
      finding.componentVariables = priorityChain.component;
    }
    if (priorityChain.legacyColor.length) {
      finding.legacyColorVariables = priorityChain.legacyColor;
      const legacyBrandVariables = priorityChain.legacyColor.filter((name) => /^--color-blue(?:0\d|10)$/i.test(name));
      if (legacyBrandVariables.length) finding.legacyBrandVariables = legacyBrandVariables;
    }
    if (priorityChain.fallback) finding.fallbackValue = priorityChain.fallback.value;

    const fdsVariables = [...new Set(priorityChain.fds)];
    if (fdsVariables.length) {
      const invalid = fdsVariables.filter((name) => !tokenByVariable.has(name));
      if (invalid.length) {
        finding.status = "invalid-token";
        finding.reason = `变量 fallback 链中包含 Catalog 不存在的 FDS Token：${invalid.join(", ")}`;
        return finding;
      }
      const existingTokens = fdsVariables.map((name) => tokenByVariable.get(name));
      const indexedDecision = rule.types.includes("color")
        ? indexedColorDecision(priorityChain.fallback?.value || occurrence.originalValue, priorityChain.legacyColor, tokens, legacyColorIndex)
        : null;
      const indexedTargetVariables = new Set(indexedDecision?.targetVariables || []);
      const incompatible = existingTokens.filter((token) => !tokenAllowed(token, rule) && !indexedTargetVariables.has(token.cssVariable));
      finding.candidates = existingTokens.map((token) => candidateRecord(token, incompatible.includes(token) ? "invalid-property" : "existing"));
      if (incompatible.length) {
        finding.status = "invalid-token";
        finding.reason = "变量 fallback 链中的 FDS Token 与当前 CSS property 不兼容";
      } else if (!priorityChain.orderValid) {
        finding.status = "invalid-token";
        finding.reason = "变量 fallback 优先级不符合“组件变量 > FDS Token > 旧色板变量 > 原值”，保持源码不变";
      } else {
        finding.status = "compliant";
        finding.reason = priorityChain.component.length && priorityChain.legacyColor.length
          ? "已保持组件变量在 FDS 外层，旧色板变量在 FDS 之后"
          : priorityChain.component.length
          ? "已保持组件自定义变量在 FDS 外层"
          : priorityChain.legacyColor.length
          ? "已保持 FDS 在旧色板变量之前"
          : "FDS Token 存在且 property 兼容";
      }
      return finding;
    }
    if (!priorityChain.fallback && !priorityChain.legacyColor.length) {
      finding.reason = priorityChain.component.length
        ? "组件自定义变量优先；未提供可验证的末端原值，不插入 FDS Token"
        : "变量未提供可验证的末端原值，无法选择 FDS Token";
      return finding;
    }
    if (priorityChain.fallback) comparisonValue = priorityChain.fallback.value;
  }

  const variables = collectCssVariables(comparisonValue);
  const invalid = [...new Set(variables.filter((name) => name.startsWith("--fds-") && !tokenByVariable.has(name)))].sort();
  if (invalid.length) {
    finding.status = "invalid-token";
    finding.reason = `FDS Catalog 中不存在变量：${invalid.join(", ")}`;
    return finding;
  }
  if (variables.length && !priorityChain?.legacyColor.length) {
    finding.reason = priorityChain
      ? "变量链末端 fallback 是复合变量表达式，无法安全插入 FDS Token"
      : variables.every((name) => name.startsWith("--fds-"))
      ? "包含 FDS Token 的复合表达式，当前不对表达式语义做自动判断"
      : "非 FDS 动态变量可能属于组件或业务私有契约，需要显式映射后再判断";
    return finding;
  }

  if (rule.types.includes("color")) {
    const indexedDecision = indexedColorDecision(
      comparisonValue,
      priorityChain?.legacyColor || [],
      tokens,
      legacyColorIndex,
    );
    if (indexedDecision) {
      finding.legacyColors = indexedDecision.legacyRecords.map(legacyColorRecord);
      if (indexedDecision.targetVariables.length !== 1) {
        finding.status = "ambiguous";
        finding.reason = "旧色值对应多个不同的新色板索引，需要人工确认";
        return finding;
      }
      if (!indexedDecision.token) {
        finding.status = "missing-token";
        finding.reason = `Catalog 缺少索引映射目标：${indexedDecision.targetVariables[0]}`;
        return finding;
      }
      finding.candidates = [candidateRecord(indexedDecision.token, "legacy-index")];
      finding.selectedToken = finding.candidates[0];
      if (!occurrence.writable || !finding._span) {
        finding.status = "unsupported";
        finding.reason = "存在唯一旧色板索引映射，但当前语法节点不能安全局部改写";
        return finding;
      }
      finding.status = "auto-replace";
      finding.reason = "按已确认的旧新色板索引关系映射，不比较新旧颜色值";
      finding.replacement = priorityChain
        ? priorityFallbackReplacement(occurrence.originalValue, priorityChain, indexedDecision.token)
        : `var(${indexedDecision.token.cssVariable}, ${occurrence.originalValue})`;
      return finding;
    }
    finding.status = "missing-token";
    finding.reason = "颜色迁移只接受内置旧色板的变量或色值，并按索引映射；不按当前 FDS 值或颜色距离猜测";
    return finding;
  }

  if (policy.exemptValues.some((value) => value.toLowerCase() === comparisonValue.trim().toLowerCase())) {
    finding.reason = priorityChain
      ? "变量链末端 fallback 是无需 Token 化的 CSS 通用值或零值"
      : "CSS 通用值或零值无需 Token 化";
    return finding;
  }

  if (rule.excludeHardcoded) {
    finding.reason = "间距可能承担布局、尺寸或组件内部特殊关系，无法可靠判断语义，硬编码值直接排除迁移";
    return finding;
  }
  if (sourceExcludedByRule(comparisonValue, rule)) {
    finding.reason = rule.id === "font-size"
      ? "小于 12px 或超过 48px 的字号按约定保留硬编码，直接排除迁移"
      : rule.id === "line-height"
      ? "固定行高维持现状，不换算、不替换，直接排除迁移"
      : "透明度 0/1 是端点值，按约定保留硬编码且不替换为 Token";
    return finding;
  }

  let parsedSource = null;
  for (const tokenType of rule.types) {
    parsedSource = parseTypedValue(comparisonValue, tokenType);
    if (parsedSource) break;
  }
  if (!parsedSource) {
    finding.reason = priorityChain
      ? "变量链末端 fallback 不是可完整比较的单一 Token 值，保持原链不变"
      : "当前值不是可完整比较的单一 Token 值，未处理 shorthand 或动态表达式";
    return finding;
  }

  const parsedCandidates = tokens
    .filter((token) => tokenAllowed(token, rule) && targetAllowedByRule(token, rule))
    .map((token) => [token, parseTypedValue(String(token.resolvedValue), token.type)])
    .filter(([, parsed]) => parsed);
  const maxCandidates = Number(policy.similarity.maxCandidates);
  if (rule.nearestAutoReplace) {
    const scored = scoredCandidates(parsedSource, parsedCandidates);
    const selectedScore = selectNearestCandidate(scored, rule, contexts);
    const reportScores = nearestReportCandidates(scored, selectedScore, maxCandidates);
    const selected = selectedScore?.[2] || null;
    const selectedDistance = selectedScore?.[0];
    const valueChanged = selectedDistance !== null && selectedDistance > 1e-9;
    finding.candidates = reportScores.map(([distance, , token]) => candidateRecord(
      token,
      distance <= 1e-9 ? "exact" : "nearest",
      distance,
    ));
    if (!selected) {
      finding.status = "missing-token";
      finding.reason = "没有符合层级边界且可比较的最近 Token 候选";
      return finding;
    }
    const selectedMatch = selectedDistance <= 1e-9 ? "exact" : "nearest";
    finding.selectedToken = candidateRecord(selected, selectedMatch, selectedDistance);
    if (valueChanged) {
      finding.valueChange = {
        from: comparisonValue,
        to: selected.resolvedValue,
      };
    }
    if (!occurrence.writable || !finding._span) {
      finding.status = "unsupported";
      finding.reason = "存在最近候选，但当前语法节点不能安全局部改写";
      return finding;
    }
    finding.status = "auto-replace";
    finding.reason = valueChanged
      ? `按最近档自动替换：${comparisonValue} -> ${selected.resolvedValue}；报告保留候选供人工复核`
      : "命中精确档位；报告保留相近候选供人工复核";
    finding.replacement = priorityChain
      ? priorityFallbackReplacement(occurrence.originalValue, priorityChain, selected)
      : `var(${selected.cssVariable}, ${occurrence.originalValue})`;
    return finding;
  }
  const exact = parsedCandidates
    .filter(([, parsed]) => valuesEqual(parsedSource, parsed))
    .map(([token]) => token)
    .sort((a, b) => a.cssVariable.localeCompare(b.cssVariable));
  if (exact.length) {
    const [selected, selection] = selectExactCandidate(exact, rule, contexts);
    finding.candidates = exact.slice(0, maxCandidates).map((token) => candidateRecord(token, "exact"));
    if (selected && occurrence.writable && finding._span) {
      finding.status = "auto-replace";
      finding.reason = priorityChain?.component.length && priorityChain.legacyColor.length
        ? "唯一精确候选满足规则；FDS 插入组件变量之后、旧色板变量之前"
        : priorityChain?.component.length
        ? "唯一精确候选满足规则；保留组件变量优先级，在其 fallback 中插入 FDS"
        : priorityChain?.legacyColor.length
        ? "唯一精确候选满足规则；FDS 插入旧色板变量之前"
        : "唯一精确候选满足 property 和层级边界";
      finding.selectedToken = candidateRecord(selected, "exact");
      finding.replacement = priorityChain
        ? priorityFallbackReplacement(occurrence.originalValue, priorityChain, selected)
        : `var(${selected.cssVariable}, ${occurrence.originalValue})`;
    } else if (selected) {
      finding.status = "unsupported";
      finding.reason = "存在唯一精确候选，但当前语法节点不能安全局部改写";
      finding.selectedToken = candidateRecord(selected, "exact");
    } else {
      finding.status = "ambiguous";
      const reason = selection === "multiple"
        ? "同一优先级存在多个精确候选，需要语义判断"
        : "精确候选存在，但超出自动消费层级或缺少 Scene 上下文";
      finding.reason = priorityChain ? `${reason}；已有变量 fallback 链保持不变` : reason;
    }
    return finding;
  }

  if (rule.preserveUnmatchedHardcoded) {
    finding.reason = rule.id === "layer"
      ? "非标准层级值按约定保留硬编码，不补充 Token，也不列入迁移问题"
      : "非标准阴影值按约定保留硬编码，不补充 Token，也不列入迁移问题";
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
      finding.reason = priorityChain
        ? "末端原值仅存在相近候选；数值接近不证明语义一致，已有变量 fallback 链保持不变"
        : "仅存在相近候选；数值接近不证明语义一致";
      finding.candidates = scored.slice(0, maxCandidates).map(([distance, token]) => candidateRecord(token, "similar", distance));
      return finding;
    }
  }

  finding.status = "missing-token";
  finding.reason = priorityChain
    ? "变量链末端原值没有可靠 FDS Token 候选，保持原链不变"
    : "该 property 属于 Token 管理范围，但没有可靠候选";
  return finding;
}

export function publicFinding(finding) {
  return Object.fromEntries(Object.entries(finding).filter(([key, value]) => !key.startsWith("_") && value !== undefined));
}
