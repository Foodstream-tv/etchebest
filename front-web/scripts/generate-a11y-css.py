#!/usr/bin/env python3
"""Generate src/app/accessibility.css (colour-blind palettes + high contrast).

Usage (from front-web/):  python3 scripts/generate-a11y-css.py

The palettes are Tailwind scales re-assigned to the five semantic roles used
by the UI (brand=orange, danger=red, success=green/emerald, info=blue,
warn=amber). Assignments were found by maximising the minimum OKLab distance
between roles under a Machado (2009) colour-vision-deficiency simulation, and
are re-validated every time this script runs.
"""
import itertools, math, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
THEME = ROOT / "node_modules/tailwindcss/theme.css"
OUT = ROOT / "src/app/accessibility.css"

SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]
# role -> source Tailwind families that currently carry that role in the UI
ROLES = {
    "brand": ["orange"],
    "danger": ["red"],
    "success": ["green", "emerald"],
    "info": ["blue"],
    "warn": ["amber"],
}
# mode -> role -> (donor family, shade-index shift)
PALETTES = {
    "protanopia": {"brand": ("orange", 0), "danger": ("pink", 2), "success": ("cyan", -1), "info": ("violet", 0), "warn": ("yellow", -1)},
    "deuteranopia": {"brand": ("orange", 1), "danger": ("fuchsia", -1), "success": ("teal", 2), "info": ("indigo", 1), "warn": ("yellow", -1)},
    "tritanopia": {"brand": ("orange", 2), "danger": ("purple", 0), "success": ("sky", -1), "info": ("indigo", 2), "warn": ("yellow", -1)},
    "achromatopsia": {"brand": ("orange", 0), "danger": ("pink", 1), "success": ("teal", -1), "info": ("indigo", 3), "warn": ("yellow", -3)},
}
THEME_TXT = THEME.read_text()
PAL = {}
for m in re.finditer(r"--color-([a-z]+)-(\d+): (oklch\(([\d.]+)% ([\d.]+) ([\d.]+)\));", THEME_TXT):
    fam, shade, raw, L, C, H = m.groups()
    PAL.setdefault(fam, {})[int(shade)] = (raw, float(L) / 100, float(C), float(H))


def donor(fam, shade, shift):
    i = min(10, max(0, SHADES.index(shade) + shift))
    return PAL[fam][SHADES[i]]


# ---------- CVD validation ----------
def to_lin(L, C, H):
    a, b = C * math.cos(math.radians(H)), C * math.sin(math.radians(H))
    l_, m_, s_ = L + 0.3963377774 * a + 0.2158037573 * b, L - 0.1055613458 * a - 0.0638541728 * b, L - 0.0894841775 * a - 1.2914855480 * b
    l, m, s = l_ ** 3, m_ ** 3, s_ ** 3
    c = lambda x: min(1, max(0, x))
    return (c(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
            c(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
            c(-0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s))


def oklab(rgb):
    r, g, b = rgb
    l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
    m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
    s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b
    l, m, s = [math.copysign(abs(x) ** (1 / 3), x) for x in (l, m, s)]
    return (0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
            0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s)


MACHADO = {
    "protanopia": [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
    "deuteranopia": [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.011820, 0.042940, 0.968881]],
    "tritanopia": [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.303900]],
}


def simulate(rgb, mode):
    if mode == "achromatopsia":
        y = min(1, max(0, 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]))
        return (y, y, y)
    mat = MACHADO[mode]
    return tuple(min(1, max(0, sum(mat[i][j] * rgb[j] for j in range(3)))) for i in range(3))


def validate():
    for mode, assign in PALETTES.items():
        worst = 99.0
        for shade in (400, 500, 600):
            labs = [oklab(simulate(to_lin(*donor(f, shade, sh)[1:]), mode)) for f, sh in assign.values()]
            for a, b in itertools.combinations(labs, 2):
                worst = min(worst, math.dist(a, b) * 100)
        print(f"{mode:14s} min role distance (OKLab dE x100): {worst:5.1f}", file=sys.stderr)


# ---------- CSS generation ----------
def scale_block(mapping, hc_light=False):
    """mapping: role -> (family, shift). Returns CSS custom property lines."""
    lines = []
    for role, srcs in ROLES.items():
        fam, shift = mapping[role]
        for src in srcs:
            for shade in SHADES:
                extra = 0
                if hc_light and shade >= 300:
                    extra = 2  # darken saturated shades for text/white-on-colour contrast
                lines.append(f"  --color-{src}-{shade}: {donor(fam, shade, shift + extra)[0]};")
    return "\n".join(lines)


def gray(shade):
    return PAL["gray"][shade][0]


def hc_gray_blocks():
    # Literal values (not var()) so chained overrides cannot resolve to each other.
    light = f"""html[data-a11y-contrast="high"]:not(.dark) {{
  --color-gray-400: {gray(600)};
  --color-gray-500: {gray(700)};
  --color-gray-600: {gray(800)};
  --color-gray-700: {gray(900)};
}}
"""
    dark = f"""html[data-a11y-contrast="high"].dark {{
  --color-gray-400: {gray(200)};
  --color-gray-500: {gray(300)};
  --color-gray-600: {gray(300)};
}}
"""
    return light + "\n" + dark


IDENTITY = {r: (ROLES[r][0], 0) for r in ROLES}


def main():
    validate()
    css = ["/* GENERATED by scripts/generate-a11y-css.py — do not edit by hand. */", ""]
    css.append(""":root {
  --fs-grad-from: #ff8a2e;
  --fs-grad-to: #ff7a1a;
}

/* Brand gradient follows the active palette / contrast mode. */
html:is(:not([data-a11y-cb="none"]), [data-a11y-contrast="high"]) {
  --fs-grad-from: var(--color-orange-400);
  --fs-grad-to: var(--color-orange-600);
}
""")
    for mode, mapping in PALETTES.items():
        css.append(f'html[data-a11y-cb="{mode}"] {{\n{scale_block(mapping)}\n}}\n')
    # High contrast on a light theme: darken the saturated shades, per palette.
    for mode, mapping in [("none", IDENTITY), *PALETTES.items()]:
        css.append(
            f'html[data-a11y-cb="{mode}"][data-a11y-contrast="high"]:not(.dark) {{\n{scale_block(mapping, hc_light=True)}\n}}\n'
        )
    css.append(hc_gray_blocks())
    swatches = ["// GENERATED by scripts/generate-a11y-css.py — do not edit by hand.",
                "// Shade-500 colours of the five UI roles for each colour-vision mode (used to preview palettes).",
                "import type { ColorBlindMode } from \"@/lib/accessibility\";", "",
                "export const COLOR_BLIND_SWATCHES: Record<ColorBlindMode, readonly string[]> = {"]
    for mode, mapping in [("none", IDENTITY), *PALETTES.items()]:
        cols = ", ".join(f'"{donor(*mapping[r][:1], 500, mapping[r][1])[0]}"' for r in ROLES)
        swatches.append(f"  {mode}: [{cols}],")
    swatches.append("};")
    (ROOT / "src/lib/accessibilitySwatches.ts").write_text("\n".join(swatches) + "\n")
    OUT.write_text("\n".join(css) + "\n" + (ROOT / "scripts/a11y-static.css").read_text())
    print(f"wrote {OUT}", file=sys.stderr)


if __name__ == "__main__":
    main()
