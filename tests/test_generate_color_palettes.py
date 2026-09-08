from __future__ import annotations

import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "fds_generate_color_palettes",
    ROOT / "tools" / "generate_color_palettes.py",
)
PALETTES = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = PALETTES
SPEC.loader.exec_module(PALETTES)


# 设计参考中的 10 套固定色板；02 阶采用最终确认参数，两项 8-bit 量化差异在测试末尾显式锁定。
DESIGN_REFERENCE = {
    "magenta": "FFF1F2 FFE2E3 FFCFD0 FFBDBF FFAAAE FF969D FF818B FF6979 FF4A66 D43550 850226 460010",
    "red": "FFF2EF FFE3DC FFD0C5 FFBFB0 FFAD99 FF9A82 FF8569 FF6E4E FF522A D53D18 801A00 430900",
    "amber": "FEF3EC FFE6D9 FFD8C3 FFCAAD FFBC97 FFAD80 FF9E66 FF8E48 FF7C19 D26200 773400 3A1600",
    "yellow": "FAF4EB FBEED9 FCE6C3 FDDEAC FFD693 FFCF7D FFC764 FFBE45 FFB602 CD9100 6D4C00 2F1E00",
    "yellow-green": "F1F7ED E6F3DC D7EDC7 C9E8B1 BBE49A ACDF81 9FD96A 92D352 87CC3B 69A522 355A00 152800",
    "green": "EEF8F1 DDF3E3 C8ECD3 B3E7C3 9BE2B2 82DCA1 69D692 4DCF83 30C776 14A25C 005A30 002A13",
    "teal": "EEF7F6 DCF0ED C5E7E3 AEDFDA 95D7D0 7ACFC7 5EC6BE 3FBEB5 16B4AB 00938B 00534E 002826",
    "blue": "EEF6FF DBEDFF C3E1FF ADD6FF 96CBFF 7EC0FF 64B5FF 46A9FF 189DFF 0080D4 00487C 002340",
    "indigo": "F0F5FF D9E7FF BDD6FF A4C6FF 8AB6FF 70A5FF 5593FF 3781FF 0C6CFF 0158D9 003589 001C52",
    "purple": "F5F4FF E4E1FE D1CAFA BFB4F9 AF9EF7 9F88F6 9071F1 8159E9 7341DE 6134BE 3E1983 250D53",
}


def channel_delta(first: str, second: str) -> int:
    return max(
        abs(int(first[index : index + 2], 16) - int(second[index : index + 2], 16))
        for index in (1, 3, 5)
    )


class GenerateColorPalettesTest(unittest.TestCase):
    def test_step_20_uses_design_parameters(self) -> None:
        self.assertEqual(0.1125, PALETTES.LIGHT_LIGHTNESS_PROGRESS[1])
        self.assertEqual(0.179, PALETTES.CHROMA_FACTORS[1])

    def test_design_reference_matches_within_hex_quantization(self) -> None:
        seeds = PALETTES.load_color_seeds()
        exact_mismatches = []

        for family, reference_values in DESIGN_REFERENCE.items():
            generated = PALETTES.generate_palette(seeds[family])
            reference = {
                step: f"#{value}"
                for step, value in zip(PALETTES.STEPS, reference_values.split())
            }
            for step in PALETTES.STEPS:
                delta = channel_delta(generated[step], reference[step])
                self.assertLessEqual(delta, 1, f"{family}-{step}")
                if generated[step] != reference[step]:
                    exact_mismatches.append((family, step, generated[step], reference[step]))

        self.assertEqual(
            [
                ("amber", 110, "#763400", "#773400"),
                ("green", 110, "#005A2F", "#005A30"),
            ],
            exact_mismatches,
        )

    def test_step_90_preserves_seed_exactly(self) -> None:
        for family, seed in PALETTES.load_color_seeds().items():
            self.assertEqual(seed, PALETTES.generate_palette(seed)[90], family)

    def test_dark_map_matches_design_contract(self) -> None:
        seeds = PALETTES.load_color_seeds()
        palettes = PALETTES.generate_all_dark_palettes()

        self.assertEqual(set(PALETTES.DARK_COLOR_FAMILIES), set(palettes))
        self.assertNotIn("brand", palettes)
        for family, palette in palettes.items():
            self.assertEqual(seeds[family], palette[90], family)
        self.assertEqual("#FFC14D", palettes["yellow"][100])

    def test_dark_map_rejects_dynamic_brand(self) -> None:
        with self.assertRaises(ValueError):
            PALETTES.generate_dark_palette("brand", "#FF7C19")

    def test_brand_and_amber_share_values_but_remain_separate_maps(self) -> None:
        palettes = PALETTES.generate_all_palettes()

        self.assertEqual(palettes["amber"], palettes["brand"])
        self.assertIn("brand", palettes)
        self.assertIn("amber", palettes)

    def test_rejects_non_six_digit_hex(self) -> None:
        for value in ("#FFF", "FF7C19", "#GG7C19"):
            with self.subTest(value=value), self.assertRaises(ValueError):
                PALETTES.generate_palette(value)


if __name__ == "__main__":
    unittest.main()
