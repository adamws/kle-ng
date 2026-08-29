import type { Key } from '@/stores/keyboard'
import { clusterAnnotationAlgorithm } from '@/utils/matrix-annotation'

const matrixLabelPattern = /^(\d+),(\d+)$/

function isRegular(key: Key): boolean {
  return !key.ghost && !key.decal
}

function parseMatrixLabel(key: Key): { row: number; col: number } | null {
  const label = key.labels[0]
  if (typeof label !== 'string') return null
  const m = matrixLabelPattern.exec(label.trim())
  if (!m) return null
  return { row: parseInt(m[1]!, 10), col: parseInt(m[2]!, 10) }
}

/**
 * Compute a stable row-major reading order for a layout's regular (non-ghost,
 * non-decal) keys, for formats whose array index *is* the key identity — no
 * separate id/matrix field to key off of (e.g. keymap-drawer's physical layout,
 * where `layers`/`combos.key_positions` reference keys purely by position).
 *
 * Prefers a full, unique labels[0] "row,col" annotation when present, so a
 * user's deliberate matrix labeling wins over a geometric guess. Otherwise
 * falls back to `clusterAnnotationAlgorithm`, which buckets keys into rows by
 * world (or de-rotated, when that produces a more compact matrix) center and
 * sorts each row by x — this recovers a sane order even when keys were placed
 * non-linearly, e.g. a split board's right half added before the left half is
 * finished, or thumb keys added out of sequence.
 */
export function computeReadingOrder(keys: Key[]): Key[] {
  const regular = keys.filter(isRegular)
  if (regular.length === 0) return []

  const labeled = regular.map((key) => ({ key, pos: parseMatrixLabel(key) }))
  const seen = new Set<string>()
  const fullyLabeled = labeled.every(({ pos }) => {
    if (!pos) return false
    const id = `${pos.row},${pos.col}`
    if (seen.has(id)) return false
    seen.add(id)
    return true
  })

  if (fullyLabeled) {
    return labeled
      .slice()
      .sort((a, b) =>
        a.pos!.row !== b.pos!.row ? a.pos!.row - b.pos!.row : a.pos!.col - b.pos!.col,
      )
      .map(({ key }) => key)
  }

  const result = clusterAnnotationAlgorithm.annotate(regular)
  return regular
    .map((key, i) => {
      const a = result.assignments[i]
      // Defensive only: clusterAnnotationAlgorithm never drops a regular key.
      const row = a?.row ?? Math.round(key.y)
      const col = a?.col ?? Math.round(key.x)
      return { key, row, col }
    })
    .sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col))
    .map(({ key }) => key)
}
