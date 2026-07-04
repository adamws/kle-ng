/**
 * Tests for layout-options utilities: getLayoutOptionGroups + collapseToLayoutChoices.
 *
 * Pre-flight note: no existing via-import.spec.ts fixture has labels[8] alt-layout keys,
 * so this file authors its own minimal inline fixture.
 */

import { describe, it, expect } from 'vitest'
import { Key } from '@adamws/kle-serial'
import {
  getLayoutOptionGroups,
  collapseToLayoutChoices,
  collapseViaLayout,
} from '../layout-options'
import { getDefaultLayoutKeys } from '../matrix-validation'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeKey(
  matrixLabel: string,
  optionChoice: string,
  x = 0,
  y = 0,
  opts: { ghost?: boolean; decal?: boolean } = {},
): Key {
  const key = new Key()
  key.labels[0] = matrixLabel
  key.labels[8] = optionChoice
  key.x = x
  key.y = y
  if (opts.ghost) key.ghost = true
  if (opts.decal) key.decal = true
  return key
}

/**
 * Minimal 5-key layout with one option group (option 0) and two choices:
 *   choice 0 — full backspace (1 key at x=14, y=0)
 *   choice 1 — split backspace (2 keys at x=13,y=0 and x=14,y=0)
 * Base keys: 3 normal keys
 */
function makeAltLayoutFixture(): Key[] {
  // Base keys (no option,choice)
  const base1 = makeKey('0,0', '', 0, 0)
  const base2 = makeKey('0,1', '', 1, 0)
  const base3 = makeKey('0,2', '', 2, 0)
  // Full backspace (choice 0)
  const fullBs = makeKey('0,3', '0,0', 14, 0)
  fullBs.width = 2
  // Split backspace left (choice 1)
  const splitLeft = makeKey('0,3', '0,1', 13, 0)
  // Split backspace right (choice 1)
  const splitRight = makeKey('0,4', '0,1', 14, 0)
  return [base1, base2, base3, fullBs, splitLeft, splitRight]
}

// ---------------------------------------------------------------------------
// getLayoutOptionGroups
// ---------------------------------------------------------------------------

describe('getLayoutOptionGroups', () => {
  it('returns [] for empty keys array', () => {
    expect(getLayoutOptionGroups([])).toEqual([])
  })

  it('returns [] when no keys have option,choice', () => {
    const keys = [makeKey('0,0', ''), makeKey('0,1', '')]
    expect(getLayoutOptionGroups(keys)).toEqual([])
  })

  it('returns one group for a single-option fixture', () => {
    const groups = getLayoutOptionGroups(makeAltLayoutFixture())
    expect(groups).toHaveLength(1)
    expect(groups[0]!.option).toBe(0)
    expect(groups[0]!.choices).toEqual([0, 1])
  })

  it('always includes choice 0 in the group', () => {
    // Even if only non-zero choices appear in keys, choice 0 should still be in the set
    const key = makeKey('0,3', '0,1', 13, 0)
    const groups = getLayoutOptionGroups([key])
    expect(groups[0]!.choices).toContain(0)
  })

  it('resolves groupLabel and choiceLabels from viaLabels array-of-arrays', () => {
    const viaLabels = [['Backspace', 'Full', 'Split']]
    const groups = getLayoutOptionGroups(makeAltLayoutFixture(), viaLabels)
    expect(groups[0]!.groupLabel).toBe('Backspace')
    expect(groups[0]!.choiceLabels).toEqual(['Full', 'Split'])
  })

  it('resolves groupLabel from viaLabels plain string entry', () => {
    const viaLabels = ['Backspace']
    const groups = getLayoutOptionGroups(makeAltLayoutFixture(), viaLabels)
    expect(groups[0]!.groupLabel).toBe('Backspace')
    expect(groups[0]!.choiceLabels).toBeUndefined()
  })

  it('returns undefined labels when viaLabels is absent', () => {
    const groups = getLayoutOptionGroups(makeAltLayoutFixture())
    expect(groups[0]!.groupLabel).toBeUndefined()
    expect(groups[0]!.choiceLabels).toBeUndefined()
  })

  it('does not throw when viaLabels is not an array', () => {
    expect(() => getLayoutOptionGroups(makeAltLayoutFixture(), 'bad' as unknown)).not.toThrow()
    expect(() => getLayoutOptionGroups(makeAltLayoutFixture(), 42 as unknown)).not.toThrow()
    expect(() => getLayoutOptionGroups(makeAltLayoutFixture(), null)).not.toThrow()
  })

  it('degrades to undefined labels on malformed viaLabels (mixed types)', () => {
    const viaLabels = [42, null, { x: 1 }]
    const groups = getLayoutOptionGroups(makeAltLayoutFixture(), viaLabels)
    expect(groups[0]!.groupLabel).toBeUndefined()
    expect(groups[0]!.choiceLabels).toBeUndefined()
  })

  it('degrades gracefully on sparse viaLabels', () => {
    const sparse: unknown[] = []
    sparse[5] = 'Late entry'
    expect(() => getLayoutOptionGroups(makeAltLayoutFixture(), sparse)).not.toThrow()
  })

  it('excludes ghost and decal keys', () => {
    const keys = [
      ...makeAltLayoutFixture(),
      makeKey('0,5', '0,1', 15, 0, { ghost: true }),
      makeKey('0,6', '0,1', 16, 0, { decal: true }),
    ]
    const groups = getLayoutOptionGroups(keys)
    expect(groups).toHaveLength(1)
  })

  it('sorts groups by option index', () => {
    const keys = [
      makeKey('0,3', '1,0', 14, 0),
      makeKey('0,4', '0,0', 13, 0),
      makeKey('0,5', '2,1', 12, 0),
    ]
    const groups = getLayoutOptionGroups(keys)
    expect(groups.map((g) => g.option)).toEqual([0, 1, 2])
  })
})

