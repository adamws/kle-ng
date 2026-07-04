# VIA Layout Collapsing

This document analyzes how VIA-annotated multi-layout keyboards are **collapsed** into a single
physical layout, both in the upstream [kicad-kbplacer](https://github.com/adamws/kicad-kbplacer)
Python project (the PCB backend) and in kle-ng's TypeScript port. It also documents where collapsing
is applied in each generation pipeline (PCB vs. plate).

**Relevant source files:**

| File                                    | Role                                                                    |
| --------------------------------------- | ----------------------------------------------------------------------- |
| `src/utils/layout-options.ts`           | `collapseViaLayout` (superset), `collapseToLayoutChoices` (single view) |
| `src/utils/matrix-validation.ts`        | `parseOptionChoice` (reads `labels[8]`), `getDefaultLayoutKeys`         |
| `src/utils/keyboard-geometry.ts`        | `getKeyCenter` — rotation-aware key center                              |
| `src/stores/keyboard.ts`                | `isViaAnnotated` detector (`isValidViaLabel` on `labels[0]`)            |
| `src/stores/plateGenerator.ts`          | Applies `collapseViaLayout` before plate generation                     |
| `src/stores/pcbGenerator.ts`            | Sends raw keys to the backend, which collapses server-side              |
| `kicad-kbplacer/kbplacer/kle_serial.py` | `MatrixAnnotatedKeyboard.collapse()` — the reference implementation     |

---

## 1. Background — VIA Layout Options

VIA layouts can express **mutually-exclusive layout options**: ISO vs. ANSI enter, full vs. split
backspace, split spacebar, stepped Caps Lock, etc. The alternatives for a given option all occupy the
same physical region of the board, so in a flat KLE layout they cannot be drawn on top of each other.
Instead, KLE authors draw each alternative **offset to the side** of the default keys and tag it with
a discriminator so tooling can tell the variants apart.

Two label positions carry the annotations (see [matrix-annotation.md](./matrix-annotation.md)):

- **`labels[0]`** — matrix coordinate `"row,col"` (e.g. `"3,13"`). Every non-decal key has one.
- **`labels[8]`** — layout `"option,choice"` (e.g. `"1,0"`). `option` is the option **group**;
  `choice` is which variant within that group. `choice === 0` is the **default** variant.

A key with no `labels[8]`, or with `choice === 0`, belongs to the default layout. A key with
`choice !== 0` is an **alternative** that is only present when its option is switched.

**Collapsing** resolves these offset alternatives back onto their true matrix positions and removes
coincident duplicates, producing a layout suitable for physical output (a PCB or a plate).

---

## 2. Reference implementation — kbplacer `collapse()`

Upstream source: `kicad-kbplacer/kbplacer/kle_serial.py`, class `MatrixAnnotatedKeyboard`,
method `collapse()` (lines ~456–510). In kbplacer the label indices differ (matrix at index 0,
option/choice at normalized index 8 — the same as kle-ng after remapping), but the semantics match.

At construction (`__post_init__`) the keyboard is split:

- `keys` — the **default** keys (`choice === 0` or no option label).
- `alternative_keys` — deep copies of the keys with `choice !== 0`.

`collapse()` then produces the superset:

1. **Seed** a `seen` set with each **non-decal default** key's signature:
   `(labels[0], centerX, centerY, decal, sm)`, where `center = (x + width/2, y + height/2)` and `sm`
   is the switch-mount type. Decal keys are skipped (they anchor nothing and pass through untouched).
2. **Group** every key by `option → choice → [keys]`.
3. For each option group, take the **choice-0 anchor** = the top-left key (`min` by `(x, y)`) of that
   option's default variant. For every non-zero `choice`, compute that choice's own top-left
   `group_anchor` and translate **all** of the choice's keys by `anchor - group_anchor`, so the
   alternative cluster overlays the default cluster's real location.
4. After translation, compute each key's signature; keep it as an alternative only if the signature
   is **unseen** (this drops exact duplicates — e.g. the middle of a 3U+3U split that coincides with a
   7U spacebar).
5. Drop any decals that leaked into the alternatives.

The result the consumers place is `keys` ⧺ `alternative_keys` — every distinct switch position across
all layout options. `collapse()` is idempotent (guarded by a `collapsed` flag). Callers such as
`key_placer.py` construct a `MatrixAnnotatedKeyboard` and call `collapse()` before placing footprints,
so the generated **PCB supports every layout option**.

---

## 3. kle-ng detection — `isViaAnnotated`

kle-ng decides whether a layout is VIA-annotated with the `isViaAnnotated` computed in
`src/stores/keyboard.ts`. A layout qualifies when it has at least one non-decal / non-ghost key and
**every** such key carries a valid `"row,col"` label in `labels[0]` (`isValidViaLabel`, tested against
`/^(\d+),(\d+)$/`). This is the same guard the PCB generator button uses
(`PcbGeneratorControls.vue`), and it now also gates plate collapsing.

---

## 4. kle-ng port — two collapse flavors in `layout-options.ts`

`src/utils/layout-options.ts` contains two collapse functions with different purposes. Both reuse
`parseOptionChoice` (`labels[8]`), `getKeyCenter` (rotation-aware center), and the local `minXY`
helper.

### `collapseToLayoutChoices(keys, choices)` — single variant (canvas preview)

Given a `Map<option, choice>`, returns the **one** layout the user selected: base keys plus the chosen
variant of each option group, with non-zero choices translated onto the choice-0 anchor and
de-duplicated. Ghost/decal keys with no option are dropped. Used by `KeyboardCanvas.vue`'s
`keysForRender` for the layout-option preview toolbar.

### `collapseViaLayout(keys)` — superset (plate, matches PCB)

A faithful port of kbplacer's `collapse()`:

- **Pass-through** (the default layout): every key with no `option,choice` **or** `choice === 0`,
  cloned as-is. Crucially, **ghost and decal keys are preserved** — the plate outline path relies on
  ghost keys to shape a tight outline, so unlike `collapseToLayoutChoices` they must not be dropped.
- **Seed** the dedup set from the non-decal pass-through keys using the signature
  `` `${labels[0]}|${cx}|${cy}|${decal}|${sm}` `` (rotated center rounded to 4 decimals, `sm`
  included to mirror kbplacer).
- For each option group, translate every non-zero choice onto the choice-0 anchor (`minXY`) and append
  it only when its post-translation signature is unseen. Decal keys are never emitted as alternatives.
- Return `passThrough ⧺ keptAlternatives`.

The input array is never mutated (keys are shallow-cloned; only scalar `x`/`y` are adjusted).

---

## 5. Where collapsing is applied

| Pipeline  | Entry point                             | How collapsing happens                                                                                                               |
| --------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| **PCB**   | `pcbGenerator.ts` → `pcbApi.submitTask` | Sends the **raw** serialized layout; the kle-ng-api backend runs kbplacer, which calls `MatrixAnnotatedKeyboard.collapse()`.         |
| **Plate** | `plateGenerator.ts` → `generatePlate()` | Calls `collapseViaLayout(keyboardStore.keys)` when `isViaAnnotated`, **before** the JSON round-trip and `postMessage` to the worker. |

Injecting in the plate **store** (rather than inside `buildPlate`/the worker) keeps the plate builder
layout-agnostic and mirrors how `KeyboardCanvas.vue` collapses in the component layer. Because the
plate result cache is keyed on settings JSON and cleared on any layout change (`requestRegenerate`),
and collapsing is deterministic from the keys, no cache-key change is required.

The plate collapse is a **superset** and is intentionally independent of the canvas layout-option
preview (`displayLayoutChoices`): the generated plate always covers every option, exactly like the PCB.

---

## 6. Worked example — split backspace

Default (choice 0): a 2U backspace at matrix `3,13`, drawn at `x = 14`.
Alternative (choice 1): two 1U keys `3,13` and `3,14`, drawn offset at `x = 13` and `x = 14`.

`collapseViaLayout`:

- Pass-through keeps the 2U backspace at `x = 14`.
- Choice-0 anchor = `(14, 0)`; choice-1 anchor = `(13, 0)` → delta `(+1, 0)`.
- Split-left moves `13 → 14`; split-right moves `14 → 15`.
- No signature collision → both split keys are kept.

Result: the plate has cutouts for the 2U backspace **and** the two 1U split keys at their true matrix
positions — a plate that physically supports either backspace configuration.
