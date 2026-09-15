#!/usr/bin/env python3
"""校验 FDS Token YAML 依赖图并生成 CSS Custom Properties。"""

from __future__ import annotations

import argparse
import hashlib
import re
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
TOKENS_ROOT = ROOT / "tokens"
ENTRY = TOKENS_ROOT / "fds-global.yml"
OUTPUT = ROOT / "release" / "fds-global-tokens.css"
MINIFIED_OUTPUT = ROOT / "release" / "fds-global-tokens.min.css"
DEFAULT_NAMESPACE = "--fds-g-"
SCENE_NAMESPACE = "--fds-s-"
TOKEN_ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REFERENCE_RE = re.compile(r"\{!([a-z0-9]+(?:-[a-z0-9]+)*)\}")
LEVEL_ORDER = {
    ("atomic", "seed"): 0,
    ("atomic", "map"): 1,
    ("semantic", "base"): 2,
    ("semantic", "scene"): 3,
}
ALLOWED_TYPES = {
    "color",
    "cubic-bezier",
    "dimension",
    "duration",
    "font-family",
    "font-weight",
    "number",
    "shadow",
    "string",
}
FORBIDDEN_LENGTH_SEEDS = {
    "unit-base",
    "font-size-base",
    "line-height-base",
    "size-base",
    "radius-base",
    "border-width-base",
    "shadow-size-base",
}


@dataclass(frozen=True)
class Token:
    token_id: str
    namespace: str
    value: str
    token_type: str
    layer: str
    tier: str
    category: str
    source: str
    comment: str | None


def load_yaml(path: Path) -> dict:
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        raise ValueError(f"{path.relative_to(ROOT)}: YAML 根节点必须是对象")
    return data


def resolve_import(parent: Path, imported: str) -> Path:
    path = (parent.parent / imported).resolve()
    if not path.is_relative_to(TOKENS_ROOT.resolve()):
        raise ValueError(f"{parent.relative_to(ROOT)}: import 超出 tokens 目录：{imported}")
    if not path.is_file():
        raise ValueError(f"{parent.relative_to(ROOT)}: import 文件不存在：{imported}")
    return path


def collect_sources() -> tuple[str, list[tuple[str, dict]]]:
    entry = load_yaml(ENTRY)
    if entry.get("schema") != "fds-token-package/v1":
        raise ValueError("tokens/fds-global.yml: schema 必须为 fds-token-package/v1")
    namespace = entry.get("global", {}).get("namespace")
    if namespace != DEFAULT_NAMESPACE:
        raise ValueError(f"tokens/fds-global.yml: namespace 必须为 {DEFAULT_NAMESPACE}")

    visited: set[Path] = set()
    visiting: list[Path] = []
    sources: list[tuple[str, dict]] = []

    def visit(path: Path) -> None:
        if path in visiting:
            cycle = " -> ".join(item.relative_to(TOKENS_ROOT).as_posix() for item in [*visiting, path])
            raise ValueError(f"检测到循环 import：{cycle}")
        if path in visited:
            return

        visiting.append(path)
        data = load_yaml(path)
        imports = data.get("imports", [])
        if not isinstance(imports, list) or not all(isinstance(item, str) for item in imports):
            raise ValueError(f"{path.relative_to(ROOT)}: imports 必须是字符串数组")
        for imported in imports:
            visit(resolve_import(path, imported))

        if "props" in data:
            if data.get("schema") != "fds-token-source/v1":
                raise ValueError(f"{path.relative_to(ROOT)}: schema 必须为 fds-token-source/v1")
            sources.append((path.relative_to(TOKENS_ROOT).as_posix(), data))
        elif path != ENTRY and data.get("schema") != "fds-token-group/v1":
            raise ValueError(f"{path.relative_to(ROOT)}: 聚合文件 schema 必须为 fds-token-group/v1")

        visiting.pop()
        visited.add(path)

    visit(ENTRY)
    return namespace, sources


