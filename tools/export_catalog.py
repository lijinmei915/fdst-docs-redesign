#!/usr/bin/env python3
"""从 FDS YAML import 图生成 catalog、Token 目录并校验文档。"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from urllib.parse import unquote

import build as token_build


ROOT = Path(__file__).resolve().parents[1]
DOCS_ROOT = ROOT / "docs"
CATALOG_OUTPUT = ROOT / "dist" / "fds-token-catalog.json"
SKILL_SEARCH_INDEX_OUTPUT = (
    ROOT
    / "skills"
    / "fds-apply"
    / "references"
    / "fds-token-search.jsonl"
)
SKILL_MIGRATION_CATALOG_OUTPUT = (
    ROOT
    / "skills"
    / "fds-migrate"
    / "references"
    / "fds-token-catalog.jsonl"
)
TOKEN_INDEX_OUTPUT = DOCS_ROOT / "reference" / "Token目录.md"
MARKDOWN_LINK_RE = re.compile(r"(?<!!)\[[^\]]+\]\(([^)]+)\)")
CSS_VARIABLE_RE = re.compile(r"--fds-(?:g|s)-[a-z0-9]+(?:-[a-z0-9]+)*(?![a-z0-9*-])")
LEVEL_LABELS = {
    ("atomic", "seed"): "Atomic / Seed",
    ("atomic", "map"): "Atomic / Map",
    ("semantic", "base"): "Semantic / Base",
    ("semantic", "scene"): "Semantic / Scene",
}
QUERY_LEVEL_PRIORITY = {
    ("semantic", "base"): 0,
    ("semantic", "scene"): 1,
    ("atomic", "map"): 2,
    ("atomic", "seed"): 3,
}
SEARCH_ALIASES = {
    "危险状态": ("danger",),
    "浅色背景": ("background",),
    "页面主背景": ("background-main",),
    "卡片标题": ("fds-s-card-title",),
    "上下文浮层": ("motion-context", "layer-popup"),
    "危险": ("danger",),
    "警告": ("warning",),
    "成功": ("success",),
    "信息": ("info",),
    "浅背景": ("background",),
    "主背景": ("background-main",),
    "文本": ("text",),
    "文字": ("text",),
    "图标": ("icon",),
    "边框": ("border",),
    "间距": ("spacing", "gap", "padding", "margin"),
    "圆角": ("radius",),
    "阴影": ("shadow",),
    "层级": ("layer", "z-index"),
    "动效": ("motion",),
    "下拉": ("dropdown", "motion-context"),
    "dropdown": ("motion-context",),
    "卡片": ("fds-s-card",),
    "标题": ("heading", "title"),
    "字号": ("font-size", "title-size"),
    "行高": ("line-height",),
    "字重": ("weight",),
}


def resolve_value(token_id: str, tokens: dict[str, token_build.Token], visiting: tuple[str, ...] = ()) -> str:
    if token_id in visiting:
        raise ValueError(f"解析 catalog 时检测到循环引用：{' -> '.join((*visiting, token_id))}")
    token = tokens[token_id]
    return token_build.REFERENCE_RE.sub(
        lambda match: resolve_value(match.group(1), tokens, (*visiting, token_id)),
        token.value,
    )


def build_reference_chain(token_id: str, tokens: dict[str, token_build.Token]) -> list[str]:
    chain: list[str] = []

    def visit(current_id: str, visiting: tuple[str, ...]) -> None:
        if current_id in visiting:
            raise ValueError(f"解析 catalog 时检测到循环引用：{' -> '.join((*visiting, current_id))}")
        if current_id not in chain:
            chain.append(current_id)
        for reference in token_build.REFERENCE_RE.findall(tokens[current_id].value):
            visit(reference, (*visiting, current_id))

    visit(token_id, ())
    return chain


def build_catalog() -> dict:
    namespace, sources = token_build.collect_sources()
    tokens, errors = token_build.validate_sources(sources)
    if errors:
        raise ValueError("Token 校验失败：\n" + "\n".join(f"- {error}" for error in errors))

    ordered_tokens = sorted(
        tokens.values(),
        key=lambda token: (
            token_build.LEVEL_ORDER[(token.layer, token.tier)],
            token.category,
            token.token_id,
        ),
    )
    source_metadata = {
        relative: source.get("global", {})
        for relative, source in sources
    }
    return {
        "schema": "fds-token-catalog/v1",
        "name": "fds-global",
        "namespace": namespace,
        "namespaces": {
            "default": namespace,
            "scene": token_build.SCENE_NAMESPACE,
        },
        "source": "tokens/fds-global.yml",
        "generatedBy": "tools/export_catalog.py",
        "tokenCount": len(ordered_tokens),
        "tokens": [
            {
                "id": token.token_id,
                "name": token.token_id,
                "cssVariable": f"{token.namespace}{token.token_id}",
                "layer": token.layer,
                "tier": token.tier,
                "category": token.category,
                "type": token.token_type,
                "value": token.value,
                "resolvedValue": resolve_value(token.token_id, tokens),
                "references": token_build.REFERENCE_RE.findall(token.value),
                "referenceChain": build_reference_chain(token.token_id, tokens),
                "source": f"tokens/{token.source}",
                "sourceFile": f"tokens/{token.source}",
                **(
                    {"origin": source_metadata[token.source]["source"]}
                    if source_metadata[token.source].get("source")
                    else {}
                ),
                **({"comment": token.comment} if token.comment else {}),
            }
            for token in ordered_tokens
        ],
    }


def render_catalog(catalog: dict) -> str:
    return json.dumps(catalog, ensure_ascii=False, indent=2) + "\n"


def css_property_for(token: dict) -> str:
    name = token["name"]
    token_type = token["type"]
    if "background" in name or "surface" in name or name == "color-mask":
        return "background-color"
    if name.startswith("border-"):
        return "border-color" if token_type == "color" else "border-width"
    if "font-family" in name:
        return "font-family"
    if (
        "font-size" in name
        or name.endswith("-title-size")
        or (token["category"] == "typography" and name.endswith("-size"))
    ):
        return "font-size"
    if "line-height" in name:
        return "line-height"
    if "weight" in name:
        return "font-weight"
    if "radius" in name:
        return "border-radius"
    if "shadow" in name:
        return "box-shadow"
    if "opacity" in name:
        return "opacity"
    if name.startswith(("layer-", "z-index-")):
        return "z-index"
    if token_type == "duration":
        return "transition-duration"
    if token_type == "cubic-bezier":
        return "transition-timing-function"
    if token_type == "color":
        return "color"
    if token_type == "dimension":
        return "gap"
    return "--fds-value"


def build_search_record(token: dict) -> dict:
    css_variable = token["cssVariable"]
    record = {
        **{
            key: value
            for key, value in token.items()
            if key not in {"source", "sourceFile", "origin"}
        },
        "cssValue": f"var({css_variable})",
        "cssExample": f"{css_property_for(token)}: var({css_variable});",
    }
    searchable = " ".join(
        str(record.get(field, "")).casefold()
        for field in (
            "name",
            "cssVariable",
            "layer",
            "tier",
            "category",
            "type",
            "value",
            "resolvedValue",
            "comment",
        )
    )
    record["searchTerms"] = sorted(
        phrase
        for phrase, alternatives in SEARCH_ALIASES.items()
        if any(
            re.search(
                rf"(?<![a-z0-9]){re.escape(alternative.casefold())}(?![a-z0-9])",
                searchable,
            )
            for alternative in alternatives
        )
    )
    return record


def render_search_index(catalog: dict) -> str:
    ordered_tokens = sorted(
        catalog["tokens"],
        key=lambda token: (
            QUERY_LEVEL_PRIORITY[(token["layer"], token["tier"])],
            token["name"],
        ),
    )
    return "".join(
        json.dumps(build_search_record(token), ensure_ascii=False, separators=(",", ":")) + "\n"
        for token in ordered_tokens
    )


def render_migration_catalog(catalog: dict) -> str:
    return "".join(
        json.dumps(token, ensure_ascii=False, separators=(",", ":")) + "\n"
        for token in catalog["tokens"]
    )


def render_token_index(catalog: dict) -> str:
    lines = [
        "# FDS Token 目录",
        "",
        "> 本文件由 `python tools/export_catalog.py` 基于 `tokens/fds-global.yml` 的 import 图自动生成，请勿手工编辑。",
        "",
        f"当前 catalog 共收录 {catalog['tokenCount']} 个 Token。原始引用和值以 [catalog JSON](../../dist/fds-token-catalog.json) 为准。",
        "",
    ]
    current_group: tuple[str, str, str] | None = None
    for token in catalog["tokens"]:
        group = (token["layer"], token["tier"], token["category"])
        if group != current_group:
            level = LEVEL_LABELS[(token["layer"], token["tier"])]
            lines.extend(
                [
                    f"## {level} / {token['category']}",
                    "",
                    "| CSS Variable | 类型 | 源值 | 解析值 | 来源 |",
                    "| --- | --- | --- | --- | --- |",
                ]
            )
            current_group = group
        source = token["source"].replace("|", "\\|")
        value = token["value"].replace("|", "\\|")
        resolved = token["resolvedValue"].replace("|", "\\|")
        lines.append(
            f"| `{token['cssVariable']}` | `{token['type']}` | `{value}` | `{resolved}` | `{source}` |"
        )
    lines.append("")
    return "\n".join(lines)


def display_path(path: Path) -> str:
    try:
        return path.relative_to(ROOT).as_posix()
    except ValueError:
        return path.as_posix()


def documentation_files() -> list[Path]:
    return sorted([*DOCS_ROOT.rglob("*.md"), *DOCS_ROOT.rglob("*.html")])


def documentation_token_files() -> list[Path]:
    return sorted(
        {
            *documentation_files(),
            *DOCS_ROOT.rglob("*.css"),
            *DOCS_ROOT.rglob("*.js"),
        }
    )


def validate_markdown_links() -> list[str]:
    errors: list[str] = []
    for path in documentation_files():
        text = path.read_text(encoding="utf-8")
        for raw_target in MARKDOWN_LINK_RE.findall(text):
            target = raw_target.strip().strip("<>").split("#", 1)[0]
            if not target or "://" in target or target.startswith(("mailto:", "/")):
                continue
            resolved = (path.parent / unquote(target)).resolve()
            if not resolved.exists():
                errors.append(f"{display_path(path)}: 相对链接不存在：{raw_target}")
    return errors


def validate_doc_variables(catalog: dict) -> list[str]:
    known = {token["cssVariable"] for token in catalog["tokens"]}
    errors: list[str] = []
    for path in documentation_token_files():
        text = path.read_text(encoding="utf-8")
        for variable in sorted(set(CSS_VARIABLE_RE.findall(text)) - known):
            errors.append(f"{display_path(path)}: catalog 中不存在示例变量 {variable}")
    return errors


def check_outputs(catalog: dict) -> list[str]:
    expected = {
        CATALOG_OUTPUT: render_catalog(catalog),
        SKILL_SEARCH_INDEX_OUTPUT: render_search_index(catalog),
        SKILL_MIGRATION_CATALOG_OUTPUT: render_migration_catalog(catalog),
        TOKEN_INDEX_OUTPUT: render_token_index(catalog),
    }
    errors: list[str] = []
    for path, content in expected.items():
        if not path.is_file():
            errors.append(f"缺少生成文件：{path.relative_to(ROOT).as_posix()}")
        elif path.read_text(encoding="utf-8") != content:
            errors.append(f"生成文件不是最新结果：{path.relative_to(ROOT).as_posix()}")
    return errors


def write_outputs(catalog: dict) -> None:
    for path, content in (
        (CATALOG_OUTPUT, render_catalog(catalog)),
        (SKILL_SEARCH_INDEX_OUTPUT, render_search_index(catalog)),
        (SKILL_MIGRATION_CATALOG_OUTPUT, render_migration_catalog(catalog)),
        (TOKEN_INDEX_OUTPUT, render_token_index(catalog)),
    ):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")


def write_catalog(path: Path, catalog: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_catalog(catalog), encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        help="只将 catalog 写入指定 JSON 文件，不生成 Markdown 文档",
    )
    parser.add_argument(
        "--check-docs",
        action="store_true",
        help="检查生成文件、Markdown 相对链接和示例变量，不写入文件",
    )
    args = parser.parse_args()
    try:
        catalog = build_catalog()
        if args.output:
            write_catalog(args.output, catalog)
            print(f"Catalog 生成完成：{args.output}（{catalog['tokenCount']} 个 Token）")
            return 0
        if args.check_docs:
            errors = [
                *check_outputs(catalog),
                *validate_markdown_links(),
                *validate_doc_variables(catalog),
            ]
            if errors:
                print("文档校验失败：", file=sys.stderr)
                print("\n".join(f"- {error}" for error in errors), file=sys.stderr)
                return 1
            print(
                f"生成物校验通过：{catalog['tokenCount']} 个 Token，"
                "dist catalog、Skill Token 快照、链接和示例变量均有效"
            )
            return 0

        write_outputs(catalog)
        print(
            f"Catalog、Skill Token 快照与 Token 目录生成完成：{catalog['tokenCount']} 个 Token",
        )
        return 0
    except (OSError, KeyError, TypeError, ValueError) as error:
        print(f"Catalog 生成失败：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
