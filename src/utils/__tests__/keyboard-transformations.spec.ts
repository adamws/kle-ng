import { describe, it, expect } from 'vitest'
import { Key } from '@adamws/kle-serial'
import { transformRotationOrigin, moveRotationOriginsToPosition } from '../keyboard-transformations'
import { getKeyCenter } from '../keyboard-geometry'

/**
 * Helper function to create a Key with specified properties
 */
function createKey(props: Partial<Key> = {}): Key {
  const key = new Key()
  Object.assign(key, props)
  return key
}

/**
 * Helper to compare floating point numbers with tolerance
 */
function expectCloseTo(actual: number, expected: number) {
  expect(actual).toBeCloseTo(expected, 6)
}

describe('transformRotationOrigin', () => {
  it('should preserve visual center position when changing rotation origin', () => {
    // Create a key with rotation at 45 degrees
    const key = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      rotation_angle: 45,
      rotation_x: 0.5,
      rotation_y: 0.5,
    })

    // Get visual center BEFORE transformation
    const centerBefore = getKeyCenter(key)

    // Transform rotation origin to a new point
    transformRotationOrigin(key, 3, 3)

    // Get visual center AFTER transformation
    const centerAfter = getKeyCenter(key)

    // Assert: Visual position should be preserved (within floating point precision)
    expectCloseTo(centerAfter.x, centerBefore.x)
    expectCloseTo(centerAfter.y, centerBefore.y)

    // Assert: Rotation origin should be updated
    expect(key.rotation_x).toBe(3)
    expect(key.rotation_y).toBe(3)
  })

  it('should handle non-rotated keys (rotation_angle = 0)', () => {
    const key = createKey({
      x: 2,
      y: 2,
      width: 1,
      height: 1,
      rotation_angle: 0,
      rotation_x: 1,
      rotation_y: 1,
    })

    const originalX = key.x
    const originalY = key.y

    // Transform rotation origin
    transformRotationOrigin(key, 5, 5)

    // Assert: Key position should remain unchanged
    expect(key.x).toBe(originalX)
    expect(key.y).toBe(originalY)

    // Assert: Rotation origin should be updated
    expect(key.rotation_x).toBe(5)
    expect(key.rotation_y).toBe(5)
  })

  it('should handle keys without rotation properties', () => {
    const key = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
    })

    // Key constructor initializes rotation_angle to 0
    // rotation_x and rotation_y default to 0 as well
    expect(key.rotation_angle).toBe(0)

    const originalX = key.x
    const originalY = key.y

    // Transform rotation origin - should not throw
    transformRotationOrigin(key, 2, 2)

    // Assert: Key position unchanged (rotation_angle is 0)
    expect(key.x).toBe(originalX)
    expect(key.y).toBe(originalY)

    // Assert: Rotation origin properties set
    expect(key.rotation_x).toBe(2)
    expect(key.rotation_y).toBe(2)
  })

  it('should handle negative rotation angles', () => {
    const key = createKey({
      x: 2,
      y: 2,
      width: 1,
      height: 1,
      rotation_angle: -45,
      rotation_x: 1,
      rotation_y: 1,
    })

    // Get visual center BEFORE transformation
    const centerBefore = getKeyCenter(key)

    // Transform rotation origin
    transformRotationOrigin(key, 4, 4)

    // Get visual center AFTER transformation
    const centerAfter = getKeyCenter(key)

    // Assert: Visual position preserved with negative angles
    expectCloseTo(centerAfter.x, centerBefore.x)
    expectCloseTo(centerAfter.y, centerBefore.y)

    // Assert: Rotation origin updated
    expect(key.rotation_x).toBe(4)
    expect(key.rotation_y).toBe(4)

    // Assert: Rotation angle unchanged
    expect(key.rotation_angle).toBe(-45)
  })
})

