# Preset Library

The preset library is the set of ready-made layouts that ship with kle-ng. It has two surfaces
— a curated shortlist in the Import dropdown and a browsable grid behind **Import → From
Preset** — and both load through the same function, so they cannot drift apart.

Most presets are one KLE payload. Some are not: a physical keyboard is not tied to one set of
legends, and an ANSI 104 board is the same board whether its keycaps are printed US-English or
Polish. Those presets carry a **language** list.

Choosing a language is **strictly optional**, and it is separated from committing to a preset.
Clicking the card imports it in one click, exactly as a single-language preset does; a control
in the card's bottom corner changes which language that click would use, and changes nothing
else.

Two rules follow, and both are load-bearing:

- **The card is the only thing that imports.** Picking from the menu stages a choice and returns
  you to the grid. Collapsing "choose" and "load" into one click would make the choice
  unrevisable — there would be no way to look at a language, change your mind, and pick another
  without importing the first one on the way.
- **The default costs one click.** An earlier version put the choice in a second modal, which
  made every import of a multilingual preset a two-step transaction. The overwhelmingly common
  case must not pay for a capability most users will never reach for.

The staged choice applies to that import only, and nothing about it is written into the layout.

The one invariant that shapes everything here: **a preset is a physical board.** Every language
of one preset must describe the same keys in the same places, and may differ only in its
legends. That is what lets the card draw a single preview, report one key count, and promise the
user in the picker that only the printing changes. `presets.spec.ts` enforces it.

**Relevant source files:**

| File                                    | Role                                                 |
| --------------------------------------- | ---------------------------------------------------- |
| `src/data/presets.json`                 | The manifest — part hand-authored, part generated    |
| `public/data/presets/`                  | The KLE payloads, fetched on demand                  |
| `src/utils/presets.ts`                  | Catalogue accessors and the single load path         |
| `src/components/PresetImportModal.vue`  | The browse grid, its previews, and the language menu |
| `src/components/KeyboardToolbar.vue`    | The Import menu and its shortlist                    |
| `scripts/generate-presets-manifest.mjs` | Regenerates the manifest from the directory          |
| `scripts/lib/presets-manifest.mjs`      | The scan and merge logic, shared with the tests      |
| `scripts/data/language-names.json`      | Committed `code → display name` registry             |

## Architecture Overview

```
public/data/presets/                     ← the payloads, one level deep at most
  planck.json                               a single-language preset
  ansi-104/en.json, ansi-104/pl.json         a multilingual preset
        │
        │  npm run generate:presets          ← scan + merge, never at runtime
        ▼
scripts/lib/presets-manifest.mjs
  scanPresetDir()   ← what is on disk
  buildManifest()   ← disk facts + hand-authored prose carried over
        │
        ▼
src/data/presets.json                    ← committed; a test fails if it is stale
        │
        │  static import (bundled)
        ▼
src/utils/presets.ts
  ALL_PRESETS / TOP_PRESETS              ← browse order / promotion order
  presetPayload(preset, code?)           ← THE only reader of the `file` fields
  applyPreset(preset, store, language?)  ← THE only load path
        │
        ├────────────────────────────────┐
        ▼                                ▼
KeyboardToolbar.vue                PresetImportModal.vue
  Top Presets shortlist              card click  ──────────▶ default language
  one click, default language        corner control ──▶ menu ──▶ stages a choice
                                                                  (no import)
```

## The manifest

`src/data/presets.json` is **half data, half prose**, and the split is the thing to remember
when editing it:

| Field                                                             | Owner                                  |
| ----------------------------------------------------------------- | -------------------------------------- |
| `id`, `file`, `languages`                                         | Generated — rewritten on every run     |
| `name`, `description`, `keywords`, `defaultLanguage`, entry order | Hand-authored — carried over untouched |

A single-language preset names its payload directly; a multilingual one lists its languages:

```jsonc
{
  "id": "planck",
  "name": "Planck",
  "file": "planck.json",
  "description": "40% ortholinear",
  "keywords": ["ortholinear", "grid", "4x12", "40%"]
},
{
  "id": "ansi-104",
  "name": "ANSI 104",
  "defaultLanguage": "en",
  "languages": [
    { "code": "en", "name": "English", "file": "ansi-104/en.json" },
    { "code": "pl", "name": "Polish", "file": "ansi-104/pl.json" }
  ],
  "description": "Full-size ANSI with numpad",
  "keywords": ["full size", "fullsize", "us", "100%"]
}
```

