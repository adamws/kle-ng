/**
 * Regression snapshot tests for the current annotation algorithm.
 *
 * On first run, Vitest writes a `.snap` file capturing the algorithm output.
 * Subsequent runs compare against that snapshot to detect unintended changes.
 *
 * To update: `npm run test:unit -- --update-snapshots`
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Serial } from '@adamws/kle-serial'
import { currentAnnotationAlgorithm } from '../current'
import type { Key } from '@/stores/keyboard'

const ROOT = resolve(fileURLToPath(import.meta.url), '../../../../..')
const PRESETS = join(ROOT, 'public/data/presets')

function loadPreset(name: string): Key[] {
  const raw = JSON.parse(readFileSync(join(PRESETS, name), 'utf8'))
  return Serial.deserialize(raw).keys as Key[]
}

/** Stable representation of an annotation result for snapshot comparison. */
function serializeAssignments(
  keys: ReadonlyArray<Key>,
  assignments: ReturnType<typeof currentAnnotationAlgorithm.annotate>['assignments'],
): Record<number, string | null> {
  const out: Record<number, string | null> = {}
  assignments.forEach((a, i) => {
    if (a === null) {
      out[i] = null
    } else {
      out[i] = a.row !== null && a.col !== null ? `${a.row},${a.col}` : `${a.row ?? '?'},${a.col ?? '?'}`
    }
  })
  return out
}

const PRESETS_TO_TEST = [
  'planck.json',
  'ortho-4-12-qmk.json',
  'default-60.json',
  'iso-60.json',
  'ansi-104.json',
  'ansi-104-big-ass-enter.json',
  'keychron-q1.json',
  'atreus.json',
  'symbolics-spacecadet.json',
  'ergodox.json',
  'kinesis-advantage.json',
  'absolem.json',
  'multilayout-60-via.json',
  'iso-105.json',
]

describe('currentAnnotationAlgorithm — preset snapshots', () => {
  for (const presetFile of PRESETS_TO_TEST) {
    it(`${presetFile}`, () => {
      const keys = loadPreset(presetFile)
      const result = currentAnnotationAlgorithm.annotate(keys)
      const snapshot = {
        status: result.status,
        warningKinds: result.warnings.map((w) => w.kind),
        assignments: serializeAssignments(keys, result.assignments),
      }
      expect(snapshot).toMatchSnapshot()
    })
  }
})
