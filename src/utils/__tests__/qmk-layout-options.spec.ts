import { describe, it, expect } from 'vitest'
import { Key } from '@adamws/kle-serial'
import LZString from 'lz-string'
import { getQmkLayouts, collapseToQmkLayout } from '../qmk-layout-options'

function makeKey(matrixPos: string, membership?: string): Key {
  const key = new Key()
  key.labels[0] = matrixPos
  if (membership !== undefined) key.labels[9] = membership
  return key
}

function makeMeta(layoutNames: string[]): Record<string, unknown> {
  const stored = { layouts: Object.fromEntries(layoutNames.map((n) => [n, {}])) }
  return { _kleng_qmk_data: LZString.compressToBase64(JSON.stringify(stored)) }
}

describe('getQmkLayouts', () => {
  it('returns null when no key has a membership tag', () => {
    const keys = [makeKey('0,0'), makeKey('0,1')]
    expect(getQmkLayouts(keys, makeMeta(['LAYOUT_a', 'LAYOUT_b']))).toBeNull()
  })

  it('returns null when only one layout is stored', () => {
    const keys = [makeKey('0,0', '0')]
    expect(getQmkLayouts(keys, makeMeta(['LAYOUT_only']))).toBeNull()
  })

  it('returns null when _kleng_qmk_data is absent', () => {
    const keys = [makeKey('0,0', '0')]
    expect(getQmkLayouts(keys, {})).toBeNull()
  })

  it('returns layout info for a 2-layout keyboard', () => {
    const keys = [makeKey('0,0', ''), makeKey('0,1', '0'), makeKey('0,1', '1')]
    const result = getQmkLayouts(keys, makeMeta(['LAYOUT_ansi', 'LAYOUT_iso']))
    expect(result).toHaveLength(2)
    expect(result![0]).toEqual({ index: 0, name: 'LAYOUT_ansi' })
    expect(result![1]).toEqual({ index: 1, name: 'LAYOUT_iso' })
  })

  it('returns layout info for a 3-layout keyboard', () => {
    const keys = [makeKey('0,0', '1;2')]
    const result = getQmkLayouts(keys, makeMeta(['LAYOUT_base', 'LAYOUT_split', 'LAYOUT_all']))
    expect(result).toHaveLength(3)
    expect(result![2]).toEqual({ index: 2, name: 'LAYOUT_all' })
  })
})

describe('collapseToQmkLayout', () => {
  it('includes shared keys (empty labels[9]) in every layout', () => {
    const shared = makeKey('0,0', '')
    const specific = makeKey('0,1', '1')
    expect(collapseToQmkLayout([shared, specific], 0)).toContain(shared)
    expect(collapseToQmkLayout([shared, specific], 0)).not.toContain(specific)
  })

  it('includes keys whose tag contains the requested index', () => {
    const k0 = makeKey('0,1', '0')
    const k12 = makeKey('0,1', '1;2')
    expect(collapseToQmkLayout([k0, k12], 0)).toContain(k0)
    expect(collapseToQmkLayout([k0, k12], 0)).not.toContain(k12)
    expect(collapseToQmkLayout([k0, k12], 1)).toContain(k12)
    expect(collapseToQmkLayout([k0, k12], 2)).toContain(k12)
  })

  it('treats absent labels[9] the same as empty (shared)', () => {
    const key = makeKey('0,0') // no labels[9] set
    expect(collapseToQmkLayout([key], 0)).toContain(key)
    expect(collapseToQmkLayout([key], 5)).toContain(key)
  })

  it('correctly filters a 3-layout scenario', () => {
    const shared = makeKey('0,0', '')
    const wide = makeKey('0,1', '0') // only in layout 0
    const narrow = makeKey('0,1', '1;2') // in layouts 1 and 2
    const extra = makeKey('0,2', '2') // only in layout 2

    const layout0 = collapseToQmkLayout([shared, wide, narrow, extra], 0)
    expect(layout0).toEqual([shared, wide])

    const layout1 = collapseToQmkLayout([shared, wide, narrow, extra], 1)
    expect(layout1).toEqual([shared, narrow])

    const layout2 = collapseToQmkLayout([shared, wide, narrow, extra], 2)
    expect(layout2).toEqual([shared, narrow, extra])
  })
})
