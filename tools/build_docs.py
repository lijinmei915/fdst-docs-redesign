#!/usr/bin/env python3
"""从 docs Markdown 和 FDST 资产生成可部署的静态文档站。"""

from __future__ import annotations

import argparse
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
TOKEN_CSS = ROOT / "release" / "fds-global-tokens.css"
TOKEN_CATALOG = ROOT / "release" / "fds-token-catalog.json"
GENERATED_MARKER = ".generated-by-fdst-docs"
REPOSITORY_BLOB_URL = "https://git.firstshare.cn/fx/fdst/-/blob/master"

NAVIGATION = (
    ("概览", (("README.md", "文档首页"), ("examples/README.md", "视觉工作台"))),
    (
        "Foundation",
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
    (
        "工程维护",
        (
            ("engineering/YAML源文件.md", "YAML 源文件"),
            ("engineering/构建与校验.md", "构建与校验"),
            ("engineering/版本与发布.md", "版本与发布"),
            ("engineering/文档维护.md", "文档维护"),
        ),
    ),
    (
        "参考",
        (
            ("reference/Token目录.md", "Token 目录"),
            ("reference/迁移与常见问题.md", "迁移与常见问题"),
        ),
    ),
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


def render_nav(current_source: PurePosixPath) -> str:
    groups: list[str] = []
    for group, pages in NAVIGATION:
        links = []
        for source_name, label in pages:
            source = PurePosixPath(source_name)
            active = source == current_source
            links.append(
                f'<a class="docs-nav-link{" is-active" if active else ""}" '
                f'href="{html.escape(relative_href(output_path(current_source), output_path(source)))}"'
                f'{" aria-current=\"page\"" if active else ""}>{html.escape(label)}</a>'
            )
        groups.append(
            f'<section class="docs-nav-group"><h2>{html.escape(group)}</h2>{"".join(links)}</section>'
        )
    return "".join(groups)


def render_page(
    source: PurePosixPath,
    title: str,
    metadata: dict,
    article: str,
    toc: list[tuple[str, str]],
) -> str:
    current_output = output_path(source)
    root_prefix = relative_href(current_output, PurePosixPath("index.html"))
    if root_prefix == "index.html":
        root_prefix = "."
    else:
        root_prefix = str(PurePosixPath(root_prefix).parent)
    group = next((name for name, pages in NAVIGATION if any(path == source.as_posix() for path, _ in pages)), "文档")
    toc_markup = "".join(
        f'<a href="#{html.escape(anchor)}">{html.escape(label)}</a>' for anchor, label in toc
    )
    teaches = str(metadata.get("teaches", ""))
    return f'''<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="{html.escape(teaches)}">
  <title>{html.escape(title)} | FDS Token</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="{root_prefix}/assets/fds-global-tokens.css">
  <link rel="stylesheet" href="{root_prefix}/assets/fds-docs.css">
  <script defer src="{root_prefix}/assets/search-index.js"></script>
  <script defer src="{root_prefix}/assets/fds-demos.js"></script>
  <script defer src="{root_prefix}/assets/fds-docs.js"></script>
</head>
<body data-page="{html.escape(source.as_posix())}" data-root="{html.escape(root_prefix)}">
  <header class="docs-topbar">
    <a class="docs-brand" href="{root_prefix}/index.html" aria-label="FDS Token 文档首页"><span>FDS</span><strong>Token</strong></a>
    <span class="docs-area">Foundation</span>
    <div class="docs-topbar-actions">
      <button class="docs-search-trigger" type="button" data-search-open>搜索文档</button>
      <button class="docs-menu-trigger" type="button" data-menu-toggle aria-expanded="false">目录</button>
    </div>
  </header>
  <div class="docs-shell">
    <aside class="docs-sidebar" data-sidebar aria-label="文档导航">{render_nav(source)}</aside>
    <main class="docs-main">
      <div class="docs-breadcrumb"><span>{html.escape(group)}</span><span>/</span><strong>{html.escape(title)}</strong></div>
      <article class="docs-article">{article}</article>
    </main>
    <aside class="docs-toc" aria-label="本页目录"><strong>本页目录</strong>{toc_markup}</aside>
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
    for source in page_sources():
        source_path = DOCS_ROOT / Path(source.as_posix())
        if not source_path.is_file():
            raise FileNotFoundError(f"文档导航源不存在：{source.as_posix()}")
        metadata, body = split_frontmatter(source_path.read_text(encoding="utf-8"))
        title = markdown_title(body, source.stem)
        current_output = output_path(source)
        renderer = markdown.Markdown(
            extensions=[
                "tables",
                "fenced_code",
                "sane_lists",
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


def actual_files() -> set[PurePosixPath]:
    if not PUBLIC_ROOT.exists():
        return set()
    return {
        PurePosixPath(path.relative_to(PUBLIC_ROOT).as_posix())
        for path in PUBLIC_ROOT.rglob("*")
        if path.is_file()
    }


def check_site(expected: dict[PurePosixPath, str]) -> list[str]:
    errors: list[str] = []
    expected_paths = set(expected)
    for missing in sorted(expected_paths - actual_files(), key=str):
        errors.append(f"缺少文档站生成文件：public/{missing.as_posix()}")
    for stale in sorted(actual_files() - expected_paths, key=str):
        errors.append(f"文档站存在过期文件：public/{stale.as_posix()}")
    for relative, content in expected.items():
        path = PUBLIC_ROOT / Path(relative.as_posix())
        if path.is_file() and path.read_text(encoding="utf-8") != content:
            errors.append(f"文档站生成文件不是最新结果：public/{relative.as_posix()}")
    return errors


def write_site(expected: dict[PurePosixPath, str]) -> None:
    resolved_public = PUBLIC_ROOT.resolve()
    if resolved_public.parent != ROOT.resolve() or resolved_public.name != "public":
        raise ValueError(f"拒绝清理非预期目录：{resolved_public}")
    if PUBLIC_ROOT.exists():
        marker = PUBLIC_ROOT / GENERATED_MARKER
        if not marker.is_file():
            raise ValueError("public/ 缺少生成标记，拒绝覆盖可能由人工维护的目录")
        shutil.rmtree(PUBLIC_ROOT)
    for relative, content in expected.items():
        path = PUBLIC_ROOT / Path(relative.as_posix())
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(content, encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="只校验 public 生成物，不写入")
    args = parser.parse_args()
    try:
        expected = build_site_files()
        if args.check:
            errors = check_site(expected)
            if errors:
                print("文档站校验失败：", file=sys.stderr)
                print("\n".join(f"- {error}" for error in errors), file=sys.stderr)
                return 1
            print(f"文档站校验通过：{len(page_sources())} 个页面，{len(expected)} 个生成文件")
            return 0
        write_site(expected)
        print(f"文档站生成完成：{PUBLIC_ROOT}（{len(page_sources())} 个页面）")
        return 0
    except (json.JSONDecodeError, OSError, TypeError, ValueError, yaml.YAMLError) as error:
        print(f"文档站生成失败：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
