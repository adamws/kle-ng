import { Key, Serial } from '@adamws/kle-serial'
import * as yaml from 'js-yaml'
import { computeReadingOrder } from './reading-order'

export interface KeymapDrawerKey {
  x: number
  y: number
  w?: number
  h?: number
  r?: number
  rx?: number
  ry?: number
}

/** Round to 6 decimal places to remove floating-point noise from kle-serial arithmetic. */
function rd(v: number): number {
  return parseFloat(v.toFixed(6))
}

function toKeymapDrawerKey(key: Key): KeymapDrawerKey {
  const out: KeymapDrawerKey = { x: rd(key.x), y: rd(key.y) }

  const w = rd(key.width)
  const h = rd(key.height)
  if (w !== 1) out.w = w
  if (h !== 1) out.h = h

  const r = rd(key.rotation_angle)
  if (r !== 0) {
    out.r = r
    // Always emit rx/ry explicitly whenever r != 0: keymap-drawer treats an omitted
    // rotation origin as the key's own center (PHYSICAL_LAYOUTS.md footnote 2), which
    // differs from other KLE-adjacent tools and would silently misplace rotated keys.
    // Deliberately diverges from qmk-export.ts's reconstructQmkKey, which omits rx/ry
    // individually when they round to 0 even if r != 0 — correct for QMK, wrong here.
    out.rx = rd(key.rotation_x)
    out.ry = rd(key.rotation_y)
  }

  return out
}

/**
 * Convert KLE keyboard data into a keymap-drawer physical-layout array — the bare-array
 * shortcut for a single unnamed `qmk_info_json` layout (see keymap-drawer's
 * PHYSICAL_LAYOUTS.md). Ghost and decal keys are dropped; the remaining keys are put in
 * row-major reading order via `computeReadingOrder`, since keymap-drawer does no
 * reordering of its own — the array index becomes the key index referenced by a keymap
 * YAML's `layers` entries and `combos[].key_positions`.
 *
 * Returns null if there are no regular (non-ghost, non-decal) keys.
 */
export function convertKleToKeymapDrawerLayout(kleData: unknown): KeymapDrawerKey[] | null {
  let keyboard
  try {
    if (Array.isArray(kleData)) {
      keyboard = Serial.deserialize(kleData)
    } else if (
      typeof kleData === 'object' &&
      kleData !== null &&
      'keys' in kleData &&
      'meta' in kleData
    ) {
      keyboard = kleData as { keys: Key[]; meta: Record<string, unknown> }
    } else {
      return null
    }
  } catch {
    return null
  }

  const orderedKeys = computeReadingOrder(keyboard.keys as Key[])
  if (orderedKeys.length === 0) return null

  return orderedKeys.map(toKeymapDrawerKey)
}

function compactKeymapDrawerKey(key: KeymapDrawerKey): string {
  const parts = Object.entries(key).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`)
  return `{${parts.join(', ')}}`
}

/** Serialize a keymap-drawer layout array with one compact key object per line. */
export function formatKeymapDrawerLayoutJson(layout: KeymapDrawerKey[]): string {
  if (layout.length === 0) return '[]'
  return `[\n${layout.map((k) => `  ${compactKeymapDrawerKey(k)}`).join(',\n')}\n]`
}

/**
 * Build a minimal starter keymap.yaml referencing `layoutJsonFilename` via
 * `qmk_info_json`, with one empty tap-legend placeholder per key in `layout` (in the
 * same order) so a first-time keymap-drawer user has something to fill in rather than
 * an empty array.
 */
export function buildKeymapDrawerYamlSkeleton(
  layout: KeymapDrawerKey[],
  layoutJsonFilename: string,
): string {
  const skeleton = {
    layout: { qmk_info_json: layoutJsonFilename },
    layers: { default: layout.map(() => '') },
    combos: [],
  }
  return yaml.dump(skeleton)
}

const KEYMAP_DRAWER_WEB_APP_URL = 'https://caksoylar.github.io/keymap-drawer'

/**
 * True when this browser can gzip-compress via the native Compression Streams API,
 * which `buildKeymapDrawerWebAppUrl` requires.
 */
export function isKeymapDrawerWebAppShareSupported(): boolean {
  return typeof CompressionStream !== 'undefined'
}

/**
 * gzip-compress and base64url-encode text, matching Python's `gzip.compress` +
 * `base64.b64encode(altchars=b"-_")`.
 *
 * Pipes through CompressionStream rather than manually driving a writer then reading
 * afterward — Chromium's implementation can deadlock on backpressure if the writable
 * side is written to and closed before anything starts consuming the readable side.
 */
async function gzipBase64Url(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text)
  const readable = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const stream = readable.pipeThrough(new CompressionStream('gzip'))
  const compressed = new Uint8Array(await new Response(stream).arrayBuffer())

  let binary = ''
  for (const byte of compressed) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_')
}

/**
 * Build a keymap-drawer web app (caksoylar.github.io/keymap-drawer) permalink that
 * pre-fills its YAML editor with a starter keymap referencing `layoutJsonFilename`.
 *
 * Matches the web app's own permalink scheme exactly — gzip, base64 with `-`/`_` in
 * place of `+`/`/` and padding kept, then percent-encoded — see
 * `kd_web/utils.py::get_permalink` in the caksoylar/keymap-drawer-web repo (the source
 * for the Streamlit app; keymap-drawer's own repo has no web app source, only the CLI).
 *
 * The physical layout itself can't be inlined this way: keymap-drawer's `qmk_info_json`
 * field only ever resolves to a file path or an uploaded buffer, never inline JSON in
 * the YAML. Pair this with downloading `layoutJsonFilename` (see
 * `formatKeymapDrawerLayoutJson`) for the user to drop into the web app's own
 * "Layout override" uploader once the link opens.
 */
export async function buildKeymapDrawerWebAppUrl(
  layout: KeymapDrawerKey[],
  layoutJsonFilename: string,
): Promise<string> {
  const encoded = await gzipBase64Url(buildKeymapDrawerYamlSkeleton(layout, layoutJsonFilename))
  return `${KEYMAP_DRAWER_WEB_APP_URL}?keymap_yaml=${encodeURIComponent(encoded)}`
}
