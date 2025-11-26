import { describe, it, expect } from 'vitest'
import { Key } from '@adamws/kle-serial'
import {
  transformRotationOrigin,
  moveRotationOriginsToPosition,
  mirrorKeys,
  calculateMirrorAxis,
  type MirrorAxis,
} from '../keyboard-transformations'
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

describe('mirrorKeys', () => {
  it('should mirror non-rotated keys horizontally across axis', () => {
    const key1 = createKey({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      labels: ['A', '', '', '', '', '', '', '', '', '', '', ''],
    })

    const key2 = createKey({
      x: 2,
      y: 1,
      width: 1,
      height: 1,
      labels: ['B', '', '', '', '', '', '', '', '', '', '', ''],
    })

    const keys = [key1, key2]
    const axis: MirrorAxis = { x: 0, y: 2, direction: 'horizontal' }

    const mirrored = mirrorKeys(keys, axis)

    // Assert: Returns new array with same length
    expect(mirrored).toHaveLength(2)
    expect(mirrored[0]).not.toBe(key1) // Deep clone
    expect(mirrored[1]).not.toBe(key2)

    // Assert: Horizontal mirror reflects Y positions
    // Formula: y_mirrored = 2 * lineY - keyY - keyHeight
    const mirroredKey1 = mirrored[0]
    expect(mirroredKey1).toBeDefined()
    expect(mirroredKey1!.x).toBe(0) // X unchanged
    expect(mirroredKey1!.y).toBe(3) // 2 * 2 - 0 - 1 = 3

    const mirroredKey2 = mirrored[1]
    expect(mirroredKey2).toBeDefined()
    expect(mirroredKey2!.x).toBe(2) // X unchanged
    expect(mirroredKey2!.y).toBe(2) // 2 * 2 - 1 - 1 = 2

    // Assert: Labels preserved
    expect(mirroredKey1!.labels[0]).toBe('A')
    expect(mirroredKey2!.labels[0]).toBe('B')
  })

  it('should mirror non-rotated keys vertically across axis', () => {
    const key1 = createKey({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      labels: ['A', '', '', '', '', '', '', '', '', '', '', ''],
    })

    const key2 = createKey({
      x: 2,
      y: 1,
      width: 1,
      height: 1,
      labels: ['B', '', '', '', '', '', '', '', '', '', '', ''],
    })

    const keys = [key1, key2]
    const axis: MirrorAxis = { x: 3, y: 0, direction: 'vertical' }

    const mirrored = mirrorKeys(keys, axis)

    // Assert: Returns new array
    expect(mirrored).toHaveLength(2)

    // Assert: Vertical mirror reflects X positions
    // Formula: x_mirrored = 2 * lineX - keyX - keyWidth
    const mirroredKey1 = mirrored[0]
    expect(mirroredKey1).toBeDefined()
    expect(mirroredKey1!.x).toBe(5) // 2 * 3 - 0 - 1 = 5
    expect(mirroredKey1!.y).toBe(0) // Y unchanged

    const mirroredKey2 = mirrored[1]
    expect(mirroredKey2).toBeDefined()
    expect(mirroredKey2!.x).toBe(3) // 2 * 3 - 2 - 1 = 3
    expect(mirroredKey2!.y).toBe(1) // Y unchanged
  })

  it('should negate rotation angle for horizontal mirror', () => {
    const key = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      rotation_angle: 45,
      rotation_x: 1.5,
      rotation_y: 1.5,
    })

    const axis: MirrorAxis = { x: 0, y: 3, direction: 'horizontal' }
    const mirrored = mirrorKeys([key], axis)

    const mirroredKey = mirrored[0]
    expect(mirroredKey).toBeDefined()

    // Assert: Rotation angle negated
    expect(mirroredKey!.rotation_angle).toBe(-45)

    // Assert: rotation_x unchanged (horizontal mirror)
    expect(mirroredKey!.rotation_x).toBe(1.5)

    // Assert: rotation_y mirrored
    expect(mirroredKey!.rotation_y).toBe(4.5) // 2 * 3 - 1.5 = 4.5
  })

  it('should negate rotation angle for vertical mirror', () => {
    const key = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      rotation_angle: 30,
      rotation_x: 1.5,
      rotation_y: 1.5,
    })

    const axis: MirrorAxis = { x: 4, y: 0, direction: 'vertical' }
    const mirrored = mirrorKeys([key], axis)

    const mirroredKey = mirrored[0]
    expect(mirroredKey).toBeDefined()

    // Assert: Rotation angle negated
    expect(mirroredKey!.rotation_angle).toBe(-30)

    // Assert: rotation_x mirrored
    expect(mirroredKey!.rotation_x).toBe(6.5) // 2 * 4 - 1.5 = 6.5

    // Assert: rotation_y unchanged (vertical mirror)
    expect(mirroredKey!.rotation_y).toBe(1.5)
  })

  it('should preserve original keys (returns deep clones)', () => {
    const originalKey = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      labels: ['Original', '', '', '', '', '', '', '', '', '', '', ''],
    })

    const originalX = originalKey.x
    const originalY = originalKey.y

    const axis: MirrorAxis = { x: 0, y: 2, direction: 'horizontal' }
    const mirrored = mirrorKeys([originalKey], axis)

    // Assert: Original key unchanged
    expect(originalKey.x).toBe(originalX)
    expect(originalKey.y).toBe(originalY)
    expect(originalKey.labels[0]).toBe('Original')

    // Assert: Mirrored key is different object
    const mirroredKey = mirrored[0]
    expect(mirroredKey).toBeDefined()
    expect(mirroredKey).not.toBe(originalKey)
    expect(mirroredKey!.y).not.toBe(originalY)
  })

  it('should handle multi-unit keys (width/height considered)', () => {
    // Create a 2.25u spacebar
    const spacebar = createKey({
      x: 3,
      y: 4,
      width: 2.25,
      height: 1,
    })

    const axis: MirrorAxis = { x: 5, y: 0, direction: 'vertical' }
    const mirrored = mirrorKeys([spacebar], axis)

    const mirroredKey = mirrored[0]
    expect(mirroredKey).toBeDefined()

    // Assert: Width is considered in mirror calculation
    // x_mirrored = 2 * lineX - keyX - keyWidth
    // x_mirrored = 2 * 5 - 3 - 2.25 = 4.75
    expectCloseTo(mirroredKey!.x, 4.75)
    expect(mirroredKey!.y).toBe(4) // Y unchanged
    expect(mirroredKey!.width).toBe(2.25) // Dimensions preserved
    expect(mirroredKey!.height).toBe(1)
  })

  it('should handle mixed rotated/non-rotated selections', () => {
    const rotatedKey = createKey({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      rotation_angle: 45,
      rotation_x: 0.5,
      rotation_y: 0.5,
    })

    const nonRotatedKey = createKey({
      x: 2,
      y: 2,
      width: 1,
      height: 1,
    })

    const keys = [rotatedKey, nonRotatedKey]
    const axis: MirrorAxis = { x: 0, y: 3, direction: 'horizontal' }

    const mirrored = mirrorKeys(keys, axis)

    // Assert: Both keys mirrored correctly
    expect(mirrored).toHaveLength(2)

    // Rotated key
    const mirroredRotated = mirrored[0]
    expect(mirroredRotated).toBeDefined()
    expect(mirroredRotated!.rotation_angle).toBe(-45)
    expect(mirroredRotated!.rotation_y).toBe(5.5) // 2 * 3 - 0.5

    // Non-rotated key
    const mirroredNonRotated = mirrored[1]
    expect(mirroredNonRotated).toBeDefined()
    expect(mirroredNonRotated!.y).toBe(3) // 2 * 3 - 2 - 1
    expect(mirroredNonRotated!.rotation_angle).toBe(0) // No rotation
  })

  it('should handle keys with zero rotation angle', () => {
    const key = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      rotation_angle: 0,
      rotation_x: 1.5,
      rotation_y: 1.5,
    })

    const axis: MirrorAxis = { x: 0, y: 3, direction: 'horizontal' }
    const mirrored = mirrorKeys([key], axis)

    const mirroredKey = mirrored[0]
    expect(mirroredKey).toBeDefined()

    // Assert: Zero rotation angle not negated
    expect(mirroredKey!.rotation_angle).toBe(0)

    // Assert: Position mirrored correctly
    expect(mirroredKey!.y).toBe(4) // 2 * 3 - 1 - 1

    // Assert: Rotation origins unchanged (rotation_angle is 0)
    expect(mirroredKey!.rotation_x).toBe(1.5)
    expect(mirroredKey!.rotation_y).toBe(1.5)
  })

  it('should handle negative rotation angles', () => {
    const key = createKey({
      x: 1,
      y: 1,
      width: 1,
      height: 1,
      rotation_angle: -30,
      rotation_x: 1,
      rotation_y: 1,
    })

    const axis: MirrorAxis = { x: 3, y: 0, direction: 'vertical' }
    const mirrored = mirrorKeys([key], axis)

    const mirroredKey = mirrored[0]
    expect(mirroredKey).toBeDefined()

    // Assert: Negative angle negated becomes positive
    expect(mirroredKey!.rotation_angle).toBe(30) // -(-30) = 30
  })
})

