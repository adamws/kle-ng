#!/usr/bin/env python3
"""
Remove all text from footprint SVGs (in place).

KiCad exports the reference designator ("REF**") — and any other footprint text —
in two forms:
  1. an invisible <text> element that carries the string, and
  2. a visible <g class="stroked-text"> group of stroke-font glyph <path>s.

Both are stripped so text doesn't clutter the preview or, more importantly,
inflate the fit-to-content bounding box computed by resize_to_content.py. Run
this BEFORE the fit-to-content step.

Usage:
    python strip_text.py front/foo.svg back/foo.svg
"""

import re
import sys
from pathlib import Path

# Visible stroke-font glyphs. KiCad's stroked-text groups contain <desc> + <path>s
# and are not nested, so a non-greedy match to the first </g> is correct.
STROKED_TEXT_RE = re.compile(r'<g\b[^>]*class="stroked-text"[^>]*>.*?</g>', re.DOTALL)
# Invisible <text> string carriers (attributes may span multiple lines).
TEXT_RE = re.compile(r"<text\b[^>]*>.*?</text>", re.DOTALL)
TEXT_SELFCLOSE_RE = re.compile(r"<text\b[^>]*/>", re.DOTALL)
# Tidy up blank lines left behind (cosmetic; svgo would also handle this).
BLANK_LINES_RE = re.compile(r"\n[ \t]*(?:\n[ \t]*)+\n")


def strip_text(svg: str) -> tuple[str, int]:
    removed = 0
    for pattern in (STROKED_TEXT_RE, TEXT_RE, TEXT_SELFCLOSE_RE):
        svg, n = pattern.subn("", svg)
        removed += n
    svg = BLANK_LINES_RE.sub("\n\n", svg)
    return svg, removed


def process_file(path: Path) -> None:
    new_text, removed = strip_text(path.read_text(encoding="utf-8"))
    path.write_text(new_text, encoding="utf-8")
    print(f"{path.name}: removed {removed} text element(s)")


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python strip_text.py <file.svg> [<file.svg> ...]", file=sys.stderr)
        sys.exit(1)

    exit_code = 0
    for arg in sys.argv[1:]:
        try:
            process_file(Path(arg))
        except Exception as exc:  # keep going through the batch, report at end
            print(f"Error processing {arg}: {exc}", file=sys.stderr)
            exit_code = 1

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
