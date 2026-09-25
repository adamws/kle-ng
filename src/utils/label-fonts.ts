/**
 * Font stacks for key legends.
 *
 * Legends generated from XKB draw a lone combining mark on U+25CC DOTTED CIRCLE
 * (`◌̉`, `◌̣`). The label fonts have neither glyph, so the browser falls back per glyph,
 * and common fallbacks (DejaVu Sans) lack mark-attachment anchors on U+25CC: the mark
 * lands at its x-height default and collides with the circle. "KLE Marks" is a small
 * subset of SIL's Andika, which positions every mark on U+25CC, overlays such as `◌̸`
 * included. It is declared in `src/assets/main.css` with a `unicode-range` limited to
 * U+25CC and the combining-mark blocks, so leading every stack with it changes nothing
 * else. See `src/assets/fonts/README.md`.
 */

/** Default family for key legends when a layout does not load its own font. */
export const DEFAULT_LABEL_FONT_FAMILY = '"Helvetica Neue", Helvetica, Arial, sans-serif'

export const MARKS_FONT_FAMILY = '"KLE Marks"'

/** `family` with the marks font in front of it; idempotent. */
export function withMarksFont(family: string): string {
  return family.startsWith(MARKS_FONT_FAMILY) ? family : `${MARKS_FONT_FAMILY}, ${family}`
}

/**
 * Starts loading the marks font. A canvas never waits for a web font: text drawn before
 * it arrives uses the fallback, so whoever draws must redraw once it is in (the editor
 * listens for `document.fonts` `loadingdone`). Resolves false instead of rejecting, since
 * a missing marks font only costs the fallback rendering.
 */
export async function loadMarksFont(): Promise<boolean> {
  if (typeof document === 'undefined' || !document.fonts?.load) return false
  try {
    const faces = await document.fonts.load(`16px ${MARKS_FONT_FAMILY}`, '◌̉')
    return faces.length > 0
  } catch {
    return false
  }
}
