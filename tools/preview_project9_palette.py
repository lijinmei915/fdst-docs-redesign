#!/usr/bin/env python3
"""把项目9 OKLCH 公式色板解析成真实十六进制，并按公司 0-11 索引映射输出。

只做一件事：读 `docs/site-assets/project9-palette.json`，把里面形如
    oklch(from #FF8000 calc(0.988 + (l - 0.988) * 0.065) calc(c * 0.20) h)
的相对色公式，换算成能直接落进 YAML 的静态色值。

不写任何源文件，不提交任何改动——只产出对比数据，供人工取舍。
"""

from __future__ import annotations

import argparse
import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
P9_PALETTE = ROOT / "docs" / "site-assets" / "project9-palette.json"
CATALOG = ROOT / "release" / "fds-token-catalog.json"

# 项目9种子色落在第几阶；公司索引 = 项目9索引 - SEED_P9_STEP 后整体对齐。
# 项目9是 1-12、公司 0-11，两者同为 12 阶，故映射为恒定偏移 1。
P9_TO_LOCAL = 1

OKLCH_RE = re.compile(
    r"^oklch\(\s*from\s+(?P<seed>#[0-9a-fA-F]{3,8})\s+(?P<body>.+)\)$"
)

# 允许出现在算式里的字符：数字、相对色分量名、四则运算和小数点。
EXPR_ALLOWED = re.compile(r"^[0-9lch\s\+\-\*/\.\(\)]+$")


# ---------- 色彩空间换算（OKLab / OKLCH <-> sRGB） ----------

def _srgb_to_linear(c: float) -> float:
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def _linear_to_srgb(c: float) -> float:
    v = 12.92 * c if c <= 0.0031308 else 1.055 * (c ** (1 / 2.4)) - 0.055
    return max(0.0, min(1.0, v))


