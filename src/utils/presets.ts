import { Serial, type Keyboard } from '@adamws/kle-serial'
import presetsMetadata from '@/data/presets.json'
import type { useKeyboardStore } from '@/stores/keyboard'

/**
 * The built-in preset library.
 *
 * `src/data/presets.json` is the manifest; the payloads it names live in
 * `public/data/presets/` and are plain KLE JSON, fetched on demand. Two surfaces
 * consume this module:
 *
 * - the Import dropdown, which lists only `TOP_PRESETS` as a shortcut, and
 * - `PresetImportModal.vue`, which browses the whole catalogue with previews.
 *
 * Both load through `applyPreset()`, so the two paths cannot drift.
 *
 * A preset is a *physical board*, and some boards ship with more than one set of
 * legends. Those carry a `languages` array and keep their payloads in a directory
 * named after the preset id (`ansi-104/en.json`, `ansi-104/pl.json`); the rest stay
 * a single flat file. Every language of one preset must describe the same keys in
 * the same places — only the legends may differ — which is what lets the card
 * preview and the key count stay language-independent. `presets.spec.ts` enforces it.
 *
 * The manifest is partly hand-authored (`name`, `description`, `keywords`,
 * `defaultLanguage`, entry order) and partly generated from what is on disk (`id`,
 * `file`, `languages`). Run `npm run generate:presets` after adding or removing a
 * payload; a test fails if the committed manifest has drifted from the directory.
 *
 * See docs/development/preset-library.md.
 *
 * NOTE: downloads are memoised for the session, so clicking the same preset twice
 * issues a single request. Tests that assert on `fetch` call counts must reset the
 * cache with `clearPresetCache()` in `beforeEach`, or a later test will be served
 * from the cache and see no request at all.
 */

export interface PresetLanguage {
  /** BCP 47 tag — `en`, `pl`, `en-GB`, `es-419`. Also the payload's basename. */
  code: string
  /**
   * Display name for the picker.
   *
   * Resolved by the generator, never by the browser: `Intl.DisplayNames` output
   * varies with the host's ICU data, and the dropdown has to read the same for
   * everyone — and be reviewable in a diff.
   */
  name: string
  /** Payload path relative to `public/data/presets`. */
  file: string
}

export interface Preset {
  /** Stable id — the flat payload's basename, or the directory name. Never a path. */
  id: string
  name: string
  /** Card tooltip and search key; never rendered inline. */
  description?: string
  /** Search-only synonyms; never displayed. */
  keywords?: string[]
  /** Payload path. Present iff the preset is single-language. */
  file?: string
  /** Present iff the preset is multilingual. Default first, then by display name. */
  languages?: PresetLanguage[]
  /** Which language the dropdown loads and the card previews. Multilingual only. */
  defaultLanguage?: string
}

/** The whole catalogue, in presets.json order — which is the modal's browse order. */
export const ALL_PRESETS: readonly Preset[] = presetsMetadata.presets ?? []

/**
 * The curated shortlist shown directly in the Import dropdown, in this exact order.
 * Everything else is reachable through Import → From Preset.
 *
 * Kept here rather than as a flag in presets.json for two reasons: the promotion
 * order is an editorial decision that has nothing to do with the browse order, and
 * the manifest stays a pure data file that anyone can append to without thinking
 * about the toolbar. `presets.spec.ts` fails if an entry here stops matching a
 * catalogue id, so a rename cannot silently empty the menu.
 */
export const TOP_PRESET_IDS: readonly string[] = [
  'blank',
  'ansi-104',
  'default-60',
  'iso-60',
  'ortho-4-12-qmk',
  'multilayout-60-via',
]

export const TOP_PRESETS: readonly Preset[] = TOP_PRESET_IDS.map((id) =>
  ALL_PRESETS.find((preset) => preset.id === id),
).filter((preset): preset is Preset => preset !== undefined)

/* -------------------------------------------------------------------------- */
/* Languages                                                                   */
/* -------------------------------------------------------------------------- */

/** A preset is multilingual when the manifest gave it a `languages` array. */
export function isMultilingual(preset: Preset): boolean {
  return preset.languages !== undefined
}

