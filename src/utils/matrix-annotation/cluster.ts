import type { Key } from '@/stores/keyboard'
import { getKeyCenter } from '@/utils/keyboard-geometry'
import { splitLayoutByRotation } from '@/utils/matrix-utils'
import type {
  AnnotationAlgorithm,
  AnnotationResult,
  AnnotationWarning,
  RowColAssignment,
} from './types'

function isRegular(key: Key): boolean {
  return !key.ghost && !key.decal
}

function shouldUseRotationAware(regularKeys: Key[]): boolean {
  const groups = splitLayoutByRotation(regularKeys)
  return groups.some((g) => Math.abs(g.rotationAngle) > 1e-6 && g.keys.length >= 2)
}

function denseReindex<T>(map: Map<T, number>): Map<T, number> {
  const sorted = [...new Set(map.values())].sort((a, b) => a - b)
  const remap = new Map<number, number>()
  sorted.forEach((v, i) => remap.set(v, i))
  const out = new Map<T, number>()
  map.forEach((v, k) => out.set(k, remap.get(v)!))
  return out
}

interface VariantResult {
  cloneToRow: Map<Key, number>
  cloneToCol: Map<Key, number>
  collisions: number
  numRows: number
  numCols: number
  matrixMax: number
  matrixSum: number
  wireLength: number
}

/**
 * Round each de-rotated center to (row, col), bucket into rows, then per-row
 * shift any duplicates to the next free column slot. Returns dense (row, col)
 * maps along with a few summary metrics used to compare variants.
 */
function annotateVariant(regularClones: Key[]): VariantResult {
  const cloneToRow = new Map<Key, number>()
  const cloneToTentativeCol = new Map<Key, number>()
  const rowToKeys = new Map<number, Key[]>()
  const cloneToCenter = new Map<Key, { x: number; y: number }>()

  regularClones.forEach((k) => {
    const c = getKeyCenter(k)
    cloneToCenter.set(k, c)
    const r = Math.round(c.y)
    const co = Math.round(c.x)
    cloneToRow.set(k, r)
    cloneToTentativeCol.set(k, co)
    if (!rowToKeys.has(r)) rowToKeys.set(r, [])
    rowToKeys.get(r)!.push(k)
  })

  const cloneToFinalCol = new Map<Key, number>()
  let collisions = 0
  rowToKeys.forEach((rowKeys) => {
    const sorted = rowKeys.slice().sort((a, b) => {
      const ca = cloneToTentativeCol.get(a)!
      const cb = cloneToTentativeCol.get(b)!
      if (ca !== cb) return ca - cb
      return cloneToCenter.get(a)!.x - cloneToCenter.get(b)!.x
    })
    const used = new Set<number>()
    sorted.forEach((k) => {
      let c = cloneToTentativeCol.get(k)!
      if (used.has(c)) {
        collisions++
        while (used.has(c)) c++
      }
      used.add(c)
      cloneToFinalCol.set(k, c)
    })
  })

  const denseRow = denseReindex(cloneToRow)
  const denseCol = denseReindex(cloneToFinalCol)

  const numRows = new Set(denseRow.values()).size
  const numCols = new Set(denseCol.values()).size
  const matrixMax = Math.max(numRows, numCols)
  const matrixSum = numRows + numCols

  // Approximate wire length to break ties between variants. We sum within-row
  // (sorted by world X) and within-col (sorted by world Y) gaps.
  const byRow = new Map<number, Key[]>()
  const byCol = new Map<number, Key[]>()
  regularClones.forEach((k) => {
    const r = denseRow.get(k)!
    const c = denseCol.get(k)!
    if (!byRow.has(r)) byRow.set(r, [])
    if (!byCol.has(c)) byCol.set(c, [])
    byRow.get(r)!.push(k)
    byCol.get(c)!.push(k)
  })
  let wireLength = 0
  const dist = (a: Key, b: Key) => {
    const ca = cloneToCenter.get(a)!
    const cb = cloneToCenter.get(b)!
    return Math.hypot(ca.x - cb.x, ca.y - cb.y)
  }
  byRow.forEach((list) => {
    list.sort((a, b) => cloneToCenter.get(a)!.x - cloneToCenter.get(b)!.x)
    for (let i = 1; i < list.length; i++) wireLength += dist(list[i - 1]!, list[i]!)
  })
  byCol.forEach((list) => {
    list.sort((a, b) => cloneToCenter.get(a)!.y - cloneToCenter.get(b)!.y)
    for (let i = 1; i < list.length; i++) wireLength += dist(list[i - 1]!, list[i]!)
  })

  return {
    cloneToRow: denseRow,
    cloneToCol: denseCol,
    collisions,
    numRows,
    numCols,
    matrixMax,
    matrixSum,
    wireLength,
  }
}