**`id` is the stable identity** — the card's `:key` and `data-preset-id`, the preview-cache key,
the `TOP_PRESET_IDS` entry, and the base of the download name. It is never a path.

**`languages[].file` is the full path** relative to `public/data/presets`, not a bare code. That
redundancy with `id` + `code` is deliberate: `presetUrl()` and `fetchPresetData()` take one
string type for every payload, flat or nested, and "what do I fetch" never needs string
assembly.

`languages` is absent — not an empty array — on a single-language preset. `isMultilingual()` is
therefore a shape check, which keeps "a board with no language concept" distinguishable from "a
board that will have several but currently has one".

### Why not one uniform schema

Forcing a `languages` array onto Planck, ErgoDox and Absolem would mean inventing a language for
boards that have none. The cost of the optional field is one `undefined` check, and it lives in
exactly one function (below).

## `presetPayload()` is a seam, not a helper

`Preset.file` being optional is a `string | undefined` cliff waiting to spread across two `.vue`
files. `presetPayload(preset, code?)` is the **only** place either `file` field is read, so the
cliff exists in one function:

```ts
presetPayload(planckPreset) // 'planck.json'
presetPayload(ansiPreset, 'pl') // 'ansi-104/pl.json'
presetPayload(ansiPreset) // 'ansi-104/en.json'  — the default
presetPayload(ansiPreset, 'zz') // 'ansi-104/en.json'  — unknown code, not a throw
```

An unknown code falls back rather than throwing: a stale link or a hand-typed code should load
the board, not break the modal.

This is also the hook for the change this design will eventually need. The manifest is a static
import, so it ships in the JS bundle; at ~100 languages that is roughly +6 KB per multilingual
preset. The exit is to move the language lists into a lazily fetched file and keep only a count
in the bundle — a contained change **only** while every language access goes through
`presetPayload()` and `presetLanguages()`.

## Download names

`presetFilename()` takes a payload path, strips the extension, and flattens `/` to `-`:

| Payload            | Download name |
| ------------------ | ------------- |
| `planck.json`      | `planck`      |
| `ansi-104/en.json` | `ansi-104-en` |
| `ansi-104/pl.json` | `ansi-104-pl` |

A multilingual preset is **always** suffixed, the default language included. A bare `ansi-104`
silently meaning English gets worse as languages are added, and a name whose shape depends on
whether the user happened to accept the default is worse still.

## Adding a language

1. Drop the payload in as `public/data/presets/<preset-id>/<code>.json`. If the preset is
   currently a flat file, `git mv` it into a directory named after its id first.
2. Run `npm run generate:presets`.
3. Review the diff. `src/data/presets.json` gains a `languages[]` entry; if the code was new,
   `scripts/data/language-names.json` gains its display name.

Nothing else is edited by hand. A payload added without step 2 fails
`'matches what the generator would write'` in `presets.spec.ts`, which exists precisely because
the alternative failure mode is silent — the file is there, valid, and simply never appears.

### Language codes are BCP 47, not XKB layout names

Codes are BCP 47 tags: `en`, `pl`, `de`, and a region subtag when one language needs more than
one variant — `en-GB`, `es-419`. The generator rejects anything that does not canonicalize to
itself (`new Intl.Locale(code).toString()`), so `PL.json` fails immediately and `pl-PL.json`
cannot drift alongside `pl.json`.

This matters because the upstream source uses XKB names, which do not map mechanically:
`us`→`en`, `gb`→`en-GB`, `latam`→`es-419`, `ara`→`ar`. That mapping is editorial and belongs to
whatever imports the XKB output — the generator only ever reads codes off filenames.

A second printing of one language, which no region subtag describes, takes a private-use tag.
English is the case that needs it. Both English defaults stay plain, base and Shift only, so
that most users get the keycaps they expect, and the AltGr-rich printings are opt-in:

| Code           | Name                        | Source                                  |
| -------------- | --------------------------- | --------------------------------------- |
| `en`           | English                     | `us` (defines no AltGr level)           |
| `en-US-x-intl` | English (US, International) | `us(altgr-intl)`: US base/Shift + AltGr |
| `en-GB`        | British English             | `gb` with the AltGr legends dropped     |
| `en-GB-x-ext`  | British English (Extended)  | `gb` in full                            |

The plain `en-GB` comes from the `basic` option in xkbprint's `languages.tsv`, which keeps only
the left column of every legend. "Extended" is the name Windows gives its AltGr-rich UK layout.
`Intl` cannot name a private-use tag, so those display names are registered by hand in
`scripts/data/language-names.json`. On the card chip and in the menu, `languageCodeLabel()`
shortens such a tag to language plus suffix (`EN-INTL`, `EN-EXT`), because the full tag would
crowd the key count off a phone-sized card.

