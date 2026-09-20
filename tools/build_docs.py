#!/usr/bin/env python3
"""从 docs Markdown 和 FDST 资产生成可部署的静态文档站。"""

from __future__ import annotations

import argparse
import hashlib
import html
import json
import os
import re
import shutil
import sys
from pathlib import Path, PurePosixPath
from urllib.parse import unquote, urlsplit

import markdown
import yaml
from markdown.extensions import Extension
from markdown.treeprocessors import Treeprocessor


ROOT = Path(__file__).resolve().parents[1]
DOCS_ROOT = ROOT / "docs"
ASSETS_ROOT = DOCS_ROOT / "site-assets"
PUBLIC_ROOT = ROOT / "public"
EXTERNAL_ROOT = ROOT / "public-external"
EXTERNAL_DOCS_ROOT = DOCS_ROOT / "external"
TOKEN_CSS = ROOT / "release" / "fds-global-tokens.css"
TOKEN_CATALOG = ROOT / "release" / "fds-token-catalog.json"
PROJECT9_PALETTE = ASSETS_ROOT / "project9-palette.json"
GENERATED_MARKER = ".generated-by-fdst-docs"
REPOSITORY_BLOB_URL = "https://git.firstshare.cn/fx/fdst/-/blob/master"

NAVIGATION = (
    ("概览", (("README.md", "文档首页"),)),
    (
        "视觉基础",
        (
            ("foundations/README.md", "基础规范"),
            ("foundations/颜色.md", "颜色"),
            ("foundations/排版.md", "排版"),
            ("foundations/间距与尺寸.md", "间距与尺寸"),
            ("foundations/圆角与边框.md", "圆角与边框"),
            ("foundations/阴影与层级.md", "阴影与层级"),
            ("foundations/动效.md", "动效"),
        ),
    ),
    (
        "语义",
        (("semantics/基础语义.md", "基础语义"), ("semantics/场景语义.md", "场景语义")),
    ),
    ("视觉预览", (("examples/README.md", "视觉工作台"),)),
    (
        "开始使用",
        (
            ("getting-started/快速开始.md", "快速开始"),
            ("getting-started/ShareDev接入.md", "ShareDev 接入"),
        ),
    ),
    (
        "概念",
        (
            ("concepts/分层模型.md", "分层模型"),
            ("concepts/命名规则.md", "命名规则"),
            ("concepts/引用与边界.md", "引用与边界"),
        ),
    ),
    ("常见问题", (("reference/迁移与常见问题.md", "迁移与常见问题"),)),
    ("Token 目录", (("reference/Token目录.md", "完整目录"),)),
    (
        "工程维护",
        (
            ("engineering/YAML源文件.md", "YAML 源文件"),
            ("engineering/构建与校验.md", "构建与校验"),
            ("engineering/版本与发布.md", "版本与发布"),
            ("engineering/文档维护.md", "文档维护"),
            ("站点内容分流清单.md", "站点内容分流清单"),
        ),
    ),
)

TOP_SECTIONS = (
    ("基础规范", "foundations/README.md", ("视觉基础", "语义", "视觉预览")),
    ("使用指南", "getting-started/快速开始.md", ("开始使用", "概念", "常见问题")),
    ("Token 目录", "reference/Token目录.md", ("Token 目录",)),
    ("内部工程", "engineering/YAML源文件.md", ("工程维护",)),
)

EXTERNAL_NAVIGATION = (
    ("概览", (("README.md", "首页"), ("使用说明.md", "使用说明"))),
)


def output_path(source: PurePosixPath) -> PurePosixPath:
    return source.parent / "index.html" if source.name == "README.md" else source.with_suffix(".html")


def relative_href(current_output: PurePosixPath, target_output: PurePosixPath) -> str:
    return PurePosixPath(os.path.relpath(target_output, current_output.parent).replace("\\", "/")).as_posix()


def split_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---\n"):
        return {}, text
    closing = text.find("\n---\n", 4)
    if closing < 0:
        raise ValueError("Markdown frontmatter 未闭合")
    metadata = yaml.safe_load(text[4:closing]) or {}
    if not isinstance(metadata, dict):
        raise ValueError("Markdown frontmatter 必须是对象")
    return metadata, text[closing + 5 :]


def markdown_title(body: str, fallback: str) -> str:
    match = re.search(r"^#\s+(.+?)\s*$", body, re.MULTILINE)
    return match.group(1).strip() if match else fallback


