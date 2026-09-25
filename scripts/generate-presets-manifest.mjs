#!/usr/bin/env node
// Regenerates src/data/presets.json from what is on disk in public/data/presets.
//
// The manifest is half data, half prose: `id`, `file` and `languages` describe the
// directory and are rewritten every run, while `name`, `description`, `keywords`,
// `defaultLanguage` and the entry order are hand-authored and carried over
// untouched. Add a payload, run this, then edit the prose for anything new.
//
// Language display names are resolved HERE rather than in the browser and cached in
// scripts/data/language-names.json. Intl.DisplayNames output varies with the host's
// ICU data, so deriving them at runtime would mean different users reading different
// dropdowns; baking them into a committed file also puts every new name in front of a
// reviewer in the diff.
//
// Usage: node scripts/generate-presets-manifest.mjs [--check]
//   --check  build in memory and exit 1 if the committed manifest is stale

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import * as prettier from 'prettier'
import { buildManifest, scanPresetDir } from './lib/presets-manifest.mjs'

const presetDir = fileURLToPath(new URL('../public/data/presets', import.meta.url))
const manifestPath = fileURLToPath(new URL('../src/data/presets.json', import.meta.url))
const namesPath = fileURLToPath(new URL('./data/language-names.json', import.meta.url))

const check = process.argv.includes('--check')

const previous = JSON.parse(readFileSync(manifestPath, 'utf-8'))
const languageNames = JSON.parse(readFileSync(namesPath, 'utf-8'))
const scan = scanPresetDir(presetDir)

// Fill in any code the registry has not seen yet, then persist it so the name lands
// in the diff. A tag Intl cannot name is a hard failure: a dropdown entry reading
// "ZZ" is worse than a build that stops and tells you which file to look at.
const displayNames = new Intl.DisplayNames(['en'], { type: 'language' })
const discovered = []
for (const { id, codes } of scan.multilingual) {
  for (const code of codes) {
    if (languageNames[code]) continue
    const name = displayNames.of(code)
    if (!name || name === code) {
      console.error(
        `error: cannot resolve a display name for "${code}" (${id}/${code}.json).\n` +
          `       Add it to scripts/data/language-names.json by hand, or check that this\n` +
          `       Node build has full ICU data.`,
      )
      process.exit(1)
    }
    languageNames[code] = name
    discovered.push(`${code} → ${name}`)
  }
}

const warnings = []
const manifest = buildManifest(scan, previous, languageNames, {
  warn: (message) => warnings.push(message),
})

// Formatted with the repo's own Prettier config rather than bare JSON.stringify:
// src/ is covered by `npm run format`, so anything else here would leave the
// generator and the formatter permanently undoing each other.
const serialized = await format(JSON.stringify(manifest), manifestPath)
const stale = serialized !== readFileSync(manifestPath, 'utf-8')

if (check) {
  if (stale) {
    console.error('error: src/data/presets.json is stale — run `npm run generate:presets`')
    process.exit(1)
  }
  console.log('src/data/presets.json is up to date')
  process.exit(0)
}

if (discovered.length) {
  writeFileSync(namesPath, JSON.stringify(sortKeys(languageNames), null, 2) + '\n')
}
writeFileSync(manifestPath, serialized)

const multilingual = manifest.presets.filter((entry) => entry.languages)
console.log(
  `${manifest.presets.length} presets ` +
    `(${multilingual.length} multilingual, ` +
    `${multilingual.reduce((n, e) => n + e.languages.length, 0)} language payloads)`,
)
for (const name of discovered) console.log(`  new language: ${name}`)
for (const warning of warnings) console.warn(`  warning: ${warning}`)
if (!stale && !discovered.length) console.log('  no changes')

async function format(source, filepath) {
  return prettier.format(source, { ...(await prettier.resolveConfig(filepath)), filepath })
}

// Prettier does not cover scripts/, so the registry is sorted here to keep it
// reviewable as it grows towards a hundred entries.
function sortKeys(object) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b, 'en')))
}
