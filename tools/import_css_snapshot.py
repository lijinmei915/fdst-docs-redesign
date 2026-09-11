#!/usr/bin/env python3
"""将 FDS CSS 快照迁移为 SLDS 风格的 YAML 源文件，仅用于结构迁移。"""

from __future__ import annotations

import argparse
import re
from pathlib import Path

import yaml


ROOT = Path(__file__).resolve().parents[1]
TOKENS_ROOT = ROOT / "tokens"
DEFAULT_NAMESPACE = "--fds-g-"
SCENE_NAMESPACE = "--fds-s-"
DECL_RE = re.compile(
    r"^\s*(?P<namespace>--fds-(?:g|s)-)(?P<token_id>[a-z0-9-]+)\s*:\s*"
    r"(?P<value>.*?);(?:\s*/\*.*)?$"
)
CSS_REFERENCE_RE = re.compile(r"var\(--fds-(?:g|s)-([a-z0-9-]+)\)")
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
COLOR_FAMILY_PATTERN = "|".join(re.escape(family) for family in COLOR_FAMILIES)
COLOR_SEED_RE = re.compile(rf"^color-(?:{COLOR_FAMILY_PATTERN})$")
COLOR_SCALE_RE = re.compile(rf"^color-(?P<family>{COLOR_FAMILY_PATTERN})-\d+$")


PALETTE_SOURCE_FILES = {
    f"atomic/map/color/palette/{family}.yml": {
        "global": {
            "layer": "atomic",
            "tier": "map",
            "category": "color",
            "type": "color",
            "scope": "global",
            "primitive": True,
            "source": "generated",
        },
        "imports": [],
    }
    for family in COLOR_FAMILIES
}


SOURCE_FILES = {
    "atomic/seed/color.yml": {
        "global": {"layer": "atomic", "tier": "seed", "category": "color", "type": "color", "scope": "global", "primitive": True, "source": "manual"},
        "imports": [],
    },
    **PALETTE_SOURCE_FILES,
    "atomic/map/color/gray.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "color", "type": "color", "scope": "global", "primitive": True, "variant": "gray", "source": "manual"},
        "imports": [],
    },
    "atomic/map/color/special.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "color", "type": "color", "scope": "global", "primitive": True, "variant": "special", "source": "manual"},
        "imports": [],
    },
    "atomic/map/color/rgb.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "color", "type": "string", "scope": "global", "primitive": True, "variant": "rgb", "source": "derived"},
        "imports": ["./palette/base.yml"],
    },
    "atomic/map/typography.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "typography", "scope": "global", "primitive": True},
        "imports": [],
    },
    "atomic/map/spacing.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "spacing", "type": "dimension", "scope": "global", "primitive": True},
        "imports": [],
    },
    "atomic/map/sizing.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "sizing", "type": "dimension", "scope": "global", "primitive": True},
        "imports": [],
    },
    "atomic/map/shape.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "shape", "type": "dimension", "scope": "global", "primitive": True},
        "imports": [],
    },
    "atomic/map/effects.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "effects", "scope": "global", "primitive": True},
        "imports": [],
    },
    "atomic/map/motion.yml": {
        "global": {"layer": "atomic", "tier": "map", "category": "motion", "type": "duration", "scope": "global", "primitive": True},
        "imports": [],
    },
    "semantic/base/color.yml": {
        "global": {"layer": "semantic", "tier": "base", "category": "color", "type": "color", "scope": "global", "primitive": False},
        "imports": ["../../atomic/map/color/palette/base.yml", "../../atomic/map/color/gray.yml"],
    },
    "semantic/base/typography.yml": {
        "global": {"layer": "semantic", "tier": "base", "category": "typography", "scope": "global", "primitive": False},
        "imports": ["./color.yml", "../../atomic/map/typography.yml"],
    },
    "semantic/base/layout.yml": {
        "global": {"layer": "semantic", "tier": "base", "category": "layout", "scope": "global", "primitive": False},
        "imports": ["./color.yml", "../../atomic/map/spacing.yml", "../../atomic/map/sizing.yml", "../../atomic/map/shape.yml", "../../atomic/map/effects.yml"],
    },
    "semantic/base/effects.yml": {
        "global": {"layer": "semantic", "tier": "base", "category": "effects", "type": "shadow", "scope": "global", "primitive": False},
        "imports": ["../../atomic/map/effects.yml"],
    },
    "semantic/base/motion.yml": {
        "global": {"layer": "semantic", "tier": "base", "category": "motion", "type": "duration", "scope": "global", "primitive": False},
        "imports": ["../../atomic/map/motion.yml"],
    },
    "semantic/scene/default.yml": {
        "global": {
            "layer": "semantic",
            "tier": "scene",
            "category": "scene",
            "scope": "global",
            "primitive": False,
            "namespace": SCENE_NAMESPACE,
        },
        "imports": [
            "../base/layout.yml",
            "../base/effects.yml",
            "../base/typography.yml",
            "../../atomic/map/spacing.yml",
            "../../atomic/map/shape.yml",
            "../../atomic/map/effects.yml",
        ],
    },
}