def repository_href(resolved: PurePosixPath, fragment: str) -> str:
    suffix = f"#{fragment}" if fragment else ""
    return f"{REPOSITORY_BLOB_URL}/{resolved.as_posix()}{suffix}"


def versioned_asset(root_prefix: str, name: str) -> str:
    source = TOKEN_CSS if name == "fds-global-tokens.css" else ASSETS_ROOT / name
    digest = hashlib.sha256(source.read_bytes()).hexdigest()[:12]
    return f"{root_prefix}/assets/{name}?v={digest}"


def radius_demo_data(catalog: dict) -> list[dict]:
    tokens = [
        token for token in catalog["tokens"]
        if (token.get("layer"), token.get("tier"), token.get("category")) == ("atomic", "map", "shape")
        and re.fullmatch(r"radius-(\d+|full)", token["name"])
    ]
    return [
        demo_token(token)
        for token in sorted(
            tokens,
            key=lambda token: (
                token["name"].endswith("-full"),
                int(token["name"].split("-")[-1]) if not token["name"].endswith("-full") else 0,
            ),
        )
    ]


def demo_token(token: dict) -> dict:
    return {"name": token["name"], "cssVariable": token["cssVariable"], "resolvedValue": token["resolvedValue"]}


def catalog_range_tables(catalog: dict) -> dict[str, str]:
    tokens = catalog["tokens"]
    by_name = {token["name"]: token for token in tokens}
    if len(by_name) != len(tokens):
        raise ValueError("Catalog 中存在重复的 Token 名称")

    def required(name: str, layer: str, tier: str, category: str) -> dict:
        token = by_name.get(name)
        if token is None or (token.get("layer"), token.get("tier"), token.get("category")) != (layer, tier, category):
            raise ValueError(f"Catalog 缺少预期 Token：{name}")
        if not token.get("cssVariable") or token.get("resolvedValue") is None:
            raise ValueError(f"Catalog Token 缺少变量名或解析值：{name}")
        return token

    def values(pattern: str, layer: str, tier: str, category: str) -> str:
        selected = [
            token for token in tokens
            if (token["layer"], token["tier"], token["category"]) == (layer, tier, category)
            and re.fullmatch(pattern, token["name"])
        ]
        if not selected:
            raise ValueError(f"Catalog 缺少值域：{pattern}")
        selected.sort(key=lambda token: (
            0, int(token["name"].rsplit("-", 1)[-1])
        ) if token["name"].rsplit("-", 1)[-1].isdigit() else (
            1, int(token["resolvedValue"]) if token["resolvedValue"].isdigit() else token["name"]
        ))
        return "、".join(token["resolvedValue"] for token in selected)

    def names(pattern: str, layer: str, tier: str, category: str) -> str:
        selected = [token["name"] for token in tokens if
                    (token["layer"], token["tier"], token["category"]) == (layer, tier, category)
                    and re.fullmatch(pattern, token["name"])]
        if not selected:
            raise ValueError(f"Catalog 缺少值域：{pattern}")
        return "、".join(f"`{name}`" for name in sorted(selected))

    tables = {
        "typography": (
            ("Font Size", values(r"font-size-\d+", "atomic", "map", "typography"), "`font-size`"),
            ("Fixed Line Height", values(r"line-height-\d+", "atomic", "map", "typography"), "`line-height`"),
            ("Line Height Ratio", values(r"line-height-ratio-\d+", "atomic", "map", "typography"), "`line-height`"),
            ("Font Weight", values(r"font-weight-.+", "atomic", "map", "typography"), "`font-weight`"),
        ),
        "spacing": (("Spacing", values(r"spacing-\d+", "atomic", "map", "spacing"), "`padding`、`margin`、`gap`"),),
        "shape": (
            ("Radius", values(r"radius-\d+", "atomic", "map", "shape") + "、" + values(r"radius-full", "atomic", "map", "shape"), "`border-radius`"),
            ("Border Width", values(r"border-width-\d+", "atomic", "map", "shape"), "`border-width`"),
        ),
        "motion": (
            ("Duration", values(r"motion-duration-\d+", "atomic", "map", "motion"), "持续时间"),
            ("Easing", values(r"motion-easing-\d+", "atomic", "map", "motion"), "运动曲线"),
        ),
        "effects": (
            ("Opacity", values(r"opacity-\d+", "atomic", "map", "effects"), "元素整体透明度"),
            ("Z-Index", values(r"layer-.+", "semantic", "base", "layout"), "覆盖层级"),
            ("Shadow", names(r"shadow-(?!\d+$).+", "semantic", "base", "effects"), "阴影语义"),
        ),
    }
    result = {
        name: "| 类别 | 当前值（来自 Catalog JSON） | 用途 |\n| --- | --- | --- |\n"
        + "\n".join(f"| {label} | {value} | {use} |" for label, value, use in rows)
        for name, rows in tables.items()
    }

    recipe_rows = []
    for role in [*(f"heading-{index}" for index in range(1, 7)), "text"]:
        parts = [required(f"{role}-{part}", "semantic", "base", "typography") for part in ("size", "line-height", "weight")]
        label = role.replace("heading-", "Heading ").replace("text", "Text")
        recipe_rows.append(
            f"| {label} | {parts[0]['resolvedValue']} | {parts[1]['resolvedValue']} | {parts[2]['resolvedValue']} | "
            + "<br>".join(f"`{part['cssVariable']}`" for part in parts) + " |"
        )
    result["typographyrecipes"] = (
        "| 角色 | 字号 | 行高 | 字重 | 对应 CSS 变量 |\n| --- | --- | --- | --- | --- |\n"
        + "\n".join(recipe_rows)
    )

    density_rows = []
    for name, label in (("compact", "Compact / 紧凑"), ("comfortable", "Comfortable / 舒适"), ("spacious", "Spacious / 宽松")):
        line = required(f"density-{name}-line-height", "semantic", "scene", "scene")
        spacing = required(f"density-{name}-spacing", "semantic", "scene", "scene")
        density_rows.append(
            f"| {label} | {line['resolvedValue']} | {spacing['resolvedValue']} | "
            f"`{line['cssVariable']}`<br>`{spacing['cssVariable']}` |"
        )
    result["typographydensity"] = (
        "| 密度 | 行高倍率 | 对应间距 | CSS 变量 |\n| --- | --- | --- | --- |\n"
        + "\n".join(density_rows)
    )

    primary_rows = []
    for name, label in (("color-primary", "Default"), ("color-primary-hover", "Hover"), ("color-primary-active", "Active"), ("color-primary-disabled", "Disabled")):
        token = required(name, "semantic", "base", "color")
        primary_rows.append(
            f"| {label} | `{token['cssVariable']}` | `{token['value']}` | `{token['resolvedValue']}` |"
        )
    result["colorprimary"] = (
        "| 状态 | CSS 变量 | Catalog 引用 | 解析值 |\n| --- | --- | --- | --- |\n"
        + "\n".join(primary_rows)
    )

    primary = required("color-primary", "semantic", "base", "color")
    reference = re.fullmatch(r"\{!([a-z0-9-]+)\}", primary["value"])
    if reference is None or reference.group(1) not in by_name:
        raise ValueError("Catalog 的 color-primary 缺少有效的源引用")
    target = by_name[reference.group(1)]
    result["primaryyaml"] = "\n".join((
        "```yaml",
        "color-primary:",
        f"  value: '{primary['value']}'",
        "```",
    ))
    result["primarycss"] = "\n".join((
        "```css",
        f"{primary['cssVariable']}: var({target['cssVariable']});",
        "```",
    ))
    result["primaryleaf"] = "\n".join((
        "```yaml",
        "schema: fds-token-source/v1",
        "global:",
        "  layer: semantic",
        "  tier: base",
        "  category: color",
        "  type: color",
        "  scope: global",
        "  primitive: false",
        "imports:",
        "- ../../atomic/map/color/palette/base.yml",
        "props:",
        "  color-primary:",
        f"    value: '{primary['value']}'",
        "```",
    ))

    heading = {part: required(f"heading-5-{part}", "semantic", "base", "typography") for part in ("size", "line-height", "weight")}
    body = {part: required(f"text-{part}", "semantic", "base", "typography") for part in ("size", "line-height", "weight")}
    heading_color = required("heading-color", "semantic", "base", "typography")
    body_color = required("text-color", "semantic", "base", "typography")
    palette_families = []
    for family in ("brand", "blue", "green", "red", "purple", "gray"):
        swatches = []
        for step in (range(1, 21) if family == "gray" else range(12)):
            token = required(f"color-{family}-{step}", "atomic", "map", "color")
            label = html.escape(f"{token['cssVariable']}: {token['resolvedValue']}")
            swatches.append(
                f'<div style="background:{html.escape(token["resolvedValue"])}" title="{label}" aria-label="{label}"></div>'
            )
        palette_families.append(
            '<div class="proto-color-family">'
            f'<div class="proto-color-family-name">{family.title()}</div>'
            f'<div class="proto-color-ramp">{"".join(swatches)}</div></div>'
        )
    result["homepalette"] = f'<div class="proto-color-grid">{"".join(palette_families)}</div>'

    result["typographycode"] = "\n".join((
        "```css",
        ".panel-title {",
        f"  color: var({heading_color['cssVariable']});",
        *(f"  {property}: var({heading[part]['cssVariable']});" for property, part in (("font-size", "size"), ("line-height", "line-height"), ("font-weight", "weight"))),
        "}",
        "",
        ".panel-content {",
        f"  color: var({body_color['cssVariable']});",
        *(f"  {property}: var({body[part]['cssVariable']});" for property, part in (("font-size", "size"), ("line-height", "line-height"), ("font-weight", "weight"))),
        "}",
        "```",
    ))
    return result


