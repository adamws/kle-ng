import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { Key } from '@adamws/kle-serial'
import { useCurveLayoutStore } from '../curveLayout'
import { useKeyboardStore } from '../keyboard'
import { verifyNoCollisions } from '@/utils/curve-layout'

const makeKey = (values: Partial<Key>): Key => Object.assign(new Key(), values)

const geometryOf = (key: Key) => ({
  x: key.x,
  y: key.y,
  rotation_x: key.rotation_x,
  rotation_y: key.rotation_y,
  rotation_angle: key.rotation_angle,
})

const row = (count: number): Key[] =>
  Array.from({ length: count }, (_, index) => makeKey({ x: index, y: 0 }))

/** Push the inner control points off the axis, which is what the bend slider does. */
const bendSpine = (store: ReturnType<typeof useCurveLayoutStore>, amount: number) => {
  const spine = store.spine
  store.setSpine([
    spine[0],
    { x: spine[1].x, y: spine[1].y - amount },
    { x: spine[2].x, y: spine[2].y - amount },
    spine[3],
  ])
}

describe('curve layout store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('opening the tool is an identity transform', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    const before = keyboard.keys.map(geometryOf)

    const curve = useCurveLayoutStore()
    curve.begin()

    expect(curve.isActive).toBe(true)
    expect(curve.keyCount).toBe(6)
    expect(keyboard.keys.map(geometryOf)).toEqual(before)
  })

  it('cancel restores the exact geometry the tool opened with', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    const before = keyboard.keys.map(geometryOf)

    const curve = useCurveLayoutStore()
    curve.begin()
    bendSpine(curve, 3)

    // The bend must actually have moved something, or this test proves nothing.
    expect(keyboard.keys.map(geometryOf)).not.toEqual(before)

    curve.cancel()

    expect(keyboard.keys.map(geometryOf)).toEqual(before)
    expect(curve.isActive).toBe(false)
  })

  it('repeated previews do not compound', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)

    const curve = useCurveLayoutStore()
    curve.begin()
    bendSpine(curve, 2)
    const afterFirst = keyboard.keys.map(geometryOf)

    curve.preview()
    curve.preview()
    curve.preview()

    expect(keyboard.keys.map(geometryOf)).toEqual(afterFirst)
  })

  it('apply records exactly one history entry and keeps the previewed geometry', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    keyboard.saveState()
    const historyBefore = keyboard.history.length

    const curve = useCurveLayoutStore()
    curve.begin()
    bendSpine(curve, 3)
    const previewed = keyboard.keys.map(geometryOf)

    curve.apply()

    expect(keyboard.history.length).toBe(historyBefore + 1)
    expect(keyboard.keys.map(geometryOf)).toEqual(previewed)
    expect(curve.isActive).toBe(false)
  })

  it('undo after apply returns the layout to its pre-curve state', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    keyboard.saveState()
    const before = keyboard.keys.map(geometryOf)

    const curve = useCurveLayoutStore()
    curve.begin()
    bendSpine(curve, 3)
    curve.apply()

    keyboard.undo()

    expect(keyboard.keys.map(geometryOf)).toEqual(before)
  })

  it('reports a collision-free result and writes rounded coordinates', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(8)

    const curve = useCurveLayoutStore()
    curve.begin()
    bendSpine(curve, 4)

    expect(curve.collisionFree).toBe(true)
    expect(curve.canApply).toBe(true)
    expect(verifyNoCollisions(keyboard.keys.map((key) => ({ key, ...geometryOf(key) })))).toBe(true)

    // No long floating-point tails in the emitted layout.
    for (const key of keyboard.keys) {
      for (const value of [key.x, key.y, key.rotation_x, key.rotation_y, key.rotation_angle]) {
        expect(Number(value.toFixed(6))).toBe(value)
      }
    }
  })

  it('reset returns the spine to straight, undoing the bend', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    const before = keyboard.keys.map(geometryOf)

    const curve = useCurveLayoutStore()
    curve.begin()
    bendSpine(curve, 3)
    curve.resetSpine()

    expect(keyboard.keys.map(geometryOf)).toEqual(before)
  })

  it('operates on the selection captured at open, not the live one', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    keyboard.selectedKeys = keyboard.keys.slice(0, 3)
    const untouched = keyboard.keys.slice(3).map(geometryOf)

    const curve = useCurveLayoutStore()
    curve.begin()
    // Changing the canvas selection mid-edit must not retarget the transform.
    keyboard.selectedKeys = keyboard.keys.slice(3)
    bendSpine(curve, 3)

    expect(curve.keyCount).toBe(3)
    expect(curve.usingAllKeys).toBe(false)
    expect(keyboard.keys.slice(3).map(geometryOf)).toEqual(untouched)
  })

  it('takes the whole layout when nothing is selected', () => {
    // Matches the other Extra Tools: usable without selecting anything first.
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    keyboard.selectedKeys = []
    const before = keyboard.keys.map(geometryOf)

    const curve = useCurveLayoutStore()
    curve.begin()

    expect(curve.usingAllKeys).toBe(true)
    expect(curve.keyCount).toBe(6)

    bendSpine(curve, 3)
    // Every key moved, not just some subset.
    keyboard.keys.forEach((key, index) => {
      expect(geometryOf(key)).not.toEqual(before[index])
    })
  })

  it('bends only the selection when one exists', () => {
    const keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    keyboard.selectedKeys = keyboard.keys.slice(0, 3)
    const untouched = keyboard.keys.slice(3).map(geometryOf)

    const curve = useCurveLayoutStore()
    curve.begin()
    bendSpine(curve, 3)

    expect(curve.usingAllKeys).toBe(false)
    expect(keyboard.keys.slice(3).map(geometryOf)).toEqual(untouched)
  })
})
