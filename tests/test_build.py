from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("fds_token_build", ROOT / "tools" / "build.py")
BUILD = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = BUILD
SPEC.loader.exec_module(BUILD)


def source(layer: str, tier: str, token_type: str, props: dict) -> dict:
    return {
        "global": {
            "layer": layer,
            "tier": tier,
            "category": "test",
            "type": token_type,
            "scope": "global",
            "primitive": layer == "atomic",
        },
        "props": props,
    }


class BuildTest(unittest.TestCase):
    def test_current_sources_are_valid(self) -> None:
        namespace, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual("--fds-g-", namespace)
        self.assertEqual([], errors)
        self.assertEqual(31, len(sources))
        self.assertEqual(462, len(tokens))
        self.assertFalse(any("-dark-" in token_id for token_id in tokens))
        self.assertFalse(
            any(token_id.startswith("color-") and "-base-" in token_id for token_id in tokens)
        )

    def test_confirmed_non_color_scales(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        self.assertEqual(
            [12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 36, 40, 48],
            [int(tokens[f"font-size-{index}"].value.removesuffix("px")) for index in range(1, 15)],
        )
        self.assertEqual(
            [16, 18, 20, 22, 24, 28, 30, 32, 36, 38, 40, 44, 48],
            [int(tokens[f"line-height-{index}"].value.removesuffix("px")) for index in range(1, 14)],
        )
        self.assertEqual("6px", tokens["radius-3"].value)
        self.assertEqual("16px", tokens["radius-6"].value)
        self.assertEqual("9999px", tokens["radius-full"].value)
        self.assertEqual("0.5", tokens["opacity-50"].value)
        self.assertEqual("1", tokens["opacity-100"].value)
        self.assertEqual("{!opacity-50}", tokens["opacity-disabled"].value)
        self.assertEqual("{!radius-4}", tokens["container-radius"].value)

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
            ["0ms", "100ms", "200ms", "300ms", "400ms"],
            [tokens[f"motion-duration-{index}"].value for index in range(5)],
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
        self.assertEqual("0 0 2px {!color-brand-90}", tokens["shadow-1"].value)
        self.assertEqual("{!shadow-1}", tokens["shadow-active"].value)
        self.assertEqual("{!shadow-2}", tokens["shadow-drag"].value)
        self.assertEqual("{!shadow-3}", tokens["shadow-dropdown"].value)
        self.assertEqual("{!shadow-none}", tokens["scene-card-shadow"].value)

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
        self.assertEqual("{!color-brand-40}", tokens["color-primary-background"].value)
        self.assertEqual("{!color-brand-60}", tokens["color-primary-disabled"].value)
        self.assertEqual("{!color-brand-80}", tokens["color-primary-hover"].value)
        self.assertEqual("{!color-brand-90}", tokens["color-primary"].value)
        self.assertEqual("{!color-brand-100}", tokens["color-primary-active"].value)

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
                f"{{!color-{family}-40}}",
                tokens[f"color-{semantic}-background"].value,
            )
            self.assertEqual(
                f"{{!color-{family}-50}}",
                tokens[f"color-{semantic}-background-hover"].value,
            )
            self.assertEqual(
                f"{{!color-{family}-60}}",
                tokens[f"color-{semantic}-background-active"].value,
            )

    def test_default_scene_only_composes_existing_tokens(self) -> None:
        _, sources = BUILD.collect_sources()
        tokens, errors = BUILD.validate_sources(sources)

        self.assertEqual([], errors)
        scene_tokens = {
            token_id: token
            for token_id, token in tokens.items()
            if token_id.startswith("scene-")
        }
        self.assertEqual(14, len(scene_tokens))
        self.assertTrue(all(token.tier == "scene" for token in scene_tokens.values()))
        self.assertTrue(all(token.value.startswith("{!") for token in scene_tokens.values()))
        self.assertEqual("{!background-main}", tokens["scene-background"].value)
        self.assertEqual("{!container-radius}", tokens["scene-card-radius"].value)
        self.assertEqual(
            "{!typography-heading-5-size}",
            tokens["scene-card-title-size"].value,
        )

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
        self.assertEqual(
            "var(--fds-g-color-brand-90)",
            BUILD.to_css_value("{!color-brand-90}", "--fds-g-"),
        )


if __name__ == "__main__":
    unittest.main()