GROUP_FILES = {
    "fds-global.yml": {
        "schema": "fds-token-package/v1",
        "global": {"name": "fds-global", "namespace": "--fds-g-", "scope": "global"},
        "imports": ["./atomic/base.yml", "./semantic/base.yml"],
    },
    "atomic/base.yml": {
        "schema": "fds-token-group/v1",
        "imports": ["./seed/base.yml", "./map/base.yml"],
    },
    "atomic/seed/base.yml": {
        "schema": "fds-token-group/v1",
        "imports": ["./color.yml"],
    },
    "atomic/map/base.yml": {
        "schema": "fds-token-group/v1",
        "imports": ["./color/base.yml", "./typography.yml", "./spacing.yml", "./sizing.yml", "./shape.yml", "./effects.yml", "./motion.yml"],
    },
    "atomic/map/color/base.yml": {
        "schema": "fds-token-group/v1",
        "imports": ["./palette/base.yml", "./gray.yml", "./special.yml", "./rgb.yml"],
    },
    "atomic/map/color/palette/base.yml": {
        "schema": "fds-token-group/v1",
        "imports": ["../../../seed/color.yml", *(f"./{family}.yml" for family in COLOR_FAMILIES)],
    },
    "semantic/base.yml": {
        "schema": "fds-token-group/v1",
        "imports": ["./base/base.yml", "./scene/base.yml"],
    },
    "semantic/base/base.yml": {
        "schema": "fds-token-group/v1",
        "imports": ["./color.yml", "./typography.yml", "./layout.yml", "./effects.yml", "./motion.yml"],
    },
    "semantic/scene/base.yml": {
        "schema": "fds-token-group/v1",
        "imports": ["./default.yml"],
    },
}


SCENE_TOKEN_TYPES = {
    "content-padding": "dimension",
    "card-gap": "dimension",
    "card-background": "color",
    "card-border-color": "color",
    "card-border-width": "dimension",
    "card-radius": "dimension",
    "card-padding": "dimension",
    "card-shadow": "shadow",
    "card-title-color": "color",
    "card-title-size": "dimension",
    "card-title-line-height": "dimension",
    "card-title-weight": "font-weight",
    "card-title-gap": "dimension",
}