def hex_to_oklch(hex_color: str) -> tuple[float, float, float]:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    r, g, b = (_srgb_to_linear(int(h[i : i + 2], 16) / 255) for i in (0, 2, 4))

    l_ = math.copysign(abs(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3),
                       0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
    m_ = math.copysign(abs(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3),
                       0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
    s_ = math.copysign(abs(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3),
                       0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)

    L = 0.2104542553 * l_ + 0.7936177850 * m_ - 0.0040720468 * s_
    a = 1.9779984951 * l_ - 2.4285922050 * m_ + 0.4505937099 * s_
    bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.8086757660 * s_

    C = math.hypot(a, bb)
    H = math.degrees(math.atan2(bb, a)) % 360.0
    return L, C, H


def oklch_to_hex(L: float, C: float, H: float) -> str:
    rad = math.radians(H)
    a, bb = C * math.cos(rad), C * math.sin(rad)

    l_ = L + 0.3963377774 * a + 0.2158037573 * bb
    m_ = L - 0.1055613458 * a - 0.0638541728 * bb
    s_ = L - 0.0894841775 * a - 1.2914855480 * bb
    l, m, s = l_**3, m_**3, s_**3

    r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
    g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
    b = -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s

    out = []
    for ch in (r, g, b):
        v = _linear_to_srgb(ch)
        out.append(f"{round(v * 255):02X}")
    hexv = "#" + "".join(out)
    # 能缩成三位就缩，保持与仓库现有写法一致
    if hexv[1] == hexv[2] and hexv[3] == hexv[4] and hexv[5] == hexv[6]:
        return "#" + hexv[1] + hexv[3] + hexv[5]
    return hexv


def _unwrap_calc(expr: str) -> str:
    expr = expr.strip()
    m = re.fullmatch(r"calc\((.*)\)", expr, flags=re.S)
    return m.group(1).strip() if m else expr


def resolve_value(css_value: str) -> str:
    """把项目9的一条 cssValue 解析为静态十六进制。"""
    value = css_value.strip()

    # 已经是静态颜色
    if value.startswith("#"):
        return normalize_hex(value)

    m = OKLCH_RE.match(value)
    if not m:
        raise ValueError(f"无法解析的色值表达式: {value}")

    seed = m.group("seed")
    sL, sC, sH = hex_to_oklch(seed)

    scope = {"l": sL, "c": sC, "h": sH}
    vals = {}
    for key in ("l", "c", "h"):
        expr = _unwrap_calc(m.group(key))
        # 只允许数字、变量和小数点，杜绝 eval 风险
        if not re.fullmatch(r"[0-9lch\s\+\-\*/\.\(\)]+", expr):
            raise ValueError(f"表达式含非法字符: {expr}")
        vals[key] = eval(expr, {"__builtins__": {}}, scope)  # noqa: S307 - 已限定字符集

    return oklch_to_hex(vals["l"], vals["c"], vals["h"])


def normalize_hex(v: str) -> str:
    h = v.lstrip("#").upper()
    if len(h) == 3:
        h = "".join(ch * 2 for ch in h)
    short = "#" + h[0] + h[2] + h[4]
    return short if h[0] == h[1] and h[2] == h[3] and h[4] == h[5] else "#" + h


# ---------- 业务组装 ----------

def load_project9() -> dict[str, dict[int, str]]:
    """返回 {palette: {family: {本地阶位: 色值}}}，索引已换算成公司 0 起步。"""
    data = json.loads(P9_PALETTE.read_text(encoding="utf-8"))
    # 变量名形如 --fds-g-color-{family}-base-{n} / -dark-{n}
    var_re = re.compile(r"^--fds-g-color-(?P<family>.+?)-(?P<mode>base|dark)-(?P<n>\d+)$")

    out: dict[str, dict[str, dict[int, str]]] = {}
    for mode, families in data["palettes"].items():
        bucket: dict[str, dict[int, str]] = {}
        for fam in families:
            steps: dict[int, str] = {}
            for sw in fam["swatches"]:
                m = var_re.match(sw["cssVariable"])
                if not m:
                    continue
                local_step = int(m.group("n")) - P9_TO_LOCAL
                steps[local_step] = resolve_value(sw["cssValue"])
            bucket[fam["family"]] = steps
        out[mode] = bucket
    return out


def load_local() -> dict[str, dict[str, dict[int, str]]]:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    var_re = re.compile(r"^--fds-g-color-(?P<family>.+?)-(?P<n>\d+)$")
    out: dict[str, dict[str, dict[int, str]]] = {"base": {}, "dark": {}}
    for token in catalog["tokens"]:
        m = var_re.match(token["cssVariable"])
        if not m:
            continue
        family, n = m.group("family"), int(m.group("n"))
        mode = "dark" if family.endswith("-dark") else "base"
        fam = family.removesuffix("-dark") if mode == "dark" else family
        out[mode].setdefault(fam, {})[n] = normalize_hex(token["resolvedValue"])
    return out


COLOR_FAMILIES_ORDER = [
    "brand", "red", "amber", "yellow", "yellow-green", "green",
    "teal", "blue", "indigo", "purple", "magenta",
]


def build_diff() -> dict:
    p9 = load_project9()
    local = load_local()
    families = {}
    for mode in ("base", "dark"):
        for fam in sorted(p9[mode]):
            p9steps = p9[mode][fam]
            locsteps = local[mode].get(fam, {})
            rows = []
            for n in sorted(p9steps):
                rows.append({
                    "n": n,
                    "p9": p9steps[n],
                    "local": locsteps.get(n),
                })
            key = fam if mode == "base" else f"{fam}-dark"
            families[key] = {
                "mode": mode,
                "family": fam,
                "rows": rows,
                "changed": sum(
                    1 for r in rows if r["local"] and r["p9"].upper() != r["local"].upper()
                ),
                "missing": sum(1 for r in rows if not r["local"]),
            }
    return families


def srgb_dist(a: str, b: str) -> float:
    """粗略视觉差异：RGB 空间欧氏距离，够用来排序「差得远不远」。"""
    def rgb(h: str) -> tuple[int, int, int]:
        h = h.lstrip("#")
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))

    ra, rb = rgb(a), rgb(b)
    return math.dist(ra, rb)


def main() -> None:
    ap = argparse.ArgumentParser(description="解析项目9 OKLCH 色板并与本地对比")
    ap.add_argument("--json", metavar="PATH", help="导出对比结果为 JSON")
    ap.add_argument("--family", help="只看某个色系")
    args = ap.parse_args()

    families = build_diff()
    total_rows = total_changed = total_missing = 0

    print(f"{'色系':<20}{'阶数':>6}{'有差异':>8}{'本地缺失':>10}{'平均视觉差':>12}")
    print("-" * 60)
    for key in sorted(families):
        info = families[key]
        if args.family and args.family not in key:
            continue
        rows = info["rows"]
        diffs = [
            srgb_dist(r["p9"], r["local"])
            for r in rows
            if r["local"] and r["p9"].upper() != r["local"].upper()
        ]
        avg = sum(diffs) / len(diffs) if diffs else 0.0
        print(f"{key:<20}{len(rows):>6}{info['changed']:>8}{info['missing']:>10}{avg:>12.1f}")
        total_rows += len(rows)
        total_changed += info["changed"]
        total_missing += info["missing"]

    print("-" * 60)
    print(f"{'合计':<20}{total_rows:>6}{total_changed:>8}{total_missing:>10}")

    if args.json:
        Path(args.json).write_text(
            json.dumps(families, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        print(f"\n已导出: {args.json}")


if __name__ == "__main__":
    main()
