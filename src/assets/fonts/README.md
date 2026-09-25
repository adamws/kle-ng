# kle-marks.woff2

A subset of **Andika Regular** by SIL International (SIL Open Font License 1.1, see `OFL.txt`),
renamed to **KLE Marks**. It is declared in `src/assets/main.css` with a `unicode-range` and
placed first in every label font stack by `withMarksFont()` (`src/utils/label-fonts.ts`), so it
is used only for the characters below and never for ordinary legends.

**Why it exists.** Legends generated from XKB draw a lone combining mark on U+25CC DOTTED CIRCLE
(`◌̉`, `◌̣`, `◌̸`). The label fonts (Helvetica, Arial) have neither glyph, so the browser falls
back per glyph to whatever the system has, and the result varies:

- DejaVu Sans, a common Linux fallback, has no mark anchors on U+25CC, so marks above and below
  collide with the circle.
- Noto Sans, the first bundled attempt, places those correctly but draws overlay marks, such as
  dead_stroke's U+0338 on the Polish and Finnish K, beside the circle instead of through it.
- Andika, built for diacritics, gets both right.

See `docs/development/preset-library.md`.

**Contents:** U+25CC plus the Latin combining blocks U+0300–036F, U+1AB0–1AFF, U+1DC0–1DFF,
U+20D0–20FF, U+FE20–FE2F, with all layout tables (GPOS mark positioning) kept.

**Renamed because of the license.** "Andika" is a Reserved Font Name under the OFL, and a subset
is a Modified Version, so the generator rewrites the family names to "KLE Marks". The
copyright, trademark notice and license records are kept in the font.

**Regenerating.** Get `Andika-Regular.ttf` and run the generator. It rewrites this file:

```bash
curl -LO https://github.com/google/fonts/raw/main/ofl/andika/Andika-Regular.ttf
npm i --no-save subset-font
node scripts/generate-marks-font.mjs Andika-Regular.ttf
```

Keep `RANGES` in the script and the `unicode-range` in `main.css` in step.
