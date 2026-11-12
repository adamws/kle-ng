import { describe, it, expect } from 'vitest'
import { Key } from '@adamws/kle-serial'
import { applyStep, removeStep, isPureStep, isNonRectangular } from '../key-utils'

function makeKey(overrides: Partial<Key> = {}): Key {
  const key = new Key()
  Object.assign(key, overrides)
  // Mirror kle-serial: an unset secondary size equals the primary one
  if (overrides.width2 === undefined) key.width2 = key.width
  if (overrides.height2 === undefined) key.height2 = key.height
  return key
}

describe('applyStep', () => {
  it('turns a 1.75U key into a stepped Caps Lock: 1.25U raised of 1.75U', () => {
    const key = makeKey({ width: 1.75 })
    applyStep(key)
    expect(key).toMatchObject({
      stepped: true,
      width: 1.25,
      width2: 1.75,
      height2: 1,
      x2: 0,
      y2: 0,
    })
    expect(isPureStep(key)).toBe(true)
  })

  it('never shrinks the raised part below 1U', () => {
    const key = makeKey({ width: 1.25 })
    applyStep(key)
    expect(key).toMatchObject({ width: 1, width2: 1.25 })
  })

  it('steps a vertical key along its height', () => {
    const key = makeKey({ width: 1, height: 2 })
    applyStep(key)
    expect(key).toMatchObject({ width: 1, height: 1.5, width2: 1, height2: 2 })
  })

  it('keeps the existing shape of a non-rectangular key', () => {
    const key = makeKey({ width: 1.25, height: 2, width2: 1.5, height2: 1, x2: -0.25 })
    applyStep(key)
    expect(key).toMatchObject({ stepped: true, width: 1.25, height: 2, width2: 1.5, x2: -0.25 })
  })

  it('only sets the flag on a 1x1 key and on rotary encoders', () => {
    const plain = makeKey()
    applyStep(plain)
    expect(plain.stepped).toBe(true)
    expect(isNonRectangular(plain)).toBe(false)

    const encoder = makeKey({ width: 2, height: 2, sm: 'rot_ec11' })
    applyStep(encoder)
    expect(encoder).toMatchObject({ stepped: true, width: 2, width2: 2 })
  })
})

describe('removeStep', () => {
  it('restores the full-width rectangle of a pure step', () => {
    const key = makeKey({ width: 1.25, width2: 1.75, stepped: true })
    removeStep(key)
    expect(key).toMatchObject({ stepped: false, width: 1.75, width2: 1.75 })
    expect(isNonRectangular(key)).toBe(false)
  })

  it('round-trips applyStep', () => {
    const key = makeKey({ width: 2.25 })
    applyStep(key)
    removeStep(key)
    expect(key).toMatchObject({ stepped: false, width: 2.25, height: 1, width2: 2.25 })
  })

  it('keeps the shape of a stepped key whose step is offset (x2 != 0)', () => {
    const key = makeKey({ width: 1.25, width2: 1.75, x2: -0.5, stepped: true })
    expect(isPureStep(key)).toBe(false)
    removeStep(key)
    expect(key).toMatchObject({ stepped: false, width: 1.25, width2: 1.75, x2: -0.5 })
  })
})