describe('moveRotationOriginsToPosition', () => {
  it('should move all keys to shared position (Mode 2)', () => {
    // Create mixed selection: rotated and non-rotated keys
    const key1 = createKey({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rotation_angle: 45,
      rotation_x: 0,
      rotation_y: 0,
    })

    const key2 = createKey({
      x: 2,
      y: 2,
      width: 1,
      height: 1,
      // No rotation
    })

    const key3 = createKey({
      x: 3,
      y: 1,
      width: 1,
      height: 1,
      rotation_angle: 90,
      rotation_x: 2,
      rotation_y: 1,
    })

    const keys = [key1, key2, key3]

    // Get visual centers BEFORE
    const centersBefore = keys.map(getKeyCenter)

    // Move all keys to shared position (5, 5)
    const modifiedCount = moveRotationOriginsToPosition(keys, { x: 5, y: 5 })

    // Get visual centers AFTER
    const centersAfter = keys.map(getKeyCenter)

    // Assert: All keys have shared rotation origin
    keys.forEach((key) => {
      expect(key.rotation_x).toBe(5)
      expect(key.rotation_y).toBe(5)
    })

    // Assert: Visual positions unchanged
    keys.forEach((key, i) => {
      const centerAfter = centersAfter[i]
      const centerBefore = centersBefore[i]
      expect(centerAfter).toBeDefined()
      expect(centerBefore).toBeDefined()
      expectCloseTo(centerAfter!.x, centerBefore!.x)
      expectCloseTo(centerAfter!.y, centerBefore!.y)
    })

    // Assert: Modified count correct
    expect(modifiedCount).toBe(3)
  })

  it('should move each key to its own center when position=null (Mode 1)', () => {
    // Create keys at different positions
    const key1 = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      rotation_angle: 45,
      rotation_x: 0,
      rotation_y: 0,
    })

    const key2 = createKey({
      x: 3,
      y: 2,
      width: 2, // Multi-unit key (spacebar)
      height: 1,
      rotation_angle: 0,
      rotation_x: 2,
      rotation_y: 2,
    })

    const keys = [key1, key2]

    // Move to key centers
    const modifiedCount = moveRotationOriginsToPosition(keys, null)

    // Assert: Each key's rotation origin is at its visual center
    keys.forEach((key) => {
      const center = getKeyCenter(key)
      expectCloseTo(key.rotation_x!, center.x)
      expectCloseTo(key.rotation_y!, center.y)
    })

    // Assert: Modified count correct
    expect(modifiedCount).toBe(2)
  })

  it('should handle mixed rotated/non-rotated selections', () => {
    const rotatedKey = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      rotation_angle: 30,
      rotation_x: 0.5,
      rotation_y: 0.5,
    })

    const nonRotatedKey = createKey({
      x: 3,
      y: 3,
      width: 6,
      height: 1,
      // No rotation properties
    })

    const keys = [rotatedKey, nonRotatedKey]

    // Move to key centers
    const modifiedCount = moveRotationOriginsToPosition(keys, null)

    // Assert: Rotated key origin at visual center
    const rotatedCenter = getKeyCenter(rotatedKey)
    expectCloseTo(rotatedKey.rotation_x!, rotatedCenter.x)
    expectCloseTo(rotatedKey.rotation_y!, rotatedCenter.y)

    // Assert: Non-rotated key origin at geometric center
    expectCloseTo(nonRotatedKey.rotation_x!, 6) // x + width/2
    expectCloseTo(nonRotatedKey.rotation_y!, 3.5) // y + height/2

    // Assert: Both keys modified
    expect(modifiedCount).toBe(2)
  })

  it('should return count of modified keys', () => {
    const keys = [createKey({ x: 0, y: 0 }), createKey({ x: 1, y: 1 }), createKey({ x: 2, y: 2 })]

    // Modify all 3 keys
    const count1 = moveRotationOriginsToPosition(keys, { x: 5, y: 5 })
    expect(count1).toBe(3)

    // Modify only 2 specific keys
    const key0 = keys[0]
    const key1 = keys[1]
    expect(key0).toBeDefined()
    expect(key1).toBeDefined()
    const targetKeys = [key0!, key1!]
    const count2 = moveRotationOriginsToPosition(keys, null, targetKeys)
    expect(count2).toBe(2)
  })

  it('should work with targetKeys parameter to modify subset', () => {
    const key1 = createKey({ x: 0, y: 0, rotation_x: 0, rotation_y: 0 })
    const key2 = createKey({ x: 1, y: 1, rotation_x: 0, rotation_y: 0 })
    const key3 = createKey({ x: 2, y: 2, rotation_x: 0, rotation_y: 0 })

    const allKeys = [key1, key2, key3]
    const targetKeys = [key1, key3] // Only modify key1 and key3

    // Move only targeted keys to position (10, 10)
    const modifiedCount = moveRotationOriginsToPosition(allKeys, { x: 10, y: 10 }, targetKeys)

    // Assert: Only key1 and key3 modified
    expect(key1.rotation_x).toBe(10)
    expect(key1.rotation_y).toBe(10)
    expect(key2.rotation_x).toBe(0) // Unchanged
    expect(key2.rotation_y).toBe(0) // Unchanged
    expect(key3.rotation_x).toBe(10)
    expect(key3.rotation_y).toBe(10)

    // Assert: Count reflects only targeted keys
    expect(modifiedCount).toBe(2)
  })
})
