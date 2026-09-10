from __future__ import annotations

import importlib.util
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
    def test_site_is_generated_from_every_navigation_source(self) -> None:
        files = BUILD_DOCS.build_site_files()

        for source in BUILD_DOCS.page_sources():
            self.assertIn(BUILD_DOCS.output_path(source), files)
        self.assertIn(PurePosixPath("assets/fds-global-tokens.css"), files)
        self.assertIn(PurePosixPath("assets/search-index.js"), files)
        self.assertEqual(
            len(BUILD_DOCS.page_sources()),
            files[PurePosixPath("assets/search-index.js")].count('"href":'),
        )

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

    def test_internal_markdown_links_are_rewritten_to_html(self) -> None:
        files = BUILD_DOCS.build_site_files()
        home = files[PurePosixPath("index.html")]

        self.assertIn('href="foundations/颜色.html"', home)
        self.assertNotIn('href="foundations/颜色.md"', home)
        self.assertIn("https://git.firstshare.cn/fx/fdst/-/blob/master/dist/fds-global-tokens.css", home)

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
