import { NodeTypes, parse as parseDom } from "@vue/compiler-dom";
import { parse as parseSfc } from "@vue/compiler-sfc";
import { parseInlineStyle, parseStylesheet } from "./stylesheet-adapter.mjs";
import { parseScript, parseStyleExpression } from "./script-adapter.mjs";

function offsetToPosition(text, offset) {
  const lines = text.slice(0, offset).split(/\r?\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function attributeValueRange(attribute, baseOffset) {
  const source = attribute.loc.source;
  const equals = source.indexOf("=");
  if (equals < 0) return null;
  const remainder = source.slice(equals + 1);
  const first = remainder.search(/\S/);
  if (first < 0) return null;
  const marker = remainder[first];
  const localStart = equals + 1 + first;
  if (marker === '"' || marker === "'") {
    const closing = source.lastIndexOf(marker);
    return closing > localStart
      ? [baseOffset + attribute.loc.start.offset + localStart + 1, baseOffset + attribute.loc.start.offset + closing]
      : null;
  }
  return [baseOffset + attribute.loc.start.offset + localStart, baseOffset + attribute.loc.end.offset];
}

function walkTemplate(node, visitor) {
  visitor(node);
  for (const child of node.children || []) walkTemplate(child, visitor);
  if (node.type === NodeTypes.IF) {
    for (const branch of node.branches) walkTemplate(branch, visitor);
  }
  if (node.type === NodeTypes.FOR && node.children) {
    for (const child of node.children) walkTemplate(child, visitor);
  }
}

export function parseMarkup({ text, fullText = text, file, baseOffset = 0, syntax = "html", container = "markup" }) {
  const occurrences = [];
  const parseErrors = [];
  let ast;
  try {
    ast = parseDom(text, {
      comments: true,
      onError(error) {
        const offset = baseOffset + (error.loc?.start?.offset || 0);
        const position = offsetToPosition(fullText, offset);
        parseErrors.push({ file, line: position.line, column: position.column, syntax, container, message: error.message });
      },
    });
  } catch (error) {
    const position = offsetToPosition(fullText, baseOffset);
    parseErrors.push({ file, line: position.line, column: position.column, syntax, container, message: error.message });
    return { occurrences, parseErrors };
  }

  walkTemplate(ast, (node) => {
    if (node.type !== NodeTypes.ELEMENT) return;
    for (const prop of node.props) {
      const isStaticStyle = prop.type === NodeTypes.ATTRIBUTE && prop.name === "style" && prop.value;
      const isBoundStyle = prop.type === NodeTypes.DIRECTIVE && prop.name === "bind" && prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && prop.arg.content === "style" && prop.exp;
      if (!isStaticStyle && !isBoundStyle) continue;
      const range = attributeValueRange(prop, baseOffset);
      if (!range) continue;
      const elementContainer = `${syntax}:<${node.tag}> style`;
      if (isStaticStyle) {
        const inlineStyle = fullText.slice(range[0], range[1]);
        if (syntax === "wxml" && (inlineStyle.includes("{{") || inlineStyle.includes("}}"))) {
          const position = offsetToPosition(fullText, range[0]);
          occurrences.push({
            file,
            syntax: "wxml-inline-style",
            container: elementContainer,
            selector: elementContainer,
            property: "<style-interpolation>",
            originalValue: inlineStyle,
            start: range[0],
            end: range[1],
            line: position.line,
            column: position.column,
            writable: false,
            unsupportedReason: "WXML style 包含模板插值，无法静态证明完整声明值",
          });
          continue;
        }
        const result = parseInlineStyle({
          text: inlineStyle,
          fullText,
          file,
          baseOffset: range[0],
          container: elementContainer,
        });
        for (const occurrence of result.occurrences) occurrence.syntax = `${syntax}-inline-style`;
        for (const error of result.parseErrors) error.syntax = `${syntax}-inline-style`;
        occurrences.push(...result.occurrences);
        parseErrors.push(...result.parseErrors);
      } else {
        const result = parseStyleExpression({
          text: fullText.slice(range[0], range[1]),
          fullText,
          file,
          baseOffset: range[0],
          container: elementContainer,
        });
        occurrences.push(...result.occurrences);
        parseErrors.push(...result.parseErrors);
      }
    }
  });
  return { occurrences, parseErrors };
}

function blockOffset(source, block) {
  if (source.slice(block.loc.start.offset, block.loc.end.offset) === block.content) return block.loc.start.offset;
  const opening = source.lastIndexOf("<", block.loc.start.offset);
  const found = source.indexOf(block.content, Math.max(0, opening));
  return found >= 0 ? found : block.loc.start.offset;
}

export function parseVue({ text, file }) {
  const occurrences = [];
  const parseErrors = [];
  let descriptor;
  try {
    const result = parseSfc(text, { filename: file });
    descriptor = result.descriptor;
    for (const error of result.errors) {
      const offset = error.loc?.start?.offset || 0;
      const position = offsetToPosition(text, offset);
      parseErrors.push({ file, line: position.line, column: position.column, syntax: "vue", container: "sfc", message: error.message || String(error) });
    }
  } catch (error) {
    parseErrors.push({ file, line: 1, column: 1, syntax: "vue", container: "sfc", message: error.message });
    return { occurrences, parseErrors };
  }

  for (const [index, style] of descriptor.styles.entries()) {
    const offset = blockOffset(text, style);
    const styleSyntax = (style.lang || "css").toLowerCase();
    const result = parseStylesheet({
      text: style.content,
      fullText: text,
      file,
      syntax: styleSyntax,
      baseOffset: offset,
      container: `vue:style[${index}]`,
    });
    occurrences.push(...result.occurrences);
    parseErrors.push(...result.parseErrors);
  }
  if (descriptor.template) {
    const offset = blockOffset(text, descriptor.template);
    const result = parseMarkup({
      text: descriptor.template.content,
      fullText: text,
      file,
      baseOffset: offset,
      syntax: "vue-template",
      container: "vue:template",
    });
    occurrences.push(...result.occurrences);
    parseErrors.push(...result.parseErrors);
  }
  for (const [name, script] of [["script", descriptor.script], ["script-setup", descriptor.scriptSetup]]) {
    if (!script) continue;
    const offset = blockOffset(text, script);
    const extension = script.lang === "ts" || script.lang === "tsx" ? `.${script.lang}` : ".js";
    const result = parseScript({
      text: script.content,
      fullText: text,
      file,
      extension,
      baseOffset: offset,
      container: `vue:${name}`,
      typescript: extension === ".ts" || extension === ".tsx",
    });
    occurrences.push(...result.occurrences);
    parseErrors.push(...result.parseErrors);
  }
  return { occurrences, parseErrors };
}
