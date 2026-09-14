from __future__ import annotations

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
TOOLS_ROOT = ROOT / "tools"
sys.path.insert(0, str(TOOLS_ROOT))
SPEC = importlib.util.spec_from_file_location(
    "fds_token_export_catalog", TOOLS_ROOT / "export_catalog.py"
)
EXPORT = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
SPEC.loader.exec_module(EXPORT)


class ExportCatalogTest(unittest.TestCase):
    def test_catalog_is_deterministic_and_traces_every_token_to_yaml(self) -> None:
        first = EXPORT.build_catalog()
        second = EXPORT.build_catalog()

        self.assertEqual(EXPORT.render_catalog(first), EXPORT.render_catalog(second))
        self.assertEqual(first["tokenCount"], len(first["tokens"]))
        self.assertEqual(len(first["tokens"]), len({item["id"] for item in first["tokens"]}))
        self.assertTrue(all(item["source"].startswith("tokens/") for item in first["tokens"]))
        self.assertTrue(all((ROOT / item["source"]).is_file() for item in first["tokens"]))
        required_fields = {
            "name",
            "cssVariable",
            "layer",
            "tier",
            "category",
            "type",
            "value",
            "resolvedValue",
            "referenceChain",
            "sourceFile",
        }
        self.assertTrue(all(required_fields <= item.keys() for item in first["tokens"]))

    def test_generated_index_contains_each_catalog_item_once(self) -> None:
        catalog = EXPORT.build_catalog()
        markdown = EXPORT.render_token_index(catalog)

        self.assertIn("请勿手工编辑", markdown)
        for token in catalog["tokens"]:
            self.assertEqual(1, markdown.count(f"`{token['cssVariable']}`"))

    def test_resolved_values_do_not_contain_source_references(self) -> None:
        catalog = EXPORT.build_catalog()

        self.assertTrue(all("{!" not in item["resolvedValue"] for item in catalog["tokens"]))

    def test_color_origin_metadata_is_preserved(self) -> None:
        catalog = EXPORT.build_catalog()
        tokens = {item["id"]: item for item in catalog["tokens"]}

        self.assertEqual("manual", tokens["color-brand"]["origin"])
        self.assertEqual("manual", tokens["color-brand-8"]["origin"])
        self.assertEqual("manual", tokens["color-yellow-dark-9"]["origin"])
        self.assertEqual("manual", tokens["color-gray-1"]["origin"])
        self.assertEqual("manual", tokens["color-special-1"]["origin"])
        self.assertEqual("derived", tokens["color-brand-8-rgb"]["origin"])

    def test_catalog_contains_complete_reference_chains(self) -> None:
        catalog = EXPORT.build_catalog()
        tokens = {item["id"]: item for item in catalog["tokens"]}

        self.assertEqual(
            ["color-danger-background", "color-red-0"],
            tokens["color-danger-background"]["referenceChain"],
        )
        self.assertEqual(
            ["card-radius", "radius-4"],
            tokens["card-radius"]["referenceChain"],
        )
        self.assertEqual("--fds-s-card-radius", tokens["card-radius"]["cssVariable"])
        self.assertEqual(
            {"default": "--fds-g-", "scene": "--fds-s-"},
            catalog["namespaces"],
        )
        self.assertEqual(["color-red-4"], tokens["color-red-4"]["referenceChain"])

    def test_typography_size_search_examples_use_font_size(self) -> None:
        catalog = EXPORT.build_catalog()
        tokens = {item["id"]: item for item in catalog["tokens"]}

        for token_id in (
            "heading-1-size",
            "heading-5-size",
            "heading-6-size",
            "text-size",
        ):
            record = EXPORT.build_search_record(tokens[token_id])
            self.assertEqual(
                f"font-size: var({tokens[token_id]['cssVariable']});",
                record["cssExample"],
            )
        self.assertEqual("gap", EXPORT.css_property_for(tokens["spacing-4"]))

    def test_relative_line_height_is_exported_as_unitless_line_height(self) -> None:
        catalog = EXPORT.build_catalog()
        tokens = {item["id"]: item for item in catalog["tokens"]}
        token = tokens["line-height-ratio-6"]

        self.assertEqual("number", token["type"])
        self.assertEqual("1.5", token["resolvedValue"])
        self.assertEqual(
            "line-height: var(--fds-g-line-height-ratio-6);",
            EXPORT.build_search_record(token)["cssExample"],
        )

    def test_catalog_contains_only_relative_source_paths(self) -> None:
        catalog = EXPORT.build_catalog()

        self.assertEqual("tokens/fds-global.yml", catalog["source"])
        self.assertTrue(all(not Path(item["source"]).is_absolute() for item in catalog["tokens"]))
        self.assertNotIn(str(ROOT), EXPORT.render_catalog(catalog))

    def test_unknown_doc_variable_is_reported(self) -> None:
        catalog = EXPORT.build_catalog()
        with tempfile.TemporaryDirectory() as directory:
            docs_root = Path(directory)
            (docs_root / "example.md").write_text(
                "color: var(--fds-g-not-a-real-token);\n"
                "background: var(--fds-s-not-a-real-token);\n",
                encoding="utf-8",
            )
            with mock.patch.object(EXPORT, "DOCS_ROOT", docs_root):
                errors = EXPORT.validate_doc_variables(catalog)

        self.assertEqual(2, len(errors))
        self.assertTrue(any("--fds-g-not-a-real-token" in error for error in errors))
        self.assertTrue(any("--fds-s-not-a-real-token" in error for error in errors))

    def test_unknown_html_preview_variable_is_reported(self) -> None:
        catalog = EXPORT.build_catalog()
        with tempfile.TemporaryDirectory() as directory:
            docs_root = Path(directory)
            (docs_root / "preview.html").write_text(
                "<style>color: var(--fds-g-not-a-real-token);</style>\n",
                encoding="utf-8",
            )
            with mock.patch.object(EXPORT, "DOCS_ROOT", docs_root):
                errors = EXPORT.validate_doc_variables(catalog)

        self.assertEqual(1, len(errors))
        self.assertIn("preview.html", errors[0])
        self.assertIn("--fds-g-not-a-real-token", errors[0])

    def test_unknown_site_asset_variable_is_reported(self) -> None:
        catalog = EXPORT.build_catalog()
        with tempfile.TemporaryDirectory() as directory:
            docs_root = Path(directory)
            (docs_root / "demo.js").write_text(
                'const token = "--fds-g-not-a-real-token";\n',
                encoding="utf-8",
            )
            with mock.patch.object(EXPORT, "DOCS_ROOT", docs_root):
                errors = EXPORT.validate_doc_variables(catalog)

        self.assertEqual(1, len(errors))
        self.assertIn("demo.js", errors[0])

    def test_wildcard_is_not_treated_as_an_example(self) -> None:
        catalog = EXPORT.build_catalog()
        with tempfile.TemporaryDirectory() as directory:
            docs_root = Path(directory)
            (docs_root / "guide.md").write_text("`--fds-s-*`\n", encoding="utf-8")
            with mock.patch.object(EXPORT, "DOCS_ROOT", docs_root):
                errors = EXPORT.validate_doc_variables(catalog)

        self.assertEqual([], errors)

    def test_missing_relative_link_is_reported(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            docs_root = Path(directory)
            (docs_root / "example.md").write_text("[missing](missing.md)\n", encoding="utf-8")
            with mock.patch.object(EXPORT, "DOCS_ROOT", docs_root):
                errors = EXPORT.validate_markdown_links()

        self.assertEqual(1, len(errors))
        self.assertIn("missing.md", errors[0])

    def test_written_catalog_is_valid_json(self) -> None:
        catalog = EXPORT.build_catalog()
        parsed = json.loads(EXPORT.render_catalog(catalog))

        self.assertEqual("fds-token-catalog/v1", parsed["schema"])
        self.assertEqual("tokens/fds-global.yml", parsed["source"])

    def test_dist_catalog_and_skill_search_index_are_checked_together(self) -> None:
        catalog = EXPORT.build_catalog()
        expected = EXPORT.render_catalog(catalog)
        search_records = [
            json.loads(line)
            for line in EXPORT.SKILL_SEARCH_INDEX_OUTPUT.read_text(encoding="utf-8").splitlines()
        ]

        self.assertEqual(expected, EXPORT.CATALOG_OUTPUT.read_text(encoding="utf-8"))
        self.assertEqual(catalog["tokenCount"], len(search_records))
        self.assertTrue(
            all(
                field not in record
                for record in search_records
                for field in ("source", "sourceFile", "origin")
            )
        )
        self.assertEqual(
            "color-danger-background",
            next(
                record["name"]
                for record in search_records
                if "危险" in record["searchTerms"] and "浅背景" in record["searchTerms"]
            ),
        )
        self.assertNotIn(
            "文本",
            next(
                record["searchTerms"]
                for record in search_records
                if record["name"] == "motion-context-duration"
            ),
        )
        self.assertEqual([], EXPORT.check_outputs(catalog))

    def test_migration_skill_contains_complete_catalog_jsonl(self) -> None:
        catalog = EXPORT.build_catalog()
        migration_records = [
            json.loads(line)
            for line in EXPORT.SKILL_MIGRATION_CATALOG_OUTPUT.read_text(
                encoding="utf-8"
            ).splitlines()
        ]

        self.assertEqual(catalog["tokens"], migration_records)
        self.assertEqual(
            EXPORT.render_migration_catalog(catalog),
            EXPORT.SKILL_MIGRATION_CATALOG_OUTPUT.read_text(encoding="utf-8"),
        )

    def test_write_catalog_writes_only_the_requested_json(self) -> None:
        catalog = EXPORT.build_catalog()
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "nested" / "catalog.json"

            EXPORT.write_catalog(output, catalog)

            self.assertEqual(EXPORT.render_catalog(catalog), output.read_text(encoding="utf-8"))
            self.assertEqual([output], [path for path in Path(directory).rglob("*") if path.is_file()])


if __name__ == "__main__":
    unittest.main()
