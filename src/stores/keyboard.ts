import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { ref, computed } from 'vue'
import { Key, KeyboardMetadata, Keyboard, Serial } from '@ijprest/kle-serial'
import { D } from '../utils/decimal-math'
import {
  generateShareableUrl,
  extractLayoutFromCurrentUrl,
  clearShareFromUrl,
} from '../utils/url-sharing'
import type { LayoutData } from '../utils/url-sharing'

export { Key, KeyboardMetadata } from '@ijprest/kle-serial'

export interface KeyboardState {
  keys: Key[]
  selectedKeys: Key[]
  metadata: KeyboardMetadata
  clipboard: Key[]
  historyIndex: number
  history: { keys: Key[]; metadata: KeyboardMetadata }[]
  dirty: boolean
  canvasMode: 'select' | 'mirror-h' | 'mirror-v' | 'rotate' | 'move-exactly'
  moveStep: number
  lockRotations: boolean
  mouseDragMode: 'none' | 'key-move' | 'rect-select'
  draggedKey: Key | null
  draggedKeys: Key[] // For multi-key dragging
  dragStartPos: { x: number; y: number }
  keyOriginalPos: { x: number; y: number }
  keysOriginalPositions: Map<Key, { x: number; y: number }> // For multi-key dragging
  keysOriginalRotations: Map<Key, { rotation_x?: number; rotation_y?: number }> // For locked rotations
  rectSelectStart: { x: number; y: number }
  rectSelectEnd: { x: number; y: number }
  tempSelectedKeys: Key[]
  mirrorAxis: { x: number; y: number; direction: 'horizontal' | 'vertical' } | null
  showMirrorPreview: boolean
  rotationOrigin: { x: number; y: number } | null
  rotationPreviewAngle: number
  originalRotationStates: Map<
    Key,
    { rotation_angle?: number; rotation_x?: number; rotation_y?: number; x?: number; y?: number }
  >
  showRotationPreview: boolean
}

