"""Generate the PCB preview coordinate-contract fixture.

Places a switch and a diode with kbplacer, the way the PCB generator backend
does, and writes their pad centres to
src/utils/__tests__/fixtures/pcb-golden-pads.json. The footprint preview is
tested against it, so the preview shows footprints exactly where kbplacer puts
them.

Needs KiCad's pcbnew, kbplacer and kbplacer's tools/dump_pair_pads.py. The
kle-ng-api worker image has the same KiCad and kbplacer as the backend:

    docker run --rm \\
        -v /path/to/kicad-kbplacer/tools:/kbtools:ro \\
        -v "$PWD":/kle-ng -w /kle-ng \\
        admwscki/keyboard-tools-kicad:latest \\
        python3 scripts/generate-pcb-golden-pads.py --tools /kbtools

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
}
# diodes with preview SVGs, for the F.Fab drawing check
FAB_DIODES = ["D_SOD-123F", "D_SOD-123", "D_SOD-323F", "D_SOD-323"]

MX = "Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_1.00u"
HYBRID = "Switch_Keyboard_Hybrid:SW_Hybrid_Cherry_MX_Alps_1.00u"
SOD123F = "Diode_SMD:D_SOD-123F"


def cases():
    # identity placement: diode pads in its own footprint frame
    yield MX, SOD123F, (0, 0, 0, "FRONT"), 0
    for switch_rotation in (0, 90, 37):
        for side in ("FRONT", "BACK"):
            for rotation in (0, 90, 270):
                yield MX, SOD123F, (5.08, 4, rotation, side), switch_rotation
    yield HYBRID, SOD123F, (5.08, 4, 90, "BACK"), 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--tools", required=True, help="kicad-kbplacer tools directory")
    parser.add_argument(
        "--output",
        default="src/utils/__tests__/fixtures/pcb-golden-pads.json",
        help="fixture path",
    )
    args = parser.parse_args()

    sys.path.insert(0, args.tools)
    import pcbnew
    from dump_pair_pads import _load, build_board, dump  # type: ignore[import-not-found]

    from kbplacer.element_position import Side

    result = []
    for switch, diode, (x, y, rotation, side), switch_rotation in cases():
        board = build_board(
            argparse.Namespace(
                switch_footprint=SWITCHES[switch],
                diode_footprint=DIODES[diode],
                diode_position=f"{x} {y} {rotation} {side}",
                switch_rotation=switch_rotation,
                switch_side=Side.FRONT,
            )
        )
        local = dump(board)
        origin = board.FindFootprintByReference("SW1").GetPosition()

        footprints = []
        for footprint in local["footprints"]:
            board_footprint = board.FindFootprintByReference(footprint["reference"])
            # dump() sorts pads by number and switch-local position, keep the
            # board positions in the same order by matching pad by pad
            board_pads = list(board_footprint.Pads())
            pads = []
            for pad in footprint["pads"]:
                match = next(
                    p
                    for p in board_pads
                    if p.GetNumber() == pad["number"]
                    and _local(p, origin, switch_rotation) == pad["position"]
                )
                board_pads.remove(match)
                position = match.GetPosition()
                pads.append(
                    {
                        "number": pad["number"],
                        "net": pad["net"],
                        "attribute": pad["attribute"],
                        "layers": pad["layers"],
                        "switch_local": pad["position"],
                        "board": {
                            "x_nm": int(position.x - origin.x),
                            "y_nm": int(position.y - origin.y),
                        },
                    }
                )
            footprints.append(
                {
                    "reference": footprint["reference"],
                    "layer": footprint["layer"],
                    "pads": pads,
                }
            )

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
    for name in FAB_DIODES:
        footprint = _load(f"{KICAD}/Diode_SMD.pretty:{name}")
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


def _local(pad, origin, switch_rotation):
    from kbplacer.board_modifier import position_in_rotated_coordinates
    import pcbnew

    position = pad.GetPosition()
    relative = pcbnew.VECTOR2I(position.x - origin.x, position.y - origin.y)
    if switch_rotation:
        relative = position_in_rotated_coordinates(relative, -switch_rotation)
    return {"x_nm": int(relative.x), "y_nm": int(relative.y)}


if __name__ == "__main__":
    sys.exit(main())