describe('calculateMirrorAxis', () => {
  it('should convert canvas position to key units', () => {
    // Canvas position (270, 162) with renderUnit=54
    const axis = calculateMirrorAxis({ x: 270, y: 162 }, 'horizontal', 54, 0.25)

    // 270 / 54 = 5.0
    // 162 / 54 = 3.0
    expect(axis.x).toBe(5)
    expect(axis.y).toBe(3)
    expect(axis.direction).toBe('horizontal')
  })

  it('should snap to grid based on snapStep', () => {
    // Canvas position (137, 81) with renderUnit=54, snapStep=0.25
    const axis = calculateMirrorAxis({ x: 137, y: 81 }, 'vertical', 54, 0.25)

    // 137 / 54 = 2.537... → snaps to 2.5
    // 81 / 54 = 1.5 → snaps to 1.5
    expectCloseTo(axis.x, 2.5)
    expectCloseTo(axis.y, 1.5)
    expect(axis.direction).toBe('vertical')
  })

  it('should create MirrorAxis with correct direction', () => {
    const horizontalAxis = calculateMirrorAxis({ x: 100, y: 100 }, 'horizontal', 54, 0.25)
    expect(horizontalAxis.direction).toBe('horizontal')

    const verticalAxis = calculateMirrorAxis({ x: 100, y: 100 }, 'vertical', 54, 0.25)
    expect(verticalAxis.direction).toBe('vertical')
  })

  it('should handle different snap steps', () => {
    // Test with snapStep = 1.0 (whole units)
    const axis1 = calculateMirrorAxis({ x: 143, y: 89 }, 'horizontal', 54, 1.0)

    // 143 / 54 = 2.648... → snaps to 3.0
    // 89 / 54 = 1.648... → snaps to 2.0
    expect(axis1.x).toBe(3)
    expect(axis1.y).toBe(2)

    // Test with snapStep = 0.5
    const axis2 = calculateMirrorAxis({ x: 143, y: 89 }, 'horizontal', 54, 0.5)

    // 143 / 54 = 2.648... → snaps to 2.5
    // 89 / 54 = 1.648... → snaps to 1.5
    expectCloseTo(axis2.x, 2.5)
    expectCloseTo(axis2.y, 1.5)
  })
})
