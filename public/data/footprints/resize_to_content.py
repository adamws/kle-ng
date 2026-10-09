#!/usr/bin/env python3
"""
Resize an SVG's page (viewBox + width/height) to exactly fit its content,
WITHOUT adding a translate() or mutating any element/group.

This is the shared step in the footprint-SVG pipeline: KiCad exports a
footprint onto a large page, and this script crops the page tightly around the
drawn geometry so the preview in kle-ng frames the footprint correctly.

Why the naive approach fails
----------------------------
KiCad writes ``width``/``height`` in pixels but ``viewBox`` in millimetres, so
svgelements applies a viewport transform (~3.78x) and reports every element's
bbox in *pixel* space. Writing those numbers back into the ``viewBox`` — while
the untouched path data stays in mm user units — frames empty space far from
the geometry. We fix this by parsing with the root viewport stripped, so bboxes
come back in the same user-unit space as the path data.

Install dependency:
    pip install svgelements

Usage:
    # Edit one or more files in place (typical pipeline use):
    python resize_to_content.py front/*.svg back/*.svg

    # Write to a separate output file (single input only):
    python resize_to_content.py input.svg -o output.svg

    # Add a little breathing room around the content (in mm):
    python resize_to_content.py --margin 0.1 front/foo.svg
"""

import argparse
import io
import re
import sys
from pathlib import Path

from svgelements import SVG, Group, Shape

# Matches the opening <svg ...> tag (attributes may span multiple lines).
SVG_TAG_RE = re.compile(r"<svg\b[^>]*>", flags=re.DOTALL)


def _strip_root_viewport(text: str) -> str:
    """Return ``text`` with width/height/viewBox removed from the root <svg> tag.

    Removing the viewport makes svgelements use an identity transform, so
    element bboxes are reported in the SVG's own user units — the same space the
    (untouched) path data lives in.
    """
    match = SVG_TAG_RE.search(text)
    if not match:
        raise ValueError("Could not find <svg> root tag.")
    stripped_tag = re.sub(
        r'\s+(?:width|height|viewBox)\s*=\s*"[^"]*"', "", match.group(0)
    )
    return text[: match.start()] + stripped_tag + text[match.end() :]


def compute_content_bbox(text: str):
    """Compute the tight content bbox in user units, including stroke extents."""
    svg = SVG.parse(io.StringIO(_strip_root_viewport(text)))

    minx = miny = float("inf")
    maxx = maxy = float("-inf")

    for element in svg.elements():
        # Only real drawable shapes contribute geometry; containers don't.
        if isinstance(element, (SVG, Group)) or not isinstance(element, Shape):
            continue
        try:
            # with_stroke=True expands by half the stroke width so courtyard /
            # silkscreen lines aren't clipped at the page edge.
            bbox = element.bbox(with_stroke=True)
        except Exception:
            bbox = None
        if bbox is None:
            continue

        x0, y0, x1, y1 = bbox
        minx = min(minx, x0)
        miny = min(miny, y0)
        maxx = max(maxx, x1)
        maxy = max(maxy, y1)

    if minx == float("inf"):
        raise ValueError("No geometric content found in SVG — nothing to fit to.")

    return minx, miny, maxx, maxy


def _set_attr(svg_tag: str, name: str, value: str) -> str:
    """Set/replace an attribute on the given <svg ...> tag string."""
    pattern = rf'\b{name}\s*=\s*"[^"]*"'
    if re.search(pattern, svg_tag):
        return re.sub(pattern, f'{name}="{value}"', svg_tag)
    return svg_tag.replace("<svg", f'<svg {name}="{value}"', 1)


def fit_svg_text(text: str, margin: float = 0.0) -> tuple[str, tuple]:
    """Return (new_svg_text, (minx, miny, width, height)) fitted to content."""
    minx, miny, maxx, maxy = compute_content_bbox(text)

    minx -= margin
    miny -= margin
    width = (maxx - minx) + margin
    height = (maxy - miny) + margin

    match = SVG_TAG_RE.search(text)
    if not match:
        raise ValueError("Could not find <svg> root tag.")
    svg_tag = match.group(0)

    svg_tag = _set_attr(
        svg_tag, "viewBox", f"{minx:.6g} {miny:.6g} {width:.6g} {height:.6g}"
    )
    # width/height carry mm units so the file also renders at true size when
    # opened standalone; kle-ng itself only reads the viewBox. Keeping them 1:1
    # with the viewBox avoids any stretching.
    svg_tag = _set_attr(svg_tag, "width", f"{width:.6g}mm")
    svg_tag = _set_attr(svg_tag, "height", f"{height:.6g}mm")

    new_text = text[: match.start()] + svg_tag + text[match.end() :]
    return new_text, (minx, miny, width, height)


def process_file(input_path: Path, output_path: Path, margin: float) -> None:
    text = input_path.read_text(encoding="utf-8")
    new_text, (minx, miny, width, height) = fit_svg_text(text, margin=margin)
    output_path.write_text(new_text, encoding="utf-8")
    where = str(output_path) if output_path != input_path else f"{input_path} (in place)"
    print(
        f"{input_path.name}: minx={minx:.4g} miny={miny:.4g} "
        f"width={width:.4g} height={height:.4g} -> {where}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Crop an SVG's page tightly around its drawn content.",
    )
    parser.add_argument("inputs", nargs="+", type=Path, help="SVG file(s) to fit")
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        help="Output file (only valid with a single input; default: edit in place)",
    )
    parser.add_argument(
        "--margin",
        type=float,
        default=0.0,
        help="Extra breathing room around the content, in mm (default: 0)",
    )
    args = parser.parse_args()

    if args.output is not None and len(args.inputs) != 1:
        parser.error("-o/--output can only be used with a single input file")

    exit_code = 0
    for input_path in args.inputs:
        output_path = args.output if args.output is not None else input_path
        try:
            process_file(input_path, output_path, args.margin)
        except Exception as exc:  # keep going through the batch, report at end
            print(f"Error processing {input_path}: {exc}", file=sys.stderr)
            exit_code = 1

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
