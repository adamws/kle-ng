import type { Key } from '@/stores/keyboard'
import { getKeyCenter } from '@/utils/keyboard-geometry'
import {
  splitLayoutByRotation,
  deRotateLayoutGroups,
  restoreOriginalRotation,
} from '@/utils/matrix-utils'
import { computeRowsAndCols } from './build-matrix'
import type { AnnotationAlgorithm, AnnotationResult, AnnotationWarning, RowColAssignment } from './types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRegular(key: Key): boolean {
  return !key.ghost && !key.decal
}

function shouldUseRotationAware(regularKeys: Key[]): boolean {
  const groups = splitLayoutByRotation(regularKeys)
  return groups.some((g) => Math.abs(g.rotationAngle) > 1e-6 && g.keys.length >= 2)
}

function checkForDuplicates(matrixMap: Map<string, Key[]>): {
  hasDuplicates: boolean
  duplicates: { position: string; keys: Key[] }[]
} {
  const duplicates: { position: string; keys: Key[] }[] = []
  let hasDuplicates = false
  matrixMap.forEach((keys, position) => {
    if (keys.length > 1) {
      hasDuplicates = true
      duplicates.push({ position, keys })
    }
  })
  return { hasDuplicates, duplicates }
}

function runAnnotationRound(keys: Key[]): {
  matrixMap: Map<string, Key[]>
  hasDuplicates: boolean
  duplicates: { position: string; keys: Key[] }[]
} {
  const matrixMap = new Map<string, Key[]>()
  keys.forEach((key) => {
    if (!isRegular(key)) return
    const center = getKeyCenter(key)
    const row = Math.round(center.y)
    const col = Math.round(center.x)
    const k = `${row},${col}`
    if (!matrixMap.has(k)) matrixMap.set(k, [])
    matrixMap.get(k)!.push(key)
  })
  return { matrixMap, ...checkForDuplicates(matrixMap) }
}

function deduplicateMap(matrixMap: Map<string, Key[]>): Map<string, Key[]> {
  const clean = new Map<string, Key[]>()
  matrixMap.forEach((keys, pos) => {
    const first = keys[0]
    if (first) clean.set(pos, [first])
  })
  return clean
}

// ---------------------------------------------------------------------------
// Assignment builder
// ---------------------------------------------------------------------------

function buildAssignments(
  allKeys: ReadonlyArray<Key>,
  clones: Key[],
  cloneMap: Map<string, Key[]>,
): (RowColAssignment | null)[] {
  const { rows, cols } = computeRowsAndCols(cloneMap)

  // Build clone-object → original-index lookup
  const cloneToOrigIdx = new Map<Key, number>()
  clones.forEach((ck, i) => cloneToOrigIdx.set(ck, i))

  // Initialize: null for ghost/decal, {row:null, col:null} for regular keys
  const assignments: (RowColAssignment | null)[] = allKeys.map((k) =>
    isRegular(k) ? { row: null, col: null } : null,
  )

  rows.forEach((row) => {
    row.keySequence.forEach((ck) => {
      const origIdx = cloneToOrigIdx.get(ck)
      if (origIdx !== undefined) {
        const a = assignments[origIdx]
        if (a) a.row = row.index
      }
    })
  })

  cols.forEach((col) => {
    col.keySequence.forEach((ck) => {
      const origIdx = cloneToOrigIdx.get(ck)
      if (origIdx !== undefined) {
        const a = assignments[origIdx]
        if (a) a.col = col.index
      }
    })
  })

  return assignments
}

// ---------------------------------------------------------------------------
// Status helper
// ---------------------------------------------------------------------------

function computeStatus(
  allKeys: ReadonlyArray<Key>,
  assignments: (RowColAssignment | null)[],
): 'success' | 'partial' {
  const anyUnassigned = allKeys.some((k, i) => {
    if (!isRegular(k)) return false
    const a = assignments[i]
    return !a || a.row === null || a.col === null
  })
  return anyUnassigned ? 'partial' : 'success'
}

// ---------------------------------------------------------------------------
// Algorithm
// ---------------------------------------------------------------------------

export const currentAnnotationAlgorithm: AnnotationAlgorithm = {
  name: 'current',
  description:
    'Rotation-aware Math.round algorithm — the current production implementation. ' +
    'Splits keys by rotation group, de-rotates each group, then assigns row/col via ' +
    'Math.round(center.y/x). Falls back to the non-aware path when de-rotation ' +
    'produces duplicates.',

  annotate(keys: ReadonlyArray<Key>): AnnotationResult {
    const warnings: AnnotationWarning[] = []

    // Work on deep clones so we never mutate the caller's keys.
    const clones = structuredClone(keys as Key[])
    // Map clone → original Key so the adapter can build display-ready duplicates.
    const cloneToOrig = new Map<Key, Key>(clones.map((ck, i) => [ck, keys[i]!]))
    const regularClones = clones.filter(isRegular)

    let finalMap: Map<string, Key[]>
    // Duplicate info for the modal's warning panel, using original key references.
    let displayDuplicates: { position: string; keys: Key[] }[] | undefined

    if (shouldUseRotationAware(regularClones)) {
      const groups = splitLayoutByRotation(regularClones)
      const deRotated = deRotateLayoutGroups(groups)

      const { matrixMap: deRotatedMap, hasDuplicates: deRotatedDups } =
        runAnnotationRound(deRotated)

      if (deRotatedDups) {
        // De-rotated approach produced duplicates — restore and fall back.
        restoreOriginalRotation(deRotated)
        warnings.push({
          kind: 'fallback',
          message:
            'Rotation-aware annotation produced duplicates; falling back to unrotated layout.',
        })

        const {
          matrixMap: origMap,
          hasDuplicates: origDups,
          duplicates,
        } = runAnnotationRound(regularClones)

        if (origDups) {
          displayDuplicates = duplicates.map((d) => ({
            position: d.position,
            keys: d.keys.map((ck) => cloneToOrig.get(ck) ?? ck),
          }))
          warnings.push({
            kind: 'duplicate',
            message: `${duplicates.length} position(s) with duplicate keys; keeping first at each position.`,
          })
          finalMap = deduplicateMap(origMap)
        } else {
          finalMap = origMap
        }
      } else {
        // De-rotated worked; restore rotation on clones (annotations stay in the map).
        restoreOriginalRotation(deRotated)
        finalMap = deRotatedMap
      }
    } else {
      const { matrixMap, hasDuplicates, duplicates } = runAnnotationRound(regularClones)

      if (hasDuplicates) {
        // Silent deduplication — matches existing non-rotation-aware behavior.
        warnings.push({
          kind: 'fallback',
          message: `${duplicates.length} position(s) with duplicate keys; keeping first at each position.`,
        })
        finalMap = deduplicateMap(matrixMap)
      } else {
        finalMap = matrixMap
      }
    }

    const assignments = buildAssignments(keys, clones, finalMap)
    const status = computeStatus(keys, assignments)

    return {
      assignments,
      status,
      warnings,
      ...(displayDuplicates ? { meta: { displayDuplicates } } : {}),
    }
  },
}
