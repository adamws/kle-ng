"""Generate the PCB preview coordinate-contract fixture.

Places a switch and a diode with kbplacer, the way the PCB generator backend
does, and writes their pad centres to
src/utils/__tests__/fixtures/pcb-golden-pads.json. The footprint preview is
tested against it, so the preview shows footprints exactly where kbplacer puts
them.

Needs KiCad's pcbnew and kbplacer with the `kbplacer.pair_pads` module. The
kle-ng-api worker image has the same KiCad and kbplacer as the backend:

    docker run --rm \\
        -v "$PWD":/kle-ng -w /kle-ng \\
        admwscki/keyboard-tools-kicad:latest \\
        python3 scripts/generate-pcb-golden-pads.py

If the image's kbplacer predates `kbplacer.pair_pads`, put a kicad-kbplacer
checkout in front of it with
`-v /path/to/kicad-kbplacer:/kbplacer:ro -e PYTHONPATH=/kbplacer`.

Coordinates are integer nanometres relative to the switch origin, +Y down:
`switch_local` is rotated back to a 0 degree switch, `board` keeps the board
axes (what the preview shows on screen). `fab_segments` lists each diode's
F.Fab lines in its own footprint frame, to check the preview SVGs are not
mirrored.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

KEYSWITCH = os.path.expanduser(
    "~/.local/share/kicad/9.0/3rdparty/footprints/"
    "com_github_perigoso_keyswitch-kicad-library"
)
KICAD = "/usr/share/kicad/footprints"

SWITCHES = {
    "Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_1.00u": (
        f"{KEYSWITCH}/Switch_Keyboard_Cherry_MX.pretty:SW_Cherry_MX_PCB_1.00u"
    ),
    # duplicated pad numbers (MX and Alps pin pairs)
    "Switch_Keyboard_Hybrid:SW_Hybrid_Cherry_MX_Alps_1.00u": (
        f"{KEYSWITCH}/Switch_Keyboard_Hybrid.pretty:SW_Hybrid_Cherry_MX_Alps_1.00u"
    ),
}
DIODES = {
    "Diode_SMD:D_SOD-123F": f"{KICAD}/Diode_SMD.pretty:D_SOD-123F",
    # THT: the footprint origin is pin 1, not the middle
    "Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal": (
        f"{KICAD}/Diode_THT.pretty:D_DO-35_SOD27_P7.62mm_Horizontal"
    ),
}
# diodes with preview SVGs, for the F.Fab drawing check: name -> library
FAB_DIODES = {
    **{name: "Diode_SMD" for name in ("D_SOD-123F", "D_SOD-123", "D_SOD-323F", "D_SOD-323")},
    **{
        name: "Diode_THT"
        for package in ("DO-34_SOD68", "DO-35_SOD27", "DO-41_SOD81")
        for name in (f"D_{package}_P{p}mm_Horizontal" for p in ("7.62", "10.16", "12.70"))
    },
}

MX = "Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_1.00u"
HYBRID = "Switch_Keyboard_Hybrid:SW_Hybrid_Cherry_MX_Alps_1.00u"
SOD123F = "Diode_SMD:D_SOD-123F"
DO35 = "Diode_THT:D_DO-35_SOD27_P7.62mm_Horizontal"
# fields of kbplacer.pair_pads pad dumps kept in the fixture
PAD_KEYS = ("number", "net", "attribute", "layers", "switch_local", "board")


def cases():
    # identity placement: diode pads in its own footprint frame
    yield MX, SOD123F, (0, 0, 0, "FRONT"), 0
    for switch_rotation in (0, 90, 37):
        for side in ("FRONT", "BACK"):
            for rotation in (0, 90, 270):
                yield MX, SOD123F, (5.08, 4, rotation, side), switch_rotation
    yield HYBRID, SOD123F, (5.08, 4, 90, "BACK"), 0
    # pin 1 is the position: below the switch, the body along the key's edge
    yield MX, DO35, (0, 0, 0, "FRONT"), 0
    for switch_rotation in (0, 37):
        for side in ("FRONT", "BACK"):
            for rotation in (0, 90, 270):
                yield MX, DO35, (-3.81, 9.5, rotation, side), switch_rotation


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument(
        "--output",
        default="src/utils/__tests__/fixtures/pcb-golden-pads.json",
        help="fixture path",
    )
    args = parser.parse_args()

    import pcbnew

    from kbplacer.element_position import ElementPosition, Side
    from kbplacer.pair_pads import (
        build_pair_board,
        dump_pair_pads,
        load_footprint_by_identifier,
    )

    result = []
    for switch, diode, (x, y, rotation, side), switch_rotation in cases():
        board = build_pair_board(
            SWITCHES[switch],
            DIODES[diode],
            ElementPosition(x, y, rotation, Side.get(side)),
            switch_rotation=switch_rotation,
        )
        footprints = [
            {
                "reference": footprint["reference"],
                "layer": footprint["layer"],
                "pads": [
                    {key: pad[key] for key in PAD_KEYS}
                    for pad in footprint["pads"]
                ],
            }
            for footprint in dump_pair_pads(board)["footprints"]
        ]

        result.append(
            {
                "switch_footprint": switch,
                "diode_footprint": diode,
                "switch_rotation": switch_rotation,
                "diode": {"x": x, "y": y, "rotation": rotation, "side": side},
                "footprints": footprints,
            }
        )

    fab_segments = {}
    for name, library in FAB_DIODES.items():
        footprint = load_footprint_by_identifier(f"{KICAD}/{library}.pretty:{name}")
        segments = []
        for item in footprint.GraphicalItems():
            if (
                item.GetLayer() != pcbnew.F_Fab
                or not isinstance(item, pcbnew.PCB_SHAPE)
                or item.GetShape() != pcbnew.SHAPE_T_SEGMENT
            ):
                continue
            start, end = item.GetStart(), item.GetEnd()
            segments.append(
                [
                    {"x_nm": int(start.x), "y_nm": int(start.y)},
                    {"x_nm": int(end.x), "y_nm": int(end.y)},
                ]
            )
        fab_segments[name] = segments

    fixture = {
        "kicad_version": pcbnew.Version(),
        "generator": "scripts/generate-pcb-golden-pads.py",
        "cases": result,
        "fab_segments": fab_segments,
    }
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(fixture, indent=2) + "\n")
    print(f"Wrote {len(result)} cases to {output}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
