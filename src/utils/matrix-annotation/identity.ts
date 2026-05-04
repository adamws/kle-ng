import type { Key } from '@/stores/keyboard'
import type { AnnotationAlgorithm, AnnotationResult } from './types'

/**
 * Stub algorithm that assigns row=sequentialIndex, col=0 to every regular key.
 * Produces a tall-thin single-column matrix — always disqualified on the matrix-size
 * criterion. Exists only to exercise the harness's multi-algorithm code path.
 */
export const identityAnnotationAlgorithm: AnnotationAlgorithm = {
  name: 'identity',
  description:
    'Stub algorithm — assigns row=keyIndex, col=0. Always loses on compactness. ' +
    'Used only to verify the benchmark harness handles multiple algorithms correctly.',

  annotate(keys: ReadonlyArray<Key>): AnnotationResult {
    let regularIdx = 0
    const assignments = keys.map((key) => {
      if (key.ghost || key.decal) return null
      return { row: regularIdx++, col: 0 }
    })
    return { assignments, status: 'success', warnings: [] }
  },
}
