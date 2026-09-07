from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SKILL_ROOT = ROOT / "skills" / "fxiaoke-design-system-token-query"
SCRIPT = "./skills/fxiaoke-design-system-token-query/scripts/query_tokens.sh"


def find_bash() -> str:
    candidates = (
        os.environ.get("BASH_BIN"),
        shutil.which("bash"),
        r"D:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\bin\bash.exe",
    )
    for candidate in candidates:
        if candidate and Path(candidate).is_file():
            return candidate
    raise RuntimeError("测试需要 Bash；可通过 BASH_BIN 指定路径")


BASH = find_bash()


def run_query(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [BASH, SCRIPT, *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )


def run_query_by_absolute_path(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        [BASH, str(SKILL_ROOT / "scripts" / "query_tokens.sh"), *args],
        cwd=ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=False,
    )


def parse_results(result: subprocess.CompletedProcess[str]) -> list[dict]:
    return [json.loads(line) for line in result.stdout.splitlines() if line]


class QueryTokensTest(unittest.TestCase):
    def test_replaced_reference_is_read_without_script_changes(self) -> None:
        record = {
            "name": "future-query-token",
            "cssVariable": "--fds-g-future-query-token",
            "layer": "semantic",
            "tier": "base",
            "category": "color",
            "type": "color",
            "resolvedValue": "#FFFFFF",
            "referenceChain": ["future-query-token", "color-gray-0"],
        }
        with tempfile.TemporaryDirectory(dir=ROOT) as directory:
            index = Path(directory) / "updated-reference.jsonl"
            index.write_text(
                json.dumps(record, ensure_ascii=False, separators=(",", ":")) + "\n",
                encoding="utf-8",
            )
            result = run_query(
                "--index",
                index.as_posix(),
                "--name",
                "--fds-g-future-query-token",
            )

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual([record], parse_results(result))

    def test_windows_absolute_script_path_resolves_bundled_index(self) -> None:
        result = run_query_by_absolute_path(
            "--name", "--fds-g-color-danger-background"
        )

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(
            ["color-danger-background"],
            [token["name"] for token in parse_results(result)],
        )

    def test_exact_css_variable_returns_traceable_token(self) -> None:
        result = run_query("--name", "--fds-g-color-primary-hover")

        self.assertEqual(0, result.returncode, result.stderr)
        tokens = parse_results(result)
        self.assertEqual(1, len(tokens))
        self.assertEqual("color-primary-hover", tokens[0]["name"])
        self.assertEqual(("semantic", "base"), (tokens[0]["layer"], tokens[0]["tier"]))
        self.assertEqual(
            ["color-primary-hover", "color-brand-80"],
            tokens[0]["referenceChain"],
        )

    def test_usage_search_prefers_semantic_base(self) -> None:
        result = run_query("--search", "危险 浅背景", "--limit", "1")

        self.assertEqual(0, result.returncode, result.stderr)
        tokens = parse_results(result)
        self.assertEqual(["color-danger-background"], [token["name"] for token in tokens])
        self.assertEqual(("semantic", "base"), (tokens[0]["layer"], tokens[0]["tier"]))

    def test_category_and_tier_filters_are_deterministic(self) -> None:
        result = run_query("--category", "motion", "--tier", "base")

        self.assertEqual(0, result.returncode, result.stderr)
        tokens = parse_results(result)
        self.assertGreater(len(tokens), 0)
        self.assertTrue(all(token["category"] == "motion" for token in tokens))
        self.assertTrue(all(token["tier"] == "base" for token in tokens))

    def test_scene_search_returns_card_title_tokens(self) -> None:
        result = run_query("--search", "卡片标题", "--limit", "1")

        self.assertEqual(0, result.returncode, result.stderr)
        tokens = parse_results(result)
        self.assertEqual(1, len(tokens))
        self.assertTrue(tokens[0]["name"].startswith("scene-card-title-"))
        self.assertEqual("scene", tokens[0]["tier"])

    def test_dropdown_search_returns_the_context_motion_group(self) -> None:
        result = run_query(
            "--search", "Dropdown", "--category", "motion", "--tier", "base"
        )

        self.assertEqual(0, result.returncode, result.stderr)
        names = {token["name"] for token in parse_results(result)}
        self.assertEqual(
            {
                "motion-context-duration",
                "motion-context-enter-easing",
                "motion-context-exit-easing",
            },
            names,
        )

    def test_card_title_size_search_does_not_return_other_title_properties(self) -> None:
        result = run_query("--search", "卡片标题 字号")

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(
            ["scene-card-title-size"],
            [token["name"] for token in parse_results(result)],
        )

    def test_opacity_query_contains_only_six_atomic_values(self) -> None:
        result = run_query(
            "--search", "opacity", "--category", "effects", "--tier", "map", "--limit", "50"
        )

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual(
            {"opacity-0", "opacity-25", "opacity-50", "opacity-65", "opacity-80", "opacity-100"},
            {token["name"] for token in parse_results(result)},
        )
        removed = run_query("--name", "--fds-g-opacity-3")
        self.assertEqual(0, removed.returncode, removed.stderr)
        self.assertEqual([], parse_results(removed))
        disabled = run_query("--name", "--fds-g-opacity-disabled")
        self.assertEqual(0, disabled.returncode, disabled.stderr)
        self.assertEqual("0.5", parse_results(disabled)[0]["resolvedValue"])

    def test_unknown_component_token_is_not_invented(self) -> None:
        result = run_query("--name", "--fds-g-button-padding")

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual([], parse_results(result))

    def test_spacing_scale_uses_explicit_spacing_name(self) -> None:
        result = run_query("--name", "--fds-g-spacing-4")

        self.assertEqual(0, result.returncode, result.stderr)
        self.assertEqual("16px", parse_results(result)[0]["resolvedValue"])

        removed = run_query("--name", "--fds-g-size-4")
        self.assertEqual(0, removed.returncode, removed.stderr)
        self.assertEqual([], parse_results(removed))

    def test_result_contains_css_layer_and_chain_without_source_metadata(self) -> None:
        result = run_query("--name", "color-danger-background")

        self.assertEqual(0, result.returncode, result.stderr)
        token = parse_results(result)[0]
        self.assertEqual(
            "background-color: var(--fds-g-color-danger-background);",
            token["cssExample"],
        )
        self.assertEqual(["color-danger-background", "color-red-10"], token["referenceChain"])
        self.assertNotIn("source", token)
        self.assertNotIn("sourceFile", token)
        self.assertNotIn("origin", token)

    def test_missing_index_fails_loudly(self) -> None:
        result = run_query("--index", "missing.jsonl", "--search", "color")

        self.assertEqual(1, result.returncode)
        self.assertIn("索引读取失败", result.stderr)

    def test_invalid_argument_returns_usage_error(self) -> None:
        result = run_query("--not-supported")

        self.assertEqual(2, result.returncode)
        self.assertIn("参数错误", result.stderr)

    def test_runtime_script_does_not_call_external_query_tools(self) -> None:
        script = (SKILL_ROOT / "scripts" / "query_tokens.sh").read_text(encoding="utf-8")
        external_command = re.compile(
            r"(?m)^\s*(?:grep|rg|sed|awk|jq|python\d*|node|perl|ruby)\b"
        )

        self.assertIsNone(external_command.search(script))
        self.assertNotIn("$(", script)


if __name__ == "__main__":
    unittest.main()
