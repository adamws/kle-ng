import type { Key } from '@/stores/keyboard'
import LZString from 'lz-string'

export interface QmkLayoutInfo {
  index: number
  name: string
}

const membershipPattern = /^\d+(;\d+)*$/

function hasMembershipTag(label: string | null | undefined): boolean {
  return typeof label === 'string' && label !== '' && membershipPattern.test(label)
}

/**
 * Returns layout info (index + name) for a QMK multi-layout keyboard, or null
 * if the keyboard has no labels[9] membership tags or only one layout.
 *
 * Layout names are read from the compressed _kleng_qmk_data stored in metadata.
 */
export function getQmkLayouts(keys: Key[], meta: Record<string, unknown>): QmkLayoutInfo[] | null {
  if (!keys.some((k) => hasMembershipTag(k.labels[9]))) return null

  const storedRaw = meta._kleng_qmk_data
  if (typeof storedRaw !== 'string') return null

  try {
    const decompressed = LZString.decompressFromBase64(storedRaw)
    if (!decompressed) return null
    const stored = JSON.parse(decompressed) as { layouts?: Record<string, unknown> }
    if (!stored.layouts) return null
    const names = Object.keys(stored.layouts)
    if (names.length < 2) return null
    return names.map((name, index) => ({ index, name }))
  } catch {
    return null
  }
}

/**
 * Returns the subset of keys that belong to a specific QMK layout index.
 * Shared keys (labels[9] empty or absent) are always included.
 * Layout-specific keys are included when their semicolon-separated index list
 * contains `layoutIndex`.
 */
export function collapseToQmkLayout(keys: Key[], layoutIndex: number): Key[] {
  return keys.filter((key) => {
    const tag = key.labels[9]
    if (!tag || tag.trim() === '') return true // shared key
    return tag
      .split(';')
      .map((s) => parseInt(s.trim(), 10))
      .includes(layoutIndex)
  })
}