### Display names are resolved at build time, never in the browser

`Intl.DisplayNames` output depends on the host's ICU data, so deriving names at runtime would
mean different users reading different dropdowns. The generator resolves each new code once,
writes it into `scripts/data/language-names.json`, and the app only ever reads that file's values
out of the manifest. A tag `Intl` cannot name is a **hard failure** — a dropdown entry reading
`ZZ` is worse than a build that stops and says which file to look at.

## Upstream: generating payloads from XKB

The localized payloads of **ANSI 104, Default 60%, ISO 105 and ISO 60%** are generated, not
written by hand. Their source is [`xkbprint`](https://gitlab.freedesktop.org/xorg/app/xkbprint)
with a `-kle` backend, which renders a compiled XKB keymap as KLE JSON, one file per X layout.

**Only the legends are taken from it, never the geometry.** The key positions xkbprint emits for
a PC 104 are close to this repo's `ansi-104` but differ from it: `rx`/`ry` clusters per section,
1.5u Ctrl, a 5.75u space bar, fractional offsets. Copying whole files in would break the geometry
invariant. xkbprint's `scripts/xkb2kle-presets.sh` transplants the legends instead:

```
kle-presets/templates/<id>.json    this repo's preset, localizable keys replaced by "<AE01>" …
xkbprint -label name  (pc104/pc105) key name for every key, in xkbprint's key order
xkbprint              (per layout)  legend for every key, in the same order
        │
        ▼ zip names with legends, substitute into the template
<id>/<code>.json                    this repo's geometry, the layout's legends
```

Only the typing keys are localized (`TLDE`, `AE01–12`, `AD01–12`, `AC01–11`, `AB01–10`, `BKSL`,
plus `LSGT` on ISO and the numpad decimal `KPDL`). Modifiers, F-keys and navigation keep this
repo's wording (`Backspace`, `Win`), so every language reads the same outside the letters.

The right Alt is the one modifier that follows the layout, but only in which of this repo's two
labels it gets: `AltGr` where the layout binds it to `ISO_Level3_Shift` (Polish, German, UK and
most European layouts), `Alt` otherwise (`us`, `ru`, `ja`). xkbprint's own legend only decides
the choice. It cannot be found in a preset by its legend, since both Alt keys read `Alt` on a
US-printed board, so the template takes the second Alt key in reading order.

The substitution works on the raw JSON string because xkbprint's legend string is in the slot
order top-left, bottom-left, top-right, bottom-right, which is also the serialized order under
KLE's default alignment `a:4`. So shift, base and the two AltGr levels land in the four corners
without deserializing anything. The generator refuses a placeholder under any other alignment.

A legend that is a lone combining mark is drawn on a dotted circle `◌` by xkbprint itself. Every
dead key is shown this way, as its combining accent on the circle: `dead_circumflex` is `◌̂`, not a
spacing `^`. Spacing forms exist for the common accents but not for all (`dead_belowdot`,
`dead_hook`), and mixing the two made one key show an accent bare beside another on a circle.
A plain `^` on a legend is therefore always a real character, never a dead key. The circle also
carries the vowel signs and tone marks of Arabic, Hebrew, Thai, Devanagari and similar scripts.
Printed bare, such a mark has no width: it floats off the cap or lands on a neighbouring legend.
The classification comes from a table xkbprint generates from Unicode's `UnicodeData.txt`
(`scripts/gen-ucsmark.awk`).

Drawing the circle is only half of it: the font must also know where a mark sits on `◌`.
kle-ng's label fonts (Helvetica, Arial) have neither glyph, and common fallbacks such as DejaVu
Sans have no mark anchors on U+25CC, so the mark collides with the circle. Every legend font stack
is therefore led by `"KLE Marks"` (`withMarksFont()` in `src/utils/label-fonts.ts`), a 14 KB
subset of SIL's Andika, renamed as its license requires, whose `@font-face` `unicode-range`
covers only U+25CC and the Latin combining-mark blocks. Ordinary legends never use it. Andika
was chosen because it positions every mark on `◌`, overlays included. Noto Sans, tried first,
draws dead_stroke's `◌̸` beside the circle instead of through it. A canvas does not wait for
web fonts, so `main.ts` starts the load and the editor redraws on `document.fonts`
`loadingdone`. `src/assets/fonts/README.md` records the font's source, and
`scripts/generate-marks-font.mjs` rebuilds it. SVG and HTML exports do not embed
it, so there the result depends on the viewer's fonts.

`ansi-104/en.json` regenerated from the `us` layout is byte-identical to the hand-made file it
was cut from, which is the check that the transplant loses nothing. The ISO presets default to
the plain `en-GB`, which likewise equals the hand-made ISO 105 and ISO 60% it replaced.

### Regenerating

In an xkbprint checkout next to this one:

```bash
scripts/xkb2kle-presets.sh --kle-ng ../kle-ng   # replaces every language of the four presets
cd ../kle-ng && npm run generate:presets
```

The editorial inputs are committed in xkbprint's `scripts/kle-presets/` directory:

| File            | Holds                                                                       |
| --------------- | --------------------------------------------------------------------------- |
| `presets.tsv`   | preset id → XKB geometry, and the layout the preset's own legends come from |
| `languages.tsv` | XKB layout → BCP 47 code (`-` skips it); order decides duplicate ties       |
| `templates/`    | one template per preset                                                     |

When a preset's geometry changes here, re-cut its template with
`scripts/xkb2kle-presets.sh --templates ../kle-ng`. It matches each key's current legend against
the reference layout (`us` or `gb`) and fails on an ambiguous or missing match.

`languages.tsv` maps XKB names to BCP 47 codes. The two do not correspond mechanically:
`us`→`en`, `gb`→`en-GB`, `latam`→`es-419`, `ara`→`ar`. The map is seeded from the
`iso639Id`/`iso3166Id` of `rules/evdev.xml` and then edited by hand. A layout whose legends are
identical to one listed earlier is reported and skipped, because a picker entry that changes
nothing is noise. For example, `cn` and `kr` are US-printed, and `at` equals `de`.

### Bundle size

There are 86 languages across four presets, and the manifest is a static import, so the language
lists add roughly 25 KB to the bundle before compression. The exit is still the one described
under `presetPayload()`: lazy-load the lists behind `presetLanguages()`.

## The language menu

The menu is a plain popup owned by `PresetImportModal`, not a component of its own and not a
modal. Three details are load-bearing:

**The toggle is a sibling of the card, not a child.** The card is a `<button>`, and a `<button>`
may not legally contain another one — browsers break the nesting and the inner control stops
being reliably clickable. So each grid item is a `.preset-card-slot` wrapper holding the card
button and, when the preset has languages, the toggle positioned in its bottom-right corner,
beside the key count — it is a fact about what you are about to load, not an overlay on the
artwork. The toggle's click handler carries `.stop`, without which every attempt to change the
language would also import the card.

**Staged choices live in `selectedLanguages`**, a `Record<preset id, code>` on the modal. Absent
means "this preset's default", so the common case stores nothing and every card is correct
before it is ever touched. It is cleared when the modal _opens_ rather than when it closes: a
staged language belongs to one visit, and the parent can hide this modal without `close()` ever
running.

**The menu is `position: fixed`, placed from the toggle's rect.** Anything absolutely positioned
inside a card is clipped: `.preset-scroll-area` hides overflow on both axes, so a menu on a card
in the last row would open into a region the user has to scroll to reach — and scrolling to
reach it would move it. `positionLanguageMenu()` reads the toggle's `getBoundingClientRect()`,
right-aligns the menu to it, clamps it into the viewport, and flips it above the toggle when the
space below runs out.

The cost of reading a rect once is that anything moving the toggle afterwards leaves the menu
floating in the wrong place. It is therefore dismissed on: an outside click, a scroll of the
grid, a window resize, a search that re-renders the grid, and Escape. One menu exists at a time —
`openLanguagePreset` is both the state and the visibility flag.

**Escape peels off one layer.** The modal's existing `document` keydown handler closes the menu
and returns early while one is open, so a single press never closes both. Focus returns to the
toggle, because otherwise it lands on `<body>` and the grid's arrow-key navigation — which moves
relative to the focused card — stops responding. The backdrop handler carries the same guard, so
the click that dismisses a menu does not also close the modal behind it.

**Focus always moves into the menu, onto the card's current language**, whether it was opened
by mouse or keyboard. Type-ahead can only hear keys while focus is inside the menu, and with ~90
languages it is the main way through the list. Starting on the current choice rather than the
first option also brings a staged language deep in the list into view when the menu reopens.
`:focus-visible` keeps the ring off for mouse users.

**Type-ahead** follows the WAI-ARIA APG menu pattern, with the matching in
`src/utils/typeahead.ts` and the buffer in the component. Keys typed within 500 ms build a prefix
(`p`,`o` → Polish). Pressing one letter repeatedly cycles through its matches. Matching ignores case
and diacritics. Names are matched before codes, so `pl` finds Polish but a code never beats a
name. A letter typed on the toggle opens the menu and jumps. Space activates the focused option
unless a multi-word name is being typed, and modifier chords are left to the browser. Moving focus
never stages anything: Enter or a click does.

## Card affordance

The toggle shows a globe, the **default language's code**, and a caret — `🌐 EN ▾`. Naming the
code rather than a count ("2 languages") is deliberate: it answers the question a user actually
has in front of a card they are about to click, which is _what will I get?_, and it advertises
that there is something to change without demanding they find out.

It is styled from scratch: **Bootstrap's `badge` partial is not compiled into this app** (nor is
`spinners`), so `.badge` would render as unstyled text. The background is `--bs-body-bg` rather
than the translucent `--bs-secondary-bg`, because the chip overlaps the preview and a
see-through chip over key legends is unreadable. It is absolutely positioned over the existing
fixed-height thumb box, so the card's dimensions do not change and the grid does not reflow.

