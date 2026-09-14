import postcss from "postcss";
import scss from "postcss-scss";
import less from "postcss-less";
import sass from "postcss-sass";

const PARSERS = { css: undefined, pcss: undefined, wxss: undefined, "css-in-js-template": undefined, scss, less, sass };

function offsetToPosition(fullText, offset) {
  const before = fullText.slice(0, offset);
  const lines = before.split(/\r?\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function positionToOffset(text, line, column) {
  const lines = text.split(/(?<=\n)/);
  return lines.slice(0, line - 1).reduce((total, value) => total + value.length, 0) + column - 1;
}

function trimSpan(text, start, end) {
  while (start < end && /\s/.test(text[start])) start += 1;
  while (end > start && /\s/.test(text[end - 1])) end -= 1;
  return [start, end];
}

function declarationContainer(declaration, fallback) {
  let current = declaration.parent;
  while (current) {
    if (current.type === "rule") return current.selector;
    if (current.type === "atrule") return `@${current.name}${current.params ? ` ${current.params}` : ""}`;
    current = current.parent;
  }
  return fallback;
}

export function parseStylesheet({ text, fullText = text, file, syntax = "css", baseOffset = 0, container = "stylesheet" }) {
  const occurrences = [];
  const parseErrors = [];
  if (!(syntax in PARSERS)) {
    const position = offsetToPosition(fullText, baseOffset);
    parseErrors.push({
      file,
      line: position.line,
      column: position.column,
      syntax,
      container,
      message: `不支持的样式语法：${syntax}`,
    });
    return { occurrences, parseErrors };
  }
  try {
    const parser = PARSERS[syntax];
    const root = postcss([]).process(text, parser ? { from: undefined, syntax: parser } : { from: undefined }).root;
    root.walkDecls((declaration) => {
      const localStart = declaration.source?.start?.offset ?? positionToOffset(
        text,
        declaration.source?.start?.line || 1,
        declaration.source?.start?.column || 1,
      );
      const rawProperty = declaration.raws?.prop?.raw || declaration.prop;
      const between = declaration.raws?.between || ":";
      let start = baseOffset + localStart + rawProperty.length + between.length;
      const rawValue = declaration.raws?.value?.raw || declaration.value;
      let end = start + rawValue.length;
      [start, end] = trimSpan(fullText, start, end);
      if (start >= end) return;
      const position = offsetToPosition(fullText, start);
      const parentStart = declaration.parent?.source?.start?.offset ?? localStart;
      occurrences.push({
        file,
        syntax,
        container: declarationContainer(declaration, container),
        selector: declarationContainer(declaration, container),
        property: declaration.prop,
        originalValue: fullText.slice(start, end),
        start,
        end,
        line: position.line,
        column: position.column,
        writable: true,
        _styleGroup: `${file}:${baseOffset + parentStart}`,
      });
    });
  } catch (error) {
    const localOffset = error.input?.offset ?? error.offset ?? positionToOffset(
      text,
      error.line || 1,
      error.column || 1,
    );
    const position = offsetToPosition(fullText, baseOffset + localOffset);
    parseErrors.push({
      file,
      line: position.line,
      column: position.column,
      syntax,
      container,
      message: error.reason || error.message,
    });
  }
  return { occurrences, parseErrors };
}

export function parseInlineStyle({ text, fullText, file, baseOffset, syntax = "html-inline-style", container }) {
  const prefix = ".__fds_inline__{";
  const result = parseStylesheet({
    text: `${prefix}${text}}`,
    fullText,
    file,
    syntax: "css",
    baseOffset: baseOffset - prefix.length,
    container,
  });
  for (const occurrence of result.occurrences) occurrence.syntax = syntax;
  for (const error of result.parseErrors) error.syntax = syntax;
  return result;
}
