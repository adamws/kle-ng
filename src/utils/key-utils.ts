import type { Key } from '@/stores/keyboard'

export function isIsoEnter(key: Key): boolean {
  return (
    key.width === 1.25 &&
    key.height === 2 &&
    key.width2 === 1.5 &&
    key.height2 === 1 &&
    key.x2 === -0.25 &&
    key.y2 === 0
  )
}

export function isBigAssEnter(key: Key): boolean {
  return (
    key.width === 1.5 &&
    key.height === 2 &&
    key.width2 === 2.25 &&
    key.height2 === 1 &&
    key.x2 === -0.75 &&
    key.y2 === 1
  )
}

export function isNonRectangular(key: Key): boolean {
  return (
    key.width !== (key.width2 || key.width) ||
    key.height !== (key.height2 || key.height) ||
    (key.x2 !== undefined && key.x2 !== 0) ||
    (key.y2 !== undefined && key.y2 !== 0)
  )
}

/** Height (or width) the lower step of an automatically stepped key takes, in U */
const AUTO_STEP_SIZE = 0.5

/**
 * A stepped key whose secondary rect is the whole cap and the primary rect the
 * raised part sharing its top-left corner — the shape `applyStep` produces
 * (e.g. stepped Caps Lock: width 1.25, width2 1.75).
 */
export function isPureStep(key: Key): boolean {
  const width2 = key.width2 || key.width
  const height2 = key.height2 || key.height
  return (
    !!key.stepped &&
    isNonRectangular(key) &&
    !key.x2 &&
    !key.y2 &&
    width2 >= key.width &&
    height2 >= key.height
  )
}

/**
 * Mark a key stepped. A rectangular key larger than 1U is split the way KLE
 * expects: the current size becomes the whole cap (width2/height2) and the primary
 * rect shrinks to the raised part, so the lower step shows immediately and the
 * switch moves to the raised part's center. Keys that already have a secondary
 * shape keep it.
 */
export function applyStep(key: Key): void {
  key.stepped = true
  if (isNonRectangular(key) || key.sm === 'rot_ec11') return

  const width = key.width
  const height = key.height
  if (width > 1) {
    key.width = Math.max(1, width - AUTO_STEP_SIZE)
  } else if (height > 1) {
    key.height = Math.max(1, height - AUTO_STEP_SIZE)
  } else {
    return
  }
  key.width2 = width
  key.height2 = height
  key.x2 = 0
  key.y2 = 0
}

/**
 * Clear the stepped flag. A pure step (see `isPureStep`) returns to the full-size
 * rectangle it covers; other shapes (ISO Enter and the like) keep their geometry.
 */
export function removeStep(key: Key): void {
  if (isPureStep(key)) {
    key.width = key.width2 || key.width
    key.height = key.height2 || key.height
  }
  key.stepped = false
}