The meta line stays one short string — it has to survive a 140 px card on a phone — so the
fuller phrasing goes into the card's `title` instead.

**Sizing.** The chip is 24 px tall, the WCAG 2.5.8 minimum target, reached by the chip itself
rather than an invisible hit area. Its icons are whole-pixel sizes (globe 12 px, caret 8 px) with
`flex-shrink: 0` and `overflow: visible`. The globe's outline touches its viewBox edge, so at a
fractional size (it used to be 0.8em = 8.8 px) pixel snapping shaved the circle flat.

The chip's width follows its code (`EN` 60 px, `EN-GB` 82 px, a staged `MS-ARAB` about 100 px), so the
key count's corner reservation (`.preset-card-meta-inset`) is computed from the code's length via
a `--lang-code-chars` custom property rather than fixed. On a phone the caret is dropped to keep
`105 keys` beside `🌐 EN-GB`. The line never wraps: an ellipsis is the backstop, and it shows only
for the longest codes on the narrowest cards.

## Search excludes language names

Language names are deliberately **not** Fuse keys. With a hundred languages per preset, every
localized preset would match every language query, and the result list would stop discriminating.
Revisit only if presets ever get per-language cards.

## Testing

```bash
npx vitest run src/utils/__tests__/presets.spec.ts \
               src/components/__tests__/PresetImportModal.spec.ts \
               src/components/__tests__/KeyboardToolbar.spec.ts
npx playwright test e2e/import-preset.spec.ts --project chromium
node scripts/generate-presets-manifest.mjs --check
```