export const useKeyboardStore = defineStore('keyboard', () => {
  const keys: Ref<Key[]> = ref([])
  const selectedKeys: Ref<Key[]> = ref([])
  const metadata: Ref<KeyboardMetadata> = ref(new KeyboardMetadata())
  const clipboard: Ref<Key[]> = ref([])
  const historyIndex = ref(-1)
  const history: Ref<
    {
      keys: Key[]
      metadata: KeyboardMetadata
    }[]
  > = ref([])
  const dirty = ref(false)
  const resetViewTrigger = ref(0) // Incremented when layout changes to trigger view reset

  const canvasMode = ref<'select' | 'mirror-h' | 'mirror-v' | 'rotate' | 'move-exactly'>('select')
  const moveStep = ref(0.25)
  const lockRotations = ref(false)

  const mouseDragMode = ref<'none' | 'key-move' | 'rect-select'>('none')
  const draggedKey: Ref<Key | null> = ref(null)
  const draggedKeys: Ref<Key[]> = ref([])
  const dragStartPos = ref({ x: 0, y: 0 })
  const keyOriginalPos = ref({ x: 0, y: 0 })
  const keysOriginalPositions: Ref<Map<Key, { x: number; y: number }>> = ref(new Map())
  const keysOriginalRotations: Ref<Map<Key, { rotation_x?: number; rotation_y?: number }>> = ref(
    new Map(),
  )

  const rectSelectStart = ref({ x: 0, y: 0 })
  const rectSelectEnd = ref({ x: 0, y: 0 })
  const tempSelectedKeys: Ref<Key[]> = ref([])

  const mirrorAxis: Ref<{ x: number; y: number; direction: 'horizontal' | 'vertical' } | null> =
    ref(null)
  const showMirrorPreview = ref(false)

  // Rotation state
  const rotationOrigin: Ref<{ x: number; y: number } | null> = ref(null)
  const rotationPreviewAngle = ref(0)
  const showRotationPreview = ref(false)
  const originalRotationStates: Ref<
    Map<
      Key,
      { rotation_angle?: number; rotation_x?: number; rotation_y?: number; x?: number; y?: number }
    >
  > = ref(new Map())

  const canUndo = computed(() => historyIndex.value > 0)
  const canRedo = computed(() => historyIndex.value < history.value.length - 1)
  const canCopy = computed(() => selectedKeys.value.length > 0)
  const canPaste = computed(() => clipboard.value.length > 0)

  const createKey = (x: number = 0, y: number = 0): Key => {
    const key = new Key()
    key.x = x
    key.y = y
    return key
  }

  const saveState = () => {
    // Remove any states after current index
    history.value = history.value.slice(0, historyIndex.value + 1)

    // Add new state
    history.value.push({
      keys: JSON.parse(JSON.stringify(keys.value)),
      metadata: JSON.parse(JSON.stringify(metadata.value)),
    })

    historyIndex.value = history.value.length - 1

    // Limit history size
    if (history.value.length > 50) {
      history.value.shift()
      historyIndex.value--
    }

    dirty.value = true
  }

  const addKey = (keyData?: Partial<Key>) => {
    const newKey = { ...createKey(), ...keyData }

    // Position new key next to selected key if one is selected
    if (keys.value.length > 0 && !keyData?.x && !keyData?.y) {
      if (selectedKeys.value.length > 0) {
        // Position next to the last selected key, accounting for rotation
        const referenceKey = selectedKeys.value[selectedKeys.value.length - 1]

        if (referenceKey.rotation_angle) {
          // For rotated keys, inherit the same rotation and positioning context
          newKey.rotation_angle = referenceKey.rotation_angle
          newKey.rotation_x = referenceKey.rotation_x
          newKey.rotation_y = referenceKey.rotation_y

          // Calculate position in the rotated coordinate system
          // Place the new key to the right of the reference key in its local coordinate system
          newKey.x = D.add(referenceKey.x, referenceKey.width)
          newKey.y = referenceKey.y
        } else {
          // Standard positioning for non-rotated keys
          newKey.x = D.add(referenceKey.x, referenceKey.width)
          newKey.y = referenceKey.y
        }
      } else {
        // Fallback to end of layout if no selection
        const lastKey = keys.value[keys.value.length - 1]
        newKey.x = D.add(lastKey.x, lastKey.width)
        newKey.y = lastKey.y
      }
    }

    keys.value.push(newKey)
    selectedKeys.value = [newKey]
    saveState()
  }

  const addKeys = (count: number) => {
    for (let i = 0; i < count; i++) {
      addKey()
    }
  }

  const deleteKeys = () => {
    if (selectedKeys.value.length === 0) return

    // Find the minimum index of selected keys to determine which key to select next
    const selectedIndices = selectedKeys.value
      .map((selectedKey) => keys.value.indexOf(selectedKey))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)

    if (selectedIndices.length === 0) return

    const minIndex = selectedIndices[0]

    // Remove selected keys
    selectedKeys.value.forEach((selectedKey) => {
      const index = keys.value.indexOf(selectedKey)
      if (index >= 0) {
        keys.value.splice(index, 1)
      }
    })

    // Auto-select the previous key for chained deletion
    if (keys.value.length > 0) {
      // Select the key that's now at the position where the first deleted key was,
      // or the previous key if we deleted the last key(s)
      const newIndex = Math.min(minIndex, keys.value.length - 1)
      selectedKeys.value = [keys.value[newIndex]]
    } else {
      selectedKeys.value = []
    }

    saveState()
  }

  const selectKey = (key: Key, extend: boolean = false) => {
    if (extend) {
      const index = selectedKeys.value.indexOf(key)
      if (index >= 0) {
        selectedKeys.value.splice(index, 1)
      } else {
        selectedKeys.value.push(key)
      }
    } else {
      selectedKeys.value = [key]
    }
  }

  const selectAll = () => {
    selectedKeys.value = [...keys.value]
  }

  const unselectAll = () => {
    selectedKeys.value = []
  }

  const copy = () => {
    if (selectedKeys.value.length === 0) return
    clipboard.value = JSON.parse(JSON.stringify(selectedKeys.value))
  }

  const cut = () => {
    copy()
    deleteKeys()
  }

  const paste = () => {
    if (clipboard.value.length === 0) return

    const pastedKeys = clipboard.value.map((key) => ({
      ...JSON.parse(JSON.stringify(key)),
      x: D.add(key.x, 1), // Offset to avoid overlap
      y: D.add(key.y, 0.25),
    }))

    keys.value.push(...pastedKeys)
    selectedKeys.value = pastedKeys
    saveState()
  }

  const undo = () => {
    if (!canUndo.value) return

    historyIndex.value--
    const state = history.value[historyIndex.value]
    keys.value = JSON.parse(JSON.stringify(state.keys))
    metadata.value = JSON.parse(JSON.stringify(state.metadata))
    selectedKeys.value = []
    dirty.value = true
  }

  const redo = () => {
    if (!canRedo.value) return

    historyIndex.value++
    const state = history.value[historyIndex.value]
    keys.value = JSON.parse(JSON.stringify(state.keys))
    metadata.value = JSON.parse(JSON.stringify(state.metadata))
    selectedKeys.value = []
    dirty.value = true
  }

  const updateKeyProperty = (key: Key, property: keyof Key, value: unknown) => {
    ;(key as unknown as Record<string, unknown>)[property] = value
    saveState()
  }

  const updateSelectedKeys = (property: keyof Key, value: unknown) => {
    selectedKeys.value.forEach((key) => {
      updateKeyProperty(key, property, value)
    })
  }

  const loadLayout = (
    layout: { keys: Key[]; metadata?: KeyboardMetadata } | Key[],
    layoutMetadata?: KeyboardMetadata,
  ) => {
    try {
      if (Array.isArray(layout)) {
        // Legacy format: array of keys
        keys.value = JSON.parse(JSON.stringify(layout)) // Deep copy
        if (layoutMetadata) {
          metadata.value = { ...metadata.value, ...layoutMetadata }
        }
      } else {
        // New format: object with keys and metadata
        keys.value = JSON.parse(JSON.stringify(layout.keys)) // Deep copy
        if (layout.metadata) {
          metadata.value = { ...metadata.value, ...layout.metadata }
        }
      }
      selectedKeys.value = []
      history.value = []
      historyIndex.value = -1
      saveState()
      dirty.value = false
      resetViewTrigger.value++ // Trigger view reset
    } catch (error) {
      console.error('Error loading layout:', error)
      throw error
    }
  }

  const clearLayout = () => {
    keys.value = []
    selectedKeys.value = []
    metadata.value = new KeyboardMetadata()
    history.value = []
    historyIndex.value = -1
    saveState()
    dirty.value = false
    resetViewTrigger.value++ // Trigger view reset
  }

  const getSerializedData = (format: 'kle' | 'kle-internal' | 'internal' = 'internal') => {
    const keyboard = new Keyboard()
    keyboard.keys = keys.value
    keyboard.meta = metadata.value

    if (format === 'kle') {
      return Serial.serialize(getRoundedKeyboard(keyboard))
    }

    if (format === 'kle-internal') {
      return getKleInternalFormat(keyboard)
    }

    return keyboard
  }

  const getRoundedKeyboard = (keyboard: Keyboard): Keyboard => {
    const roundToSixDecimals = (value: number): number => {
      return D.round(value, 6)
    }

    const roundedKeys = keyboard.keys.map((key) => {
      const roundedKey = { ...key }

      // Round all numeric properties to 6 decimal places
      if (typeof roundedKey.x === 'number') roundedKey.x = roundToSixDecimals(roundedKey.x)
      if (typeof roundedKey.y === 'number') roundedKey.y = roundToSixDecimals(roundedKey.y)
      if (typeof roundedKey.width === 'number')
        roundedKey.width = roundToSixDecimals(roundedKey.width)
      if (typeof roundedKey.height === 'number')
        roundedKey.height = roundToSixDecimals(roundedKey.height)
      if (typeof roundedKey.x2 === 'number') roundedKey.x2 = roundToSixDecimals(roundedKey.x2)
      if (typeof roundedKey.y2 === 'number') roundedKey.y2 = roundToSixDecimals(roundedKey.y2)
      if (typeof roundedKey.width2 === 'number')
        roundedKey.width2 = roundToSixDecimals(roundedKey.width2)
      if (typeof roundedKey.height2 === 'number')
        roundedKey.height2 = roundToSixDecimals(roundedKey.height2)
      if (typeof roundedKey.rotation_x === 'number')
        roundedKey.rotation_x = roundToSixDecimals(roundedKey.rotation_x)
      if (typeof roundedKey.rotation_y === 'number')
        roundedKey.rotation_y = roundToSixDecimals(roundedKey.rotation_y)
      if (typeof roundedKey.rotation_angle === 'number')
        roundedKey.rotation_angle = roundToSixDecimals(roundedKey.rotation_angle)

      return roundedKey
    })

    const roundedKeyboard = new Keyboard()
    roundedKeyboard.keys = roundedKeys
    roundedKeyboard.meta = keyboard.meta

    return roundedKeyboard
  }

  const getKleInternalFormat = (keyboard: Keyboard) => {
    const roundedKeyboard = getRoundedKeyboard(keyboard)

    return {
      meta: roundedKeyboard.meta,
      keys: roundedKeyboard.keys,
    }
  }

  const loadKLELayout = (kleData: unknown) => {
    const keyboard = Serial.deserialize(kleData as Array<unknown>)
    loadLayout(keyboard.keys, keyboard.meta)
  }

  const updateLayoutFromJson = (kleData: unknown) => {
    // Similar to loadKLELayout but preserves undo history
    const keyboard = Serial.deserialize(kleData as Array<unknown>)

    try {
      keys.value = JSON.parse(JSON.stringify(keyboard.keys)) // Deep copy
      metadata.value = { ...metadata.value, ...keyboard.meta }
      selectedKeys.value = []
      // Don't clear history - this preserves undo functionality
      saveState() // This adds current state to history
      dirty.value = true // Mark as dirty since user made changes
    } catch (error) {
      console.error('Error updating layout from JSON:', error)
      throw error
    }
  }

  // Initialize with a sample layout for development/demo (not in tests)
  const initWithSample = () => {
    // Skip sample initialization if we're in test environment
    if (
      import.meta.env.MODE === 'test' ||
      typeof (globalThis as Record<string, unknown>).describe !== 'undefined' ||
      (typeof navigator !== 'undefined' && navigator.webdriver)
    ) {
      // Initialize empty state for tests
      saveState()
      dirty.value = false
      return
    }

    // Check if there's a shared layout in the URL first
    if (loadFromShareUrl()) {
      return // Successfully loaded from share URL
    }

    const sampleLayout = [
      [
        'Num Lock',
        '/',
        '*',
        '-',
        { x: 0.25, f: 4, w: 14, h: 5, d: true },
        "Getting Started with Keyboard Layout Editor NG<br><br>Start by exploring the presets and samples from the menu-bar to give you an idea of the possibilities. Once you are ready to start designing your own keyboard, just load one of the presets and start customizing it!<br><br>→ Use left-side toolbar to add and edit keys<br>→ The selected keys can be modified on the Properties tab. Use mouse left click to select one or multiple keys<br>→ Move selection with arrows or with mouse middle-click drag.<br><br>When you're ready to save your layout, simply use 'Export' from the menu-bar. Have fun!",
      ],
      [{ f: 3 }, '7\nHome', '8\n↑', '9\nPgUp', { h: 2 }, '+'],
      ['4\n←', '5', '6\n→'],
      ['1\nEnd', '2\n↓', '3\nPgDn', { h: 2 }, 'Enter'],
      [{ w: 2 }, '0\nIns', '.\nDel'],
    ]

    try {
      const keyboard = Serial.deserialize(sampleLayout)
      keys.value = keyboard.keys
      metadata.value = keyboard.meta
      selectedKeys.value = []
      history.value = []
      historyIndex.value = -1
      saveState()
      dirty.value = false
      resetViewTrigger.value++
    } catch (error) {
      console.error('Error loading sample layout:', error)
      saveState()
      dirty.value = false
    }
  }

  // Toolbar actions
  const setCanvasMode = (mode: 'select' | 'mirror-h' | 'mirror-v' | 'rotate' | 'move-exactly') => {
    canvasMode.value = mode
    // Reset any ongoing operations when switching modes
    mouseDragMode.value = 'none'
    draggedKey.value = null
    tempSelectedKeys.value = []
    mirrorAxis.value = null
    showMirrorPreview.value = false
    rotationOrigin.value = null
    rotationPreviewAngle.value = 0
    showRotationPreview.value = false
  }

  const setMoveStep = (step: number) => {
    if (step >= 0.05 && step <= 5) {
      moveStep.value = step
    }
  }

  const setLockRotations = (locked: boolean) => {
    lockRotations.value = locked
  }

  const startKeyDrag = (key: Key, startPos: { x: number; y: number }) => {
    mouseDragMode.value = 'key-move'
    draggedKey.value = key

    // Store drag start position in canvas pixels
    dragStartPos.value = {
      x: startPos.x,
      y: startPos.y,
    }
    keyOriginalPos.value = { x: key.x, y: key.y }

    // Set up multi-key dragging if the clicked key is part of current selection
    if (selectedKeys.value.includes(key) && selectedKeys.value.length > 1) {
      draggedKeys.value = [...selectedKeys.value]
      keysOriginalPositions.value.clear()
      keysOriginalRotations.value.clear()
      selectedKeys.value.forEach((selectedKey) => {
        keysOriginalPositions.value.set(selectedKey, { x: selectedKey.x, y: selectedKey.y })
        // Store original rotation origins for lock rotations feature
        if (lockRotations.value) {
          keysOriginalRotations.value.set(selectedKey, {
            rotation_x: selectedKey.rotation_x,
            rotation_y: selectedKey.rotation_y,
          })
        }
      })
    } else {
      // Single key drag (current behavior)
      draggedKeys.value = [key]
      keysOriginalPositions.value.clear()
      keysOriginalRotations.value.clear()
      keysOriginalPositions.value.set(key, { x: key.x, y: key.y })
      // Store original rotation origins for lock rotations feature
      if (lockRotations.value) {
        keysOriginalRotations.value.set(key, {
          rotation_x: key.rotation_x,
          rotation_y: key.rotation_y,
        })
      }
    }
  }

  const updateKeyDrag = (currentPos: { x: number; y: number }) => {
    if (mouseDragMode.value === 'key-move' && draggedKey.value) {
      // Calculate mouse movement delta in canvas pixels
      const deltaPixelsX = D.sub(currentPos.x, dragStartPos.value.x)
      const deltaPixelsY = D.sub(currentPos.y, dragStartPos.value.y)

      // Convert pixel delta to key units - this is the screen-space movement
      const CANVAS_UNIT = 54
      const screenDeltaX = D.div(deltaPixelsX, CANVAS_UNIT)
      const screenDeltaY = D.div(deltaPixelsY, CANVAS_UNIT)

      // Update all dragged keys
      draggedKeys.value.forEach((key) => {
        const originalPos = keysOriginalPositions.value.get(key)
        if (originalPos) {
          let worldDeltaX = screenDeltaX
          let worldDeltaY = screenDeltaY

          // For rotated keys, transform screen-space delta to world-space delta
          // This ensures the key moves in the same direction as the mouse cursor
          if (key.rotation_angle && key.rotation_angle !== 0) {
            // Convert rotation angle to radians (no inversion - we want screen to world)
            const rad = D.degreesToRadians(key.rotation_angle)
            const cos = D.cos(rad)
            const sin = D.sin(rad)

            // Transform screen delta to world delta using rotation matrix
            worldDeltaX = D.add(D.mul(screenDeltaX, cos), D.mul(screenDeltaY, sin))
            worldDeltaY = D.add(D.mul(-screenDeltaX, sin), D.mul(screenDeltaY, cos))
          }

          // Apply increment-based snapping like keyboard movement
          const snappedDeltaX = D.roundToStep(worldDeltaX, moveStep.value)
          const snappedDeltaY = D.roundToStep(worldDeltaY, moveStep.value)

          key.x = D.add(originalPos.x, snappedDeltaX) // Allow negative positions
          key.y = D.add(originalPos.y, snappedDeltaY)

          // Update rotation origins to maintain relative offset when lock rotations is enabled
          if (lockRotations.value) {
            const originalRotation = keysOriginalRotations.value.get(key)
            if (originalRotation) {
              if (originalRotation.rotation_x !== undefined) {
                key.rotation_x = D.add(originalRotation.rotation_x, snappedDeltaX)
              }
              if (originalRotation.rotation_y !== undefined) {
                key.rotation_y = D.add(originalRotation.rotation_y, snappedDeltaY)
              }
            }
          }
        }
      })
    }
  }

  const endKeyDrag = () => {
    if (mouseDragMode.value === 'key-move') {
      mouseDragMode.value = 'none'
      draggedKey.value = null
      draggedKeys.value = []
      keysOriginalPositions.value.clear()
      keysOriginalRotations.value.clear()
      saveState()
    }
  }

  const startRectSelect = (startPos: { x: number; y: number }) => {
    mouseDragMode.value = 'rect-select'
    rectSelectStart.value = { ...startPos }
    rectSelectEnd.value = { ...startPos }
    tempSelectedKeys.value = []
  }

  const updateRectSelect = (endPos: { x: number; y: number }, selectedKeys: Key[]) => {
    if (mouseDragMode.value === 'rect-select') {
      rectSelectEnd.value = { ...endPos }
      tempSelectedKeys.value = selectedKeys
    }
  }

  const endRectSelect = () => {
    if (mouseDragMode.value === 'rect-select') {
      selectedKeys.value = [...tempSelectedKeys.value]
      mouseDragMode.value = 'none'
      tempSelectedKeys.value = []
    }
  }

  const setMirrorAxis = (pos: { x: number; y: number }, direction: 'horizontal' | 'vertical') => {
    // Convert canvas coordinates to key units (same logic as updateMousePosition)
    // pos already comes from getCanvasPosition() which accounts for zoom, pan, and coordinate offset
    const RENDER_UNIT = 54 // Should match renderOptions.unit

    // Convert to key units
    const rawX = D.div(pos.x, RENDER_UNIT)
    const rawY = D.div(pos.y, RENDER_UNIT)

    // Snap to move step grid
    const snapX = D.roundToStep(rawX, moveStep.value)
    const snapY = D.roundToStep(rawY, moveStep.value)

    mirrorAxis.value = {
      x: snapX,
      y: snapY,
      direction,
    }
    showMirrorPreview.value = true
  }

  const performMirror = () => {
    if (!mirrorAxis.value || selectedKeys.value.length === 0) return

    const mirrored = selectedKeys.value.map((key) => {
      const newKey = JSON.parse(JSON.stringify(key)) as Key

      if (mirrorAxis.value!.direction === 'horizontal') {
        // Horizontal line mirrors keys vertically (across Y-axis)
        const keyY = key.y
        const lineY = mirrorAxis.value!.y
        newKey.y = D.mirrorPoint(keyY, lineY, key.height) // Mirror across horizontal line, allow negative

        // Handle rotation for horizontal mirror
        if (key.rotation_angle !== undefined && key.rotation_angle !== 0) {
          // Mirror the rotation angle - for horizontal mirror, negate the angle
          newKey.rotation_angle = -key.rotation_angle

          // Mirror the rotation origin Y coordinate
          if (key.rotation_y !== undefined) {
            newKey.rotation_y = D.mirrorPoint(key.rotation_y, lineY)
          }

          // Keep rotation origin X coordinate unchanged for horizontal mirror
          if (key.rotation_x !== undefined) {
            newKey.rotation_x = key.rotation_x
          }
        }
      } else {
        // Vertical line mirrors keys horizontally (across X-axis)
        const keyX = key.x
        const lineX = mirrorAxis.value!.x
        const mirroredX = D.mirrorPoint(keyX, lineX, key.width)
        newKey.x = mirroredX // Mirror across vertical line, allow negative

        // Handle rotation for vertical mirror
        if (key.rotation_angle !== undefined && key.rotation_angle !== 0) {
          // Mirror the rotation angle - for vertical mirror, negate the angle
          newKey.rotation_angle = -key.rotation_angle

          // Mirror the rotation origin X coordinate
          if (key.rotation_x !== undefined) {
            newKey.rotation_x = D.mirrorPoint(key.rotation_x, lineX)
          }

          // Keep rotation origin Y coordinate unchanged for vertical mirror
          if (key.rotation_y !== undefined) {
            newKey.rotation_y = key.rotation_y
          }
        }
      }

      return newKey
    })

    keys.value.push(...mirrored)
    selectedKeys.value = mirrored
    saveState()

    // Reset mirror state
    mirrorAxis.value = null
    showMirrorPreview.value = false
    canvasMode.value = 'select'
  }

  // Rotation functionality
  const startRotation = (origin: { x: number; y: number }) => {
    // Store original rotation state for all selected keys
    originalRotationStates.value.clear()
    selectedKeys.value.forEach((key) => {
      originalRotationStates.value.set(key, {
        rotation_angle: key.rotation_angle || 0,
        rotation_x: key.rotation_x,
        rotation_y: key.rotation_y,
        // Also store original key position to restore on cancel
        x: key.x,
        y: key.y,
      })

      // For already-rotated keys, transform their rotation origins to the new point
      // This ensures the rotation tool works correctly with mixed rotated/unrotated selections
      transformRotationOrigin(key, origin.x, origin.y)
    })

    rotationOrigin.value = { x: origin.x, y: origin.y }
    rotationPreviewAngle.value = 0
    showRotationPreview.value = true
  }

  const updateRotationPreview = (deltaAngle: number) => {
    // Apply rotation based on original state + delta
    selectedKeys.value.forEach((key) => {
      const originalState = originalRotationStates.value.get(key)
      if (originalState) {
        const newAngle = (originalState.rotation_angle || 0) + deltaAngle
        key.rotation_angle = ((newAngle % 360) + 360) % 360
        // rotation_x and rotation_y should already be set correctly from startRotation
      }
    })

    // Store the current delta for reference
    rotationPreviewAngle.value = deltaAngle
  }

  const applyRotation = () => {
    // Finalize the rotation and save state
    if (rotationOrigin.value && selectedKeys.value.length > 0) {
      saveState()
    }

    // Clear rotation state
    originalRotationStates.value.clear()
    rotationOrigin.value = null
    rotationPreviewAngle.value = 0
    showRotationPreview.value = false
    canvasMode.value = 'select'
  }

  const cancelRotation = () => {
    // Restore original rotation state for all selected keys
    selectedKeys.value.forEach((key) => {
      const originalState = originalRotationStates.value.get(key)
      if (originalState) {
        key.rotation_angle = originalState.rotation_angle || 0
        if (originalState.rotation_x !== undefined) {
          key.rotation_x = originalState.rotation_x
        }
        if (originalState.rotation_y !== undefined) {
          key.rotation_y = originalState.rotation_y
        }
        // Restore original key position to fix the bug where keys move on cancel
        if (originalState.x !== undefined) {
          key.x = originalState.x
        }
        if (originalState.y !== undefined) {
          key.y = originalState.y
        }
      }
    })

    // Clear rotation state
    originalRotationStates.value.clear()
    rotationOrigin.value = null
    rotationPreviewAngle.value = 0
    showRotationPreview.value = false
    canvasMode.value = 'select'
  }

  // Generalized function: Transform rotation origin from current to target point without changing visual appearance
  const transformRotationOrigin = (key: Key, targetOriginX: number, targetOriginY: number) => {
    // Only process keys that have rotation properties
    if (
      !key.rotation_angle ||
      key.rotation_angle === 0 ||
      key.rotation_x === undefined ||
      key.rotation_y === undefined
    ) {
      // For non-rotated keys, just set the new origin
      key.rotation_x = targetOriginX
      key.rotation_y = targetOriginY
      return
    }

    const currentOriginX = key.rotation_x
    const currentOriginY = key.rotation_y
    const angle = key.rotation_angle

    const angleRad = D.degreesToRadians(angle)
    const cos = Math.cos(angleRad)
    const sin = Math.sin(angleRad)

    // Step 1: Calculate current rendered position of key's top-left corner
    const dx_key = D.sub(key.x, currentOriginX)
    const dy_key = D.sub(key.y, currentOriginY)

    const renderedKeyX = D.add(currentOriginX, D.sub(D.mul(dx_key, cos), D.mul(dy_key, sin)))
    const renderedKeyY = D.add(currentOriginY, D.add(D.mul(dx_key, sin), D.mul(dy_key, cos)))

    // Step 2: Calculate new key position so that when rotated around target origin,
    // it produces the same rendered position
    const dx_rendered = D.sub(renderedKeyX, targetOriginX)
    const dy_rendered = D.sub(renderedKeyY, targetOriginY)

    // Apply inverse rotation to get new key position
    const newX = D.add(targetOriginX, D.add(D.mul(dx_rendered, cos), D.mul(dy_rendered, sin)))
    const newY = D.add(targetOriginY, D.sub(D.mul(dy_rendered, cos), D.mul(dx_rendered, sin)))

    // Update key properties
    key.x = newX
    key.y = newY
    key.rotation_x = targetOriginX
    key.rotation_y = targetOriginY
  }

  // Move selected keys by exact delta X and Y values (in internal units)
  const moveSelectedKeys = (deltaX: number, deltaY: number) => {
    selectedKeys.value.forEach((key) => {
      // Add delta to current position
      key.x = D.add(key.x, deltaX)
      key.y = D.add(key.y, deltaY)

      // If the key has rotation origins, move them too to maintain rotation behavior
      if (key.rotation_x !== undefined) {
        key.rotation_x = D.add(key.rotation_x, deltaX)
      }
      if (key.rotation_y !== undefined) {
        key.rotation_y = D.add(key.rotation_y, deltaY)
      }
    })
  }

  // Debug function: Move rotation origins to key centers for selected keys without changing visual appearance
  const moveRotationsToKeyCenters = () => {
    let modifiedCount = 0

    selectedKeys.value.forEach((key) => {
      if (key.rotation_angle && key.rotation_angle !== 0) {
        // Calculate visual center of the rotated key
        const currentOriginX = key.rotation_x!
        const currentOriginY = key.rotation_y!
        const angle = key.rotation_angle

        const angleRad = D.degreesToRadians(angle)
        const cos = Math.cos(angleRad)
        const sin = Math.sin(angleRad)

        // Get unrotated center and transform it to visual center
        const unrotatedCenterX = D.add(key.x, D.div(key.width || 1, 2))
        const unrotatedCenterY = D.add(key.y, D.div(key.height || 1, 2))

        const dx_center = D.sub(unrotatedCenterX, currentOriginX)
        const dy_center = D.sub(unrotatedCenterY, currentOriginY)

        const visualCenterX = D.add(
          currentOriginX,
          D.sub(D.mul(dx_center, cos), D.mul(dy_center, sin)),
        )
        const visualCenterY = D.add(
          currentOriginY,
          D.add(D.mul(dx_center, sin), D.mul(dy_center, cos)),
        )

        // Use generalized function to transform rotation origin
        transformRotationOrigin(key, visualCenterX, visualCenterY)
        modifiedCount++
      } else {
        // For non-rotated keys, set rotation origin to their center
        const centerX = D.add(key.x, D.div(key.width || 1, 2))
        const centerY = D.add(key.y, D.div(key.height || 1, 2))
        key.rotation_x = centerX
        key.rotation_y = centerY
        modifiedCount++
      }
    })

    if (modifiedCount > 0) {
      saveState()
    }
  }

  // URL Sharing functionality
  const generateShareUrl = (): string => {
    const layoutData: LayoutData = {
      keys: keys.value,
      metadata: metadata.value,
    }
    return generateShareableUrl(layoutData)
  }

  const loadFromShareUrl = (): boolean => {
    try {
      const sharedLayout = extractLayoutFromCurrentUrl()
      if (sharedLayout) {
        loadLayout(sharedLayout.keys, sharedLayout.metadata)
        clearShareFromUrl() // Clean up URL after loading
        return true
      }
      return false
    } catch (error) {
      console.error('Error loading layout from share URL:', error)
      return false
    }
  }

  // Helper functions for legend operations
  const saveToHistory = () => {
    saveState()
  }

  const markDirty = () => {
    dirty.value = true
  }

  initWithSample()

  return {
    keys,
    selectedKeys,
    metadata,
    clipboard,
    historyIndex,
    history,
    dirty,
    resetViewTrigger,

    // Toolbar state
    canvasMode,
    moveStep,
    lockRotations,
    mouseDragMode,
    draggedKey,
    draggedKeys,
    dragStartPos,
    keyOriginalPos,
    keysOriginalPositions,
    keysOriginalRotations,
    rectSelectStart,
    rectSelectEnd,
    tempSelectedKeys,
    mirrorAxis,
    showMirrorPreview,
    rotationOrigin,
    rotationPreviewAngle,
    showRotationPreview,

    canUndo,
    canRedo,
    canCopy,
    canPaste,

    addKey,
    addKeys,
    deleteKeys,
    selectKey,
    selectAll,
    unselectAll,
    copy,
    cut,
    paste,
    undo,
    redo,
    updateKeyProperty,
    updateSelectedKeys,
    loadLayout,
    clearLayout,
    loadKLELayout,
    updateLayoutFromJson,
    getSerializedData,
    saveState,

    // Toolbar actions
    setCanvasMode,
    setMoveStep,
    setLockRotations,
    startKeyDrag,
    updateKeyDrag,
    endKeyDrag,
    startRectSelect,
    updateRectSelect,
    endRectSelect,
    setMirrorAxis,
    performMirror,

    // Rotation functions
    startRotation,
    updateRotationPreview,
    applyRotation,
    cancelRotation,
    transformRotationOrigin,
    moveRotationsToKeyCenters,

    // Movement functions
    moveSelectedKeys,

    // URL sharing
    generateShareUrl,
    loadFromShareUrl,

    // Legend tools
    saveToHistory,
    markDirty,
  }
})