def validate_sources(sources: list[tuple[str, dict]]) -> tuple[dict[str, Token], list[str]]:
    tokens: dict[str, Token] = {}
    errors: list[str] = []

    for relative, source in sources:
        global_meta = source.get("global")
        props = source.get("props")
        if not isinstance(global_meta, dict):
            errors.append(f"{relative}: global 必须是对象")
            continue
        if not isinstance(props, dict) or not props:
            errors.append(f"{relative}: props 必须是非空对象")
            continue

        layer = global_meta.get("layer")
        tier = global_meta.get("tier")
        category = global_meta.get("category")
        scope = global_meta.get("scope")
        primitive = global_meta.get("primitive")
        default_type = global_meta.get("type")
        level = (layer, tier)

        if level not in LEVEL_ORDER:
            errors.append(f"{relative}: 非法 layer/tier：{layer}/{tier}")
            continue
        source_namespace = global_meta.get("namespace")
        if level == ("semantic", "scene"):
            if source_namespace != SCENE_NAMESPACE:
                errors.append(f"{relative}: Semantic/Scene namespace 必须为 {SCENE_NAMESPACE}")
            namespace = SCENE_NAMESPACE
        else:
            if source_namespace not in (None, DEFAULT_NAMESPACE):
                errors.append(f"{relative}: 仅 Semantic/Scene 可以使用 {SCENE_NAMESPACE}")
            namespace = DEFAULT_NAMESPACE
        if scope != "global":
            errors.append(f"{relative}: scope 必须为 global")
        if not isinstance(category, str) or not category:
            errors.append(f"{relative}: category 必须是非空字符串")
        if primitive is not (layer == "atomic"):
            errors.append(f"{relative}: Atomic 的 primitive 必须为 true，Semantic 必须为 false")
        if default_type is not None and default_type not in ALLOWED_TYPES:
            errors.append(f"{relative}: 不支持的 global.type：{default_type}")
        if f"{layer}/{tier}/" not in f"{relative}/":
            errors.append(f"{relative}: 文件路径与 layer/tier={layer}/{tier} 不一致")

        for token_id, definition in props.items():
            if not isinstance(token_id, str) or not TOKEN_ID_RE.fullmatch(token_id):
                errors.append(f"{relative}: Token ID 必须为小写 kebab-case：{token_id}")
                continue
            if token_id in tokens:
                errors.append(f"重复 Token：{token_id}（{tokens[token_id].source}、{relative}）")
                continue
            if not isinstance(definition, dict) or "value" not in definition:
                errors.append(f"{relative}: {token_id} 必须是包含 value 的对象")
                continue

            token_type = definition.get("type", default_type)
            if token_type not in ALLOWED_TYPES:
                errors.append(f"{relative}: {token_id} 缺少有效 type")
                continue
            value = str(definition["value"]).strip()
            comment = definition.get("comment")
            if not value:
                errors.append(f"{relative}: {token_id} 的 value 不能为空")
                continue
            if "--fds-" in value or "var(" in value:
                errors.append(f"{relative}: {token_id} 必须使用 {{!token-id}} 源引用，不能写 CSS 变量")
            if "rem" in value.lower() or "calc(" in value.lower():
                errors.append(f"{relative}: {token_id} 禁止使用 rem/calc()")
            if token_id in FORBIDDEN_LENGTH_SEEDS:
                errors.append(f"{relative}: 不允许长度 Seed：{token_id}")
            if comment is not None and (not isinstance(comment, str) or not comment.strip()):
                errors.append(f"{relative}: {token_id} 的 comment 必须是非空字符串")

            tokens[token_id] = Token(
                token_id=token_id,
                namespace=namespace,
                value=value,
                token_type=token_type,
                layer=layer,
                tier=tier,
                category=category,
                source=relative,
                comment=comment.strip() if isinstance(comment, str) else None,
            )

    validate_references(tokens, errors)
    return tokens, errors


def validate_references(tokens: dict[str, Token], errors: list[str]) -> None:
    graph: dict[str, list[str]] = {}
    for token_id, token in tokens.items():
        references = REFERENCE_RE.findall(token.value)
        graph[token_id] = references
        for reference in references:
            target = tokens.get(reference)
            if target is None:
                errors.append(f"{token.source}: {token_id} 引用了未定义 Token {reference}")
                continue
            source_level = (token.layer, token.tier)
            target_level = (target.layer, target.tier)
            if LEVEL_ORDER[target_level] > LEVEL_ORDER[source_level]:
                errors.append(
                    f"{token.source}: {token_id} 不能向上引用 {reference}"
                    f"（{token.layer}/{token.tier} -> {target.layer}/{target.tier}）"
                )
            composite_reference = token.token_type == "shadow" and target.token_type == "color"
            if token.token_type != target.token_type and not composite_reference:
                errors.append(
                    f"{token.source}: {token_id}（{token.token_type}）不能引用"
                    f" {reference}（{target.token_type}）"
                )

    visited: set[str] = set()
    visiting: list[str] = []

    def visit(token_id: str) -> None:
        if token_id in visiting:
            start = visiting.index(token_id)
            errors.append(f"循环 Token 引用：{' -> '.join([*visiting[start:], token_id])}")
            return
        if token_id in visited:
            return
        visiting.append(token_id)
        for reference in graph.get(token_id, []):
            if reference in tokens:
                visit(reference)
        visiting.pop()
        visited.add(token_id)

    for token_id in tokens:
        visit(token_id)


