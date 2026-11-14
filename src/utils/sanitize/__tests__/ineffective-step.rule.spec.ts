import { describe, it, expect } from 'vitest'
import { ineffectiveStepRule } from '../rules/ineffective-step.rule'
import { makeKey } from './fixtures'

describe('ineffectiveStepRule', () => {
  it('is registered as a redundancy rule', () => {
    expect(ineffectiveStepRule.kind).toBe('redundancy')
  })

  it('flags a step whose second rect is narrower than the raised part', () => {
    // [[{"x":1,"a":7,"w":1.25,"w2":1,"l":true},"Caps Lock"]]
    const keys = [makeKey({ width: 1.25, width2: 1, stepped: true })]

    expect(ineffectiveStepRule.scan(keys).count).toBe(1)
  })

  it('flags a step on a rectangular key', () => {
    const keys = [makeKey({ width: 1.75, width2: 1.75, stepped: true })]

    expect(ineffectiveStepRule.scan(keys).count).toBe(1)
  })

  it('flags a second rect nested inside the raised part', () => {
    const keys = [
      makeKey({ width: 2, height: 2, x2: 0.5, y2: 0.5, width2: 1, height2: 1, stepped: true }),
    ]

    expect(ineffectiveStepRule.scan(keys).count).toBe(1)
  })

  it('clears the flag and the leftover second rect', () => {
    const keys = [makeKey({ width: 1.25, width2: 1, stepped: true })]

    ineffectiveStepRule.fix(keys)

    expect(keys[0]).toMatchObject({
      stepped: false,
      width: 1.25,
      height: 1,
      width2: 1.25,
      height2: 1,
      x2: 0,
      y2: 0,
    })
  })

  it('leaves a stepped Caps Lock alone', () => {
    const keys = [makeKey({ width: 1.25, width2: 1.75, stepped: true })]
    const before = structuredClone(keys)

    expect(ineffectiveStepRule.scan(keys).count).toBe(0)
    ineffectiveStepRule.fix(keys)
    expect(keys).toEqual(before)
  })

  it('leaves a step that overhangs on the left alone', () => {
    // Second rect starts left of the raised part, so the step shows there.
    const keys = [makeKey({ width: 1.25, x2: -0.5, width2: 1.25, stepped: true })]

    expect(ineffectiveStepRule.scan(keys).count).toBe(0)
  })

  it('leaves a step along the height alone', () => {
    const keys = [makeKey({ width: 1, height: 1.5, width2: 1, height2: 2, stepped: true })]

    expect(ineffectiveStepRule.scan(keys).count).toBe(0)
  })

  it('leaves a non-stepped key with a nested second rect alone', () => {
    const keys = [makeKey({ width: 1.25, width2: 1 })]
    const before = structuredClone(keys)

    expect(ineffectiveStepRule.scan(keys).count).toBe(0)
    ineffectiveStepRule.fix(keys)
    expect(keys).toEqual(before)
  })

  it('does not count a floating-point rounding error as a step', () => {
    // 0.1 + 0.2 is 0.30000000000000004 in plain floats, past the raised part.
    const keys = [makeKey({ width: 0.3, x2: 0.1, width2: 0.2, stepped: true })]

    expect(ineffectiveStepRule.scan(keys).count).toBe(1)
  })

  it('is idempotent', () => {
    const keys = [makeKey({ width: 1.25, width2: 1, stepped: true })]

    ineffectiveStepRule.fix(keys)
    expect(ineffectiveStepRule.scan(keys).count).toBe(0)

    const afterFirst = structuredClone(keys)
    ineffectiveStepRule.fix(keys)
    expect(keys).toEqual(afterFirst)
  })

  it('is a no-op on an empty layout', () => {
    const keys: ReturnType<typeof makeKey>[] = []
    expect(ineffectiveStepRule.scan(keys).count).toBe(0)
    expect(() => ineffectiveStepRule.fix(keys)).not.toThrow()
  })
})
