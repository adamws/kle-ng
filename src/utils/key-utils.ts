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