// ---------------------------------------------------------------------------
// collapseToLayoutChoices
// ---------------------------------------------------------------------------

const sel = (option: number, choice: number) => new Map([[option, choice]])

describe('collapseToLayoutChoices', () => {
  it('does not mutate the input array (round-trip JSON equality)', () => {
    const keys = makeAltLayoutFixture()
    const original = JSON.stringify(keys)
    collapseToLayoutChoices(keys, sel(0, 0))
    collapseToLayoutChoices(keys, sel(0, 1))
    expect(JSON.stringify(keys)).toBe(original)
  })

  it('mutating returned keys does not affect input', () => {
    const keys = makeAltLayoutFixture()
    const result = collapseToLayoutChoices(keys, sel(0, 1))
    result[0]!.x = 9999
    expect(keys[0]!.x).toBe(0)
  })

  it('choice 0 keeps positions identical to base keys', () => {
    const keys = makeAltLayoutFixture()
    const result = collapseToLayoutChoices(keys, sel(0, 0))
    const bs = result.find((k) => k.labels[8] === '0,0')
    expect(bs).toBeDefined()
    expect(bs!.x).toBe(14)
  })

  it('choice 1 translates split keys to anchor of choice-0 group', () => {
    const keys = makeAltLayoutFixture()
    const result = collapseToLayoutChoices(keys, sel(0, 1))

    // choice-0 anchor = min(x,y) of choice-0 keys = (14, 0)
    // choice-1 anchor = min(x,y) of choice-1 keys = (13, 0) [splitLeft at x=13]
    // delta = (14-13, 0-0) = (1, 0)
    // splitLeft should move from x=13 to x=14
    // splitRight should move from x=14 to x=15
    const splitLeft = result.find((k) => k.labels[0] === '0,3' && k.labels[8] === '0,1')
    const splitRight = result.find((k) => k.labels[0] === '0,4')
    expect(splitLeft).toBeDefined()
    expect(splitLeft!.x).toBe(14)
    expect(splitRight).toBeDefined()
    expect(splitRight!.x).toBe(15)
  })

  it('excludes choice-0 keys when viewing choice 1', () => {
    const keys = makeAltLayoutFixture()
    const result = collapseToLayoutChoices(keys, sel(0, 1))
    const fullBs = result.find((k) => k.labels[8] === '0,0')
    expect(fullBs).toBeUndefined()
  })

  it('includes base keys in all choice views', () => {
    const keys = makeAltLayoutFixture()
    for (const choice of [0, 1]) {
      const result = collapseToLayoutChoices(keys, sel(0, choice))
      expect(result.some((k) => k.labels[0] === '0,0')).toBe(true)
      expect(result.some((k) => k.labels[0] === '0,1')).toBe(true)
      expect(result.some((k) => k.labels[0] === '0,2')).toBe(true)
    }
  })

  it('deduplicates keys with same matrix label and center', () => {
    const key1 = makeKey('0,0', '', 0, 0)
    const key2 = makeKey('0,0', '', 0, 0)
    const result = collapseToLayoutChoices([key1, key2], sel(0, 0))
    expect(result.filter((k) => k.labels[0] === '0,0')).toHaveLength(1)
  })

  it('parity with getDefaultLayoutKeys for choice 0 single-group fixture', () => {
    const keys = makeAltLayoutFixture()
    const collapsed = collapseToLayoutChoices(keys, sel(0, 0))
    const defaultKeys = getDefaultLayoutKeys(keys)

    const collapsedLabels = collapsed.map((k) => k.labels[0]).sort()
    const defaultLabels = defaultKeys.map((k) => k.labels[0]).sort()
    expect(collapsedLabels).toEqual(defaultLabels)
  })

  it('returns empty array for empty input', () => {
    expect(collapseToLayoutChoices([], sel(0, 0))).toEqual([])
  })

  it('unknown option returns base keys + choice-0 fallback for existing groups', () => {
    const keys = makeAltLayoutFixture()
    const result = collapseToLayoutChoices(keys, new Map([[99, 99]]))
    expect(result.some((k) => k.labels[0] === '0,0')).toBe(true)
    // Option 0 not in map → falls back to choice 0 (full backspace)
    expect(result.some((k) => k.labels[8] === '0,0')).toBe(true)
    expect(result.some((k) => k.labels[8] === '0,1')).toBe(false)
  })

  it('multiple options apply independently', () => {
    // Two option groups: option 0 (backspace split) and option 1 (numpad)
    const keys = makeAltLayoutFixture()
    // Add a second option group: option 1, choices 0 and 1
    const opt1c0 = makeKey('1,0', '1,0', 0, 2)
    const opt1c1 = makeKey('1,0', '1,1', 0, 3)
    keys.push(opt1c0, opt1c1)

    const result = collapseToLayoutChoices(
      keys,
      new Map([
        [0, 1],
        [1, 1],
      ]),
    )
    // Option 0, choice 1: split backspace shown (not full)
    expect(result.some((k) => k.labels[8] === '0,1')).toBe(true)
    expect(result.some((k) => k.labels[8] === '0,0')).toBe(false)
    // Option 1, choice 1 shown
    expect(result.some((k) => k.labels[8] === '1,1')).toBe(true)
    expect(result.some((k) => k.labels[8] === '1,0')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// collapseViaLayout (superset — matches kbplacer PCB collapse)
// ---------------------------------------------------------------------------

describe('collapseViaLayout', () => {
  it('does not mutate the input array', () => {
    const keys = makeAltLayoutFixture()
    const original = JSON.stringify(keys)
    collapseViaLayout(keys)
    expect(JSON.stringify(keys)).toBe(original)
  })

  it('returns empty array for empty input', () => {
    expect(collapseViaLayout([])).toEqual([])
  })

  it('returns a plain (non-VIA) layout unchanged in matrix labels and length', () => {
    const keys = [makeKey('0,0', ''), makeKey('0,1', ''), makeKey('0,2', '')]
    const result = collapseViaLayout(keys)
    expect(result).toHaveLength(3)
    expect(result.map((k) => k.labels[0]).sort()).toEqual(['0,0', '0,1', '0,2'])
  })

  it('keeps BOTH default and repositioned alternative keys (superset)', () => {
    // Fixture: full backspace (choice 0) + split backspace (choice 1).
    const keys = makeAltLayoutFixture()
    const result = collapseViaLayout(keys)

    // 3 base + full backspace + 2 repositioned split keys = 6
    expect(result).toHaveLength(6)

    // Default full backspace is retained at its original position.
    const fullBs = result.find((k) => k.labels[8] === '0,0')
    expect(fullBs).toBeDefined()
    expect(fullBs!.x).toBe(14)

    // choice-0 anchor = (14,0); choice-1 anchor = (13,0) → delta (+1,0).
    const splitLeft = result.find((k) => k.labels[0] === '0,3' && k.labels[8] === '0,1')
    const splitRight = result.find((k) => k.labels[0] === '0,4')
    expect(splitLeft!.x).toBe(14)
    expect(splitRight!.x).toBe(15)
  })

  it('de-duplicates an alternative key coincident with a default key', () => {
    // Default group (choice 0): two 1U keys at matrix 8,0 and 8,1.
    const d0a = makeKey('8,0', '0,0', 0, 0)
    const d0b = makeKey('8,1', '0,0', 1, 0)
    // Alternative group (choice 1): one key coincident with d0a, one distinct.
    const c1a = makeKey('8,0', '0,1', 0, 0) // same matrix + center as d0a → dropped
    const c1b = makeKey('8,2', '0,1', 1, 0) // distinct matrix → kept
    const result = collapseViaLayout([d0a, d0b, c1a, c1b])

    // d0a, d0b, and c1b — the coincident c1a is de-duplicated away.
    expect(result).toHaveLength(3)
    expect(result.filter((k) => k.labels[0] === '8,0')).toHaveLength(1)
    expect(result.some((k) => k.labels[0] === '8,2')).toBe(true)
  })

  it('preserves ghost and decal keys that carry no option/choice', () => {
    const ghost = makeKey('9,0', '', 20, 0, { ghost: true })
    const decal = makeKey('', '', 21, 0, { decal: true })
    const result = collapseViaLayout([...makeAltLayoutFixture(), ghost, decal])
    expect(result.some((k) => k.ghost)).toBe(true)
    expect(result.some((k) => k.decal)).toBe(true)
  })

  it('never emits decal keys as alternatives', () => {
    const base = makeKey('0,0', '0,0', 0, 0)
    const altDecal = makeKey('0,1', '0,1', 1, 0, { decal: true })
    const result = collapseViaLayout([base, altDecal])
    expect(result.some((k) => k.decal)).toBe(false)
    expect(result).toHaveLength(1)
  })
})