/**
 * The preset's languages, or `[]` for a single-language preset.
 *
 * Returns an array rather than `undefined` so no call site needs a null check, and
 * so this stays the one place to change if the language lists ever move out of the
 * bundled manifest into a lazily fetched file.
 */
export function presetLanguages(preset: Preset): readonly PresetLanguage[] {
  return preset.languages ?? []
}

export function defaultLanguageOf(preset: Preset): PresetLanguage | undefined {
  const languages = presetLanguages(preset)
  return languages.find((language) => language.code === preset.defaultLanguage) ?? languages[0]
}

/**
 * The payload path for a preset in a language, and the only place the manifest's
 * `file` fields are read — which is what keeps `Preset.file` being optional from
 * becoming a `string | undefined` cliff across the components.
 *
 * An unknown or absent code falls back to the default language rather than throwing:
 * a stale link or a hand-typed code should load the board, not break the modal.
 */
export function presetPayload(preset: Preset, code?: string): string {
  if (!isMultilingual(preset)) return preset.file ?? ''

  const languages = presetLanguages(preset)
  const requested = code !== undefined ? languages.find((l) => l.code === code) : undefined
  return (requested ?? defaultLanguageOf(preset))?.file ?? ''
}

/* -------------------------------------------------------------------------- */

export function presetUrl(file: string): string {
  return `${import.meta.env.BASE_URL}data/presets/${file}`
}

/**
 * Download name for a payload path: `iso-105.json` → `iso-105`,
 * `ansi-104/pl.json` → `ansi-104-pl`.
 *
 * A multilingual preset is always suffixed, the default language included, so the
 * name never changes shape depending on which language happened to be picked.
 */
export function presetFilename(payloadPath: string): string {
  return payloadPath.replace(/\.[^/.]+$/, '').replace(/\//g, '-')
}

export interface PresetPreview {
  keyboard: Keyboard
  keyCount: number
}

const rawCache = new Map<string, Promise<unknown>>()
const previewCache = new Map<string, Promise<PresetPreview>>()

/**
 * Raw KLE JSON for a payload path, memoised for the session.
 *
 * Keyed by the path, which already embeds the language, so the languages of one
 * preset cache independently without any extra bookkeeping.
 */
export function fetchPresetData(file: string): Promise<unknown> {
  const cached = rawCache.get(file)
  if (cached) return cached

  const request = (async () => {
    const response = await fetch(presetUrl(file))
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return response.json()
  })()

  // A transient failure must not poison the preset for the rest of the session.
  // The extra `.catch` only evicts; the rejection is still delivered to callers.
  request.catch(() => {
    rawCache.delete(file)
  })

  rawCache.set(file, request)
  return request
}

/**
 * A preset deserialized for thumbnail rendering.
 *
 * Deliberately goes through the same `Serial.deserialize` the load path uses, so a
 * preview cannot show something different from what clicking the card produces.
 */
export function loadPresetPreview(file: string): Promise<PresetPreview> {
  const cached = previewCache.get(file)
  if (cached) return cached

  const pending = (async () => {
    const keyboard = Serial.deserialize((await fetchPresetData(file)) as Array<unknown>)
    return { keyboard, keyCount: keyboard.keys.length }
  })()

  pending.catch(() => {
    previewCache.delete(file)
  })

  previewCache.set(file, pending)
  return pending
}

/**
 * The single load path shared by the dropdown and the modal. Throws; callers decide
 * how to report.
 *
 * `language` is optional and falls back to the preset's default, so the Import
 * dropdown's one-click shortcut needs no separate code path.
 *
 * Takes the store as a parameter rather than calling `useKeyboardStore()` itself,
 * matching `processJsonLayout()` in `json-layout-processor.ts`.
 */
export async function applyPreset(
  preset: Preset,
  keyboardStore: ReturnType<typeof useKeyboardStore>,
  language?: string,
): Promise<void> {
  const path = presetPayload(preset, language)
  const data = await fetchPresetData(path)
  keyboardStore.loadKLELayout(data)
  // loadKeyboard() clears the filename, so naming the download has to come after.
  keyboardStore.filename = presetFilename(path)
}

/** Drops the memoised responses. Exists for tests that assert on fetch counts. */
export function clearPresetCache(): void {
  rawCache.clear()
  previewCache.clear()
}
