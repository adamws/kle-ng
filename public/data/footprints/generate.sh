#!/bin/bash
#
# Regenerate the footprint preview SVGs used by the kle-ng PCB Generator.
#
# For every footprint in the table below this script:
#   1. exports a front-side and back-side SVG from its KiCad .pretty library
#      (kicad-cli),
#   2. remaps KiCad's per-side layer colors to the kle-ng preview palette,
#   3. removes all text (reference designators etc.) with strip_text.py,
#   4. prettifies each SVG with svgo (if installed), then
#   5. crops each SVG's page tightly to its content (resize_to_content.py),
#   6. checks that switch and diode SVGs are centred on the footprint origin.
#
# The footprint name doubles as the output filename: front/<name>.svg and
# back/<name>.svg — which is exactly what src/utils/footprintUtils.ts expects.
#
# Requirements: kicad-cli (KiCad 9+), python3, the `svgelements` module
# (pip install svgelements), and GNU sed. Optional: svgo (npm i -g svgo) for
# prettified output.
#
# Usage:
#   ./generate.sh            # regenerate every footprint in the table
#

set -euo pipefail

# Run from this script's directory so front/, back/ and resize_to_content.py
# resolve regardless of where it's invoked from.
cd "$(dirname "$0")"

# --- KiCad export layers ---------------------------------------------------
# F.Fab / B.Fab carry the component body + courtyard outline; F.Cu / B.Cu the
# pads; Edge.Cuts the board edge.
layers_front="F.Fab,F.Cu,Edge.Cuts"
layers_back="F.Fab,B.Fab,B.Cu,Edge.Cuts"

# --- Color remap -----------------------------------------------------------
# KiCad exports each layer in its theme color, remap those to kle-ng's preview palette.
# Format "<from>|<to>"; matched case-insensitively.
COLOR_MAP=(
  "#AFAFAF|#585D84" # F.Fab courtyard   -> outline gray
  "#D0D2CD|#585D84" # Edge.Cuts         -> outline gray
)

# --- KiCad footprint library locations -------------------------------------
KICAD_LIB="/usr/share/kicad/footprints"
KEYSWITCH_LIB="$HOME/.local/share/kicad/9.0/3rdparty/footprints/com_github_perigoso_keyswitch-kicad-library"

# --- Footprint table -------------------------------------------------------
# One row per footprint, formatted "<library.pretty>|<footprint name>".
# Uncomment additional rows to generate more variants.
FOOTPRINTS=(
#  # Diodes ------------------------------------------------------------------
#  "$KICAD_LIB/Diode_SMD.pretty|D_SOD-123"
#  "$KICAD_LIB/Diode_SMD.pretty|D_SOD-123F"
#  "$KICAD_LIB/Diode_SMD.pretty|D_SOD-323"
#  "$KICAD_LIB/Diode_SMD.pretty|D_SOD-323F"
#  "$KICAD_LIB/Diode_THT.pretty|D_DO-35_SOD27_P7.62mm_Horizontal"
#
#  # Switches (perigoso keyswitch library) -----------------------------------
#  "$KEYSWITCH_LIB/Switch_Keyboard_Cherry_MX.pretty|SW_Cherry_MX_PCB_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Alps_Matias.pretty|SW_Alps_Matias_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Hybrid.pretty|SW_Hybrid_Cherry_MX_Alps_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Kailh.pretty|SW_Kailh_Choc_V1_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Kailh.pretty|SW_Kailh_Choc_V2_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Kailh.pretty|SW_Kailh_Choc_V1V2_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Kailh.pretty|SW_Kailh_Choc_Mini_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Hotswap_Kailh.pretty|SW_Hotswap_Kailh_Choc_V1_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Hotswap_Kailh.pretty|SW_Hotswap_Kailh_Choc_V2_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Hotswap_Kailh.pretty|SW_Hotswap_Kailh_Choc_V1V2_1.00u"
#  "$KEYSWITCH_LIB/Switch_Keyboard_Hotswap_Kailh.pretty|SW_Hotswap_Kailh_MX_1.00u"
#
#  # Per-key RGB LED ---------------------------------------------------------
#  "$KICAD_LIB/LED_SMD.pretty|LED_SK6812MINI-E_3.2x2.8mm_P1.5mm_ReverseMount"

  # Decoupling capacitor ----------------------------------------------------
#  "$KICAD_LIB/Capacitor_SMD.pretty|C_0402_1005Metric"
  # Additional capacitor sizes (uncomment to generate):
   "$KICAD_LIB/Capacitor_SMD.pretty|C_01005_0402Metric"
   "$KICAD_LIB/Capacitor_SMD.pretty|C_0201_0603Metric"
   "$KICAD_LIB/Capacitor_SMD.pretty|C_0603_1608Metric"
   "$KICAD_LIB/Capacitor_SMD.pretty|C_0805_2012Metric"
   "$KICAD_LIB/Capacitor_SMD.pretty|C_1206_3216Metric"
)