/**
 * Lower is better. Encodes the bench scoring priority: matrixMax dominates,
 * matrixSum tie-breaks, wireLength tie-breaks at the finest level.
 */
function variantScore(v: VariantResult): [number, number, number] {
  return [v.matrixMax, v.matrixSum, v.wireLength]
}

function variantBetter(a: VariantResult, b: VariantResult): boolean {
  const sa = variantScore(a)
  const sb = variantScore(b)
  for (let i = 0; i < sa.length; i++) {
    if (sa[i]! < sb[i]!) return true
    if (sa[i]! > sb[i]!) return false
  }
  return false
}

export const clusterAnnotationAlgorithm: AnnotationAlgorithm = {
  name: 'cluster',
  description:
    'Round to (row, col) on world centers, with per-row collision shifting (no key ' +
    'is ever dropped). When the layout has rotation groups of 2+ keys, also evaluates a ' +
    'de-rotated variant and picks whichever produces the more compact matrix (matrixMax, ' +
    'then matrixSum, then wire length).',

  annotate(keys: ReadonlyArray<Key>): AnnotationResult {
    const warnings: AnnotationWarning[] = []
    const assignments: (RowColAssignment | null)[] = keys.map((k) =>
      isRegular(k) ? { row: null, col: null } : null,
    )

    const clonesA = structuredClone(keys as Key[])
    const cloneToOrigA = new Map<Key, number>()
    clonesA.forEach((c, i) => cloneToOrigA.set(c, i))
    const regularA = clonesA.filter(isRegular)
    if (regularA.length === 0) {
      return { assignments, status: 'success', warnings }
    }

    // Variant A: world centers (no de-rotation).
    const variantA = annotateVariant(regularA)
    let chosen: {
      variant: VariantResult
      cloneToOrig: Map<Key, number>
      regular: Key[]
      label: string
    } = {
      variant: variantA,
      cloneToOrig: cloneToOrigA,
      regular: regularA,
      label: 'world',
    }

    // Variant B: de-rotated centers, only if there's meaningful rotation.
    if (shouldUseRotationAware(regularA)) {
      const clonesB = structuredClone(keys as Key[])
      const cloneToOrigB = new Map<Key, number>()
      clonesB.forEach((c, i) => cloneToOrigB.set(c, i))
      const regularB = clonesB.filter(isRegular)
      const groups = splitLayoutByRotation(regularB)
      // Zero out rotation_angle directly on clones (no label side-channel needed).
      // Note: this only zeros the angle — x/y/rotation_x/rotation_y are unchanged,
      // so centers are approximate for keys rotated around a pivot (pre-existing behaviour).
      groups.forEach((g) => {
        if (Math.abs(g.rotationAngle) > 1e-6) {
          g.keys.forEach((k) => {
            k.rotation_angle = 0
          })
        }
      })
      const variantB = annotateVariant(regularB)

      if (variantBetter(variantB, variantA)) {
        chosen = {
          variant: variantB,
          cloneToOrig: cloneToOrigB,
          regular: regularB,
          label: 'de-rotated',
        }
      }
    }

    chosen.regular.forEach((k) => {
      const origIdx = chosen.cloneToOrig.get(k)
      if (origIdx === undefined) return
      const a = assignments[origIdx]
      if (!a) return
      a.row = chosen.variant.cloneToRow.get(k)!
      a.col = chosen.variant.cloneToCol.get(k)!
    })

    if (chosen.variant.collisions > 0) {
      warnings.push({
        kind: 'algorithm-specific',
        message: `Resolved ${chosen.variant.collisions} per-row column collision(s) by shifting to next free slot.`,
      })
    }

    return { assignments, status: 'success', warnings, meta: { variant: chosen.label } }
  },
}
