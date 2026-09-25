// Pure logic behind `npm run generate:presets`, split out from the CLI so that
// `src/utils/__tests__/presets.spec.ts` can reuse it: the freshness test asserts that
// the committed src/data/presets.json is exactly what buildManifest() would write, so
// a payload added to public/data/presets without regenerating fails CI instead of
// silently never appearing in the app.
//
// See docs/development/preset-library.md.

import { readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * What is actually on disk under public/data/presets.
 *
 * Exactly two shapes are legal, and nothing nests deeper than one level:
 *   foo.json        -> a single-language preset with id "foo"
 *   foo/en.json     -> a multilingual preset with id "foo" and language code "en"
 *
 * Anything else throws. A silent skip here would mean a payload that exists, is
 * unreachable, and reports no error anywhere — which is the exact failure the
 * catalogue tests were written to catch in the first place.
 *
 * @param {string} rootDir absolute path to public/data/presets
 * @returns {{ flat: {id: string, file: string}[], multilingual: {id: string, codes: string[]}[] }}
 */
export function scanPresetDir(rootDir) {
  const flat = []
  const multilingual = []

  for (const entry of readdirSync(rootDir).sort()) {
    if (entry.startsWith('.')) continue // .DS_Store and friends

    const full = join(rootDir, entry)
    if (statSync(full).isDirectory()) {
      const codes = []
      for (const child of readdirSync(full).sort()) {
        if (child.startsWith('.')) continue
        if (!child.endsWith('.json')) {
          throw new Error(
            `${entry}/${child}: a preset language directory may only contain .json payloads`,
          )
        }
        if (statSync(join(full, child)).isDirectory()) {
          throw new Error(`${entry}/${child}: preset payloads may not nest more than one level`)
        }
        codes.push(child.slice(0, -'.json'.length))
      }
      if (codes.length === 0) {
        throw new Error(`${entry}/: a preset directory with no payloads in it`)
      }
      for (const code of codes) assertCanonicalCode(entry, code)
      multilingual.push({ id: entry, codes })
      continue
    }

    if (!entry.endsWith('.json')) {
      throw new Error(`${entry}: unexpected file in the preset directory (expected .json)`)
    }
    flat.push({ id: entry.slice(0, -'.json'.length), file: entry })
  }

  return { flat, multilingual }
}

/**
 * A language code must be a BCP 47 tag that canonicalizes to itself, so that
 * `PL.json` fails here rather than producing a dropdown entry that looks like a
 * duplicate of `pl`, and `pl-PL.json` cannot quietly drift alongside `pl.json`.
 *
 * Note these are BCP 47 tags, NOT xkb layout names: xkb's `us`/`gb`/`latam`/`ara`
 * become `en`/`en-GB`/`es-419`/`ar`. That mapping is editorial and belongs to
 * whatever imports the xkbprint output — this scan only ever reads codes off
 * filenames.
 */
function assertCanonicalCode(id, code) {
  let canonical
  try {
    canonical = new Intl.Locale(code).toString()
  } catch {
    throw new Error(`${id}/${code}.json: "${code}" is not a valid BCP 47 language tag`)
  }
  if (canonical !== code) {
    throw new Error(`${id}/${code}.json: use the canonical tag "${canonical}" instead of "${code}"`)
  }
}

/**
 * Merge what is on disk with the hand-authored manifest.
 *
 * The split matters: `name`, `description`, `keywords`, `defaultLanguage` and the
 * entry order are editorial content a human wrote, and regeneration must never
 * touch them. `id`, `file` and `languages` are facts about the directory and are
 * always rewritten.
 *
 * @param {ReturnType<typeof scanPresetDir>} scan
 * @param {{presets: object[]}} previous the committed manifest
 * @param {Record<string,string>} languageNames code -> display name registry
 * @param {{warn?: (message: string) => void}} [options]
 */
export function buildManifest(scan, previous, languageNames, options = {}) {
  const warn = options.warn ?? (() => {})
  const editorial = new Map((previous.presets ?? []).map((entry) => [entry.id, entry]))
  const order = (previous.presets ?? []).map((entry) => entry.id)

  const built = new Map()

  for (const { id, file } of scan.flat) {
    built.set(id, { ...carryOver(id, editorial), file })
  }

  for (const { id, codes } of scan.multilingual) {
    const base = carryOver(id, editorial)
    const defaultLanguage = resolveDefault(id, codes, editorial.get(id)?.defaultLanguage, warn)
    built.set(id, {
      ...base,
      defaultLanguage,
      languages: orderLanguages(id, codes, defaultLanguage, languageNames),
    })
  }

  for (const id of order) {
    if (!built.has(id)) warn(`dropped "${id}": its payload is no longer in the preset directory`)
  }

  // Existing entries keep the order a human put them in; anything new lands at the
  // end, where it is easy to spot and move.
  const known = order.filter((id) => built.has(id))
  const added = [...built.keys()].filter((id) => !order.includes(id)).sort()
  for (const id of added) warn(`added "${id}": give it a real name, description and keywords`)

  return { presets: [...known, ...added].map((id) => reorderFields(built.get(id))) }
}

function carryOver(id, editorial) {
  const previous = editorial.get(id)
  if (!previous) {
    return { id, name: titleCase(id) }
  }
  const entry = { id, name: previous.name }
  if (previous.description !== undefined) entry.description = previous.description
  if (previous.keywords !== undefined) entry.keywords = previous.keywords
  return entry
}

function resolveDefault(id, codes, previous, warn) {
  if (previous !== undefined && codes.includes(previous)) return previous
  if (previous !== undefined) {
    warn(`"${id}": defaultLanguage "${previous}" is no longer on disk`)
  }
  const fallback = codes.includes('en') ? 'en' : [...codes].sort()[0]
  if (previous === undefined) {
    warn(`"${id}": no defaultLanguage set, using "${fallback}"`)
  }
  return fallback
}

/** Default first — it is what the dropdown loads — then the rest by display name. */
function orderLanguages(id, codes, defaultLanguage, languageNames) {
  const entries = codes.map((code) => {
    const name = languageNames[code]
    if (!name) {
      throw new Error(
        `${id}/${code}.json: no display name for "${code}" in scripts/data/language-names.json — run \`npm run generate:presets\` to add it`,
      )
    }
    return { code, name, file: `${id}/${code}.json` }
  })

  return entries.sort((a, b) => {
    if (a.code === defaultLanguage) return -1
    if (b.code === defaultLanguage) return 1
    return a.name.localeCompare(b.name, 'en')
  })
}

/** One field order for every entry, so a regeneration never churns the diff. */
function reorderFields(entry) {
  const out = { id: entry.id, name: entry.name }
  if (entry.file !== undefined) out.file = entry.file
  if (entry.defaultLanguage !== undefined) out.defaultLanguage = entry.defaultLanguage
  if (entry.languages !== undefined) out.languages = entry.languages
  if (entry.description !== undefined) out.description = entry.description
  if (entry.keywords !== undefined) out.keywords = entry.keywords
  return out
}

function titleCase(id) {
  return id.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}
