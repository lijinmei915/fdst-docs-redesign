import valueParser from "postcss-value-parser";
import { createHash } from "node:crypto";

const GLOBAL = /^(?:inherit|initial|unset|revert|revert-layer)$/i;
const LENGTH = /^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|em|rem|ex|ch|cap|ic|lh|rlh|vw|vh|vmin|vmax|cm|mm|q|in|pt|pc|%))$/i;
const TIME = /^-?(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s)$/i;
const EASING = /^(?:ease|linear|ease-in|ease-out|ease-in-out|step-start|step-end)$/i;
const meaningful = nodes => nodes.filter(n => n.type !== "space" && n.type !== "comment");

// Return disjoint source spans so each value keeps its own candidates and fallback.
export function expandCompositeOccurrence(occurrence, tokens = []) {
  if (occurrence.unsupportedReason || !occurrence.writable) return [occurrence];
  const property = occurrence.property.toLowerCase();
  const value = occurrence.originalValue;
  if (GLOBAL.test(value.trim())) return [occurrence];
  const nodes = meaningful(valueParser(value).nodes);
  const raw = node => value.slice(node.sourceIndex, node.sourceEndIndex);
  const uncertain = () => [{ ...occurrence, unsupportedReason: "复合样式无法安全拆解为确定值，保留源码并交由人工检查" }];
  const part = (node, effectiveProperty) => {
    const before = value.slice(0, node.sourceIndex).split(/\r?\n/);
    return {
      ...occurrence, property: effectiveProperty, sourceProperty: property,
      declarationId: createHash("sha256").update(`${occurrence.file}:${occurrence.start}:${property}`).digest("hex").slice(0, 16),
      originalValue: raw(node), start: occurrence.start + node.sourceIndex,
      end: occurrence.start + node.sourceEndIndex,
      line: occurrence.line + before.length - 1,
      column: before.length === 1 ? occurrence.column + before[0].length : before.at(-1).length + 1,
    };
  };
  const variable = node => node.type === "function" && node.value.toLowerCase() === "var" && !node.unclosed;
  const resolved = node => {
    if (!variable(node)) return raw(node);
    const name = meaningful(node.nodes)[0]?.value;
    const token = tokens.find(t => t.cssVariable === name);
    return token ? String(token.resolvedValue) : "";
  };
  const split = separator => {
    const groups = [[]];
    for (const node of nodes) {
      if (node.type === "div" && node.value === separator) groups.push([]);
      else groups.at(-1).push(node);
    }
    return groups;
  };
  const colorList = /^(?:border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?-color)$/;
  const widthList = /^(?:border(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?-width)$/;
  const radius = /^border(?:-(?:top-left|top-right|bottom-left|bottom-right|start-start|start-end|end-start|end-end))?-radius$/;
  if (colorList.test(property) || widthList.test(property) || radius.test(property)) {
    const effective = radius.test(property) ? "border-radius" : colorList.test(property) ? "border-color" : "border-width";
    const groups = split("/");
    const max = property === "border-radius" || property === "border-color" || property === "border-width" ? 4 : /-(?:block|inline)-(?:color|width)$/.test(property) || radius.test(property) ? 2 : 1;
    if (groups.length > (property === "border-radius" ? 2 : 1) || groups.some(group => !group.length || group.length > max)) return uncertain();
    if (nodes.some(n => n.unclosed || (n.type === "div" && n.value !== "/"))) return uncertain();
    const values = groups.flat();
    if (effective !== "border-color" && values.some(n => !LENGTH.test(raw(n)) && !variable(n) && !(effective === "border-width" && /^(?:thin|medium|thick)$/.test(raw(n))))) return uncertain();
    if (values.length === 1 && effective === property) return [occurrence];
    return values.map(n => part(n, effective));
  }
  if (/^(?:transition|animation)-(?:duration|timing-function)$/.test(property)) {
    const groups = split(",");
    if (groups.some(g => g.length !== 1)) return uncertain();
    return groups.length === 1 ? [occurrence] : groups.map(g => part(g[0], property));
  }
  if (property === "transition") {
    if (value.trim().toLowerCase() === "none") return [occurrence];
    const selected = [];
    for (const group of split(",")) {
      let times = 0;
      let easing = false;
      let name = false;
      if (!group.length) return uncertain();
      for (const node of group) {
        const text = resolved(node);
        if (TIME.test(text)) {
          if (++times > 2 || (times === 1 && text.startsWith("-"))) return uncertain();
          if (times === 1) selected.push(part(node, "transition-duration"));
        } else if (EASING.test(text) || /^(?:cubic-bezier|steps|linear)\(/.test(text)) {
          if (easing || node.unclosed) return uncertain();
          easing = true;
          selected.push(part(node, "transition-timing-function"));
        } else if (node.type === "word" && /^[-a-zA-Z_][\w-]*$/.test(text) && !GLOBAL.test(text)) {
          if (name || text === "none") return uncertain();
          name = true;
        } else return uncertain();
      }
    }
    return selected.length ? selected : uncertain();
  }
  if (property === "font") {
    if (/^(?:caption|icon|menu|message-box|small-caption|status-bar)$/.test(value.trim())) return [occurrence];
    const sizeIndex = nodes.findIndex(n => LENGTH.test(resolved(n)));
    if (sizeIndex < 0) return uncertain();
    const selected = [];
    let weight = false;
    for (const node of nodes.slice(0, sizeIndex)) {
      const text = resolved(node);
      if (/^(?:[1-9]00|bold|bolder|lighter)$/.test(text)) {
        if (weight) return uncertain();
        weight = true;
        selected.push(part(node, "font-weight"));
      } else if (!/^(?:normal|italic|oblique|small-caps|ultra-condensed|extra-condensed|condensed|semi-condensed|semi-expanded|expanded|extra-expanded|ultra-expanded)$/.test(text)) return uncertain();
    }
    selected.push(part(nodes[sizeIndex], "font-size"));
    let familyIndex = sizeIndex + 1;
    if (nodes[familyIndex]?.type === "div" && nodes[familyIndex].value === "/") {
      const height = nodes[++familyIndex];
      if (!height || (!LENGTH.test(resolved(height)) && !/^(?:\d+(?:\.\d+)?|normal)$/.test(resolved(height)))) return uncertain();
      selected.push(part(height, "line-height"));
      familyIndex++;
    }
    const family = nodes.slice(familyIndex);
    if (!family.length || family.some(n => !["word", "string"].includes(n.type) && !(n.type === "div" && n.value === ","))) return uncertain();
    return selected;
  }
  // These can contain managed values, but guessing their grammar would be unsafe.
  if (/^(?:animation|background-image|text-decoration|text-emphasis|text-shadow|filter|backdrop-filter|border-image|mask|mask-image)$/.test(property) && !/^(?:none|auto|normal|initial|inherit|unset|revert|revert-layer)$/.test(value.trim())) return uncertain();
  return [occurrence];
}