# --- Preflight -------------------------------------------------------------
missing=0
command -v kicad-cli >/dev/null 2>&1 || { echo "error: kicad-cli not found (needs KiCad 9+)"; missing=1; }
command -v python3 >/dev/null 2>&1 || { echo "error: python3 not found"; missing=1; }
command -v sed >/dev/null 2>&1 || { echo "error: sed not found"; missing=1; }
if command -v python3 >/dev/null 2>&1 && ! python3 -c "import svgelements" >/dev/null 2>&1; then
  echo "error: python module 'svgelements' not installed — run: pip install svgelements"
  missing=1
fi
[ "$missing" -eq 0 ] || exit 1

# svgo is optional (prettifying is cosmetic). Prefer a global install, fall
# back to the repo's local copy via npx; warn and skip if neither is available.
if command -v svgo >/dev/null 2>&1; then
  SVGO_CMD="svgo"
elif command -v npx >/dev/null 2>&1 && npx --no-install svgo --version >/dev/null 2>&1; then
  SVGO_CMD="npx --no-install svgo"
else
  SVGO_CMD=""
  echo "note: svgo not found — SVGs won't be prettified (install: npm i -g svgo)"
fi

mkdir -p front back

# --- Steps -----------------------------------------------------------------
# Remap KiCad layer colors to the kle-ng preview palette (in place).
remap_colors() {
  local file="$1" map from to
  for map in "${COLOR_MAP[@]}"; do
    from="${map%%|*}"
    to="${map##*|}"
    sed -i -E "s/${from}/${to}/Ig" "$file"
  done
}

# Pretty-print SVGs in place with svgo (no-op when svgo isn't installed). Runs
# before the crop so resize_to_content.py always sets the final viewBox last.
# svgo.config.mjs (auto-loaded from this dir) keeps pads as separate paths.
prettify_svg() {
  [ -n "$SVGO_CMD" ] || return 0
  # shellcheck disable=SC2086 # SVGO_CMD may be "npx --no-install svgo"
  $SVGO_CMD --pretty --quiet "$@" >/dev/null
}

# The PCB generator preview centres switch and diode SVGs on their viewBox and
# places them where kbplacer puts the footprint origin, so the viewBox centre
# must be (0,0) in footprint coordinates. kicad-cli exports onto a page with
# the origin at the page centre and step 5 crops to the content, so this only
# holds for content symmetric around the origin (or SVGs in footprint
# coordinates). Fail instead of shipping a preview that is silently offset.
check_origin_centred() {
  python3 - "$@" <<'PY'
import re
import sys

failed = False
for path in sys.argv[1:]:
    with open(path) as f:
        match = re.search(r'viewBox="([^"]+)"', f.read())
    x, y, width, height = (float(v) for v in match.group(1).split())
    cx, cy = x + width / 2, y + height / 2
    if abs(cx) > 1e-3 or abs(cy) > 1e-3:
        print(f"    error: {path}: viewBox centre ({cx:g}, {cy:g}) is not the footprint origin (0, 0)")
        failed = True
sys.exit(1 if failed else 0)
PY
}

generate_one() {
  local library="$1" fp="$2"

  if [ ! -d "$library" ]; then
    echo "    skipped: library not found: $library"
    return 1
  fi

  # 1. Export both sides from the footprint library; -o is an output directory
  #    and the file is named after the footprint (front/<fp>.svg, back/<fp>.svg).
  kicad-cli fp export svg -l "$layers_front" --sp --fp "$fp" -o front "$library" >/dev/null
  kicad-cli fp export svg -l "$layers_back" --sp --fp "$fp" -o back "$library" >/dev/null

  # 2. Remap colors to the preview palette.
  remap_colors "front/$fp.svg"
  remap_colors "back/$fp.svg"

  # 3. Remove all text (reference designators etc.) before fitting to content.
  python3 strip_text.py "front/$fp.svg" "back/$fp.svg"

  # 4. Prettify (optional).
  prettify_svg "front/$fp.svg" "back/$fp.svg"

  # 5. Crop both pages tightly to their content.
  python3 resize_to_content.py "front/$fp.svg" "back/$fp.svg"

  # 6. Switch and diode previews must be centred on the footprint origin.
  case "$fp" in
    SW_* | D_*) check_origin_centred "front/$fp.svg" "back/$fp.svg" ;;
  esac
}

total=${#FOOTPRINTS[@]}
failed=()
echo "Generating $total footprint(s)..."
echo

i=0
for row in "${FOOTPRINTS[@]}"; do
  i=$((i + 1))
  library="${row%%|*}"
  fp="${row##*|}"
  echo "[$i/$total] $fp"
  if ! generate_one "$library" "$fp"; then
    failed+=("$fp")
  fi
done

echo
if [ "${#failed[@]}" -eq 0 ]; then
  echo "Done — all $total footprint(s) generated into front/ and back/."
else
  echo "Done with ${#failed[@]} failure(s): ${failed[*]}"
  exit 1
fi
