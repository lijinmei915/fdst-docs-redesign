import { parse, parseExpression } from "@babel/parser";
import traverseModule from "@babel/traverse";
import { parseStylesheet } from "./stylesheet-adapter.mjs";

const traverse = traverseModule.default || traverseModule;
const STYLE_CALLS = new Set(["css", "createStyles", "makeStyles"]);

function offsetToPosition(text, offset) {
  const lines = text.slice(0, offset).split(/\r?\n/);
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

function keyName(node) {
  if (!node || node.computed) return null;
  if (node.key.type === "Identifier" || node.key.type === "StringLiteral") return node.key.name || node.key.value;
  return null;
}

function toCssProperty(name) {
  if (name.startsWith("--")) return name;
  return name
    .replace(/^ms([A-Z])/, "-ms-$1")
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase();
}

function literalSpan(node, fullText, baseOffset) {
  if (node.type === "StringLiteral") {
    return [baseOffset + node.start + 1, baseOffset + node.end - 1];
  }
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return [baseOffset + node.start + 1, baseOffset + node.end - 1];
  }
  return null;
}

function unsupportedOccurrence({ file, fullText, baseOffset, syntax, container, property, node, reason }) {
  const start = baseOffset + (node.start || 0);
  const end = baseOffset + (node.end || node.start || 0);
  const position = offsetToPosition(fullText, start);
  return {
    file,
    syntax,
    container,
    property,
    originalValue: fullText.slice(start, end),
    line: position.line,
    column: position.column,
    writable: false,
    unsupportedReason: reason,
  };
}

function containsTypeName(node, name) {
  if (!node || typeof node !== "object") return false;
  if ((node.type === "Identifier" || node.type === "TSQualifiedName") && (node.name === name || node.right?.name === name)) return true;
  return Object.entries(node).some(([key, value]) => !["loc", "start", "end"].includes(key) &&
    (Array.isArray(value) ? value.some((item) => containsTypeName(item, name)) : containsTypeName(value, name)));
}

function unwrapTypeExpression(node) {
  let current = node;
  while (["TSAsExpression", "TSSatisfiesExpression", "TSTypeAssertion", "TSNonNullExpression"].includes(current?.type)) {
    current = current.expression;
  }
  return current;
}

function processStyleObject(node, context, seen) {
  if (!node || node.type !== "ObjectExpression" || seen.has(node)) return;
  seen.add(node);
  const styleGroup = `${context.file}:${context.baseOffset + node.start}`;
  for (const member of node.properties) {
    if (member.type === "SpreadElement") {
      context.occurrences.push(unsupportedOccurrence({
        ...context,
        property: "<spread>",
        node: member,
        reason: "样式对象包含 spread，当前不跟踪跨变量数据流",
      }));
      continue;
    }
    if (member.type !== "ObjectProperty") {
      context.occurrences.push(unsupportedOccurrence({
        ...context,
        property: "<method>",
        node: member,
        reason: "样式对象方法无法静态判定为单一 CSS 值",
      }));
      continue;
    }
    const rawKey = keyName(member);
    if (!rawKey) {
      context.occurrences.push(unsupportedOccurrence({
        ...context,
        property: "<computed>",
        node: member,
        reason: "计算属性名无法静态映射到 CSS property",
      }));
      continue;
    }
    if (member.value.type === "ObjectExpression") {
      processStyleObject(member.value, { ...context, container: `${context.container}.${rawKey}` }, seen);
      continue;
    }

    const property = toCssProperty(rawKey);
    const span = literalSpan(member.value, context.fullText, context.baseOffset);
    if (span) {
      const position = offsetToPosition(context.fullText, span[0]);
      context.occurrences.push({
        file: context.file,
        syntax: context.syntax,
        container: context.container,
        property,
        originalValue: context.fullText.slice(span[0], span[1]),
        start: span[0],
        end: span[1],
        line: position.line,
        column: position.column,
        writable: true,
        _styleGroup: styleGroup,
      });
      continue;
    }
    context.occurrences.push(unsupportedOccurrence({
      ...context,
      property,
      node: member.value,
      reason: member.value.type === "NumericLiteral"
        ? "数值样式的运行时单位由框架决定，首版只报告不自动改写"
        : "动态样式表达式无法静态证明最终 CSS 值",
    }));
  }
}

function isCssTag(tag) {
  return tag.type === "Identifier" && tag.name === "css" ||
    tag.type === "MemberExpression" && tag.object.type === "Identifier" && tag.object.name === "styled";
}