def to_css_value(value: str, tokens: dict[str, Token]) -> str:
    return REFERENCE_RE.sub(
        lambda match: f"var({tokens[match.group(1)].namespace}{match.group(1)})",
        value,
    )


def build_css(namespace: str, sources: list[tuple[str, dict]], tokens: dict[str, Token]) -> str:
    lines = [
        "/**",
        " * FDS Global CSS Token（由 YAML 源文件生成，请勿直接编辑）。",
        " * 层级：Atomic（Seed / Map）-> Semantic（Base / Scene）。",
        " */",
        "",
        ":root {",
    ]
    for relative, source in sources:
        meta = source["global"]
        lines.append(
            f"  /* {meta['layer']} / {meta['tier']} / {meta['category']} · source: tokens/{relative} */"
        )
        for token_id in source["props"]:
            token = tokens[token_id]
            comment = f" /* {token.comment} */" if token.comment else ""
            lines.append(
                f"  {token.namespace}{token_id}: {to_css_value(token.value, tokens)};{comment}"
            )
        lines.append("")
    lines.append("}")

    reduced_motion_tokens = [
        token
        for token in tokens.values()
        if token.layer == "semantic"
        and token.category == "motion"
        and token.token_type == "duration"
    ]
    if reduced_motion_tokens:
        lines.extend(
            [
                "",
                "/* 减少动态效果时统一关闭语义动效；组件应消费语义 Motion Token。 */",
                "@media (prefers-reduced-motion: reduce) {",
                "  :root {",
            ]
        )
        reduced_motion_value = tokens["motion-duration-0"]
        for token in reduced_motion_tokens:
            lines.append(
                f"    {token.namespace}{token.token_id}: "
                f"var({reduced_motion_value.namespace}motion-duration-0);"
            )
        lines.extend(["  }", "}"])
    return "\n".join(lines) + "\n"


def build_minified_css(
    namespace: str,
    sources: list[tuple[str, dict]],
    tokens: dict[str, Token],
) -> str:
    parts = [":root{"]
    for _, source in sources:
        for token_id in source["props"]:
            token = tokens[token_id]
            parts.append(
                f"{token.namespace}{token_id}:{to_css_value(token.value, tokens)};"
            )
    parts.append("}")

    reduced_motion_tokens = [
        token
        for token in tokens.values()
        if token.layer == "semantic"
        and token.category == "motion"
        and token.token_type == "duration"
    ]
    if reduced_motion_tokens:
        parts.append("@media (prefers-reduced-motion:reduce){:root{")
        reduced_motion_value = tokens["motion-duration-0"]
        for token in reduced_motion_tokens:
            parts.append(
                f"{token.namespace}{token.token_id}:"
                f"var({reduced_motion_value.namespace}motion-duration-0);"
            )
        parts.append("}}")
    return "".join(parts)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只校验，不写入产物")
    args = parser.parse_args()
    try:
        namespace, sources = collect_sources()
        tokens, errors = validate_sources(sources)
        if errors:
            print("Token 校验失败：", file=sys.stderr)
            print("\n".join(f"- {error}" for error in errors), file=sys.stderr)
            return 1
        if args.check:
            print(f"Token 校验通过：{len(tokens)} 个变量，{len(sources)} 个源文件")
        else:
            output = build_css(namespace, sources, tokens)
            minified_output = build_minified_css(namespace, sources, tokens)
            OUTPUT.parent.mkdir(parents=True, exist_ok=True)
            OUTPUT.write_text(output, encoding="utf-8", newline="\n")
            MINIFIED_OUTPUT.write_text(minified_output, encoding="utf-8", newline="\n")
            hashed_outputs = []
            for path in (OUTPUT, MINIFIED_OUTPUT):
                content = path.read_bytes()
                content_hash = hashlib.sha256(content).hexdigest()[:12]
                hashed_path = path.with_name(f"{path.stem}.{content_hash}{path.suffix}")
                hashed_path.write_bytes(content)
                hashed_outputs.append(hashed_path)
            tpl_config = OUTPUT.parent / "tpl_config"
            tpl_config.write_text(
                f"fdstCssEntry:{hashed_outputs[1].name}\n",
                encoding="utf-8",
                newline="\n",
            )
            print(
                f"Token 构建完成：{'、'.join(str(path) for path in (OUTPUT, MINIFIED_OUTPUT, *hashed_outputs, tpl_config))}"
                f"（{len(tokens)} 个变量）"
            )
        return 0
    except (OSError, KeyError, TypeError, ValueError, yaml.YAMLError) as error:
        print(f"Token 构建失败：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
