import type { Key } from '@/stores/keyboard'
import { parseOptionChoice, validateMatrixDuplicates } from '@/utils/matrix-validation'
import { buildRowsColsFromResult } from './build-matrix'
import { clusterSymmetryAnnotationAlgorithm } from './cluster-symmetry'

const MANUAL_HINT =
  'Use Tools → Add Switch Matrix Coordinates to annotate the layout, ' +
  'or disable automatic annotation.'

/**
 * Write `row,col` matrix coordinates into labels[0] of every regular key,
 * using the same algorithm and re-indexing as the
 * **Add Switch Matrix Coordinates → Annotate Automatically** tool.
 *
 * Mutates `keys` in place, so callers pass a copy of the layout. Other labels
 * are kept, except a labels[8] value that is not a valid `option,choice`,
 * which the PCB backend would reject.
 *
 * @returns An error message when the result is not usable for a PCB, otherwise null.
 */
export function annotateMatrixAutomatically(keys: Key[]): string | null {
  const result = clusterSymmetryAnnotationAlgorithm.annotate(keys)
  const { rows, cols } = buildRowsColsFromResult(result, keys)

  const keyToRow = new Map<Key, number>()
  const keyToCol = new Map<Key, number>()
  rows.forEach((row) => row.keySequence.forEach((key) => keyToRow.set(key, row.index)))
  cols.forEach((col) => col.keySequence.forEach((key) => keyToCol.set(key, col.index)))

  let unassigned = 0
  keys.forEach((key) => {
    if (key.ghost || key.decal) return
    const row = keyToRow.get(key)
    const col = keyToCol.get(key)
    if (row === undefined || col === undefined) {
      unassigned++
      key.labels[0] = ''
    } else {
      key.labels[0] = `${row},${col}`
    }
    if (key.labels[8] && parseOptionChoice(key) === null) key.labels[8] = ''
  })

  if (unassigned > 0) {
    return (
      `Automatic annotation could not assign matrix coordinates to ${unassigned} ` +
      `key${unassigned === 1 ? '' : 's'}. ${MANUAL_HINT}`
    )
  }

  const duplicates = validateMatrixDuplicates(keys)
  if (!duplicates.isValid) {
    const positions = duplicates.duplicatesWithoutOption.map((d) => d.position).join(', ')
    return `Automatic annotation produced duplicate matrix positions (${positions}). ${MANUAL_HINT}`
  }

  return null
}
