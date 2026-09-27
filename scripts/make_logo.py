"""Build the centred logo lockup for the README: mark, wordmark, tagline.

    python scripts/make_logo.py --inter Inter.ttf --deva NotoSansDevanagari.ttf

Text is drawn as vector outlines, not <text>: GitHub shows SVG with whatever
fonts the viewer happens to have, and a machine without a Devanagari font
would render "सहाय" as boxes. Outlines read the same everywhere. Glyphs are
shaped with HarfBuzz, so Devanagari vowel signs sit where they should.

Fonts (both SIL Open Font License, not committed):
  Inter                 github.com/google/fonts/tree/main/ofl/inter
  Noto Sans Devanagari  github.com/google/fonts/tree/main/ofl/notosansdevanagari

Writes docs/img/logo-lockup-dark.svg and docs/img/logo-lockup-light.svg,
one for each GitHub theme.
"""

from __future__ import annotations

import argparse
import io
from pathlib import Path

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

REPO_ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = REPO_ROOT / "docs" / "img"

# The mark, from sahaay/ui/logo.svg (64-unit grid).
MARK = """<rect x="1.5" y="1.5" width="61" height="61" rx="16" fill="#050607" stroke="#23272d" stroke-width="3"/>
<g fill="none" stroke-linecap="round" stroke-width="4.5">
<path d="M16 27v10" stroke="#ececec"/><path d="M24 19v26" stroke="#4db8ff"/><path d="M32 24v16" stroke="#ececec"/>
<path d="M41 26h9" stroke="#ececec" stroke-opacity=".6"/><path d="M41 38h5" stroke="#ececec" stroke-opacity=".6"/></g>"""

THEMES = {
    "dark": {"word": "#ECECEC", "tag": "#8B919A", "deva": "#4DB8FF", "line": "#4DB8FF"},
    "light": {"word": "#0F1720", "tag": "#56646F", "deva": "#0B6FB8", "line": "#0B6FB8"},
}


class Face:
    """A variable font pinned to one instance, ready to shape and outline."""

    def __init__(self, path: Path, axes: dict[str, float]):
        font = instantiateVariableFont(TTFont(path), axes)
        buf = io.BytesIO()
        font.save(buf)
        self.font = TTFont(io.BytesIO(buf.getvalue()))
        self.glyphs = self.font.getGlyphSet()
        self.order = self.font.getGlyphOrder()
        self.upem = self.font["head"].unitsPerEm
        self.hb_font = hb.Font(hb.Face(hb.Blob(buf.getvalue())))

    def shape(self, text: str, tracking_em: float = 0.0) -> tuple[list[tuple[str, float, float]], float]:
        """Glyph names with pen positions in font units, and the total advance."""
        buf = hb.Buffer()
        buf.add_str(text)
        buf.guess_segment_properties()
        hb.shape(self.hb_font, buf)
        out, x = [], 0.0
        track = tracking_em * self.upem
        for info, pos in zip(buf.glyph_infos, buf.glyph_positions, strict=True):
            out.append((self.order[info.codepoint], x + pos.x_offset, pos.y_offset))
            x += pos.x_advance + track
        return out, x - (track if out else 0)

    def path(self, glyphs, size: float, left: float, baseline: float) -> str:
        """One SVG path for a shaped run, scaled to `size` px, y flipped."""
        s = size / self.upem
        pen = SVGPathPen(self.glyphs, ntos=lambda v: f"{v:.1f}")
        for name, gx, gy in glyphs:
            self.glyphs[name].draw(TransformPen(pen, (s, 0, 0, -s, left + gx * s, baseline - gy * s)))
        return pen.getCommands()

    def width(self, advance: float, size: float) -> float:
        return advance * size / self.upem


def build(inter: Path, deva: Path) -> dict[str, str]:
    word = Face(inter, {"wght": 650, "opsz": 32})
    small = Face(inter, {"wght": 520, "opsz": 14})
    devanagari = Face(deva, {"wght": 600, "wdth": 100})

    width, cx = 1200, 600
    mark_size, mark_top = 176, 24
    word_size, word_base = 132, 330
    tag_size, tag_base = 46, 412

    wg, wadv = word.shape("Sahaay", tracking_em=-0.02)
    ww = word.width(wadv, word_size)
    word_path = word.path(wg, word_size, cx - ww / 2, word_base)

    dg, dadv = devanagari.shape("सहाय")
    dw = devanagari.width(dadv, tag_size * 1.15)
    sep = "  ·  "
    tg, tadv = small.shape(sep + "OFFLINE LECTURE COMPANION", tracking_em=0.16)
    tw = small.width(tadv, tag_size * 0.62)
    left = cx - (dw + tw) / 2
    deva_path = devanagari.path(dg, tag_size * 1.15, left, tag_base)
    tag_path = small.path(tg, tag_size * 0.62, left + dw, tag_base - 2)

    scale = mark_size / 64
    mark = f'<g transform="translate({cx - mark_size / 2:.1f} {mark_top}) scale({scale:.4f})">{MARK}</g>'

    svgs = {}
    for name, c in THEMES.items():
        svgs[name] = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} 450" role="img" aria-labelledby="t d">
<title id="t">Sahaay</title>
<desc id="d">Sahaay - offline lecture companion. Live captions, Indian-language translation and a jargon glossary, on the device.</desc>
{mark}
<path d="{word_path}" fill="{c['word']}"/>
<path d="{deva_path}" fill="{c['deva']}"/>
<path d="{tag_path}" fill="{c['tag']}"/>
</svg>
"""
    return svgs


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--inter", type=Path, required=True)
    ap.add_argument("--deva", type=Path, required=True)
    ap.add_argument("--out-dir", type=Path, default=OUT_DIR)
    args = ap.parse_args()
    args.out_dir.mkdir(parents=True, exist_ok=True)
    for name, svg in build(args.inter, args.deva).items():
        out = args.out_dir / f"logo-lockup-{name}.svg"
        out.write_text(svg, encoding="utf-8")
        print(f"wrote {out.relative_to(REPO_ROOT) if out.is_relative_to(REPO_ROOT) else out} ({len(svg) // 1024} KB)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
