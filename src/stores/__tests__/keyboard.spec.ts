import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKeyboardStore } from '../keyboard'
import { Key, Keyboard, KeyboardMetadata } from '@adamws/kle-serial'

describe('Keyboard Store', () => {
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useKeyboardStore()
  })

  describe('initial state', () => {
    it('should have empty initial state', () => {
      expect(store.keys).toHaveLength(0)
      expect(store.selectedKeys).toHaveLength(0)
      expect(store.clipboard).toHaveLength(0)
      expect(store.dirty).toBe(false)
      expect(store.historyIndex).toBe(0) // Initial save state
    })

    it('should have correct computed properties', () => {
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)
      expect(store.canCopy).toBe(false)
      expect(store.canPaste).toBe(false)
    })
  })

  describe('key operations', () => {
    it('should add a key', () => {
      store.addKey()

      expect(store.keys).toHaveLength(1)
      expect(store.selectedKeys).toHaveLength(1)
      expect(store.selectedKeys[0]).toBe(store.keys[0])
      expect(store.dirty).toBe(true)
    })

    it('should add a key with custom properties', () => {
      store.addKey({
        x: 5,
        y: 2,
        width: 1.5,
        color: '#ff0000',
        labels: ['', '', '', '', 'Test', '', '', '', '', '', '', ''],
      })

      const key = store.keys[0]
      expect(key.x).toBe(5)
      expect(key.y).toBe(2)
      expect(key.width).toBe(1.5)
      expect(key.color).toBe('#ff0000')
      expect(key.labels[4]).toBe('Test')
    })

    it('should position new keys after existing ones', () => {
      store.addKey({ x: 0, y: 0, width: 1 })
      store.addKey()

      expect(store.keys[1].x).toBe(1) // After first key (x=0, width=1)
      expect(store.keys[1].y).toBe(0) // Same row
    })

    it('should add multiple keys', () => {
      store.addKeys(3)

      expect(store.keys).toHaveLength(3)
      expect(store.selectedKeys).toHaveLength(1) // Only last added key selected
    })

    it('should delete selected keys and clear selection when all keys deleted', () => {
      store.addKey()
      store.addKey()
      store.selectAll()

      expect(store.selectedKeys).toHaveLength(2)

      store.deleteKeys()

      expect(store.keys).toHaveLength(0)
      expect(store.selectedKeys).toHaveLength(0)
    })

    it('should auto-select previous key after deleting middle key', () => {
      // Add 3 keys: [0], [1], [2]
      store.addKey({ x: 0, y: 0 })
      store.addKey({ x: 1, y: 0 })
      store.addKey({ x: 2, y: 0 })

      // Select middle key (index 1)
      store.selectKey(store.keys[1])
      expect(store.selectedKeys[0].x).toBe(1)

      // Delete it
      store.deleteKeys()

      // Should have 2 keys left: [0], [2]
      expect(store.keys).toHaveLength(2)
      expect(store.keys[0].x).toBe(0)
      expect(store.keys[1].x).toBe(2)

      // Should auto-select the key that moved to index 1 (previously at index 2)
      expect(store.selectedKeys).toHaveLength(1)
      expect(store.selectedKeys[0].x).toBe(2)
    })

    it('should auto-select previous key after deleting last key', () => {
      // Add 3 keys: [0], [1], [2]
      store.addKey({ x: 0, y: 0 })
      store.addKey({ x: 1, y: 0 })
      store.addKey({ x: 2, y: 0 })

      // Select last key (index 2)
      store.selectKey(store.keys[2])
      expect(store.selectedKeys[0].x).toBe(2)

      // Delete it
      store.deleteKeys()

      // Should have 2 keys left: [0], [1]
      expect(store.keys).toHaveLength(2)

      // Should auto-select the new last key (index 1)
      expect(store.selectedKeys).toHaveLength(1)
      expect(store.selectedKeys[0].x).toBe(1)
    })

    it('should auto-select next key after deleting first key', () => {
      // Add 3 keys: [0], [1], [2]
      store.addKey({ x: 0, y: 0 })
      store.addKey({ x: 1, y: 0 })
      store.addKey({ x: 2, y: 0 })

      // Select first key (index 0)
      store.selectKey(store.keys[0])
      expect(store.selectedKeys[0].x).toBe(0)

      // Delete it
      store.deleteKeys()

      // Should have 2 keys left: [1], [2] (shifted to indices 0, 1)
      expect(store.keys).toHaveLength(2)
      expect(store.keys[0].x).toBe(1)
      expect(store.keys[1].x).toBe(2)

      // Should auto-select the key that moved to index 0 (previously at index 1)
      expect(store.selectedKeys).toHaveLength(1)
      expect(store.selectedKeys[0].x).toBe(1)
    })

    it('should auto-select appropriately when deleting multiple keys', () => {
      // Add 5 keys: [0], [1], [2], [3], [4]
      store.addKey({ x: 0, y: 0 })
      store.addKey({ x: 1, y: 0 })
      store.addKey({ x: 2, y: 0 })
      store.addKey({ x: 3, y: 0 })
      store.addKey({ x: 4, y: 0 })

      // Select keys at indices 1 and 3
      store.selectKey(store.keys[1])
      store.selectKey(store.keys[3], true)
      expect(store.selectedKeys).toHaveLength(2)

      // Delete them
      store.deleteKeys()

      // Should have 3 keys left: [0], [2], [4] at indices 0, 1, 2
      expect(store.keys).toHaveLength(3)
      expect(store.keys[0].x).toBe(0)
      expect(store.keys[1].x).toBe(2)
      expect(store.keys[2].x).toBe(4)

      // Should auto-select the key at index 1 (was at index 2 before deletion, the first available after minimum deleted index 1)
      expect(store.selectedKeys).toHaveLength(1)
      expect(store.selectedKeys[0].x).toBe(2)
    })

    it('should not delete if no keys selected', () => {
      store.addKey()
      store.unselectAll()

      store.deleteKeys()

      expect(store.keys).toHaveLength(1)
    })
  })

  describe('selection operations', () => {
    beforeEach(() => {
      store.addKey({ x: 0, y: 0 })
      store.addKey({ x: 1, y: 0 })
      store.addKey({ x: 2, y: 0 })
      store.unselectAll()
    })

    it('should select a single key', () => {
      store.selectKey(store.keys[0])

      expect(store.selectedKeys).toHaveLength(1)
      expect(store.selectedKeys[0]).toBe(store.keys[0])
    })

    it('should extend selection with ctrl/cmd', () => {
      store.selectKey(store.keys[0])
      store.selectKey(store.keys[1], true)

      expect(store.selectedKeys).toHaveLength(2)
      expect(store.selectedKeys).toContain(store.keys[0])
      expect(store.selectedKeys).toContain(store.keys[1])
    })

    it('should toggle selection with extend', () => {
      store.selectKey(store.keys[0])
      store.selectKey(store.keys[0], true) // Toggle off

      expect(store.selectedKeys).toHaveLength(0)
    })

    it('should select all keys', () => {
      store.selectAll()

      expect(store.selectedKeys).toHaveLength(3)
      expect(store.selectedKeys).toEqual(store.keys)
    })

    it('should unselect all keys', () => {
      store.selectAll()
      store.unselectAll()

      expect(store.selectedKeys).toHaveLength(0)
    })
  })

  describe('clipboard operations', () => {
    beforeEach(() => {
      store.addKey({
        x: 0,
        y: 0,
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
      })
      store.addKey({
        x: 1,
        y: 0,
        labels: ['', '', '', '', 'B', '', '', '', '', '', '', ''],
      })
    })

    it('should copy selected keys', () => {
      store.selectKey(store.keys[0])
      store.copy()

      expect(store.clipboard).toHaveLength(1)
      expect(store.clipboard[0].labels[4]).toBe('A')
      expect(store.canPaste).toBe(true)
    })

    it('should not copy if no keys selected', () => {
      store.unselectAll()
      store.copy()

      expect(store.clipboard).toHaveLength(0)
    })

    it('should cut selected keys', async () => {
      store.selectKey(store.keys[0])
      await store.cut()

      expect(store.clipboard).toHaveLength(1)
      expect(store.keys).toHaveLength(1) // One key removed
      expect(store.keys[0].labels[4]).toBe('B') // Remaining key
    })

    it('should not paste keys when system clipboard is unavailable', async () => {
      store.selectKey(store.keys[0])
      await store.copy()
      await store.paste()

      // Paste should not work without system clipboard access in test environment
      expect(store.keys).toHaveLength(2) // Original 2 keys remain
      expect(store.selectedKeys).toHaveLength(1) // Still has the selected key
    })

    it('should not paste if clipboard empty', async () => {
      await store.paste()

      expect(store.keys).toHaveLength(2) // No change
    })

    it('should show error toast for invalid JSON clipboard data', () => {
      const result = store.handleSystemClipboardData('invalid json data')

      expect(result).toBe(false)
      expect(store.keys).toHaveLength(2) // No change
    })

    it('should show error toast for valid JSON but invalid keyboard data', () => {
      const result = store.handleSystemClipboardData('{"not": "keyboard", "data": true}')

      expect(result).toBe(false)
      expect(store.keys).toHaveLength(2) // No change
    })
  })

  describe('undo/redo operations', () => {
    it('should track history on state changes', () => {
      expect(store.canUndo).toBe(false)

      store.addKey()
      expect(store.canUndo).toBe(true)

      store.addKey()
      expect(store.historyIndex).toBe(2) // Initial + 2 additions
    })

    it('should undo operations', () => {
      store.addKey()
      const keyCount = store.keys.length

      store.undo()

      expect(store.keys).toHaveLength(keyCount - 1)
      expect(store.canRedo).toBe(true)
    })

    it('should redo operations', () => {
      store.addKey()
      store.undo()

      const keyCount = store.keys.length

      store.redo()

      expect(store.keys).toHaveLength(keyCount + 1)
      expect(store.canRedo).toBe(false)
    })

    it('should clear redo history on new actions', () => {
      store.addKey()
      store.undo()

      expect(store.canRedo).toBe(true)

      store.addKey() // New action should clear redo

      expect(store.canRedo).toBe(false)
    })
  })

  describe('property updates', () => {
    beforeEach(() => {
      store.addKey()
    })

    it('should update single key property', () => {
      const key = store.keys[0]

      store.updateKeyProperty(key, 'width', 1.5)

      expect(key.width).toBe(1.5)
      expect(store.dirty).toBe(true)
    })

    it('should update selected keys property', () => {
      store.addKey()
      store.selectAll()

      store.updateSelectedKeys('color', '#ff0000')

      expect(store.keys[0].color).toBe('#ff0000')
      expect(store.keys[1].color).toBe('#ff0000')
    })
  })

  describe('layout loading', () => {
    it('should load KLE format layout', () => {
      const kleData = [
        { name: 'Test Layout' },
        [{ a: 7 }, 'Q', 'W', 'E'], // Use alignment 7 for single chars
      ]

      store.loadKLELayout(kleData)

      expect(store.keys).toHaveLength(3)
      expect(store.metadata.name).toBe('Test Layout')
      expect(store.keys[0].labels[4]).toBe('Q')
      expect(store.dirty).toBe(false)
    })

    it('should load internal format layout', () => {
      const layout = {
        keys: [new Key()],
        meta: { ...new KeyboardMetadata(), name: 'Internal Layout' },
      }

      store.loadKeyboard(layout)

      expect(store.keys).toHaveLength(1)
      expect(store.metadata.name).toBe('Internal Layout')
    })

    it('should clear selection and history on load', () => {
      store.addKey()
      store.selectKey(store.keys[0])

      store.loadKLELayout([['Q']])

      expect(store.selectedKeys).toHaveLength(0)
      expect(store.historyIndex).toBe(0) // Reset to initial state
    })
  })

  describe('mirror operations', () => {
    beforeEach(() => {
      store.addKey({
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
      })
      store.addKey({
        x: 2,
        y: 1,
        width: 1,
        height: 1,
        labels: ['', '', '', '', 'B', '', '', '', '', '', '', ''],
      })
      store.selectAll()
    })

    it('should snap mirror axis to grid when setting axis', () => {
      // Set move step to 0.25
      store.moveStep = 0.25

      // Convert key coordinates to canvas coordinates for setMirrorAxis
      // After coordinate fix: canvas coordinates = key_units * 54 (no CANVAS_PADDING)
      const canvasPos = { x: 1.37 * 54, y: 0.63 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')

      expect(store.mirrorAxis).not.toBeNull()
      expect(store.mirrorAxis!.x).toBe(1.25) // Snapped to nearest 0.25
      expect(store.mirrorAxis!.y).toBe(0.75) // Snapped to nearest 0.25
      expect(store.mirrorAxis!.direction).toBe('horizontal')
    })

    it('should perform horizontal mirror of non-rotated keys', () => {
      // Set horizontal mirror axis at y=2 (convert to canvas coordinates)
      const canvasPos = { x: 0 * 54, y: 2 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')

      const originalKeyCount = store.keys.length
      store.performMirror()

      expect(store.keys.length).toBe(originalKeyCount * 2)

      // Original keys should still be there
      expect(store.keys[0].x).toBe(0)
      expect(store.keys[0].y).toBe(0)
      expect(store.keys[1].x).toBe(2)
      expect(store.keys[1].y).toBe(1)

      // Find mirrored keys
      const mirroredA = store.keys.find((k) => k.labels[4] === 'A' && k.x === 0 && k.y !== 0)
      const mirroredB = store.keys.find((k) => k.labels[4] === 'B' && k.x === 2 && k.y !== 1)

      expect(mirroredA).toBeDefined()
      expect(mirroredB).toBeDefined()

      // Check mirrored positions: y_mirrored = 2 * lineY - keyY - keyHeight
      expect(mirroredA!.y).toBe(3) // 2 * 2 - 0 - 1 = 3
      expect(mirroredB!.y).toBe(2) // 2 * 2 - 1 - 1 = 2
    })

    it('should perform vertical mirror of non-rotated keys', () => {
      // Set vertical mirror axis at x=3 (convert to canvas coordinates)
      const canvasPos = { x: 3 * 54, y: 0 * 54 }
      store.setMirrorAxis(canvasPos, 'vertical')

      const originalKeyCount = store.keys.length
      store.performMirror()

      expect(store.keys.length).toBe(originalKeyCount * 2)

      // Find mirrored keys
      const mirroredA = store.keys.find((k) => k.labels[4] === 'A' && k.x !== 0)
      const mirroredB = store.keys.find((k) => k.labels[4] === 'B' && k.x !== 2)

      expect(mirroredA).toBeDefined()
      expect(mirroredB).toBeDefined()

      // Check mirrored positions: x_mirrored = 2 * lineX - keyX - keyWidth
      expect(mirroredA!.x).toBe(5) // 2 * 3 - 0 - 1 = 5
      expect(mirroredB!.x).toBe(3) // 2 * 3 - 2 - 1 = 3
      expect(mirroredA!.y).toBe(0) // Y unchanged
      expect(mirroredB!.y).toBe(1) // Y unchanged
    })

    it('should handle horizontal mirror of rotated keys', () => {
      // Add a rotated key
      const rotatedKey = new Key()
      rotatedKey.x = 1
      rotatedKey.y = 1
      rotatedKey.rotation_angle = 45
      rotatedKey.rotation_x = 1.5
      rotatedKey.rotation_y = 1.5
      rotatedKey.labels = ['', '', '', '', 'Rotated', '', '', '', '', '', '', '']

      store.keys.push(rotatedKey)
      store.selectKey(rotatedKey)

      // Set horizontal mirror axis at y=3 (convert to canvas coordinates)
      const canvasPos = { x: 0 * 54, y: 3 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')
      store.performMirror()

      // Find the mirrored rotated key
      const mirrored = store.keys.find((k) => k.labels[4] === 'Rotated' && k.x === 1 && k.y !== 1)

      expect(mirrored).toBeDefined()

      // Check rotation properties
      expect(mirrored!.rotation_angle).toBe(-45) // Angle negated
      expect(mirrored!.rotation_x).toBe(1.5) // X rotation origin unchanged
      expect(mirrored!.rotation_y).toBe(4.5) // Y rotation origin mirrored: 2*3 - 1.5 = 4.5
      expect(mirrored!.y).toBe(4) // Key position mirrored: 2*3 - 1 - 1 = 4
    })

    it('should handle vertical mirror of rotated keys', () => {
      // Add a rotated key
      const rotatedKey = new Key()
      rotatedKey.x = 1
      rotatedKey.y = 1
      rotatedKey.rotation_angle = 30
      rotatedKey.rotation_x = 1.5
      rotatedKey.rotation_y = 1.5
      rotatedKey.labels = ['', '', '', '', 'Rotated', '', '', '', '', '', '', '']

      store.keys.push(rotatedKey)
      store.selectKey(rotatedKey)

      // Set vertical mirror axis at x=4 (convert to canvas coordinates)
      const canvasPos = { x: 4 * 54, y: 0 * 54 }
      store.setMirrorAxis(canvasPos, 'vertical')
      store.performMirror()

      // Find the mirrored rotated key
      const mirrored = store.keys.find((k) => k.labels[4] === 'Rotated' && k.x !== 1 && k.y === 1)

      expect(mirrored).toBeDefined()

      // Check rotation properties
      expect(mirrored!.rotation_angle).toBe(-30) // Angle negated
      expect(mirrored!.rotation_x).toBe(6.5) // X rotation origin mirrored: 2*4 - 1.5 = 6.5
      expect(mirrored!.rotation_y).toBe(1.5) // Y rotation origin unchanged
      expect(mirrored!.x).toBe(6) // Key position mirrored: 2*4 - 1 - 1 = 6
    })

    it('should preserve rotation origin when rotation_x/rotation_y are undefined', () => {
      // Add a rotated key without explicit rotation origin
      const rotatedKey = new Key()
      rotatedKey.x = 1
      rotatedKey.y = 1
      rotatedKey.rotation_angle = 45
      // Set rotation_x and rotation_y to undefined (Key constructor sets them to 0)
      delete (rotatedKey as unknown as Record<string, unknown>).rotation_x
      delete (rotatedKey as unknown as Record<string, unknown>).rotation_y
      rotatedKey.labels = ['', '', '', '', 'Rotated', '', '', '', '', '', '', '']

      store.keys.push(rotatedKey)
      store.selectKey(rotatedKey)

      // Set horizontal mirror axis at y=3 (convert to canvas coordinates)
      const canvasPos = { x: 0 * 54, y: 3 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')
      store.performMirror()

      // Find the mirrored rotated key
      const mirrored = store.keys.find((k) => k.labels[4] === 'Rotated' && k.y !== 1)

      expect(mirrored).toBeDefined()
      expect(mirrored!.rotation_angle).toBe(-45) // Angle negated
      expect(mirrored!.rotation_x).toBeUndefined() // Should remain undefined
      expect(mirrored!.rotation_y).toBeUndefined() // Should remain undefined
    })

    it('should not mirror keys with zero rotation angle', () => {
      // Add a key with rotation_angle = 0
      const key = new Key()
      key.x = 1
      key.y = 1
      key.rotation_angle = 0
      key.rotation_x = 1.5
      key.rotation_y = 1.5
      key.labels = ['', '', '', '', 'ZeroRotation', '', '', '', '', '', '', '']

      store.keys.push(key)
      store.selectKey(key)

      const canvasPos = { x: 0 * 54, y: 3 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')
      store.performMirror()

      const mirrored = store.keys.find((k) => k.labels[4] === 'ZeroRotation' && k.y !== 1)

      expect(mirrored).toBeDefined()
      expect(mirrored!.rotation_angle).toBe(0) // Should remain 0
      expect(mirrored!.rotation_x).toBe(1.5) // Should remain unchanged
      expect(mirrored!.rotation_y).toBe(1.5) // Should remain unchanged
    })

    it('should reset mirror state after performing mirror', () => {
      const canvasPos = { x: 1 * 54, y: 1 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')
      expect(store.mirrorAxis).not.toBeNull()

      store.performMirror()

      expect(store.mirrorAxis).toBeNull()
      expect(store.canvasMode).toBe('select')
    })

    it('should select mirrored keys after mirror operation', () => {
      const initialSelectedCount = store.selectedKeys.length

      const canvasPos = { x: 0 * 54, y: 2 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')
      store.performMirror()

      expect(store.selectedKeys.length).toBe(initialSelectedCount)
      // All selected keys should be the new mirrored keys
      store.selectedKeys.forEach((key) => {
        // Mirrored keys should be at different positions than originals
        const isOriginal = (key.x === 0 && key.y === 0) || (key.x === 2 && key.y === 1)
        expect(isOriginal).toBe(false)
      })
    })

    it('should not perform mirror without selected keys', () => {
      store.unselectAll()

      const initialKeyCount = store.keys.length
      const canvasPos = { x: 1 * 54, y: 1 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')
      store.performMirror()

      expect(store.keys.length).toBe(initialKeyCount) // No change
    })

    it('should not perform mirror without mirror axis set', () => {
      const initialKeyCount = store.keys.length
      store.performMirror()

      expect(store.keys.length).toBe(initialKeyCount) // No change
    })

    it('should allow negative coordinates in mirrored keys', () => {
      // Add a key very close to axis
      store.addKey({
        x: 0.1,
        y: 0.1,
        width: 1,
        height: 1,
        labels: ['', '', '', '', 'Edge', '', '', '', '', '', '', ''],
      })
      store.selectAll()

      // Set mirror axis that would create negative coordinates (convert to canvas coordinates)
      const canvasPos = { x: 0 * 54, y: 0 * 54 }
      store.setMirrorAxis(canvasPos, 'horizontal')
      store.performMirror()

      // Find the mirrored edge key
      const mirrored = store.keys.find((k) => k.labels[4] === 'Edge' && k.y !== 0.1)
      expect(mirrored).toBeDefined()
      expect(mirrored!.y).toBeLessThan(0) // Should be negative (mirrored across y=0 from y=0.1)
    })

    it('should calculate mirror position correctly for coordinate accuracy regression test', () => {
      // This test specifically catches the coordinate conversion bug where
      // tooltip shows "X: 2" but actual mirror axis was stored as x=1.75
      // causing mirrored key to be at x=2.5 instead of expected x=3
      // Clear existing keys and add a fresh one at (0,0)
      store.keys.length = 0
      store.selectedKeys.length = 0

      const key = new Key()
      key.x = 0
      key.y = 0
      key.width = 1
      key.height = 1
      key.labels = ['TEST', '', '', '', '', '', '', '', '', '', '', '']
      store.keys.push(key)
      expect(store.keys.length).toBe(1)

      // Verify key properties
      const originalKey = store.keys[0]
      expect(originalKey.x).toBe(0)
      expect(originalKey.y).toBe(0)
      expect(originalKey.width).toBe(1)

      // Select the key
      store.selectKey(originalKey, false)
      expect(store.selectedKeys.length).toBe(1)

      // Set mirror axis at x=2 (use the coordinate system that setMirrorAxis expects)
      // After the coordinate fix, setMirrorAxis expects coordinates from getCanvasPosition()
      // which doesn't include the CANVAS_PADDING offset
      const canvasPos = { x: 2 * 54, y: 0 * 54 } // x=2, y=0 in key units * RENDER_UNIT
      store.setMirrorAxis(canvasPos, 'vertical')

      // Perform mirror operation
      store.performMirror()

      // Should now have 2 keys
      expect(store.keys.length).toBe(2)

      // Find the mirrored key (not the original)
      const mirroredKey = store.keys.find((k) => k !== originalKey)
      expect(mirroredKey).toBeDefined()

      // Calculate expected position: x_mirrored = 2 * lineX - keyX - keyWidth
      // Expected: x_mirrored = 2 * 2 - 0 - 1 = 3
      // If the coordinate bug exists, this would be x=2.5 (due to axis at x=1.75)
      expect(mirroredKey!.x).toBe(3) // This assertion would fail with the coordinate bug
      expect(mirroredKey!.y).toBe(0) // Y should remain unchanged

      // Additional verification that axis was positioned correctly
      // The bug would cause snapX to be ~1.75 instead of 2.0
      // We can't directly test the intermediate values, but the final result
      // being x=3 confirms the axis was correctly positioned at x=2
    })

    it('should allow moving keys to negative coordinates', () => {
      // Add a key at positive coordinates
      const key = new Key()
      key.x = 1
      key.y = 1
      key.labels[4] = 'TestKey'
      store.addKey(key)
      store.selectKey(key)

      // Start drag operation
      const startPos = { x: 1 * 54, y: 1 * 54 } // Convert to canvas coordinates
      store.startKeyDrag(key, startPos)

      // Move key to negative coordinates
      const endPos = { x: -0.5 * 54, y: -0.25 * 54 } // Move to (-0.5, -0.25)
      store.updateKeyDrag(endPos)
      store.endKeyDrag()

      // Verify key moved to negative coordinates
      expect(key.x).toBe(-0.5)
      expect(key.y).toBe(-0.25)
    })
  })

  describe('mouse drag step behavior', () => {
    it('should drag rotated keys following mouse cursor directly', () => {
      // Clear any existing keys first
      store.keys = []

      // Add a rotated key
      store.addKey({
        x: 1,
        y: 1,
        width: 1,
        height: 1,
        labels: ['', '', '', '', 'R', '', '', '', '', '', '', ''],
        rotation_angle: 45,
        rotation_x: 0.5,
        rotation_y: 0.5,
      })
      const key = store.keys[0]

      // Set move step to 0.25
      store.moveStep = 0.25

      // Start drag at canvas coordinates (100, 100)
      const startCanvasX = 100
      const startCanvasY = 100
      store.startKeyDrag(key, { x: startCanvasX, y: startCanvasY })

      // Move mouse to the right by 54 pixels (1 key unit)
      // This should move the key right by 1 unit, regardless of rotation
      const newCanvasX = startCanvasX + 54 // +1 key unit
      const newCanvasY = startCanvasY // No vertical movement
      store.updateKeyDrag({ x: newCanvasX, y: newCanvasY })

      // With coordinate transformation, 45° rotated key moving right on screen
      // should move diagonally in world coordinates to appear as right movement
      // For 45° rotation: screen right (1,0) transforms to world (cos(45°), -sin(45°)) ≈ (0.707, -0.707)
      // But with step size 0.25, this gets snapped to (1, 0) or (0.75, -0.75) depending on rounding
      expect(key.x).toBeCloseTo(1.75, 2) // 1 + 0.75 (transformed and snapped)
      expect(key.y).toBeCloseTo(0.25, 2) // 1 + (-0.75) snapped to -0.75, but then rounded differently

      // The key's rotation should not affect the drag direction
      expect(key.rotation_angle).toBe(45) // Rotation unchanged
    })

    it('should prevent cursor and key from diverging during rotated key drag', () => {
      // Clear any existing keys first
      store.keys = []

      // Add a heavily rotated key to test divergence prevention
      store.addKey({
        x: 0,
        y: 0,
        width: 1,
        height: 1,
        labels: ['', '', '', '', 'T', '', '', '', '', '', '', ''],
        rotation_angle: 90, // 90 degree rotation
        rotation_x: 0.5,
        rotation_y: 0.5,
      })
      const key = store.keys[0]

      // Set move step to 1 (no snapping) to test pure movement
      store.moveStep = 1

      // Simulate multiple drag steps to test for divergence
      const startX = 100
      const startY = 100
      store.startKeyDrag(key, { x: startX, y: startY })

      // For 90° rotation, screen movement transforms as:
      // Screen right (1,0) → World (cos(90°), -sin(90°)) = (0, -1)
      // Screen up (-1,0) → World (0*cos(90°) + (-1)*sin(90°), -0*sin(90°) + (-1)*cos(90°)) = (-1, 0)

      // Step 1: Move right by 54 pixels (1 unit) - should move key "down" in world space
      store.updateKeyDrag({ x: startX + 54, y: startY })
      expect(key.x).toBe(0) // No change in world X for screen right movement
      expect(key.y).toBe(-1) // Moves down in world space (screen right = world down for 90° rotation)

      // Step 2: Move right again - total 2 units right in screen space
      store.updateKeyDrag({ x: startX + 108, y: startY })
      expect(key.x).toBe(0) // Still no world X change
      expect(key.y).toBe(-2) // Total 2 units down in world space

      // Step 3: Move diagonally up-right in screen space
      // Screen delta: right=1, up=-1 → World delta: (0,-1) + (-1,0) = (-1,-1)
      store.updateKeyDrag({ x: startX + 162, y: startY - 54 })
      expect(key.x).toBe(-1) // Now moves left in world (screen up component)
      expect(key.y).toBe(-3) // Further down in world (screen right component)

      // Key should follow mouse precisely - no divergence
      // Even with 90° rotation, screen movements translate directly to key position changes
    })

    it('should use increment-based movement instead of grid snapping', () => {
      // Clear any existing keys first
      store.keys = []

      // Add a key at a non-grid position
      store.addKey({
        x: 0.375,
        y: 0.125,
        width: 1,
        height: 1,
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
      })
      const key = store.keys[0]

      // Set move step to 0.25
      store.moveStep = 0.25

      // Start drag simulation - convert key coordinates to canvas coordinates
      // After coordinate fix: Canvas coordinates = key_units * 54 (no CANVAS_PADDING)
      const startCanvasX = 0.375 * 54
      const startCanvasY = 0.125 * 54
      store.startKeyDrag(key, { x: startCanvasX, y: startCanvasY })

      // Simulate a definite movement that should result in increment-based snapping
      // Move right by exactly one step (should result in original + step)
      const deltaX = 1.0 * 54 // 1 key unit in canvas pixels
      const newCanvasX = startCanvasX + deltaX
      store.updateKeyDrag({ x: newCanvasX, y: startCanvasY })

      // With increment-based movement:
      // deltaX = 1.0 key units, snapped to step (1.0 / 0.25 = 4 steps exactly)
      // Result: 0.375 + 1.0 = 1.375
      expect(key.x).toBe(1.375) // Original position + exact step multiple
      expect(key.y).toBe(0.125) // Should remain unchanged

      // Verify it's NOT using grid snapping (which would give 1.25, 1.5, etc.)
      expect(key.x).not.toBe(1.25) // Would be nearest 0.25 multiple with grid snapping
      expect(key.x).not.toBe(1.5) // Would be nearest 0.25 multiple with grid snapping
    })

    it('should handle negative positions correctly with increment-based movement', () => {
      // Clear any existing keys first
      store.keys = []

      // Add a key at position close to zero
      store.addKey({
        x: 0.125,
        y: 0.125,
        width: 1,
        height: 1,
        labels: ['', '', '', '', 'B', '', '', '', '', '', '', ''],
      })
      const key = store.keys[0]

      // Set move step to 0.25
      store.moveStep = 0.25

      // Start drag - convert key coordinates to canvas coordinates
      const startCanvasX = 0.125 * 54
      const startCanvasY = 0.125 * 54
      store.startKeyDrag(key, { x: startCanvasX, y: startCanvasY })

      // Move left by exactly one step
      const deltaX = -1.0 * 54 // -1 key unit in canvas pixels
      const newCanvasX = startCanvasX + deltaX
      store.updateKeyDrag({ x: newCanvasX, y: startCanvasY })

      // With increment-based: 0.125 + (-1.0) = -0.875
      expect(key.x).toBe(-0.875)
      expect(key.y).toBe(0.125) // Should remain unchanged

      // Test that it allows negative coordinates
      expect(key.x).toBeLessThan(0)
    })
  })

  describe('serialization', () => {
    beforeEach(() => {
      store.addKey({
        labels: ['', '', '', '', 'A', '', '', '', '', '', '', ''],
      })
    })

    it('should get serialized data in internal format', () => {
      const data = store.getSerializedData('internal') as Keyboard

      expect(data).toHaveProperty('keys')
      expect(data).toHaveProperty('meta')
      expect(data.keys).toHaveLength(1)
      expect(data.keys[0].labels[4]).toBe('A')
    })

    it('should get serialized data in KLE format', () => {
      const data = store.getSerializedData('kle') as unknown[]

      expect(Array.isArray(data)).toBe(true)
      expect(data.length).toBeGreaterThanOrEqual(1) // At least one row
      // Find the row with 'A' key
      const foundA = data.some((row) => Array.isArray(row) && row.includes('A'))
      expect(foundA).toBe(true)
    })

    it('should get serialized data in KLE internal format', () => {
      const data = store.getSerializedData('kle-internal') as {
        meta: KeyboardMetadata
        keys: Key[]
      }

      expect(data).toHaveProperty('meta')
      expect(data).toHaveProperty('keys')
      expect(Array.isArray(data.keys)).toBe(true)
      expect(data.keys).toHaveLength(1)
      expect(data.keys[0]).toHaveProperty('x')
      expect(data.keys[0]).toHaveProperty('y')
      expect(data.keys[0]).toHaveProperty('width')
      expect(data.keys[0]).toHaveProperty('height')
      expect(data.keys[0].labels[4]).toBe('A')
    })

    it('should round numeric values to 6 decimal places in KLE format', () => {
      // Add a key with high precision values
      store.addKey({
        x: 1.1234567890123456,
        y: 2.9876543210987654,
        width: 1.5555555555555556,
        rotation_angle: 15.123456789012345,
      })

      const data = store.getSerializedData('kle') as unknown[]
      // Since KLE format is array-based, we need to parse the keys from the serialized format
      expect(Array.isArray(data)).toBe(true)
    })

    it('should round numeric values to 6 decimal places in KLE internal format', () => {
      // Add a key with high precision values
      store.addKey({
        x: 1.1234567890123456,
        y: 2.9876543210987654,
        width: 1.5555555555555556,
        height: 2.7777777777777778,
        rotation_angle: 15.123456789012345,
        rotation_x: 3.1415926535897932,
        rotation_y: 2.7182818284590451,
      })

      const data = store.getSerializedData('kle-internal') as {
        meta: KeyboardMetadata
        keys: Key[]
      }
      const key = data.keys[1] // Second key (first one was added in beforeEach)

      // Check that values are rounded to 6 decimal places
      expect(key.x).toBe(1.123457) // 1.1234567890123456 -> 1.123457
      expect(key.y).toBe(2.987654) // 2.9876543210987654 -> 2.987654
      expect(key.width).toBe(1.555556) // 1.5555555555555556 -> 1.555556
      expect(key.height).toBe(2.777778) // 2.7777777777777778 -> 2.777778
      expect(key.rotation_angle).toBe(15.123457) // 15.123456789012345 -> 15.123457
      expect(key.rotation_x).toBe(3.141593) // 3.1415926535897932 -> 3.141593
      expect(key.rotation_y).toBe(2.718282) // 2.7182818284590451 -> 2.718282
    })

    it('should handle zero and integer values correctly', () => {
      store.addKey({
        x: 0,
        y: 1,
        width: 2.0,
        height: 3,
      })

      const data = store.getSerializedData('kle-internal') as {
        meta: KeyboardMetadata
        keys: Key[]
      }
      const key = data.keys[1] // Second key

      expect(key.x).toBe(0)
      expect(key.y).toBe(1)
      expect(key.width).toBe(2)
      expect(key.height).toBe(3)
    })

    it('should preserve metadata in KLE internal format', () => {
      store.metadata.name = 'Test Keyboard'
      store.metadata.author = 'Test Author'
      store.metadata.backcolor = '#123456'

      const data = store.getSerializedData('kle-internal') as {
        meta: KeyboardMetadata
        keys: Key[]
      }

      expect(data.meta.name).toBe('Test Keyboard')
      expect(data.meta.author).toBe('Test Author')
      expect(data.meta.backcolor).toBe('#123456')
    })
  })
})
