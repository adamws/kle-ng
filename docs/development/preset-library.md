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
  iso-105.json                              a single-language preset
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
  "id": "iso-105",
  "name": "ISO 105",
  "file": "iso-105.json",
  "description": "Full-size ISO with numpad",
  "keywords": ["full size", "fullsize", "european", "uk", "100%"]
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
presetPayload(isoPreset) // 'iso-105.json'
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
| `iso-105.json`     | `iso-105`     |
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

### Display names are resolved at build time, never in the browser

`Intl.DisplayNames` output depends on the host's ICU data, so deriving names at runtime would
mean different users reading different dropdowns. The generator resolves each new code once,
writes it into `scripts/data/language-names.json`, and the app only ever reads that file's values
out of the manifest. A tag `Intl` cannot name is a **hard failure** — a dropdown entry reading
`ZZ` is worse than a build that stops and says which file to look at.

## Upstream: generating payloads from XKB

The eventual source of legend data is [`xkbprint`](https://gitlab.freedesktop.org/xorg/app/xkbprint)
with a `-kle` backend (see its `scripts/xkb2kle.sh` and `xkb2kle-all.sh`), which dumps a compiled
XKB keymap straight to KLE JSON — roughly a hundred layouts × seventy keyboard geometries.

**Its output is not drop-in.** The geometry it emits for a PC 104 differs from this repo's
`ansi-104`: it uses `rx`/`ry` rotation clusters per section, labels `Bksp` and `Super` rather
than `Backspace` and `Win`, and gives Ctrl 1.5u instead of 1.25u. Copying such a file in as a new
language would break the geometry invariant — which is exactly what the invariant test catches.
**Transplant the legends onto this repo's geometry**; do not copy whole files.

`xkbprint` also emits no metadata at all: no name, no author, and no record of which layout or
geometry produced the file. Provenance lives only in the directory and file names.

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
