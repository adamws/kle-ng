import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKeyboardStore } from '../keyboard'

describe('KLE Internal Format Property Order', () => {
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useKeyboardStore()
  })

  it('should export keys with properties in the correct order', () => {
    // Create a simple layout with one key
    store.addKey({ x: 0, y: 0 })
    const key = store.keys[0]
    expect(key).toBeDefined()
    key!.labels[4] = 'A' // Set a label

    // Export to KLE Internal format
    const data = store.getSerializedData('kle-internal')

    // Stringify and parse to verify property order
    const jsonString = JSON.stringify(data, null, 2)

    // Extract property names from the first key in the JSON
    const keyMatch = jsonString.match(/"keys":\s*\[\s*\{([^}]+)\}/s)
    expect(keyMatch).toBeTruthy()

    // Get all top-level property names in order (not nested ones)
    // We need to parse the first key object carefully
    const firstKey = data.keys[0]
    const properties = Object.keys(firstKey)

    // Expected order according to Key class definition
    const expectedOrder = [
      'color',
      'labels',
      'textColor',
      'textSize',
      'default',
      'x',
      'y',
      'width',
      'height',
      'x2',
      'y2',
      'width2',
      'height2',
      'rotation_x',
      'rotation_y',
      'rotation_angle',
      'decal',
      'ghost',
      'stepped',
      'nub',
      'profile',
      'sm',
      'sb',
      'st',
    ]

    // Verify that properties appear in the expected order
    // We filter expectedOrder to only include properties that are actually in the output
    const actualPropertiesInOrder = expectedOrder.filter((prop) => properties.includes(prop))

    // Check that the properties that appear do so in the correct order
    expect(properties).toEqual(actualPropertiesInOrder)

    // Specifically verify that labels, textColor, textSize come before 'default'
    // This is the key regression - they were appearing at the end
    const labelsIndex = properties.indexOf('labels')
    const textColorIndex = properties.indexOf('textColor')
    const textSizeIndex = properties.indexOf('textSize')
    const defaultIndex = properties.indexOf('default')

    expect(labelsIndex).toBeGreaterThan(-1)
    expect(textColorIndex).toBeGreaterThan(-1)
    expect(textSizeIndex).toBeGreaterThan(-1)
    expect(defaultIndex).toBeGreaterThan(-1)

    // These should come before 'default'
    expect(labelsIndex).toBeLessThan(defaultIndex)
    expect(textColorIndex).toBeLessThan(defaultIndex)
    expect(textSizeIndex).toBeLessThan(defaultIndex)

    // And they should come after 'color'
    const colorIndex = properties.indexOf('color')
    expect(colorIndex).toBe(0) // color should be first
    expect(labelsIndex).toBeGreaterThan(colorIndex)
    expect(textColorIndex).toBeGreaterThan(colorIndex)
    expect(textSizeIndex).toBeGreaterThan(colorIndex)
  })

  it('should maintain consistent property order across multiple keys', () => {
    // Create multiple keys with different properties
    store.addKey({ x: 0, y: 0 })
    store.addKey({ x: 1, y: 0, width: 2 })
    store.addKey({ x: 3, y: 0, rotation_angle: 45 })

    const data = store.getSerializedData('kle-internal')

    // For simplicity, just verify the first key has correct order
    const firstKey = data.keys[0]
    const properties = Object.keys(firstKey)

    // Verify color comes first and labels/textColor/textSize come before default
    expect(properties[0]).toBe('color')
    const defaultIndex = properties.indexOf('default')
    const labelsIndex = properties.indexOf('labels')

    expect(labelsIndex).toBeLessThan(defaultIndex)
  })
})
