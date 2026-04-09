# Pretext Migration Plan

**Library:** [`@chenglou/pretext`](https://github.com/chenglou/pretext) — fast, accurate multiline text
measurement and layout for Canvas 2D.

**Status:** On hold. Pretext is `v0.0.5` (pre-stable). API surface is still in active flux
(streaming APIs, materialization deferral, `walkRichInlineLineRanges` vs `layoutWithLines`).
Revisit when ≥1.0.0 or an explicit API stability signal is made upstream.

---

## Why Bother

### 1. i18n correctness (real bug today)

`wrapSingleLine()` in `LabelRenderer.ts:1389` splits on `' '` (ASCII space only). This means:

- **Japanese / Chinese** — no spaces; entire text becomes one word, never wraps
- **Thai** — no inter-word spaces
- **Arabic / Hebrew** — no-space runs, mixed bidi

Pretext uses `Intl.Segmenter` with CJK kinsoku rules, Thai word boundaries, grapheme
clusters, and emoji width correction (fixes a Chrome/Firefox macOS canvas inflation bug).

### 2. Performance

The render loop calls `wrapNodeLines()` → `wrapSingleLine()` → `ctx.measureText()` per word,
per label, per frame. The existing `ParseCache` only caches the parsed AST; measured widths are
recomputed every render.

Pretext's two-phase model caches segment measurements by `(font, segment)` globally. After
`prepare()` runs once, `layout()` is pure arithmetic (~0.0002 ms/text, no canvas calls).

### 3. Code reduction

Replacing the wrapping/measurement core would remove roughly 250–350 lines from
`LabelRenderer.ts` (currently ~1,570 lines). Rendering code and list layout stay custom.

---

## What Pretext Does NOT Replace

- **Rendering** — pretext is layout-only; all `fillText()` / `drawImage()` calls stay
- **List layout** — `drawList()`, `measureListHeight()`, bullet markers, indentation — no concept in pretext
- **Image / SVG nodes** — draw calls stay custom (pretext can model them as atomic pills for
  width budgeting, but drawing is still manual)
- **12-position grid geometry** — pure coordinate math, unrelated to text layout
- **Link hit-test registration** (`LinkTracker`) — unchanged
- **HTML AST → pretext model mapping** — kle-ng's `LabelNode[]` tree needs bridging

---

## Immediate Win: Internal Wrap Cache (do this now, no new dependency)

Before any pretext work, extend the cache layer to store wrapped line results.
`wrapNodeLines()` output is pure function of `(nodes, maxWidth, fontFamily)`. Keying a
`LayoutCache` on those inputs eliminates per-render `measureText()` calls today.

Approximate scope: ~40 lines alongside the existing `ParseCache`
(`src/utils/caches/ParseCache.ts`).

---

## Migration Phases

### Phase 0 — Internal wrap cache *(prerequisite, independent of pretext)*

- Add `LayoutCache` (or extend `ParseCache`) keyed on `(labelNodesHash, maxWidth, fontFamily)`
  returning `LabelNode[][]` (wrapped lines)
- Hash input: stable JSON of the node array + width + font string
- Cache eviction: same LRU size as `ParseCache` (currently 1,000 entries)
- Zero API change; purely internal to `LabelRenderer`

### Phase 1 — Plain-text labels via pretext core API

**Scope:** `LabelNode[]` arrays where every node is `type === 'text'` with no bold/italic
styling (most common case — unformatted key legends).

**What changes:**

| Current | Replacement |
|---------|-------------|
| `wrapSingleLine()` word-split loop | `prepareWithSegments(text, font)` → `layoutWithLines(prepared, maxWidth, lineHeight)` |
| `measureNodeWidth()` for plain text | pretext segment cache |
| `truncateWithEllipsis()` for long words | pretext grapheme-level break + ellipsis |

**What stays:** `drawMultiLineNodes()` rendering — just feed it the line strings from
`layout.lines[].text` instead of the custom node arrays.

**Expected gain:** correct CJK/Thai wrapping; ~100 lines removed from wrapping/measurement
path.

### Phase 2 — Styled inline (bold/italic/links) via rich inline API

**Scope:** mixed-style `LabelNode[]` runs that contain `bold`/`italic` style variants or
`type === 'link'` nodes, but no images, SVGs, or lists.

**Mapping `LabelNode[]` → `RichInlineItem[]`:**

```typescript
// text node with style
{ text: node.text, width: measured, break: 'allowed' }

// link node (keep atomic across word boundary)
{ text: node.text, width: measured, break: 'never' }

// image/svg node (handled in Phase 3 or left as-is)
{ text: '', width: imageWidth, break: 'never' }
```

**What changes:**

- Call `prepareRichInline(items)` + `walkRichInlineLineRanges(prepared, maxWidth, ...)`
- For each returned line range, render the original `LabelNode` slice using existing draw code
- `measureNodesWidth()` and the multi-node wrapping path become dead code for this scope

**What stays:** all rendering logic; `drawMultiLineNodes()` reads node slices per line.

### Phase 3 — Cleanup

After Phases 1–2 land, audit and remove dead code:

- `measureNodeWidth()` — only needed for lists/images after Phase 1+2
- `measureNodesWidth()` — dead after Phase 2
- `measureListWidth()`, `measureListHeight()` — keep (list layout stays custom)
- `wrapSingleLine()` — dead after Phase 1+2; remove
- `truncateWithEllipsis()` — likely dead; remove

Expected net change in `LabelRenderer.ts`: ~1,570 → ~1,150–1,200 lines.

---

## Files Affected

| File | Change |
|------|--------|
| `src/utils/renderers/LabelRenderer.ts` | Replace wrapping/measurement core (Phases 1–2) |
| `src/utils/caches/ParseCache.ts` | Add or extend with wrap cache (Phase 0) |
| `package.json` | Add `@chenglou/pretext` dependency (Phase 1) |

All other files (`canvas-renderer.ts`, `KeyRenderer.ts`, `LinkTracker.ts`, label position
constants) are unaffected.

---

## Pretext API Quick Reference (as of v0.0.5)

```typescript
import { prepare, prepareWithSegments, layoutWithLines } from '@chenglou/pretext'
import { prepareRichInline, walkRichInlineLineRanges } from '@chenglou/pretext/rich-inline'

// Plain text
const prepared = prepareWithSegments(text, '14px Helvetica Neue')
const { lines, lineCount, height } = layoutWithLines(prepared, maxWidth, lineHeight)
// lines[i].text  → string for fillText()
// lines[i].width → measured line width

// Rich inline (mixed styles / atomic items)
const prepared = prepareRichInline([
  { text: 'Hello ', width: w1, break: 'allowed' },
  { text: 'world', width: w2, break: 'never' },   // keep atomic
])
walkRichInlineLineRanges(prepared, maxWidth, (line) => {
  // line.items[] → slice of original items for this line
})
```

Note: `width` for each `RichInlineItem` must be pre-measured via `ctx.measureText()` with the
correct font set. Pretext uses these widths for line-break arithmetic, not re-measurement.
