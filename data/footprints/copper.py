#!/usr/bin/env python3
"""
Copper shapes of an exported footprint SVG, for the footprint-SVG pipeline.

    python copper.py origin <svg> <pads.json>   # prints "x y": the footprint origin in the SVG
    python copper.py shift <svg> "<x> <y>"      # moves that point to (0, 0) (in place)
    python copper.py mark <svg>...              # adds class="hoverable" to copper shapes (in place)
    python copper.py holes <svg> <pads.json>    # draws the pads' drills (in place, after shift)

kicad-cli centres a footprint's bounding box (reference and value text
included) on its page, so the footprint origin ends up at an arbitrary point
of the SVG. `origin` finds it from the pads: their copper centres in the
pad geometry JSON (scripts/generate-footprint-pads.mjs, footprint coordinates)
must match the centres of the SVG's copper shapes up to one translation,
possibly with the footprint mirrored (the back side export). It fails when
they don't, rather than guess.

`shift` then moves the drawing into footprint coordinates, which the preview
and its tests expect (pcb-coordinate-contract.spec.ts): path data and circle
centres are rewritten, nothing is wrapped in a transform.

kicad-cli draws pads without their drills, so `holes` adds them, from the
pad JSON, as circles in the hole colour the hand-made switch SVGs use
(slots as stadiums). It runs on a shifted SVG, finding the mirror (front or
back export) from the copper.

`mark` tags copper so the track editor can hide it under its own pad layer
(FootprintPreview.vue, `.hoverable`).

Needs svgelements (pip install svgelements).
"""

import io
import json
import math
import re
import sys
import xml.etree.ElementTree as ET

from svgelements import SVG, Circle, Group, Path, Shape

from resize_to_content import _strip_root_viewport

# KiCad's F.Cu and B.Cu colours in the export (kept by generate.sh's colour remap)
COPPER = {"#c83434", "#4d7fc4"}
# Drill fill, as in the hand-made switch SVGs
HOLE = "#AFAFAF"
# Pad centres match within this (mm); kicad-cli writes 4 decimals.
TOLERANCE = 0.01

SVG_NS = "http://www.w3.org/2000/svg"


def copper_centres(text: str) -> list[tuple[float, float, bool]]:
    """Centres of the copper-filled shapes: (x, y, exact), exact for circles.

    Other shapes give their bounding box centre, which can be a rounding step
    off (arcs are written as polylines).
    """
    svg = SVG.parse(io.StringIO(_strip_root_viewport(text)))
    centres = []
    for element in svg.elements():
        if isinstance(element, (SVG, Group)) or not isinstance(element, Shape):
            continue
        fill = element.fill
        if fill is None or fill.value is None or fill.hex[:7].lower() not in COPPER:
            continue
        bbox = element.bbox()
        if bbox is None:
            continue
        if isinstance(element, Circle):
            centres.append((float(element.cx), float(element.cy), True))
            continue
        x0, y0, x1, y1 = bbox
        centres.append(((x0 + x1) / 2, (y0 + y1) / 2, False))
    return centres


def rotate_kicad(x: float, y: float, degrees: float) -> tuple[float, float]:
    """Rotates by a KiCad orientation (counter-clockwise on screen, +Y down)."""
    rad = math.radians(degrees)
    c, s = math.cos(rad), math.sin(rad)
    return x * c + y * s, -x * s + y * c


def pad_centres(pads: dict) -> list[tuple[float, float]]:
    """Copper centres of the pads, footprint coordinates (the drill offset moves the copper)."""
    out = []
    for pad in pads["pads"]:
        if pad["type"] == "np_thru_hole" or pad["shape"] == "custom":
            continue
        at = pad["at"]
        offset = (pad.get("drill") or {}).get("offset") or {"x": 0, "y": 0}
        ox, oy = rotate_kicad(offset["x"], offset["y"], at["rot"])
        out.append((at["x"] + ox, at["y"] + oy))
    return out


def locate_origin(text: str, pads: dict) -> tuple[float, float]:
    return locate(text, pads)[0]


def locate(text: str, pads: dict) -> tuple[tuple[float, float], tuple[int, int]]:
    """The origin of the footprint in the SVG, and its mirror (sx, sy)."""
    found = copper_centres(text)
    expected = pad_centres(pads)
    if not found or not expected:
        raise ValueError("no copper shapes or no pads to match")

    def near(p, q):
        return abs(p[0] - q[0]) <= TOLERANCE and abs(p[1] - q[1]) <= TOLERANCE

    for sx, sy in ((1, 1), (-1, 1), (1, -1)):
        mirrored = [(sx * x, sy * y) for x, y in expected]
        first = mirrored[0]
        for c in found:
            t = (c[0] - first[0], c[1] - first[1])
            pairs = []
            for x, y in mirrored:
                match = next((f for f in found if near((x + t[0], y + t[1]), f)), None)
                if match is None:
                    break
                pairs.append((match, (x, y)))
            else:
                # refine on exact (circle) centres when there are any
                exact = [pair for pair in pairs if pair[0][2]] or pairs
                tx = sum(f[0] - p[0] for f, p in exact) / len(exact)
                ty = sum(f[1] - p[1] for f, p in exact) / len(exact)
                # kicad-cli writes 4 decimals
                return (round(tx, 4) + 0.0, round(ty, 4) + 0.0), (sx, sy)
    raise ValueError("the pads don't match the SVG's copper shapes")