| Spec                                                 | What it holds down                                                                                                                                                                               |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/utils/__tests__/presets.spec.ts`                | Runs against the **real** manifest: manifest ↔ directory in both directions, `TOP_PRESET_IDS` resolution, the geometry invariant, manifest freshness, `presetPayload` fallbacks, download naming |
| `src/components/__tests__/PresetImportModal.spec.ts` | One-click default load, the toggle not loading the card under it, menu contents, staging without importing, restaging before committing, Escape ordering, dismissal on re-filter                 |
| `src/components/__tests__/KeyboardToolbar.spec.ts`   | The shortlist loads the default language and never opens a menu                                                                                                                                  |
| `src/stores/__tests__/kle-roundtrip.spec.ts`         | Reads payload paths off disk directly — update it when a payload moves                                                                                                                           |
| `e2e/import-preset.spec.ts`                          | TC-PRESET-020…028 cover the control end to end: one-click default, menu contents, staging without importing, two-Escape ordering, click-away, and dismissal on scroll                            |

Two of these are worth understanding rather than just running:

**The geometry invariant test** deserializes every language of every multilingual preset and
compares a per-key fingerprint — position, size, secondary rect, rotation, `stepped`, `decal`,
`ghost`, `color`, `profile` — against the default. `labels`, `textSize` and `textColor` are
excluded, because a dense language legitimately needs a smaller legend and that is the only thing
a translation may change.

**The freshness test** feeds the committed manifest back in as the editorial source, which makes
it a pure staleness check: hand-written prose survives by construction, while an unregistered
language shows up as an extra `languages[]` entry and fails.

## Related documentation

- [Import and Export](../import-export.md) — the user-facing description of the Import menu and the preset library
- [Canvas Rendering Pipeline](./canvas-rendering-pipeline.md) — `LayoutPreviewRenderer`, which draws the card thumbnails
- [Layout Export](./layout-export.md) — the KLE label model the payloads use, including the 12 label positions
