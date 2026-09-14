from __future__ import annotations

import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("fds_token_build", ROOT / "tools" / "build.py")
BUILD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = BUILD
SPEC.loader.exec_module(BUILD)


def source(
    layer: str,
    tier: str,
    token_type: str,
    props: dict,
    namespace: str | None = None,
) -> dict:
    global_meta = {
            "layer": layer,
            "tier": tier,
            "category": "test",
            "type": token_type,
            "scope": "global",
            "primitive": layer == "atomic",
        }
    if namespace is not None:
        global_meta["namespace"] = namespace
    return {
        "global": global_meta,
        "props": props,
    }


class BuildTest(unittest.TestCase):
    def test_build_writes_pretty_and_minified_css(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "fds-global-tokens.css"
            minified_output = Path(directory) / "fds-global-tokens.min.css"
            with (
                mock.patch.object(BUILD, "OUTPUT", output),
                mock.patch.object(BUILD, "MINIFIED_OUTPUT", minified_output),
                mock.patch.object(sys, "argv", ["build.py"]),
            ):
                self.assertEqual(0, BUILD.main())

            self.assertTrue(output.is_file())
            self.assertTrue(minified_output.is_file())
            pretty_css = output.read_text(encoding="utf-8")
            minified_css = minified_output.read_text(encoding="utf-8")
            self.assertNotIn("\n", minified_css)
            self.assertNotIn("/*", minified_css)
            self.assertLess(len(minified_css), len(pretty_css))
            self.assertIn("--fds-g-color-yellow-dark-9:#FFC14D;", minified_css)
            self.assertIn("@media (prefers-reduced-motion:reduce)", minified_css)

            _, sources = BUILD.collect_sources()
            tokens, errors = BUILD.validate_sources(sources)
            self.assertEqual([], errors)
            for token in tokens.values():
                declaration = (
                    f"{token.namespace}{token.token_id}:"
                    f"{BUILD.to_css_value(token.value, tokens)};"
                )
                self.assertIn(declaration, minified_css, token.token_id)

    def test_check_mode_does_not_write_css(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "fds-global-tokens.css"
            minified_output = Path(directory) / "fds-global-tokens.min.css"
            with (
                mock.patch.object(BUILD, "OUTPUT", output),
                mock.patch.object(BUILD, "MINIFIED_OUTPUT", minified_output),
                mock.patch.object(sys, "argv", ["build.py", "--check"]),
            ):
                self.assertEqual(0, BUILD.main())

            self.assertFalse(output.exists())
            self.assertFalse(minified_output.exists())

    def test_current_sources_are_valid(self) -> None:
        namespace, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual("--fds-g-", namespace)
        self.assertEqual([], errors)
        self.assertEqual(37, len(sources))
        self.assertEqual(503, len(tokens))
        self.assertFalse(
            any(token_id.startswith("color-") and "-base-" in token_id for token_id in tokens)
        )

    def test_design_color_families_and_seeds(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        seeds = {
            "brand": "#FF7C19",
            "amber": "#FF7C19",
            "yellow": "#FFB602",
            "yellow-green": "#87CC3B",
            "green": "#30C776",
            "teal": "#16B4AB",
            "blue": "#189DFF",
            "indigo": "#0C6CFF",
            "purple": "#7341DE",
            "magenta": "#FF4A66",
            "red": "#FF522A",
        }
        self.assertEqual(
            {f"color-{family}": value for family, value in seeds.items()},
            {
                token_id: token.value
                for token_id, token in tokens.items()
                if token.layer == "atomic" and token.tier == "seed" and token.category == "color"
            },
        )
        for family, seed in seeds.items():
            scale = [tokens[f"color-{family}-{step}"] for step in range(12)]
            self.assertEqual(12, len(scale))
            self.assertTrue(
                all(
                    token.source == f"atomic/map/color/palette/{family}.yml"
                    for token in scale
                )
            )
            self.assertEqual(seed, tokens[f"color-{family}-8"].value)

        fixed_families = tuple(family for family in seeds if family != "brand")
        self.assertFalse(any(token_id.startswith("color-brand-dark-") for token_id in tokens))
        for family in fixed_families:
            scale = [tokens[f"color-{family}-dark-{step}"] for step in range(12)]
            self.assertEqual(12, len(scale))
            self.assertTrue(
                all(
                    token.source == f"atomic/map/color/dark/{family}.yml"
                    for token in scale
                )
            )
            self.assertEqual(seeds[family], tokens[f"color-{family}-dark-8"].value)

        self.assertEqual("#FFC14D", tokens["color-yellow-dark-9"].value)
        self.assertTrue(
            all(
                f"color-{family}-{old_step}" not in tokens
                for family in seeds
                for old_step in range(20, 121, 10)
            )
        )
        gray_tokens = {
            token_id: token
            for token_id, token in tokens.items()
            if token_id.startswith("color-gray-")
            and token_id.removeprefix("color-gray-").isdigit()
        }
        self.assertEqual(
            [f"color-gray-{step}" for step in range(1, 21)],
            sorted(gray_tokens, key=lambda token_id: int(token_id.rsplit("-", 1)[1])),
        )
        self.assertEqual(
            [
                "#FFFFFF",
                "#F9F9F9",
                "#F1F0F0",
                "#E5E5E4",
                "#D7D6D6",
                "#C9C8C7",
                "#B8B7B6",
                "#A8A6A5",
                "#989695",
                "#888685",
                "#797675",
                "#6A6765",
                "#5B5856",
                "#4D4A48",
                "#3F3C3A",
                "#322E2C",
                "#25211F",
                "#1B1715",
                "#110D0B",
                "#080504",
            ],
            [gray_tokens[f"color-gray-{step}"].value for step in range(1, 21)],
        )
        self.assertEqual("{!color-gray-1}", tokens["color-white"].value)
        self.assertEqual("{!color-gray-20}", tokens["color-black"].value)
        self.assertEqual(
            ["#F2F4FB", "#737C8C", "#EFF1F3", "#F7F8FA"],
            [tokens[f"color-special-{step}"].value for step in range(1, 5)],
        )

    def test_confirmed_non_color_scales(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        self.assertEqual(
            ["0", "4px", "8px", "12px", "16px", "20px", "24px", "32px", "48px"],
            [tokens[f"spacing-{index}"].value for index in range(9)],
        )
        self.assertTrue(all(f"size-{index}" not in tokens for index in range(9)))
        self.assertEqual(
            [12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48],
            [int(tokens[f"font-size-{index}"].value.removesuffix("px")) for index in range(1, 15)],
        )
        self.assertEqual(
            [16, 18, 20, 22, 24, 28, 30, 32, 36, 38, 40, 44, 48],
            [int(tokens[f"line-height-{index}"].value.removesuffix("px")) for index in range(1, 14)],
        )
        self.assertEqual(
            ["1.2", "1.3", "1.4", "1.5", "1.6", "1.8"],
            [tokens[f"line-height-ratio-{index}"].value for index in range(1, 7)],
        )
        self.assertTrue(
            all(tokens[f"line-height-ratio-{index}"].token_type == "number" for index in range(1, 7))
        )
        self.assertEqual("6px", tokens["radius-3"].value)
        self.assertEqual("16px", tokens["radius-6"].value)
        self.assertEqual("20px", tokens["radius-7"].value)
        self.assertEqual("9999px", tokens["radius-full"].value)
        self.assertEqual("0.5", tokens["opacity-50"].value)
        self.assertEqual("1", tokens["opacity-100"].value)
        self.assertEqual("{!opacity-50}", tokens["opacity-disabled"].value)
        self.assertTrue(
            {
                *(f"control-height-{index}" for index in range(1, 7)),
                "control-height-compact",
                "control-height-default",
                "control-height-large",
                "control-radius",
                "container-radius",
            }.isdisjoint(tokens)
        )

    def test_confirmed_typography_contract(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        self.assertEqual(
            {
                "text-color": "{!color-text-primary}",
                "text-size": "{!font-size-3}",
                "text-line-height": "{!line-height-5}",
                "text-weight": "{!font-weight-regular}",
            },
            {
                token_id: tokens[token_id].value
                for token_id in (
                    "text-color",
                    "text-size",
                    "text-line-height",
                    "text-weight",
                )
            },
        )
        removed_tokens = {
            "font-family-code",
            "font-family-sans",
            "typography-body-color",
            "typography-body-font-family",
            "typography-body-line-height",
            "typography-body-size",
            "typography-body-weight",
            "typography-caption-line-height",
            "typography-caption-size",
            "typography-caption-weight",
            "typography-code-font-family",
            "typography-heading-font-family",
            "typography-label-line-height",
            "typography-label-size",
            "typography-label-weight",
        }
        self.assertTrue(removed_tokens.isdisjoint(tokens))
        self.assertEqual("{!font-size-3}", tokens["heading-6-size"].value)
        self.assertEqual("{!line-height-3}", tokens["heading-6-line-height"].value)
        self.assertEqual("{!font-weight-semibold}", tokens["heading-6-weight"].value)

    def test_opacity_is_limited_to_six_common_values(self) -> None:
        namespace, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        self.assertEqual(
            {
                "opacity-0": "0",
                "opacity-25": "0.25",
                "opacity-50": "0.5",
                "opacity-65": "0.65",
                "opacity-80": "0.8",
                "opacity-100": "1",
            },
            {
                token_id: token.value
                for token_id, token in tokens.items()
                if token_id.startswith("opacity-") and token.tier == "map"
            },
        )
        self.assertEqual("{!opacity-50}", tokens["opacity-disabled"].value)
        css = BUILD.build_css(namespace, sources, tokens)
        self.assertIn("--fds-g-opacity-65: 0.65;", css)
        self.assertIn("--fds-g-opacity-disabled: var(--fds-g-opacity-50);", css)
        self.assertNotIn("--fds-g-opacity-3:", css)

    def test_confirmed_motion_recipes_and_effect_models(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        self.assertNotIn("motion-duration-base", tokens)
        self.assertEqual(
            ["0ms", "100ms", "200ms", "300ms", "400ms", "500ms", "600ms", "800ms", "1000ms"],
            [tokens[f"motion-duration-{index}"].value for index in range(9)],
        )
        self.assertEqual(
            [
                "cubic-bezier(0.3, 0, 0.15, 1)",
                "cubic-bezier(0, 0.3, 0.15, 1)",
                "cubic-bezier(0.3, 0, 1, 0.3)",
            ],
            [tokens[f"motion-easing-{index}"].value for index in range(1, 4)],
        )
        self.assertTrue(
            all(tokens[f"motion-easing-{index}"].token_type == "cubic-bezier" for index in range(1, 4))
        )
        self.assertEqual("{!motion-duration-1}", tokens["motion-feedback-duration"].value)
        self.assertEqual("{!motion-duration-2}", tokens["motion-context-duration"].value)
        self.assertEqual("{!motion-duration-3}", tokens["motion-disclosure-duration"].value)
        self.assertEqual("{!motion-duration-4}", tokens["motion-prominent-duration"].value)
        self.assertEqual("{!motion-easing-2}", tokens["motion-context-enter-easing"].value)
        self.assertEqual("{!motion-easing-3}", tokens["motion-context-exit-easing"].value)
        self.assertNotIn("motion-state-duration", tokens)
        self.assertNotIn("motion-enter-duration", tokens)
        self.assertNotIn("motion-exit-duration", tokens)
        self.assertNotIn("motion-slow-duration", tokens)
        self.assertEqual(
            ["0", "100", "1000", "4000", "5000", "9000"],
            [tokens[f"z-index-{index}"].value for index in range(6)],
        )
        self.assertEqual("{!z-index-2}", tokens["layer-popup"].value)
        self.assertEqual("{!z-index-3}", tokens["layer-overlay"].value)
        self.assertEqual("{!z-index-5}", tokens["layer-feedback"].value)
        self.assertNotIn("layer-dropdown", tokens)
        self.assertNotIn("layer-popover", tokens)
        self.assertNotIn("layer-message", tokens)
        self.assertEqual("0 0 2px {!color-brand-8}", tokens["shadow-1"].value)
        self.assertEqual("{!shadow-1}", tokens["shadow-active"].value)
        self.assertEqual("{!shadow-2}", tokens["shadow-drag"].value)
        self.assertEqual("{!shadow-3}", tokens["shadow-dropdown"].value)
        self.assertEqual("{!shadow-none}", tokens["card-shadow"].value)

        namespace, sources = BUILD.collect_sources()
        css = BUILD.build_css(namespace, sources, tokens)
        self.assertIn("@media (prefers-reduced-motion: reduce)", css)
        for token_id in (
            "motion-feedback-duration",
            "motion-context-duration",
            "motion-disclosure-duration",
            "motion-prominent-duration",
        ):
            self.assertIn(
                f"--fds-g-{token_id}: var(--fds-g-motion-duration-0);",
                css,
            )
        self.assertNotIn("--fds-g-motion-feedback-easing: var(--fds-g-motion-duration-0);", css)

    def test_primary_semantic_scale_mapping(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        self.assertEqual("{!color-brand-0}", tokens["color-primary-background"].value)
        self.assertEqual("{!color-brand-4}", tokens["color-primary-disabled"].value)
        self.assertEqual("{!color-brand-7}", tokens["color-primary-hover"].value)
        self.assertEqual("{!color-brand-8}", tokens["color-primary"].value)
        self.assertEqual("{!color-brand-9}", tokens["color-primary-active"].value)

    def test_gray_semantic_scale_mapping(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        expected = {
            "color-text-primary": "{!color-gray-20}",
            "color-text-secondary": "{!color-gray-15}",
            "color-text-tertiary": "{!color-gray-12}",
            "color-text-disabled": "{!color-gray-6}",
            "color-text-inverse": "{!color-gray-1}",
            "color-icon-primary": "{!color-gray-20}",
            "color-icon-secondary": "{!color-gray-11}",
            "color-icon-disabled": "{!color-gray-6}",
            "border-default": "{!color-gray-5}",
            "border-subtle": "{!color-gray-4}",
            "border-disabled": "{!color-gray-2}",
            "background-main": "{!color-gray-3}",
            "background-container": "{!color-gray-1}",
            "background-elevated": "{!color-gray-1}",
            "background-disabled": "{!color-gray-2}",
        }
        self.assertEqual(
            expected,
            {token_id: tokens[token_id].value for token_id in expected},
        )

    def test_semantic_status_background_scale_mapping(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        families = {
            "primary": "brand",
            "danger": "red",
            "warning": "amber",
            "success": "green",
            "info": "blue",
        }
        for semantic, family in families.items():
            self.assertEqual(
                f"{{!color-{family}-0}}",
                tokens[f"color-{semantic}-background"].value,
            )
            self.assertEqual(
                f"{{!color-{family}-1}}",
                tokens[f"color-{semantic}-background-hover"].value,
            )
            self.assertEqual(
                f"{{!color-{family}-2}}",
                tokens[f"color-{semantic}-background-active"].value,
            )

    def test_default_scene_only_composes_existing_tokens(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        scene_tokens = {
            token_id: token
            for token_id, token in tokens.items()
            if token.tier == "scene"
        }
        self.assertEqual(13, len(scene_tokens))
        self.assertTrue(all(token.namespace == "--fds-s-" for token in scene_tokens.values()))
        self.assertTrue(all(not token_id.startswith("scene-") for token_id in scene_tokens))
        self.assertTrue(all(token.value.startswith("{!") for token in scene_tokens.values()))
        self.assertNotIn("background", tokens)
        self.assertEqual("{!radius-4}", tokens["card-radius"].value)
        self.assertEqual(
            "{!heading-5-size}",
            tokens["card-title-size"].value,
        )

        namespace, sources = BUILD.collect_sources()
        css = BUILD.build_css(namespace, sources, tokens)
        self.assertIn("--fds-s-card-padding: var(--fds-g-spacing-4);", css)
        self.assertIn("--fds-s-card-title-color: var(--fds-g-heading-color);", css)
        self.assertNotIn("--fds-g-scene-", css)

    def test_scene_namespace_is_explicit_and_reserved(self) -> None:
        missing_scene_namespace = [
            (
                "semantic/scene/test.yml",
                source("semantic", "scene", "color", {"background": {"value": "#FFFFFF"}}),
            )
        ]
        _, errors = BUILD.validate_sources(missing_scene_namespace)
        self.assertTrue(any("Semantic/Scene namespace 必须为 --fds-s-" in error for error in errors))

        scene_namespace_on_base = [
            (
                "semantic/base/test.yml",
                source(
                    "semantic",
                    "base",
                    "color",
                    {"background": {"value": "#FFFFFF"}},
                    namespace="--fds-s-",
                ),
            )
        ]
        _, errors = BUILD.validate_sources(scene_namespace_on_base)
        self.assertTrue(any("仅 Semantic/Scene 可以使用 --fds-s-" in error for error in errors))

    def test_rejects_upward_reference(self) -> None:
        sources = [
            (
                "atomic/map/test.yml",
                source("atomic", "map", "color", {"map-color": {"value": "{!semantic-color}"}}),
            ),
            (
                "semantic/base/test.yml",
                source("semantic", "base", "color", {"semantic-color": {"value": "#000000"}}),
            ),
        ]

        _, errors = BUILD.validate_sources(sources)

        self.assertTrue(any("不能向上引用" in error for error in errors))

    def test_rejects_reference_type_mismatch(self) -> None:
        sources = [
            (
                "atomic/map/test.yml",
                source(
                    "atomic",
                    "map",
                    "color",
                    {
                        "color-token": {"value": "#000000"},
                        "dimension-token": {"value": "{!color-token}", "type": "dimension"},
                    },
                ),
            )
        ]

        _, errors = BUILD.validate_sources(sources)

        self.assertTrue(any("不能引用" in error and "dimension" in error for error in errors))

    def test_allows_shadow_to_compose_color(self) -> None:
        sources = [
            (
                "atomic/map/test.yml",
                source(
                    "atomic",
                    "map",
                    "shadow",
                    {
                        "color-token": {"value": "#000000", "type": "color"},
                        "shadow-token": {"value": "0 0 2px {!color-token}"},
                    },
                ),
            )
        ]

        _, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)

    def test_converts_source_reference_to_css_variable(self) -> None:
        sources = [
            (
                "atomic/map/test.yml",
                source("atomic", "map", "color", {"color-brand-8": {"value": "#FF7C19"}}),
            )
        ]
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        self.assertEqual(
            "var(--fds-g-color-brand-8)",
            BUILD.to_css_value("{!color-brand-8}", tokens),
        )


if __name__ == "__main__":
    unittest.main()