function processTaggedTemplate(node, context) {
  if (!isCssTag(node.tag)) return;
  if (node.quasi.expressions.length) {
    context.occurrences.push(unsupportedOccurrence({
      ...context,
      property: "<template-interpolation>",
      node: node.quasi,
      reason: "CSS-in-JS 模板包含插值，无法静态证明完整声明值",
    }));
    return;
  }
  const contentStart = context.baseOffset + node.quasi.start + 1;
  const contentEnd = context.baseOffset + node.quasi.end - 1;
  const result = parseStylesheet({
    text: context.fullText.slice(contentStart, contentEnd),
    fullText: context.fullText,
    file: context.file,
    syntax: "css-in-js-template",
    baseOffset: contentStart,
    container: "css-template",
  });
  context.occurrences.push(...result.occurrences);
  context.parseErrors.push(...result.parseErrors);
}

function parserPlugins(extension, typescript) {
  const plugins = ["decorators-legacy", "classProperties", "classPrivateProperties", "classPrivateMethods", "dynamicImport", "topLevelAwait", "jsx"];
  if (typescript || [".ts", ".tsx"].includes(extension)) plugins.push("typescript");
  return plugins;
}

export function parseScript({ text, fullText = text, file, extension = ".js", baseOffset = 0, container = "script", typescript = false }) {
  const occurrences = [];
  const parseErrors = [];
  const syntax = extension.replace(/^\./, "") || "js";
  let ast;
  try {
    ast = parse(text, {
      sourceType: "unambiguous",
      errorRecovery: false,
      plugins: parserPlugins(extension, typescript),
    });
  } catch (error) {
    const localOffset = error.pos || 0;
    const position = offsetToPosition(fullText, baseOffset + localOffset);
    parseErrors.push({ file, line: position.line, column: position.column, syntax, container, message: error.message });
    return { occurrences, parseErrors };
  }

  const seen = new WeakSet();
  const context = { occurrences, parseErrors, file, fullText, baseOffset, syntax, container };
  traverse(ast, {
    JSXAttribute(path) {
      if (path.node.name?.name !== "style") return;
      const expression = path.node.value?.type === "JSXExpressionContainer" ? path.node.value.expression : null;
      if (expression?.type === "ObjectExpression") {
        processStyleObject(expression, { ...context, container: "jsx:style" }, seen);
      } else if (expression) {
        occurrences.push(unsupportedOccurrence({
          ...context,
          container: "jsx:style",
          property: "<style-reference>",
          node: expression,
          reason: "JSX style 引用了动态表达式，当前不跟踪跨变量数据流",
        }));
      }
    },
    VariableDeclarator(path) {
      const object = unwrapTypeExpression(path.node.init);
      const hasStyleType = containsTypeName(path.node.id?.typeAnnotation, "CSSProperties") ||
        containsTypeName(path.node.init?.typeAnnotation, "CSSProperties");
      if (object?.type !== "ObjectExpression" || !hasStyleType) return;
      processStyleObject(object, { ...context, container: `CSSProperties:${path.node.id.name || "object"}` }, seen);
    },
    CallExpression(path) {
      if (path.node.callee.type !== "Identifier" || !STYLE_CALLS.has(path.node.callee.name)) return;
      for (const argument of path.node.arguments) {
        if (argument.type === "ObjectExpression") {
          processStyleObject(argument, { ...context, container: `${path.node.callee.name}()` }, seen);
        } else if (["ArrowFunctionExpression", "FunctionExpression"].includes(argument.type)) {
          if (argument.body.type === "ObjectExpression") {
            processStyleObject(argument.body, { ...context, container: `${path.node.callee.name}():return` }, seen);
          } else if (argument.body.type === "BlockStatement") {
            for (const statement of argument.body.body) {
              if (statement.type === "ReturnStatement" && statement.argument?.type === "ObjectExpression") {
                processStyleObject(statement.argument, { ...context, container: `${path.node.callee.name}():return` }, seen);
              }
            }
          }
        }
      }
    },
    TaggedTemplateExpression(path) {
      processTaggedTemplate(path.node, context);
    },
  });
  return { occurrences, parseErrors };
}

export function parseStyleExpression({ text, fullText, file, baseOffset, container = "vue:style-binding", typescript = false }) {
  const occurrences = [];
  const parseErrors = [];
  try {
    const expression = parseExpression(text, { plugins: parserPlugins(typescript ? ".ts" : ".js", typescript) });
    if (expression.type === "ObjectExpression") {
      processStyleObject(expression, {
        occurrences,
        parseErrors,
        file,
        fullText,
        baseOffset,
        syntax: "vue-template",
        container,
      }, new WeakSet());
    } else {
      occurrences.push(unsupportedOccurrence({
        occurrences,
        parseErrors,
        file,
        fullText,
        baseOffset,
        syntax: "vue-template",
        container,
        property: "<style-reference>",
        node: expression,
        reason: "Vue :style 不是对象字面量，当前不跟踪跨变量数据流",
      }));
    }
  } catch (error) {
    const position = offsetToPosition(fullText, baseOffset + (error.pos || 0));
    parseErrors.push({ file, line: position.line, column: position.column, syntax: "vue-template", container, message: error.message });
  }
  return { occurrences, parseErrors };
}
