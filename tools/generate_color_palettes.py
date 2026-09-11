#!/usr/bin/env python3
"""从颜色 Seed 生成 Seed 锚定 OKLCH Map。"""

from __future__ import annotations

import argparse
import math
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
SEED_SOURCE = ROOT / "tokens" / "atomic" / "seed" / "color.yml"
PALETTE_ROOT = ROOT / "tokens" / "atomic" / "map" / "color" / "palette"
DARK_PALETTE_ROOT = ROOT / "tokens" / "atomic" / "map" / "color" / "dark"

COLOR_FAMILIES = (
    "brand",
    "amber",
    "yellow",
    "yellow-green",
    "green",
    "teal",
    "blue",
    "indigo",
    "purple",
    "magenta",
    "red",
)
DARK_COLOR_FAMILIES = COLOR_FAMILIES[1:]
STEPS = tuple(range(12))
CHROMA_FACTORS = (0.08, 0.179, 0.30, 0.43, 0.57, 0.71, 0.83, 0.93, 1.0, 0.90, 0.72, 0.52)
LIGHT_LIGHTNESS_PROGRESS = (0.0, 0.1125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875)
DARK_LIGHTNESS_PROGRESS = (0.22, 0.667, 1.0)
DARK_LOW_LIGHTNESS_PROGRESS = (0.08, 0.16, 0.25, 0.35, 0.46, 0.58, 0.70, 0.84)
DARK_LOW_CHROMA_FACTORS = (0.10, 0.16, 0.23, 0.32, 0.44, 0.58, 0.73, 0.88)
DARK_HIGH_LIGHTNESS_PROGRESS = (0.13, 0.27, 0.42)
DARK_HIGH_CHROMA_FACTORS = (0.92, 0.76, 0.58)
YELLOW_DARK_9_CHROMA_FACTOR = 0.90
GAMUT_SEARCH_ITERATIONS = 48
GAMUT_EPSILON = 1e-12


@dataclass(frozen=True)
class Oklch:
    lightness: float
    chroma: float
    hue: float


@dataclass(frozen=True)
class PaletteMismatch:
    profile: str
    family: str
    step: int
    actual: str | None
    expected: str


def _multiply_matrix(matrix: tuple[tuple[float, ...], ...], vector: tuple[float, ...]) -> tuple[float, ...]:
    return tuple(sum(coefficient * value for coefficient, value in zip(row, vector)) for row in matrix)