def shift(text: str, dx: float, dy: float) -> str:
    """Translates every path and circle by (dx, dy); other shapes aren't expected."""
    for tag in ("rect", "line", "polyline", "polygon", "ellipse", "use", "text"):
        if re.search(rf"<{tag}\b", text):
            raise ValueError(f"can't shift <{tag}> elements")

    def compact(d: str) -> str:
        # svgelements writes full floats (and E exponents): round to 1 nm
        return re.sub(
            r"-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?",
            lambda m: f"{round(float(m.group(0)), 6) + 0.0:g}",
            d,
        )

    def path(m: re.Match) -> str:
        p = Path(m.group(2)) * f"translate({dx}, {dy})"
        p.reify()
        return f'{m.group(1)}d="{compact(p.d())}"'

    def number(attr: str, delta: float):
        def sub(m: re.Match) -> str:
            return f'{attr}="{float(m.group(1)) + delta:.6g}"'

        return sub

    text = re.sub(r'(\s)d="([^"]*)"', path, text)
    text = re.sub(r'\bcx="([^"]*)"', number("cx", dx), text)
    return re.sub(r'\bcy="([^"]*)"', number("cy", dy), text)


def hole_shapes(text: str, pads: dict) -> list[str]:
    """SVG shapes of the pads' drills; the SVG must be in footprint coordinates."""
    (ox, oy), (sx, sy) = locate(text, pads)
    if max(abs(ox), abs(oy)) > 1e-3:
        raise ValueError(f"footprint origin at ({ox:g}, {oy:g}), shift the SVG first")
    shapes = []
    for pad in pads["pads"]:
        drill = pad.get("drill")
        if not drill:
            continue
        at = pad["at"]
        x, y = sx * at["x"], sy * at["y"]
        w, h = drill["w"], drill.get("h") or drill["w"]
        if abs(w - h) < 1e-9:
            shapes.append(f'<circle class="hoverable" cx="{x:.6g}" cy="{y:.6g}" r="{w / 2:.6g}" />')
            continue
        # a slot: a stadium along its longer side, turned with the pad
        r = min(w, h) / 2
        half = (max(w, h) - min(w, h)) / 2
        ux, uy = (1, 0) if w > h else (0, 1)
        ux, uy = rotate_kicad(ux, uy, at["rot"])
        ux, uy = sx * ux, sy * uy
        ax, ay, bx, by = x - ux * half, y - uy * half, x + ux * half, y + uy * half
        nx, ny = -uy * r, ux * r
        f = lambda v: f"{round(v, 6) + 0.0:g}"
        shapes.append(
            f'<path class="hoverable" d="M {f(ax + nx)},{f(ay + ny)} L {f(bx + nx)},{f(by + ny)} '
            f"A {f(r)},{f(r)} 0 0 0 {f(bx - nx)},{f(by - ny)} L {f(ax - nx)},{f(ay - ny)} "
            f'A {f(r)},{f(r)} 0 0 0 {f(ax + nx)},{f(ay + ny)} Z" />'
        )
    return shapes


def add_holes(text: str, pads: dict) -> str:
    """Draws the drills over everything else, before the closing </svg>."""
    shapes = hole_shapes(text, pads)
    if not shapes:
        return text
    group = f'<g style="fill:{HOLE};fill-opacity:1.000;stroke:none;">\n' + "\n".join(shapes) + "\n</g>\n"
    end = text.rindex("</svg>")
    return text[:end] + group + text[end:]


def mark_copper(text: str) -> str:
    """Adds class="hoverable" to shapes filled with copper (directly or from a group)."""
    ET.register_namespace("", SVG_NS)
    root = ET.fromstring(text)

    def fill_of(el, inherited):
        style = el.get("style", "")
        m = re.search(r"fill\s*:\s*([^;]+)", style)
        fill = m.group(1).strip() if m else el.get("fill", inherited)
        return fill.lower() if fill else inherited

    def walk(el, inherited):
        fill = fill_of(el, inherited)
        tag = el.tag.split("}")[-1]
        if tag in ("path", "circle", "rect", "ellipse", "polygon") and fill in COPPER:
            classes = el.get("class", "").split()
            if "hoverable" not in classes:
                # first, like the hand-made SVGs (readers look for it before `d`)
                attrib = {"class": " ".join([*classes, "hoverable"])}
                attrib.update((k, v) for k, v in el.attrib.items() if k != "class")
                el.attrib.clear()
                el.attrib.update(attrib)
        for child in el:
            walk(child, fill)

    walk(root, None)
    return ET.tostring(root, encoding="unicode")


def main() -> None:
    if len(sys.argv) >= 4 and sys.argv[1] == "origin":
        with open(sys.argv[2]) as f:
            text = f.read()
        with open(sys.argv[3]) as f:
            pads = json.load(f)
        x, y = locate_origin(text, pads)
        print(f"{x:.6g} {y:.6g}")
    elif len(sys.argv) == 4 and sys.argv[1] == "shift":
        x, y = (float(v) for v in sys.argv[3].split())
        with open(sys.argv[2]) as f:
            text = f.read()
        with open(sys.argv[2], "w") as f:
            f.write(shift(text, -x, -y))
    elif len(sys.argv) == 4 and sys.argv[1] == "holes":
        with open(sys.argv[2]) as f:
            text = f.read()
        with open(sys.argv[3]) as f:
            pads = json.load(f)
        with open(sys.argv[2], "w") as f:
            f.write(add_holes(text, pads))
    elif len(sys.argv) >= 3 and sys.argv[1] == "mark":
        for path in sys.argv[2:]:
            with open(path) as f:
                text = f.read()
            with open(path, "w") as f:
                f.write(mark_copper(text))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