def expand_catalog_tables(body: str, tables: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        name = match.group(1)
        if name not in tables:
            raise ValueError(f"未知 Catalog 表格：{name}")
        return tables[name]

    return re.sub(r"<!-- fds-catalog-table:([a-z]+) -->", replace, body)


def other_demo_data(catalog: dict) -> dict:
    tokens = {token["name"]: token for token in catalog["tokens"]}
    def select(pattern: str, layer: str, tier: str, category: str) -> list[dict]:
        return [
            token for token in catalog["tokens"]
            if (token["layer"], token["tier"], token["category"]) == (layer, tier, category)
            and re.fullmatch(pattern, token["name"])
        ]

    spacing = sorted(select(r"spacing-\d+", "atomic", "map", "spacing"), key=lambda token: int(token["name"].split("-")[-1]))
    opacity = sorted(select(r"opacity-\d+", "atomic", "map", "effects"), key=lambda token: int(token["name"].split("-")[-1]))
    shadows = sorted(select(r"shadow-(?!\d+$).+", "semantic", "base", "effects"), key=lambda token: (token["name"] != "shadow-none", token["name"]))
    layers = sorted(select(r"layer-.+", "semantic", "base", "layout"), key=lambda token: int(token["resolvedValue"]))
    motions = []
    for duration in select(r"motion-.+-duration", "semantic", "base", "motion"):
        stem = duration["name"].removesuffix("-duration")
        easing = tokens.get(stem + "-enter-easing") or tokens.get(stem + "-easing")
        if easing is None:
            raise ValueError(f"动效缺少缓动 Token：{stem}")
        motions.append({"name": stem.removeprefix("motion-"), "duration": demo_token(duration), "easing": demo_token(easing)})
    motions.sort(key=lambda item: int(item["duration"]["resolvedValue"].removesuffix("ms")))

    primary = [tokens[name] for name in ("color-primary", "color-primary-hover", "color-primary-active", "color-primary-disabled")]
    statuses = []
    for token in select(r"color-(?!primary$|text-|icon-|mask$)[a-z]+", "semantic", "base", "color"):
        background = tokens.get(token["name"] + "-background")
        if background is not None:
            statuses.append({"name": token["name"].removeprefix("color-"), "color": demo_token(token), "background": demo_token(background)})
    typography = []
    for role in [*(f"heading-{index}" for index in range(1, 7)), "text"]:
        typography.append({
            "name": role,
            **{part: demo_token(tokens[f"{role}-{part}"]) for part in ("size", "line-height", "weight")},
        })
    return {
        "typography": typography,
        "spacing": [demo_token(token) for token in spacing],
        "opacity": [demo_token(token) for token in opacity],
        "shadows": [demo_token(token) for token in shadows],
        "layers": [demo_token(token) for token in layers],
        "motions": motions,
        "primaryColors": [demo_token(token) for token in primary],
        "statusColors": statuses,
    }


class LinkRewriteTreeprocessor(Treeprocessor):
    def __init__(self, md: markdown.Markdown, source: PurePosixPath, current_output: PurePosixPath):
        super().__init__(md)
        self.source = source
        self.current_output = current_output

    def run(self, root):
        for element in root.iter("a"):
            raw_href = element.get("href", "")
            split = urlsplit(raw_href)
            if not split.path or split.scheme or raw_href.startswith(("#", "/")):
                continue
            decoded = unquote(split.path)
            resolved_docs = (self.source.parent / PurePosixPath(decoded))
            normalized = PurePosixPath(os.path.normpath(resolved_docs.as_posix()).replace("\\", "/"))
            fragment = f"#{split.fragment}" if split.fragment else ""
            if normalized.suffix.lower() == ".md" and not normalized.as_posix().startswith("../"):
                element.set("href", relative_href(self.current_output, output_path(normalized)) + fragment)
            elif normalized.as_posix() in {
                "examples/Foundation预览.html",
                "examples/颜色预览.html",
            }:
                anchor = "#foundation" if "Foundation" in normalized.name else "#colors"
                element.set("href", relative_href(self.current_output, output_path(PurePosixPath("examples/README.md"))) + anchor)
            elif normalized.as_posix() == "../public/index.html":
                element.set("href", relative_href(self.current_output, PurePosixPath("index.html")))
            elif normalized.as_posix().startswith("../"):
                repo_target = PurePosixPath(
                    os.path.normpath((PurePosixPath("docs") / normalized).as_posix()).replace("\\", "/")
                )
                element.set("href", repository_href(repo_target, split.fragment))
        return root


class LinkRewriteExtension(Extension):
    def __init__(self, source: PurePosixPath, current_output: PurePosixPath):
        super().__init__()
        self.source = source
        self.current_output = current_output

    def extendMarkdown(self, md):
        md.treeprocessors.register(
            LinkRewriteTreeprocessor(md, self.source, self.current_output),
            "fds_link_rewrite",
            5,
        )


def toc_items(tokens: list[dict]) -> list[tuple[str, str]]:
    items: list[tuple[str, str]] = []
    for token in tokens:
        if token.get("level") == 2:
            items.append((token["id"], token["name"]))
        items.extend(toc_items(token.get("children", [])))
    return items


def strip_html(value: str) -> str:
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", value)).strip()


def validate_document_token_references(body: str, catalog: dict, source: PurePosixPath) -> None:
    """阻止文档引用 Catalog 已删除或改名的完整 CSS 变量。"""
    known = {token["cssVariable"] for token in catalog["tokens"]}
    mentioned = set(re.findall(r"--fds-[gs]-[a-z0-9-]+", body))
    unknown = sorted(name for name in mentioned if not name.endswith("-") and name not in known)
    if unknown:
        raise ValueError(f"{source.as_posix()} 引用了 Catalog 中不存在的变量：{', '.join(unknown)}")

    if source.parts[0] in {"foundations", "semantics"}:
        literals = sorted(set(re.findall(r"(?<![\w-])#[0-9A-Fa-f]{6}\b|(?<![\w-])\d+(?:\.\d+)?(?:px|ms)\b", body)))
        if literals:
            raise ValueError(
                f"{source.as_posix()} 手写了可能过时的 Token 数值：{', '.join(literals)}；请从 Catalog JSON 生成"
            )


def render_nav(current_source: PurePosixPath, navigation=NAVIGATION) -> str:
    groups: list[str] = []
    for group, pages in navigation:
        links = []
        for source_name, label in pages:
            source = PurePosixPath(source_name)
            active = source == current_source
            current_attr = ' aria-current="page"' if active else ""
            links.append(
                f'<a class="docs-nav-link{" is-active" if active else ""}" '
                f'href="{html.escape(relative_href(output_path(current_source), output_path(source)))}"'
                f'{current_attr}>{html.escape(label)}</a>'
            )
        groups.append(
            f'<section class="docs-nav-group"><h2>{html.escape(group)}</h2>{"".join(links)}</section>'
        )
    return "".join(groups)


def section_for_source(source: PurePosixPath) -> tuple[str, str, tuple[str, ...]] | None:
    group = next((name for name, pages in NAVIGATION if any(path == source.as_posix() for path, _ in pages)), None)
    return next((section for section in TOP_SECTIONS if group in section[2]), None)


def navigation_for_source(source: PurePosixPath) -> tuple:
    section = section_for_source(source)
    return tuple((name, pages) for name, pages in NAVIGATION if name in section[2]) if section else NAVIGATION


def render_top_nav(source: PurePosixPath, class_name: str) -> str:
    current_section = section_for_source(source)
    links = []
    for label, landing, _ in TOP_SECTIONS:
        active = current_section is not None and current_section[0] == label
        href = relative_href(output_path(source), output_path(PurePosixPath(landing)))
        loc_attr = ' aria-current="location"' if active else ""
        links.append(
            f'<a class="docs-section-link{" is-active" if active else ""}" href="{html.escape(href)}"'
            f'{loc_attr}>{html.escape(label)}</a>'
        )
    return f'<nav class="{class_name}" aria-label="文档分区">{"".join(links)}</nav>'


def render_page(
    source: PurePosixPath,
    title: str,
    metadata: dict,
    article: str,
    toc: list[tuple[str, str]],
    demo_data_version: str,
) -> str:
    current_output = output_path(source)
    root_prefix = relative_href(current_output, PurePosixPath("index.html"))
    if root_prefix == "index.html":
        root_prefix = "."
    else:
        root_prefix = str(PurePosixPath(root_prefix).parent)
    group = next((name for name, pages in NAVIGATION if any(path == source.as_posix() for path, _ in pages)), "文档")
    section = section_for_source(source)
    breadcrumb_parts = []
    if section:
        section_href = relative_href(current_output, output_path(PurePosixPath(section[1])))
        breadcrumb_parts.append(f'<a href="{html.escape(section_href)}">{html.escape(section[0])}</a>')
        if group != section[0]:
            breadcrumb_parts.extend(("<span>/</span>", f"<span>{html.escape(group)}</span>"))
    else:
        breadcrumb_parts.append(f"<span>{html.escape(group)}</span>")
    breadcrumb_parts.extend(("<span>/</span>", f"<strong>{html.escape(title)}</strong>"))
    breadcrumb_markup = "".join(breadcrumb_parts)
    toc_markup = "".join(
        f'<a href="#{html.escape(anchor)}">{html.escape(label)}</a>' for anchor, label in toc
    )
    teaches = str(metadata.get("teaches", ""))
    is_home = source.as_posix() == "README.md"
    header_nav = render_top_nav(source, "docs-primary-nav")
    header_links = '<button class="docs-menu-trigger" type="button" data-menu-toggle aria-expanded="false">目录</button>'
    sidebar = f'<aside class="docs-sidebar" data-sidebar aria-label="文档导航">{render_top_nav(source, "docs-mobile-sections")}{render_nav(source, navigation_for_source(source))}</aside>'
    breadcrumb = f'<div class="docs-breadcrumb">{breadcrumb_markup}</div>'
    page_toc = f'<aside class="docs-toc" aria-label="本页目录"><strong>本页目录</strong>{toc_markup}</aside>'
    if is_home:
        header_nav = '<nav class="docs-home-breadcrumb" aria-label="当前位置"><a href="./index.html">概览</a> / <span aria-current="page">文档首页</span></nav>'
        header_links = f'<a class="docs-home-repository" href="{REPOSITORY_BLOB_URL}">代码仓库</a>'
        sidebar = breadcrumb = page_toc = ""
    home_current_attr = ' aria-current="page"' if is_home else ""
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{html.escape(teaches)}">
  <title>{html.escape(title)}{"" if is_home else " | FDS Token"}</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="{versioned_asset(root_prefix, 'fds-global-tokens.css')}">
  <link rel="stylesheet" href="{versioned_asset(root_prefix, 'fds-docs.css')}">
  <script defer src="{root_prefix}/assets/search-index.js"></script>
  <script defer src="{root_prefix}/assets/fds-demo-data.js?v={demo_data_version}"></script>
  <script defer src="{versioned_asset(root_prefix, 'fds-demos.js')}"></script>
  <script defer src="{root_prefix}/assets/fds-docs.js"></script>
</head>
<body data-page="{html.escape(source.as_posix())}" data-root="{html.escape(root_prefix)}">
  <header class="docs-topbar">
    <a class="docs-brand" href="{root_prefix}/index.html" aria-label="FDS Token 文档首页"{home_current_attr}><span>{"F" if is_home else "FDS"}</span><strong>{"FDS Token" if is_home else "Token"}</strong></a>
    {header_nav}
    <div class="docs-topbar-actions">
      <button class="docs-search-trigger" type="button" data-search-open>{"搜索" if is_home else "搜索文档"}</button>
      {header_links}
    </div>
  </header>
  <div class="docs-shell">
    {sidebar}
    <main class="docs-main">
      {breadcrumb}
      <article class="docs-article">{article}</article>
    </main>
    {page_toc}
  </div>
  <div class="docs-backdrop" data-menu-backdrop hidden></div>
  <dialog class="docs-search" data-search-dialog>
    <form method="dialog" class="docs-search-head"><label for="docs-search-input">搜索文档</label><button type="submit">关闭</button></form>
    <input id="docs-search-input" type="search" autocomplete="off" placeholder="输入 Token、用途或规范名称" data-search-input>
    <div class="docs-search-results" data-search-results></div>
  </dialog>
</body>
</html>
'''


def page_sources() -> list[PurePosixPath]:
    return [PurePosixPath(path) for _, pages in NAVIGATION for path, _ in pages]


def build_site_files() -> dict[PurePosixPath, str]:
    expected: dict[PurePosixPath, str] = {}
    search_records: list[dict] = []
    catalog = json.loads(TOKEN_CATALOG.read_text(encoding="utf-8"))
    if catalog.get("schema") != "fds-token-catalog/v1" or catalog.get("tokenCount") != len(catalog.get("tokens", [])):
        raise ValueError("Token catalog 无效或数量不一致")
    project9_palette = json.loads(PROJECT9_PALETTE.read_text(encoding="utf-8"))
    if set(project9_palette.get("palettes", {})) != {"base", "dark"}:
        raise ValueError("项目9色板预览快照缺少 Base 或 Dark 色阶")
    range_tables = catalog_range_tables(catalog)
    demo_data_asset = (
        "window.FDS_DEMO_DATA = "
        + json.dumps(
            {"project9Palette": project9_palette, "radius": radius_demo_data(catalog), **other_demo_data(catalog)},
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + ";\n"
    )
    demo_data_version = hashlib.sha256(demo_data_asset.encode("utf-8")).hexdigest()[:12]
    for source in page_sources():
        source_path = DOCS_ROOT / Path(source.as_posix())
        if not source_path.is_file():
            raise FileNotFoundError(f"文档导航源不存在：{source.as_posix()}")
        metadata, body = split_frontmatter(source_path.read_text(encoding="utf-8"))
        validate_document_token_references(body, catalog, source)
        body = expand_catalog_tables(body, range_tables)
        title = markdown_title(body, source.stem)
        current_output = output_path(source)
        renderer = markdown.Markdown(
            extensions=[
                "tables",
                "fenced_code",
                "sane_lists",
                "md_in_html",
                "toc",
                LinkRewriteExtension(source, current_output),
            ],
            extension_configs={"toc": {"permalink": False}},
            output_format="html5",
        )
        article = renderer.convert(body)
        expected[current_output] = render_page(
            source,
            title,
            metadata,
            article,
            toc_items(getattr(renderer, "toc_tokens", [])),
            demo_data_version,
        )
        search_records.append(
            {
                "title": title,
                "group": next((name for name, pages in NAVIGATION if any(path == source.as_posix() for path, _ in pages)), "文档"),
                "summary": str(metadata.get("teaches", "")),
                "href": current_output.as_posix(),
                "text": strip_html(article)[:12000],
            }
        )
    for name in ("fds-docs.css", "fds-docs.js", "fds-demos.js"):
        expected[PurePosixPath("assets") / name] = (ASSETS_ROOT / name).read_text(encoding="utf-8")
    expected[PurePosixPath("prototypes/prototype-c.html")] = (ASSETS_ROOT / "prototype-c.html").read_text(encoding="utf-8")
    expected[PurePosixPath("assets/fds-demo-data.js")] = demo_data_asset
    expected[PurePosixPath("assets/fds-global-tokens.css")] = TOKEN_CSS.read_text(encoding="utf-8")
    expected[PurePosixPath("assets/search-index.js")] = (
        "window.FDS_DOCS_META = "
        + json.dumps(
            {"tokenCount": catalog["tokenCount"], "source": catalog["source"]},
            ensure_ascii=False,
            separators=(",", ":"),
        )
        + ";\nwindow.FDS_DOCS_SEARCH_INDEX = "
        + json.dumps(search_records, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )
    expected[PurePosixPath(GENERATED_MARKER)] = "Generated by tools/build_docs.py. Do not edit public files directly.\n"
    return expected


def build_external_files() -> dict[PurePosixPath, str]:
    """只从明确允许的独立文稿生成对外预览，不复制内部站资产。"""
    expected: dict[PurePosixPath, str] = {}
    sources = [PurePosixPath(path) for _, pages in EXTERNAL_NAVIGATION for path, _ in pages]
    for source in sources:
        path = EXTERNAL_DOCS_ROOT / Path(source.as_posix())
        if not path.is_file():
            raise FileNotFoundError(f"对外文稿不存在：{path}")
        metadata, body = split_frontmatter(path.read_text(encoding="utf-8"))
        if metadata.get("audience") != "external" or metadata.get("status") != "preview":
            raise ValueError(f"对外文稿需要 audience: external 和 status: preview：{path}")
        if re.search(r"git\.firstshare\.cn|项目9|ShareDev|(?:\.\./){2}|<script|<iframe", body, re.I):
            raise ValueError(f"对外文稿含内部引用或可执行内容：{path}")
        title = markdown_title(body, source.stem)
        current_output = output_path(source)
        renderer = markdown.Markdown(
            extensions=["tables", "fenced_code", "toc", LinkRewriteExtension(source, current_output)],
            output_format="html5",
        )
        article = renderer.convert(body)
        root_prefix = "."
        expected[current_output] = f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="description" content="{html.escape(str(metadata.get('teaches', 'FDS Token 对外网站预览')))}">
  <title>{html.escape(title)} | FDS Token 对外预览</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="{root_prefix}/assets/external.css">
</head>
<body>
  <header class="topbar"><a class="brand" href="{root_prefix}/index.html"><span>FDS</span> Token</a><nav aria-label="主导航">{render_nav(source, EXTERNAL_NAVIGATION)}</nav></header>
  <div class="notice">对外网站预览 · 内容尚未发布</div>
  <main class="content"><article>{article}</article></main>
  <footer>FDS Token · 对外预览</footer>
</body>
</html>
'''
    expected[PurePosixPath("assets/external.css")] = (ASSETS_ROOT / "external.css").read_text(encoding="utf-8")
    expected[PurePosixPath(GENERATED_MARKER)] = "Generated by tools/build_docs.py --site external. Do not edit generated files.\n"
    return expected


def actual_files(root: Path | None = None) -> set[PurePosixPath]:
    root = PUBLIC_ROOT if root is None else root
    if not root.exists():
        return set()
    return {
        PurePosixPath(path.relative_to(root).as_posix())
        for path in root.rglob("*")
        if path.is_file()
    }


def check_site(expected: dict[PurePosixPath, str], root: Path | None = None) -> list[str]:
    root = PUBLIC_ROOT if root is None else root
    errors: list[str] = []
    expected_paths = set(expected)
    for missing in sorted(expected_paths - actual_files(root), key=str):
        errors.append(f"缺少文档站生成文件：{root.name}/{missing.as_posix()}")
    for stale in sorted(actual_files(root) - expected_paths, key=str):
        errors.append(f"文档站存在过期文件：{root.name}/{stale.as_posix()}")
    for relative, content in expected.items():
        path = root / Path(relative.as_posix())
        if path.is_file() and path.read_text(encoding="utf-8") != content:
            errors.append(f"文档站生成文件不是最新结果：{root.name}/{relative.as_posix()}")
    return errors


def write_site(expected: dict[PurePosixPath, str], root: Path | None = None) -> None:
    root = PUBLIC_ROOT if root is None else root
    resolved_root = root.resolve()
    if resolved_root.parent != ROOT.resolve() or resolved_root.name not in {"public", "public-external"}:
        raise ValueError(f"拒绝清理非预期目录：{resolved_root}")
    if root.exists():
        marker = root / GENERATED_MARKER
        if not marker.is_file():
            raise ValueError(f"{root.name}/ 缺少生成标记，拒绝覆盖可能由人工维护的目录")
        shutil.rmtree(root)
    for relative, content in expected.items():
        path = root / Path(relative.as_posix())
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只校验生成物，不写入")
    parser.add_argument("--site", choices=("internal", "external", "all"), default="all", help="生成内部站、对外预览站或两者")
    args = parser.parse_args()
    try:
        sites = []
        if args.site in {"internal", "all"}:
            sites.append((PUBLIC_ROOT, build_site_files()))
        if args.site in {"external", "all"}:
            sites.append((EXTERNAL_ROOT, build_external_files()))
        if args.check:
            errors = [error for root, expected in sites for error in check_site(expected, root)]
            if errors:
                print("文档站校验失败：", file=sys.stderr)
                print("\n".join(f"- {error}" for error in errors), file=sys.stderr)
                return 1
            print("文档站校验通过：" + "、".join(f"{root.name} {len(expected)} 个文件" for root, expected in sites))
            return 0
        for root, expected in sites:
            write_site(expected, root)
            print(f"文档站生成完成：{root}（{len(expected)} 个文件）")
        return 0
    except (json.JSONDecodeError, OSError, TypeError, ValueError, yaml.YAMLError) as error:
        print(f"文档站生成失败：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
