from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import yaml


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fds_import_css_snapshot", ROOT / "tools" / "import_css_snapshot.py"
)
IMPORT = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(IMPORT)


class ImportCssSnapshotTest(unittest.TestCase):
    def test_current_css_snapshot_imports_all_tokens(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            tokens_root = Path(directory) / "tokens"
            with (
                mock.patch.object(IMPORT, "TOKENS_ROOT", tokens_root),
                mock.patch.object(
                    sys,
                    "argv",
                    ["import_css_snapshot.py", str(ROOT / "dist" / "fds-global-tokens.css")],
                ),
            ):
                self.assertEqual(0, IMPORT.main())

            scene_source = yaml.safe_load(
                (tokens_root / "semantic" / "scene" / "default.yml").read_text(
                    encoding="utf-8"
                )
            )
            self.assertEqual("--fds-s-", scene_source["global"]["namespace"])
            self.assertEqual(13, len(scene_source["props"]))
            self.assertEqual("{!spacing-4}", scene_source["props"]["card-padding"]["value"])

    def test_scene_namespace_is_imported_into_scene_source(self) -> None:
        match = IMPORT.DECL_RE.match(
            "  --fds-s-card-padding: var(--fds-g-spacing-4);"
        )

        self.assertIsNotNone(match)
        assert match is not None
        self.assertEqual("--fds-s-", match.group("namespace"))
        self.assertEqual("card-padding", match.group("token_id"))
        self.assertEqual("semantic/scene/default.yml", IMPORT.classify("card-padding", "--fds-s-"))
        self.assertEqual("dimension", IMPORT.token_type("card-padding"))
        self.assertEqual(
            "{!spacing-4}",
            IMPORT.CSS_REFERENCE_RE.sub(
                lambda reference: f"{{!{reference.group(1)}}}",
                match.group("value"),
            ),
        )

    def test_scene_source_and_group_keep_dedicated_namespace(self) -> None:
        scene_source = IMPORT.SOURCE_FILES["semantic/scene/default.yml"]

        self.assertEqual("--fds-s-", scene_source["global"]["namespace"])
        self.assertIn("./scene/base.yml", IMPORT.GROUP_FILES["semantic/base.yml"]["imports"])
        self.assertEqual(
            ["./default.yml"],
            IMPORT.GROUP_FILES["semantic/scene/base.yml"]["imports"],
        )

    def test_unknown_scene_token_is_rejected(self) -> None:
        with self.assertRaisesRegex(ValueError, "无法分类 Scene Token"):
            IMPORT.classify("unknown", "--fds-s-")


if __name__ == "__main__":
    unittest.main()