def classify(token_id: str, namespace: str = DEFAULT_NAMESPACE) -> str:
    if namespace == SCENE_NAMESPACE:
        if token_id not in SCENE_TOKEN_TYPES:
            raise ValueError(f"无法分类 Scene Token：{token_id}")
        return "semantic/scene/default.yml"
    if COLOR_SEED_RE.fullmatch(token_id):
        return "atomic/seed/color.yml"
    color_match = COLOR_SCALE_RE.fullmatch(token_id)
    if color_match:
        return f"atomic/map/color/palette/{color_match.group('family')}.yml"
    if token_id == "color-brand-vivid":
        return "atomic/map/color/palette/brand.yml"
    if re.fullmatch(r"color-gray-\d+", token_id) or token_id in {"color-white", "color-black"}:
        return "atomic/map/color/gray.yml"
    if re.fullmatch(r"color-special-[1-4]", token_id):
        return "atomic/map/color/special.yml"
    if token_id.endswith("-rgb"):
        return "atomic/map/color/rgb.yml"
    if token_id.startswith(("font-family-", "font-size-", "line-height-", "font-weight-")):
        return "atomic/map/typography.yml"
    if token_id.startswith("spacing-"):
        return "atomic/map/spacing.yml"
    if token_id.startswith("icon-size-") and token_id.rsplit("-", 1)[-1].isdigit():
        return "atomic/map/sizing.yml"
    if token_id.startswith(("radius-", "border-width-")):
        return "atomic/map/shape.yml"
    if token_id.startswith(("motion-duration-", "motion-easing-")):
        return "atomic/map/motion.yml"
    if re.fullmatch(r"(?:opacity|z-index)-\d+", token_id) or token_id.startswith("shadow-"):
        return "atomic/map/effects.yml"
    if token_id.startswith(("color-", "border-")):
        return "semantic/base/color.yml"
    if token_id == "heading-color" or re.fullmatch(
        r"(?:heading-\d+|text)-(?:color|size|line-height|weight)", token_id
    ):
        return "semantic/base/typography.yml"
    if token_id.startswith(("background-", "opacity-", "layer-")):
        return "semantic/base/layout.yml"
    if token_id in {"shadow-none", "shadow-active", "shadow-drag", "shadow-dropdown"}:
        return "semantic/base/effects.yml"
    if token_id.startswith("motion-"):
        return "semantic/base/motion.yml"
    raise ValueError(f"无法分类 Token：{token_id}")


def token_type(token_id: str) -> str:
    if token_id in SCENE_TOKEN_TYPES:
        return SCENE_TOKEN_TYPES[token_id]
    if token_id.endswith("-rgb"):
        return "string"
    if token_id.startswith(("color-", "background-", "border-")) or token_id.endswith("-color"):
        return "color"
    if token_id.startswith("font-family-") or token_id.endswith("-font-family"):
        return "font-family"
    if token_id.startswith("font-weight-") or token_id.endswith("-weight"):
        return "font-weight"
    if token_id.startswith(("font-size-", "line-height-", "spacing-", "icon-size-", "radius-", "border-width-")):
        return "dimension"
    if token_id.endswith(("-size", "-line-height", "-radius")):
        return "dimension"
    if token_id.startswith("motion-easing-") or token_id.endswith("-easing"):
        return "cubic-bezier"
    if token_id.startswith("motion-"):
        return "duration"
    if token_id.startswith(("opacity-", "z-index-", "layer-")):
        return "number"
    if token_id.startswith("shadow-"):
        return "shadow"
    raise ValueError(f"无法判断 Token 类型：{token_id}")


def write_yaml(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(yaml.safe_dump(data, allow_unicode=True, sort_keys=False), encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="现有 fds-global-tokens.css 路径")
    args = parser.parse_args()
    text = args.input.read_text(encoding="utf-8")
    groups: dict[str, dict] = {path: {} for path in SOURCE_FILES}

    for line in text.splitlines():
        match = DECL_RE.match(line)
        if not match:
            continue
        namespace = match.group("namespace")
        token_id = match.group("token_id").replace("color-seed-", "color-", 1)
        value = match.group("value")
        source_path = classify(token_id, namespace)
        source_meta = SOURCE_FILES[source_path]["global"]
        definition: dict[str, str] = {
            "value": CSS_REFERENCE_RE.sub(lambda ref: f"{{!{ref.group(1)}}}", value.strip())
        }
        inferred_type = token_type(token_id)
        if source_meta.get("type") != inferred_type:
            definition["type"] = inferred_type
        groups[source_path][token_id] = definition

    for relative, config in SOURCE_FILES.items():
        source = {"schema": "fds-token-source/v1", "global": config["global"]}
        if config["imports"]:
            source["imports"] = config["imports"]
        source["props"] = groups[relative]
        write_yaml(TOKENS_ROOT / relative, source)

    for relative, group in GROUP_FILES.items():
        write_yaml(TOKENS_ROOT / relative, group)

    total = sum(len(tokens) for tokens in groups.values())
    print(f"已拆分 {total} 个 Token，生成 {len(SOURCE_FILES)} 个叶子源文件。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