def _srgb_to_linear(channel: float) -> float:
    return channel / 12.92 if channel <= 0.04045 else ((channel + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(channel: float) -> float:
    return 12.92 * channel if channel <= 0.0031308 else 1.055 * channel ** (1 / 2.4) - 0.055


def normalize_hex(value: str) -> str:
    normalized = value.strip().upper()
    if len(normalized) != 7 or not normalized.startswith("#"):
        raise ValueError(f"颜色必须是 6 位 Hex：{value}")
    try:
        int(normalized[1:], 16)
    except ValueError as error:
        raise ValueError(f"颜色必须是 6 位 Hex：{value}") from error
    return normalized


def hex_to_oklch(value: str) -> Oklch:
    normalized = normalize_hex(value)
    linear_rgb = tuple(
        _srgb_to_linear(int(normalized[index : index + 2], 16) / 255)
        for index in (1, 3, 5)
    )
    l_value, m_value, s_value = _multiply_matrix(
        (
            (0.4122214708, 0.5363325363, 0.0514459929),
            (0.2119034982, 0.6806995451, 0.1073969566),
            (0.0883024619, 0.2817188376, 0.6299787005),
        ),
        linear_rgb,
    )
    l_root, m_root, s_root = (
        math.copysign(abs(channel) ** (1 / 3), channel)
        for channel in (l_value, m_value, s_value)
    )
    lightness, a_value, b_value = _multiply_matrix(
        (
            (0.2104542553, 0.7936177850, -0.0040720468),
            (1.9779984951, -2.4285922050, 0.4505937099),
            (0.0259040371, 0.7827717662, -0.8086757660),
        ),
        (l_root, m_root, s_root),
    )
    return Oklch(
        lightness=lightness,
        chroma=math.hypot(a_value, b_value),
        hue=math.atan2(b_value, a_value),
    )


def oklch_to_linear_srgb(color: Oklch) -> tuple[float, float, float]:
    a_value = color.chroma * math.cos(color.hue)
    b_value = color.chroma * math.sin(color.hue)
    l_root, m_root, s_root = _multiply_matrix(
        (
            (1.0, 0.3963377774, 0.2158037573),
            (1.0, -0.1055613458, -0.0638541728),
            (1.0, -0.0894841775, -1.2914855480),
        ),
        (color.lightness, a_value, b_value),
    )
    return _multiply_matrix(
        (
            (4.0767416621, -3.3077115913, 0.2309699292),
            (-1.2684380046, 2.6097574011, -0.3413193965),
            (-0.0041960863, -0.7034186147, 1.7076147010),
        ),
        (l_root**3, m_root**3, s_root**3),
    )


def is_in_srgb_gamut(linear_rgb: tuple[float, float, float]) -> bool:
    return all(-GAMUT_EPSILON <= channel <= 1 + GAMUT_EPSILON for channel in linear_rgb)


def fit_chroma_to_srgb(color: Oklch) -> Oklch:
    if is_in_srgb_gamut(oklch_to_linear_srgb(color)):
        return color

    lower = 0.0
    upper = color.chroma
    for _ in range(GAMUT_SEARCH_ITERATIONS):
        candidate = (lower + upper) / 2
        candidate_color = Oklch(color.lightness, candidate, color.hue)
        if is_in_srgb_gamut(oklch_to_linear_srgb(candidate_color)):
            lower = candidate
        else:
            upper = candidate
    return Oklch(color.lightness, lower, color.hue)


def oklch_to_hex(color: Oklch) -> str:
    fitted = fit_chroma_to_srgb(color)
    channels = []
    for channel in oklch_to_linear_srgb(fitted):
        encoded = _linear_to_srgb(min(1.0, max(0.0, channel)))
        channels.append(math.floor(encoded * 255 + 0.5))
    return "#" + "".join(f"{channel:02X}" for channel in channels)


def _lerp(start: float, end: float, progress: float) -> float:
    return start + (end - start) * progress


def generate_palette(seed: str) -> dict[int, str]:
    normalized_seed = normalize_hex(seed)
    seed_color = hex_to_oklch(normalized_seed)
    palette: dict[int, str] = {}

    for index, (step, chroma_factor) in enumerate(zip(STEPS, CHROMA_FACTORS)):
        if step == 8:
            palette[step] = normalized_seed
            continue
        if step < 8:
            lightness = _lerp(
                0.97,
                seed_color.lightness,
                LIGHT_LIGHTNESS_PROGRESS[index],
            )
        else:
            lightness = _lerp(
                seed_color.lightness,
                0.25,
                DARK_LIGHTNESS_PROGRESS[index - 9],
            )
        palette[step] = oklch_to_hex(
            Oklch(lightness, seed_color.chroma * chroma_factor, seed_color.hue)
        )
    return palette


def generate_dark_palette(family: str, seed: str) -> dict[int, str]:
    if family not in DARK_COLOR_FAMILIES:
        raise ValueError(f"Dark Map 不支持该色系：{family}")

    normalized_seed = normalize_hex(seed)
    seed_color = hex_to_oklch(normalized_seed)
    palette: dict[int, str] = {}

    for index, step in enumerate(STEPS):
        if step == 8:
            palette[step] = normalized_seed
            continue
        if step < 8:
            lightness = _lerp(
                0.18,
                seed_color.lightness,
                DARK_LOW_LIGHTNESS_PROGRESS[index],
            )
            chroma_factor = DARK_LOW_CHROMA_FACTORS[index]
        else:
            high_index = index - 9
            lightness = _lerp(
                seed_color.lightness,
                1.0,
                DARK_HIGH_LIGHTNESS_PROGRESS[high_index],
            )
            chroma_factor = DARK_HIGH_CHROMA_FACTORS[high_index]
            if family == "yellow" and step == 9:
                chroma_factor = YELLOW_DARK_9_CHROMA_FACTOR
        palette[step] = oklch_to_hex(
            Oklch(lightness, seed_color.chroma * chroma_factor, seed_color.hue)
        )
    return palette


def load_color_seeds(path: Path = SEED_SOURCE) -> dict[str, str]:
    source = yaml.safe_load(path.read_text(encoding="utf-8"))
    props = source.get("props", {})
    return {
        family: normalize_hex(props[f"color-{family}"]["value"])
        for family in COLOR_FAMILIES
    }


def generate_all_palettes(seed_source: Path = SEED_SOURCE) -> dict[str, dict[int, str]]:
    return {
        family: generate_palette(seed)
        for family, seed in load_color_seeds(seed_source).items()
    }


def generate_all_dark_palettes(seed_source: Path = SEED_SOURCE) -> dict[str, dict[int, str]]:
    seeds = load_color_seeds(seed_source)
    return {
        family: generate_dark_palette(family, seeds[family])
        for family in DARK_COLOR_FAMILIES
    }


def compare_palette_sources(
    palettes: dict[str, dict[int, str]],
    palette_root: Path = PALETTE_ROOT,
    profile: str = "base",
) -> list[PaletteMismatch]:
    mismatches: list[PaletteMismatch] = []
    for family, palette in palettes.items():
        path = palette_root / f"{family}.yml"
        source = yaml.safe_load(path.read_text(encoding="utf-8"))
        props = source.get("props", {})
        for step, expected in palette.items():
            token_id = (
                f"color-{family}-{step}"
                if profile == "base"
                else f"color-{family}-dark-{step}"
            )
            definition = props.get(token_id)
            actual = definition.get("value") if isinstance(definition, dict) else None
            actual = normalize_hex(actual) if isinstance(actual, str) else None
            if actual != expected:
                mismatches.append(PaletteMismatch(profile, family, step, actual, expected))
    return mismatches


def compare_dark_palette_sources(
    palettes: dict[str, dict[int, str]],
    palette_root: Path = DARK_PALETTE_ROOT,
) -> list[PaletteMismatch]:
    return compare_palette_sources(palettes, palette_root, "dark")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="对照检查现有 Map 与 Seed/算法结果")
    parser.parse_args()

    try:
        palettes = generate_all_palettes()
        dark_palettes = generate_all_dark_palettes()
        mismatches = compare_palette_sources(palettes)
        mismatches.extend(compare_dark_palette_sources(dark_palettes))
        if mismatches:
            print(f"颜色 Map 与 Seed 生成结果不一致：{len(mismatches)} 项", file=sys.stderr)
            for mismatch in mismatches:
                print(
                    f"- {mismatch.family}-{mismatch.profile}-{mismatch.step}: "
                    f"当前 {mismatch.actual or '<missing>'}，生成 {mismatch.expected}",
                    file=sys.stderr,
                )
            return 1
        print(
            f"颜色 Map 对照通过：Base {len(palettes)} 个色系，"
            f"Dark {len(dark_palettes)} 个色系，{len(STEPS)} 阶"
        )
        return 0
    except (KeyError, OSError, TypeError, ValueError, yaml.YAMLError) as error:
        print(f"颜色 Map 生成失败：{error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
