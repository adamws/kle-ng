import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve, basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Serial } from '@adamws/kle-serial'
import type { Key } from '../src/stores/keyboard'

const ROOT = resolve(fileURLToPath(import.meta.url), '../..')
const BENCH_FIXTURES = join(ROOT, 'bench/fixtures')

/** bench/fixtures/reference/ — loaded for research use, not by the harness. */
export const REFERENCE_DIR = join(BENCH_FIXTURES, 'reference')

export interface LayoutEntry {
  name: string
  keys: Key[]
}

function tryLoadKle(filePath: string): Key[] | null {
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'))
    if (!raw || (typeof raw === 'object' && !Array.isArray(raw) && Object.keys(raw).length === 0)) {
      return null
    }
    return Serial.deserialize(raw).keys as Key[]
  } catch {
    return null
  }
}

export function loadCorpus(filter?: string[]): LayoutEntry[] {
  const entries: LayoutEntry[] = []

  let files: string[]
  try {
    files = readdirSync(BENCH_FIXTURES)
      .filter((f) => {
        if (extname(f) !== '.json') return false
        // exclude subdirectory entries (e.g. 'reference' shows up as a name without ext, but guard anyway)
        try { return statSync(join(BENCH_FIXTURES, f)).isFile() } catch { return false }
      })
      .sort()
  } catch {
    return entries
  }

  for (const file of files) {
    const name = basename(file, '.json')
    if (filter && !filter.includes(name)) continue
    const keys = tryLoadKle(join(BENCH_FIXTURES, file))
    if (keys === null) {
      console.warn(`Skipping ${name}: fixture not yet provided (placeholder).`)
      continue
    }
    entries.push({ name, keys })
  }

  return entries
}

export { tryLoadKle as loadKle }
