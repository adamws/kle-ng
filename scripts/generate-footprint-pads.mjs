#!/usr/bin/env node
/**
 * Generates the pad geometry JSON used by the PCB generator track editor.
 *
 * Reads the footprints listed in public/data/footprints/footprints.txt (shared
 * with public/data/footprints/generate.sh, which makes the preview SVGs) and
 * writes public/data/footprints/pads/<name>.json with parseFootprintPads().
 * The output is committed: CI and Vercel have no KiCad libraries.
 *
 * Use the same libraries as the kle-ng-api worker (KiCad 9 with
 * keyswitch-kicad-library v2.4), so pads match what kbplacer places. Library
 * locations default to a local KiCad 9 install and can be overridden:
 *
 *   KICAD_LIB=/path/to/footprints KEYSWITCH_LIB=/path/to/keyswitch \
 *     node scripts/generate-footprint-pads.mjs [footprint names...]
 *
 * Needs Node 22.18+ (imports TypeScript with type stripping).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseFootprintPads } from '../src/utils/kicad/footprint-pads.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const footprintsDir = join(root, 'public/data/footprints')
const outDir = join(footprintsDir, 'pads')

const libs = {
  KICAD_LIB: process.env.KICAD_LIB ?? '/usr/share/kicad/footprints',
  KEYSWITCH_LIB:
    process.env.KEYSWITCH_LIB ??
    join(
      homedir(),
      '.local/share/kicad/9.0/3rdparty/footprints/com_github_perigoso_keyswitch-kicad-library',
    ),
}

const only = process.argv.slice(2)
const rows = readFileSync(join(footprintsDir, 'footprints.txt'), 'utf8')
  .split('\n')
  .map((line) => line.replace(/#.*/, '').trim())
  .filter(Boolean)
  .map((row) => {
    const [library, name] = row
      .replace(/\$(KICAD_LIB|KEYSWITCH_LIB)/g, (_, v) => libs[v])
      .split('|')
    return { library, name }
  })
  .filter(({ name }) => only.length === 0 || only.includes(name))

/** Rounds to 1 nm, which drops float noise from arc maths and keeps JSON short. */
const round = (_key, value) =>
  typeof value === 'number' ? Math.round(value * 1e6) / 1e6 || 0 : value

mkdirSync(outDir, { recursive: true })
let failed = 0
for (const { library, name } of rows) {
  try {
    const text = readFileSync(join(library, `${name}.kicad_mod`), 'utf8')
    const pads = parseFootprintPads(text)
    // KiCad 5 footprints carry the name unquoted, KiCad 9 ones quoted; use ours
    const out = { ...pads, footprint: name }
    writeFileSync(join(outDir, `${name}.json`), JSON.stringify(out, round, 2) + '\n')
    console.log(`${name}: ${pads.pads.length} pads`)
  } catch (err) {
    failed++
    console.error(`${name}: ${err instanceof Error ? err.message : err}`)
  }
}
if (failed) {
  console.error(`${failed} footprint(s) failed`)
  process.exit(1)
}
