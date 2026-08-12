/**
 * Wire segment resolution for matrix annotation drawing.
 * Decides which keys a segment between two keys covers, and splits them into
 * keys that may be added and keys that would violate matrix rules.
 *
 * Store access is injected as predicates so this stays pure and testable.
 */

import { findKeysAlongLine } from './line-intersection'
import { getKeyCenter } from './keyboard-geometry'
import type { Key } from '@/stores/keyboard'

export interface SegmentKeysOptions {
  /** Last key already committed to the sequence (segment origin) */
  lastKey: Key
  /** Key under the cursor / just clicked (segment destination) */
  targetKey: Key
  allKeys: Key[]
  sensitivity: number
  /** true = point-to-point, skip everything between lastKey and targetKey */
  direct: boolean
  isInSequence: (key: Key) => boolean
  canAdd: (key: Key) => boolean
  /**
   * Called as each key is accepted, before the next candidate is validated.
   * Lets the commit path add keys to the sequence incrementally so `canAdd`
   * sees the keys accepted earlier in this same segment (the duplicate-position
   * checks in the drawing store compare against the current sequence).
   * Omitted by the preview path, which must not mutate any state.
   */
  onAccept?: (key: Key) => void
}

export interface SegmentKeys {
  /** Keys that may be added, in traversal order */
  legalKeys: Key[]
  /** Keys the segment covers but that would violate matrix rules */
  illegalKeys: Key[]
}

/**
 * Resolve which keys a wire segment from `lastKey` to `targetKey` covers.
 * In direct mode only `targetKey` is considered; otherwise the line sweep
 * collects every key the segment passes over.
 *
 * @example
 * const { legalKeys } = computeSegmentKeys({
 *   lastKey, targetKey, allKeys: keys, sensitivity: 0.3, direct: true,
 *   isInSequence: () => false, canAdd: () => true,
 * }) // legalKeys === [targetKey] - intermediate keys skipped
 */
export function computeSegmentKeys(options: SegmentKeysOptions): SegmentKeys {
  const { lastKey, targetKey, allKeys, sensitivity, direct, isInSequence, canAdd, onAccept } =
    options

  const candidates: Key[] = direct
    ? [targetKey]
    : findKeysAlongLine(getKeyCenter(lastKey), getKeyCenter(targetKey), allKeys, sensitivity)

  // The segment always terminates at the target key, even when the sweep
  // misses it (possible at high sensitivity with wide or offset keys).
  if (!candidates.includes(targetKey)) candidates.push(targetKey)

  const legalKeys: Key[] = []
  const illegalKeys: Key[] = []

  for (const key of candidates) {
    if (isInSequence(key)) continue
    if (canAdd(key)) {
      legalKeys.push(key)
      onAccept?.(key)
    } else {
      illegalKeys.push(key)
    }
  }

  return { legalKeys, illegalKeys }
}
