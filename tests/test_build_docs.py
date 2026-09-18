from __future__ import annotations

import importlib.util
import hashlib
import json
import re
import sys
import tempfile
import unittest
from pathlib import Path, PurePosixPath
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
TOOLS_ROOT = ROOT / "tools"
sys.path.insert(0, str(TOOLS_ROOT))
SPEC = importlib.util.spec_from_file_location("fds_build_docs", TOOLS_ROOT / "build_docs.py")
BUILD_DOCS = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(BUILD_DOCS)


class BuildDocsTest(unittest.TestCase):
    def test_top_sections_match_page_classification(self) -> None:
        files = BUILD_DOCS.build_site_files()
        expected = {
            "foundations/颜色.html": ("基础规范", "视觉基础"),
            "semantics/基础语义.html": ("基础规范", "语义"),
            "examples/index.html": ("基础规范", "视觉预览"),
            "concepts/命名规则.html": ("使用指南", "概念"),
            "reference/迁移与常见问题.html": ("使用指南", "常见问题"),
            "reference/Token目录.html": ("Token 目录", "Token 目录"),
            "engineering/YAML源文件.html": ("内部工程", "工程维护"),
        }
        for path, (section, group) in expected.items():
            page = files[PurePosixPath(path)]
            top = page.split('<nav class="docs-primary-nav"', 1)[1].split("</nav>", 1)[0]
            sidebar = page.split('<aside class="docs-sidebar"', 1)[1].split("</aside>", 1)[0]
            self.assertEqual(1, top.count('class="docs-section-link is-active"'))
            self.assertIn(f'>{section}</a>', top)
            self.assertIn(f'<h2>{group}</h2>', sidebar)
            self.assertIn('class="docs-mobile-sections"', sidebar)
        naming = files[PurePosixPath("concepts/命名规则.html")]
        sidebar = naming.split('<aside class="docs-sidebar"', 1)[1].split("</nav>", 1)[1].split("</aside>", 1)[0]
        self.assertNotIn("foundations/颜色.html", sidebar)
        self.assertNotIn("engineering/YAML源文件.html", sidebar)

        sources = [path for _, pages in BUILD_DOCS.NAVIGATION for path, _ in pages]
        self.assertEqual(len(sources), len(set(sources)))
        self.assertEqual(
            ["README.md"],
            [path for path in sources if BUILD_DOCS.section_for_source(PurePosixPath(path)) is None],
        )

    def test_site_is_generated_from_every_navigation_source(self) -> None:
        files = BUILD_DOCS.build_site_files()

        for source in BUILD_DOCS.page_sources():
            self.assertIn(BUILD_DOCS.output_path(source), files)
        self.assertIn(PurePosixPath("assets/fds-global-tokens.css"), files)
        self.assertIn(PurePosixPath("assets/fds-demo-data.js"), files)
        self.assertIn(PurePosixPath("assets/search-index.js"), files)
        self.assertEqual(
            len(BUILD_DOCS.page_sources()),
            files[PurePosixPath("assets/search-index.js")].count('"href":'),
        )

    def test_homepage_follows_prototype_structure(self) -> None:
        files = BUILD_DOCS.build_site_files()
        home = files[PurePosixPath("index.html")]
        self.assertIn("<title>FDS Token</title>", home)
        sections = ["proto-hero", "proto-role-grid", "proto-preview-section", "proto-specs", "proto-code-block", "proto-footer"]
        positions = [home.index(f'class="{section}"') for section in sections]
        self.assertEqual(sorted(positions), positions)
        self.assertEqual(4, home.count('class="proto-role-card"'))
        self.assertEqual(6, home.count('class="proto-color-family"'))
        self.assertEqual(2, home.count('class="proto-spec-card"'))
        for absent in ('class="docs-sidebar"', 'class="docs-toc"', 'class="docs-primary-nav"', 'data-menu-toggle', 'data-demo="overview"'):
            self.assertNotIn(absent, home)
        self.assertIn('class="docs-home-breadcrumb"', home)
        self.assertIn('data-search-open', home)
        self.assertIn('<pre class="proto-code-block"><code>', home)
        for href in re.findall(r'href="([^"]+)"', home):
            if href.endswith(".html") and not href.startswith("https:"):
                self.assertIn(PurePosixPath(href), files)
        self.assertEqual(
            (ROOT / "docs/site-assets/prototype-c.html").read_text(encoding="utf-8"),
            files[PurePosixPath("prototypes/prototype-c.html")],
        )

    def test_homepage_palette_is_derived_from_catalog(self) -> None:
        catalog = json.loads((ROOT / "release/fds-token-catalog.json").read_text(encoding="utf-8"))
        palette = BUILD_DOCS.catalog_range_tables(catalog)["homepalette"]
        for family in ("brand", "blue", "green", "red", "purple", "gray"):
            tokens = [token for token in catalog["tokens"] if re.fullmatch(f"color-{family}-[0-9]+", token["name"])]
            self.assertEqual(20 if family == "gray" else 12, len(tokens))
            for token in tokens:
                self.assertIn(f'{token["cssVariable"]}: {token["resolvedValue"]}', palette)
        next(token for token in catalog["tokens"] if token["name"] == "color-blue-6")["resolvedValue"] = "#123456"
        with tempfile.TemporaryDirectory() as directory:
            catalog_path = Path(directory) / "catalog.json"
            catalog_path.write_text(json.dumps(catalog), encoding="utf-8")
            with mock.patch.object(BUILD_DOCS, "TOKEN_CATALOG", catalog_path):
                home = BUILD_DOCS.build_site_files()[PurePosixPath("index.html")]
        self.assertIn('style="background:#123456"', home)
        self.assertNotIn("<!-- fds-catalog-table:", home)
        source = (ROOT / "docs/README.md").read_text(encoding="utf-8")
        self.assertNotRegex(source, r"#[0-9A-Fa-f]{6}\b")

    def test_foundation_pages_keep_inline_demo_mounts(self) -> None:
        files = BUILD_DOCS.build_site_files()

        expectations = {
            "foundations/颜色.html": "semantic-colors",
            "foundations/排版.html": "typography",
            "foundations/间距与尺寸.html": "spacing",
            "foundations/圆角与边框.html": "radius",
            "foundations/阴影与层级.html": "effects",
            "foundations/动效.html": "motion",
        }
        for page, demo in expectations.items():
            self.assertIn(f'data-demo="{demo}"', files[PurePosixPath(page)])

    def test_typography_and_range_tables_follow_catalog_json(self) -> None:
        catalog = json.loads((ROOT / "release/fds-token-catalog.json").read_text(encoding="utf-8"))
        for token in catalog["tokens"]:
            if token["name"] == "font-size-1":
                token["resolvedValue"] = "99px"
            elif token["name"] == "heading-1-size":
                token["resolvedValue"] = "33px"
            elif token["name"] == "density-compact-line-height":
                token["resolvedValue"] = "1.37"
        with tempfile.TemporaryDirectory() as directory:
            catalog_path = Path(directory) / "catalog.json"
            catalog_path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(BUILD_DOCS, "TOKEN_CATALOG", catalog_path):
                files = BUILD_DOCS.build_site_files()
        page = files[PurePosixPath("foundations/排版.html")]
        self.assertIn("99px", page)
        self.assertIn("33px", page)
        self.assertIn("1.37", page)
        self.assertIn("--fds-s-density-compact-line-height", page)
        self.assertIn("font-size: var(--fds-g-heading-5-size);", page)
        self.assertIn("当前值（来自 Catalog JSON）", page)
        self.assertNotIn("<!-- fds-catalog-table:", page)
        data = json.loads(files[PurePosixPath("assets/fds-demo-data.js")].removeprefix("window.FDS_DEMO_DATA = ").rstrip(";\n"))
        self.assertEqual("33px", data["typography"][0]["size"]["resolvedValue"])
        self.assertNotIn("palettes", data)

    def test_typography_build_rejects_missing_recipe_token(self) -> None:
        catalog = json.loads((ROOT / "release/fds-token-catalog.json").read_text(encoding="utf-8"))
        catalog["tokens"] = [token for token in catalog["tokens"] if token["name"] != "heading-5-weight"]
        catalog["tokenCount"] = len(catalog["tokens"])
        with tempfile.TemporaryDirectory() as directory:
            catalog_path = Path(directory) / "catalog.json"
            catalog_path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(BUILD_DOCS, "TOKEN_CATALOG", catalog_path):
                with self.assertRaisesRegex(ValueError, "heading-5-weight"):
                    BUILD_DOCS.build_site_files()

    def test_current_primary_mapping_and_density_follow_catalog(self) -> None:
        catalog = json.loads((ROOT / "release/fds-token-catalog.json").read_text(encoding="utf-8"))
        for token in catalog["tokens"]:
            if token["name"] == "color-primary":
                token["value"] = "{!color-brand-7}"
                token["resolvedValue"] = "#123456"
            elif token["name"] == "density-compact-spacing":
                token["resolvedValue"] = "7px"
        with tempfile.TemporaryDirectory() as directory:
            catalog_path = Path(directory) / "catalog.json"
            catalog_path.write_text(json.dumps(catalog, ensure_ascii=False), encoding="utf-8")
            with mock.patch.object(BUILD_DOCS, "TOKEN_CATALOG", catalog_path):
                files = BUILD_DOCS.build_site_files()
        color = files[PurePosixPath("foundations/颜色.html")]
        naming = files[PurePosixPath("concepts/命名规则.html")]
        yaml_source = files[PurePosixPath("engineering/YAML源文件.html")]
        spacing = files[PurePosixPath("foundations/间距与尺寸.html")]
        scene = files[PurePosixPath("semantics/场景语义.html")]
        self.assertIn("#123456", color)
        self.assertIn("{!color-brand-7}", color)
        for page in (naming, yaml_source):
            self.assertIn("{!color-brand-7}", page)
            self.assertIn("--fds-g-color-primary: var(--fds-g-color-brand-7);", page)
            self.assertNotIn("--fds-g-color-primary: var(--fds-g-color-brand-9);", page)
        self.assertIn("7px", spacing)
        self.assertIn("7px", scene)

    def test_document_references_must_exist_in_catalog(self) -> None:
        catalog = json.loads((ROOT / "release/fds-token-catalog.json").read_text(encoding="utf-8"))
        BUILD_DOCS.validate_document_token_references(
            "Use `--fds-g-heading-5-size`; prefix `--fds-s-card-` is illustrative.",
            catalog,
            PurePosixPath("sample.md"),
        )
        with self.assertRaisesRegex(ValueError, "--fds-g-heading-99-size"):
            BUILD_DOCS.validate_document_token_references(
                "Use `--fds-g-heading-99-size`.", catalog, PurePosixPath("sample.md")
            )
        with self.assertRaisesRegex(ValueError, "手写了可能过时的 Token 数值"):
            BUILD_DOCS.validate_document_token_references(
                "主色是 #FF8000。", catalog, PurePosixPath("foundations/颜色.md")
            )

    def test_pages_version_demo_asset_from_its_content(self) -> None:
        files = BUILD_DOCS.build_site_files()
        demo = files[PurePosixPath("assets/fds-demos.js")]
        version = hashlib.sha256(demo.encode("utf-8")).hexdigest()[:12]
        self.assertIn(
            f'/assets/fds-demos.js?v={version}',
            files[PurePosixPath("foundations/颜色.html")],
        )
        token_css = files[PurePosixPath("assets/fds-global-tokens.css")]
        css_version = hashlib.sha256(token_css.encode("utf-8")).hexdigest()[:12]
        self.assertIn(
            f'/assets/fds-global-tokens.css?v={css_version}',
            files[PurePosixPath("foundations/颜色.html")],
        )

    def test_demo_data_uses_catalog_tokens_outside_palette_preview(self) -> None:
        files = BUILD_DOCS.build_site_files()
        asset = files[PurePosixPath("assets/fds-demo-data.js")]
        prefix = "window.FDS_DEMO_DATA = "
        self.assertTrue(asset.startswith(prefix))
        data = json.loads(asset[len(prefix):-2])
        self.assertNotIn("palettes", data)
        catalog = json.loads((ROOT / "release/fds-token-catalog.json").read_text(encoding="utf-8"))
        indexed = {token["cssVariable"]: token for token in catalog["tokens"]}
        expected_radius = {
            token["cssVariable"]: token["resolvedValue"] for token in catalog["tokens"]
            if re.fullmatch(r"radius-(\d+|full)", token["name"])
            and (token["layer"], token["tier"], token["category"]) == ("atomic", "map", "shape")
        }
        self.assertEqual(
            expected_radius,
            {item["cssVariable"]: item["resolvedValue"] for item in data["radius"]},
        )
        def check_records(value):
            if isinstance(value, list):
                for item in value:
                    check_records(item)
            elif isinstance(value, dict):
                if "cssVariable" in value:
                    token = indexed[value["cssVariable"]]
                    self.assertEqual(value["resolvedValue"], token["resolvedValue"])
                for item in value.values():
                    check_records(item)

        check_records({key: value for key, value in data.items() if key != "project9Palette"})
        for key, pattern, layer, tier, category in (
            ("spacing", r"spacing-\d+", "atomic", "map", "spacing"),
            ("opacity", r"opacity-\d+", "atomic", "map", "effects"),
            ("shadows", r"shadow-(?!\d+$).+", "semantic", "base", "effects"),
            ("layers", r"layer-.+", "semantic", "base", "layout"),
        ):
            expected_names = {
                token["name"] for token in catalog["tokens"]
                if (token["layer"], token["tier"], token["category"]) == (layer, tier, category)
                and re.fullmatch(pattern, token["name"])
            }
            self.assertEqual(expected_names, {item["name"] for item in data[key]})
        self.assertEqual(
            {token["name"] for token in catalog["tokens"] if token["category"] == "motion" and token["tier"] == "base" and token["name"].endswith("-duration")},
            {item["duration"]["name"] for item in data["motions"]},
        )
        version = hashlib.sha256(asset.encode("utf-8")).hexdigest()[:12]
        self.assertIn(
            f'/assets/fds-demo-data.js?v={version}',
            files[PurePosixPath("foundations/颜色.html")],
        )
        self.assertIn(
            f'/assets/fds-demo-data.js?v={version}',
            files[PurePosixPath("foundations/圆角与边框.html")],
        )

    def test_project9_palette_is_local_preview_only(self) -> None:
        files = BUILD_DOCS.build_site_files()
        asset = files[PurePosixPath("assets/fds-demo-data.js")]
        data = json.loads(asset.removeprefix("window.FDS_DEMO_DATA = ").rstrip(";\n"))
        self.assertNotIn("palettes", data)
        self.assertNotIn("data-palette-source", files[PurePosixPath("assets/fds-demos.js")])
        preview = data["project9Palette"]
        snapshot = json.loads((ROOT / "docs/site-assets/project9-palette.json").read_text(encoding="utf-8"))
        self.assertEqual(snapshot, preview)
        self.assertEqual(276, sum(len(group["swatches"]) for groups in preview["palettes"].values() for group in groups))
        brand = next(group for group in preview["palettes"]["base"] if group["family"] == "brand")
        self.assertEqual(list(range(1, 13)), [swatch["step"] for swatch in brand["swatches"]])
        self.assertEqual("#FF8000", brand["swatches"][6]["cssValue"])
        self.assertFalse(any("var(" in swatch["cssValue"] for groups in preview["palettes"].values() for group in groups for swatch in group["swatches"]))

    def test_site_styles_reference_published_css_variables(self) -> None:
        catalog = json.loads((ROOT / "release/fds-token-catalog.json").read_text(encoding="utf-8"))
        published = {token["cssVariable"] for token in catalog["tokens"]}
        for source in ("fds-docs.css", "fds-demos.js"):
            content = (ROOT / "docs/site-assets" / source).read_text(encoding="utf-8")
            self.assertFalse(set(re.findall(r"--fds-[gs]-[a-z0-9-]+", content)) - published)

    def test_internal_markdown_links_are_rewritten_to_html(self) -> None:
        files = BUILD_DOCS.build_site_files()
        home = files[PurePosixPath("index.html")]

        self.assertIn('href="foundations/颜色.html"', home)
        self.assertNotIn('href="foundations/颜色.md"', home)
        self.assertIn("https://git.firstshare.cn/fx/fdst/-/blob/master/release/fds-global-tokens.css", home)

    def test_external_build_contains_only_allowlisted_preview_content(self) -> None:
        files = BUILD_DOCS.build_external_files()
        self.assertEqual(
            {"index.html", "使用说明.html", "assets/external.css", BUILD_DOCS.GENERATED_MARKER},
            {path.as_posix() for path in files},
        )
        combined = "\n".join(files.values())
        for forbidden in ("git.firstshare.cn", "project9Palette", "项目9", "ShareDev", "fds-global-tokens.css", "search-index.js"):
            self.assertNotIn(forbidden, combined)
        self.assertIn('href="使用说明.html"', files[PurePosixPath("index.html")])
        self.assertIn('name="robots" content="noindex, nofollow"', files[PurePosixPath("index.html")])

    def test_external_build_rejects_unapproved_document(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            external_root = Path(directory)
            (external_root / "README.md").write_text("# Unreviewed", encoding="utf-8")
            (external_root / "使用说明.md").write_text("# Unreviewed", encoding="utf-8")
            with mock.patch.object(BUILD_DOCS, "EXTERNAL_DOCS_ROOT", external_root):
                with self.assertRaisesRegex(ValueError, "audience: external"):
                    BUILD_DOCS.build_external_files()

    def test_write_then_check_detects_drift(self) -> None:
        expected = {PurePosixPath("index.html"): "ok\n", PurePosixPath(BUILD_DOCS.GENERATED_MARKER): "marker\n"}
        with tempfile.TemporaryDirectory() as directory:
            public_root = Path(directory) / "public"
            with mock.patch.object(BUILD_DOCS, "ROOT", Path(directory)), mock.patch.object(
                BUILD_DOCS, "PUBLIC_ROOT", public_root
            ):
                BUILD_DOCS.write_site(expected)
                self.assertEqual([], BUILD_DOCS.check_site(expected))
                (public_root / "index.html").write_text("stale\n", encoding="utf-8")
                self.assertEqual(1, len(BUILD_DOCS.check_site(expected)))


if __name__ == "__main__":
    unittest.main()
