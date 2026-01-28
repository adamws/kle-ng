import { defineStore } from 'pinia'
import type { Ref } from 'vue'
import { ref, computed } from 'vue'
import { Key, KeyboardMetadata, Keyboard, Serial } from '@adamws/kle-serial'
import { D } from '../utils/decimal-math'
import { toast } from '../composables/useToast'
import {
  generateShareableUrl,
  extractLayoutFromCurrentUrl,
  clearShareFromUrl,
  extractGistFromCurrentUrl,
  extractUrlFromCurrentUrl,
  fetchGistLayout,
  clearGistFromUrl,
  clearUrlFromHash,
  loadErgogenKeyboard,
} from '../utils/url-sharing'
import {
  createEmptyLabels,
  createEmptyTextColors,
  createEmptyTextSizes,
} from '../utils/array-helpers'
import { getSerializedData as getSerializedDataUtil } from '../utils/serialization'
import {
  transformRotationOrigin as transformRotationOriginUtil,
  moveRotationOriginsToPosition as moveRotationOriginsToPositionUtil,
  mirrorKeys as mirrorKeysUtil,
  calculateMirrorAxis as calculateMirrorAxisUtil,
  type MirrorAxis,
} from '../utils/keyboard-transformations'
import { useFontStore } from './font'
import { svgCache } from '../utils/caches/SVGCache'
import { parseCache } from '../utils/caches/ParseCache'
import { imageCache } from '../utils/caches/ImageCache'
import { validateMatrixDuplicates } from '../utils/matrix-validation'

export { Key, Keyboard, KeyboardMetadata, type Array12 } from '@adamws/kle-serial'

// localStorage key for persisting lock rotations setting
const LOCK_ROTATIONS_KEY = 'kle-ng-lock-rotations'

export interface KeyboardState {
  keys: Key[]
  selectedKeys: Key[]
  metadata: KeyboardMetadata
  filename: string // Original filename for downloads
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
  const filename: Ref<string> = ref('')
  const clipboard: Ref<Key[]> = ref([])
  const historyIndex = ref(-1)
  const history: Ref<
    {
      keys: Key[]
      metadata: KeyboardMetadata
    }[]
  > = ref([])
  // Smart dirty detection: compare current state to baseline snapshot
  const baselineSnapshot = ref<string>('')

  const createSnapshot = (): string => {
    return JSON.stringify({
      keys: keys.value,
      metadata: metadata.value,
    })
  }

  const dirty = computed(() => {
    // If no baseline set yet, not dirty
    if (!baselineSnapshot.value) return false
    return createSnapshot() !== baselineSnapshot.value
  })

  const updateBaseline = () => {
    baselineSnapshot.value = createSnapshot()
  }

  const resetViewTrigger = ref(0) // Incremented when layout changes to trigger view reset

  const canvasMode = ref<'select' | 'mirror-h' | 'mirror-v' | 'rotate' | 'move-exactly'>('select')
  const moveStep = ref(0.25)

  // Initialize lockRotations from localStorage
  const getLockRotationsFromStorage = (): boolean => {
    const stored = localStorage.getItem(LOCK_ROTATIONS_KEY)
    return stored === 'true'
  }
  const lockRotations = ref(getLockRotationsFromStorage())

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

  const mirrorAxis: Ref<MirrorAxis | null> = ref(null)
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

  // Overlapping key selection popup state
  const keySelectionPopup = ref<{
    visible: boolean
    position: { x: number; y: number }
    keys: Key[]
    extendSelection: boolean
  }>({
    visible: false,
    position: { x: 0, y: 0 },
    keys: [],
    extendSelection: false,
  })
  const popupHoveredKey: Ref<Key | null> = ref(null)

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

  /**
   * Clear all render caches (SVG, parse, and image caches)
   * Called when layout changes to ensure fresh rendering
   */
  const clearRenderCaches = () => {
    svgCache.clear()
    parseCache.clear()
    imageCache.clear()
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

    // Notify canvas of potential bounds changes
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('keys-modified'))
    }
  }

  /**
   * Adds a new key to the keyboard layout.
   * If no position is specified, positions the key next to the currently selected key,
   * or at the end of the layout if no key is selected.
   * Automatically selects the newly added key and saves state to history.
   * @param keyData - Optional partial key data to override defaults
   */
  const addKey = (keyData?: Partial<Key>) => {
    const newKey = { ...createKey(), ...keyData }

    // Position new key next to selected key if one is selected
    if (keys.value.length > 0 && !keyData?.x && !keyData?.y) {
      if (selectedKeys.value.length > 0) {
        // Position next to the last selected key, accounting for rotation
        const referenceKey = selectedKeys.value[selectedKeys.value.length - 1]

        if (referenceKey) {
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
        }
      } else {
        // Fallback to end of layout if no selection
        const lastKey = keys.value[keys.value.length - 1]
        if (lastKey) {
          newKey.x = D.add(lastKey.x, lastKey.width)
          newKey.y = lastKey.y
        }
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
    if (minIndex === undefined) return

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
      const keyAtIndex = keys.value[newIndex]
      if (keyAtIndex) {
        selectedKeys.value = [keyAtIndex]
      } else {
        selectedKeys.value = []
      }
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

  // Overlapping key selection popup actions
  const showKeySelectionPopup = (
    x: number,
    y: number,
    overlappingKeys: Key[],
    extendSelection: boolean,
  ) => {
    keySelectionPopup.value = {
      visible: true,
      position: { x, y },
      keys: overlappingKeys,
      extendSelection,
    }
  }

  const hideKeySelectionPopup = () => {
    keySelectionPopup.value = {
      visible: false,
      position: { x: 0, y: 0 },
      keys: [],
      extendSelection: false,
    }
    popupHoveredKey.value = null
  }

  const selectKeyFromPopup = (key: Key) => {
    selectKey(key, keySelectionPopup.value.extendSelection)
    hideKeySelectionPopup()
  }

  const setPopupHoveredKey = (key: Key | null) => {
    popupHoveredKey.value = key
  }

  const copy = async () => {
    if (selectedKeys.value.length === 0) return

    // Keep existing internal clipboard for compatibility
    clipboard.value = JSON.parse(JSON.stringify(selectedKeys.value))

    // Convert selected keys to raw KLE format and copy to system clipboard
    try {
      const tempKeyboard = new Keyboard()
      tempKeyboard.keys = selectedKeys.value
      const rawKleData = JSON.stringify(Serial.serialize(tempKeyboard))

      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(rawKleData)
        // Show success toast
        const keyCount = selectedKeys.value.length
        toast.showSuccess(
          `${keyCount} ${keyCount === 1 ? 'key' : 'keys'} copied to clipboard`,
          'Copied',
          { duration: 2000 },
        )
        return // Successfully copied to system clipboard
      }

      // Fallback to canvas event for older browsers
      window.dispatchEvent(new CustomEvent('system-copy', { detail: rawKleData }))
      // Show success toast for fallback method too
      const keyCount = selectedKeys.value.length
      toast.showSuccess(
        `${keyCount} ${keyCount === 1 ? 'key' : 'keys'} copied to clipboard`,
        'Copied',
        { duration: 2000 },
      )
    } catch (error) {
      // Keep internal clipboard only
      console.warn('System clipboard copy failed:', error)
    }
  }

  const cut = async () => {
    if (selectedKeys.value.length === 0) return

    const keyCount = selectedKeys.value.length

    // Keep existing internal clipboard for compatibility
    clipboard.value = JSON.parse(JSON.stringify(selectedKeys.value))

    // Convert selected keys to raw KLE format and copy to system clipboard
    try {
      const tempKeyboard = new Keyboard()
      tempKeyboard.keys = selectedKeys.value
      const rawKleData = JSON.stringify(Serial.serialize(tempKeyboard))

      // Try modern Clipboard API first
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(rawKleData)
      } else {
        // Fallback to canvas event for older browsers
        window.dispatchEvent(new CustomEvent('system-copy', { detail: rawKleData }))
      }
    } catch (error) {
      console.warn('System clipboard copy failed:', error)
    }

    // Delete the keys
    deleteKeys()

    // Show success toast for cut operation
    toast.showSuccess(`${keyCount} ${keyCount === 1 ? 'key' : 'keys'} cut to clipboard`, 'Cut', {
      duration: 2000,
    })
  }

  const paste = async () => {
    // Try direct clipboard access
    if (navigator.clipboard && window.isSecureContext) {
      try {
        const clipboardText = await navigator.clipboard.readText()
        if (clipboardText && clipboardText.trim()) {
          handleSystemClipboardData(clipboardText)
        }
      } catch (error) {
        // Clipboard access failed
        console.warn('Clipboard access failed:', error)
      }
    }
  }

  // New method to handle system clipboard paste data
  const handleSystemClipboardData = (rawKleData: string): boolean => {
    try {
      const kleArray = JSON.parse(rawKleData)
      const keyboard = Serial.deserialize(kleArray)

      if (keyboard && keyboard.keys && keyboard.keys.length > 0) {
        // Use system clipboard data at original positions
        const pastedKeys = keyboard.keys.map((key) => ({
          ...key,
        }))

        keys.value.push(...pastedKeys)
        selectedKeys.value = pastedKeys
        saveState()

        // Show success toast
        const keyCount = pastedKeys.length
        toast.showSuccess(
          `${keyCount} ${keyCount === 1 ? 'key' : 'keys'} pasted from clipboard`,
          'Pasted',
          { duration: 2000 },
        )
        return true
      }
    } catch {
      // Show error toast for invalid clipboard data
      toast.showError('Clipboard data is not in a valid keyboard layout format', 'Paste Failed', {
        duration: 3000,
      })
      return false
    }

    // Valid JSON but no valid keyboard data found
    toast.showError(
      'Clipboard data does not contain valid keyboard layout information',
      'Paste Failed',
      { duration: 3000 },
    )
    return false
  }

  const undo = () => {
    if (!canUndo.value) return

    historyIndex.value--
    const state = history.value[historyIndex.value]
    if (!state) return // Guard against undefined state

    keys.value = JSON.parse(JSON.stringify(state.keys))
    metadata.value = JSON.parse(JSON.stringify(state.metadata))
    selectedKeys.value = []

    // Notify canvas of potential bounds changes (undo doesn't call saveState)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('keys-modified'))
    }
  }

  const redo = () => {
    if (!canRedo.value) return

    historyIndex.value++
    const state = history.value[historyIndex.value]
    if (!state) return // Guard against undefined state

    keys.value = JSON.parse(JSON.stringify(state.keys))
    metadata.value = JSON.parse(JSON.stringify(state.metadata))
    selectedKeys.value = []

    // Notify canvas of potential bounds changes (redo doesn't call saveState)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('keys-modified'))
    }
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

  /**
   * Loads a keyboard layout into the store.
   * Performs a deep copy of keys and metadata to ensure data isolation.
   * Resets history, selection, and triggers view reset.
   * Applies font settings from CSS metadata if present.
   * @param keyboard - The keyboard layout to load
   * @throws {Error} If the layout cannot be loaded
   */
  const loadKeyboard = (keyboard: Keyboard) => {
    try {
      keys.value = JSON.parse(JSON.stringify(keyboard.keys))
      // Merge with defaults to ensure all standard properties exist
      const defaults = new KeyboardMetadata()
      metadata.value = { ...defaults, ...JSON.parse(JSON.stringify(keyboard.meta)) }

      // Apply font settings from CSS metadata if present
      const fontStore = useFontStore()
      if (keyboard.meta?.css) {
        fontStore.applyFromCssMetadata(keyboard.meta.css)
      } else {
        // No CSS metadata, reset to default font
        fontStore.resetToDefault()
      }

      selectedKeys.value = []
      history.value = []
      historyIndex.value = -1
      saveState()
      updateBaseline()
      resetViewTrigger.value++ // Trigger view reset (will preserve zoom, reset pan only)

      // Clear render caches when loading new layout
      clearRenderCaches()

      // Validate matrix duplicates after loading
      // Per VIA spec, duplicate matrix positions must have option,choice labels
      const validation = validateMatrixDuplicates(keys.value)
      if (!validation.isValid) {
        const positions = validation.duplicatesWithoutOption.map((d) => d.position).join(', ')
        toast.showWarning(
          `Layout has duplicate matrix positions without option,choice labels: ${positions}. Per VIA spec, keys sharing a matrix position must have option,choice labels in the bottom-right label (e.g., "0,0", "0,1").`,
          'Matrix Warning',
          { duration: 8000 },
        )
      }
    } catch (error) {
      console.error('Error loading layout:', error)
      throw error
    }
  }

  /**
   * Clears the current keyboard layout, resetting all state to defaults.
   * Removes all keys, clears selection, resets metadata, and clears history.
   * Resets font to default and triggers view reset.
   */
  const clearLayout = () => {
    keys.value = []
    selectedKeys.value = []
    metadata.value = new KeyboardMetadata()
    filename.value = ''
    history.value = []
    historyIndex.value = -1

    // Reset to default font when clearing layout
    const fontStore = useFontStore()
    fontStore.resetToDefault()

    saveState()
    updateBaseline()
    resetViewTrigger.value++ // Trigger view reset
  }

  /**
   * Serializes the current keyboard layout in the specified format.
   * Wrapper around the utility function that builds a Keyboard from the store state.
   *
   * @param format - The serialization format:
   *   - 'internal': Returns Keyboard object (default)
   *   - 'kle': Returns KLE compact format (array-based)
   *   - 'kle-internal': Returns object format with proper property ordering for JSON export
   * @returns The serialized keyboard data
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getSerializedData = (format: 'kle' | 'kle-internal' | 'internal' = 'internal'): any => {
    const keyboard = new Keyboard()
    keyboard.keys = JSON.parse(JSON.stringify(keys.value))
    keyboard.meta = JSON.parse(JSON.stringify(metadata.value))

    return getSerializedDataUtil(keyboard, format)
  }

  const loadKLELayout = (kleData: unknown) => {
    const keyboard = Serial.deserialize(kleData as Array<unknown>)
    loadKeyboard(keyboard)
  }

  const updateLayoutFromJson = (kleData: unknown) => {
    // Similar to loadKLELayout but preserves undo history
    const keyboard = Serial.deserialize(kleData as Array<unknown>)

    try {
      selectedKeys.value = []

      keys.value = keyboard.keys
      metadata.value = keyboard.meta

      // Apply font settings from CSS metadata if present
      const fontStore = useFontStore()
      if (keyboard.meta?.css) {
        fontStore.applyFromCssMetadata(keyboard.meta.css)
      } else {
        // No CSS metadata, reset to default font
        fontStore.resetToDefault()
      }

      // Don't clear history - this preserves undo functionality
      saveState() // This adds current state to history

      // Clear render caches when updating layout from JSON
      clearRenderCaches()
    } catch (error) {
      console.error('Error updating layout from JSON:', error)
      throw error
    }
  }

  // Initialize with a sample layout for development/demo (not in tests)
  const initWithSample = async () => {
    // Skip sample initialization if we're in test environment
    if (
      import.meta.env.MODE === 'test' ||
      typeof (globalThis as Record<string, unknown>).describe !== 'undefined' ||
      (typeof navigator !== 'undefined' && navigator.webdriver)
    ) {
      // Initialize empty state for tests
      saveState()
      updateBaseline()
      return
    }

    // Check if there's a shared layout in the URL
    if (loadFromShareUrl()) {
      return // Successfully loaded from share URL
    }

    // Check for #url= or #gist= formats (both are valid, #gist= is preferred for gists)
    if (await loadFromUrlHash()) {
      return // Successfully loaded from URL hash
    }

    // Direct #gist=ID format (shorter, preferred for gists)
    if (await loadFromGistUrl()) {
      return // Successfully loaded from gist URL
    }

    const sampleLayout = [
      [
        'Num Lock',
        '/',
        '*',
        '-',
        { x: 0.25, f: 5, w: 12.5, h: 5, d: true },
        'Getting Started with Keyboard Layout Editor NG<br><br>Start by exploring the presets from the menu-bar to give you an idea of the possibilities.<br>Once you are ready to start designing your own keyboard, just load one of the presets and start customizing it!<br><br><ul><li>Use left-side toolbar to add and edit keys</li><li>The selected keys can be modified on the <i>Properties</i> tab. Use mouse left click to select one or multiple keys</li><li>Move selection with arrows or with mouse middle-click drag</li><li>To learn more see <a href="https://github.com/adamws/kle-ng/blob/master/README.md">documentation</a></li></ul><br>When you\'re ready to save your layout, simply use <i>Export</i> from the menu-bar. Have fun!',
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
      updateBaseline()
      resetViewTrigger.value++
    } catch (error) {
      console.error('Error loading sample layout:', error)
      saveState()
      updateBaseline()
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
    // Persist to localStorage
    localStorage.setItem(LOCK_ROTATIONS_KEY, String(locked))
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
          let deltaX = screenDeltaX
          let deltaY = screenDeltaY

          // When lock rotations is enabled, move everything in screen coordinates
          // When disabled, transform screen delta to world delta for rotated keys
          if (!lockRotations.value && key.rotation_angle && key.rotation_angle !== 0) {
            // Transform screen delta to world delta using rotation matrix
            // This ensures the key moves in the same direction as the mouse cursor
            const rad = D.degreesToRadians(key.rotation_angle)
            const cos = D.cos(rad)
            const sin = D.sin(rad)

            deltaX = D.add(D.mul(screenDeltaX, cos), D.mul(screenDeltaY, sin))
            deltaY = D.add(D.mul(-screenDeltaX, sin), D.mul(screenDeltaY, cos))
          }

          // Apply increment-based snapping like keyboard movement
          const snappedDeltaX = D.roundToStep(deltaX, moveStep.value)
          const snappedDeltaY = D.roundToStep(deltaY, moveStep.value)

          key.x = D.add(originalPos.x, snappedDeltaX) // Allow negative positions
          key.y = D.add(originalPos.y, snappedDeltaY)

          // Update rotation origins to maintain relative offset when lock rotations is enabled
          if (lockRotations.value && key.rotation_angle && key.rotation_angle !== 0) {
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

  // Wrapper: Calculate mirror axis position from canvas coordinates
  // Implementation moved to src/utils/keyboard-transformations.ts
  const setMirrorAxis = (pos: { x: number; y: number }, direction: 'horizontal' | 'vertical') => {
    const RENDER_UNIT = 54 // Should match renderOptions.unit
    mirrorAxis.value = calculateMirrorAxisUtil(pos, direction, RENDER_UNIT, moveStep.value)
    showMirrorPreview.value = true
  }

  const performMirror = () => {
    if (!mirrorAxis.value || selectedKeys.value.length === 0) return

    // Utility returns NEW mirrored keys
    const mirrored = mirrorKeysUtil(selectedKeys.value, mirrorAxis.value)

    // Store adds them to layout
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

  // Wrapper: Transform rotation origin from current to target point without changing visual appearance
  // Implementation moved to src/utils/keyboard-transformations.ts
  const transformRotationOrigin = (key: Key, targetOriginX: number, targetOriginY: number) => {
    transformRotationOriginUtil(key, targetOriginX, targetOriginY)
  }

  // Move selected keys by exact delta X and Y values (in internal units)
  const moveSelectedKeys = (deltaX: number, deltaY: number) => {
    selectedKeys.value.forEach((key) => {
      // Add delta to current position
      key.x = D.add(key.x, deltaX)
      key.y = D.add(key.y, deltaY)

      // Update rotation origins when lock rotations is enabled and key has non-zero rotation
      if (lockRotations.value && key.rotation_angle && key.rotation_angle !== 0) {
        if (key.rotation_x !== undefined) {
          key.rotation_x = D.add(key.rotation_x, deltaX)
        }
        if (key.rotation_y !== undefined) {
          key.rotation_y = D.add(key.rotation_y, deltaY)
        }
      }
    })
  }

  // Wrapper: Move rotation origins to a specific position or key centers
  // Implementation moved to src/utils/keyboard-transformations.ts
  // Store wrapper adds state management (saveState) after modifications
  const moveRotationOriginsToPosition = (
    position: { x: number; y: number } | null,
    targetKeys?: Key[],
  ) => {
    const keysToModify = targetKeys || selectedKeys.value
    const modifiedCount = moveRotationOriginsToPositionUtil(keys.value, position, keysToModify)

    if (modifiedCount > 0) {
      saveState()
    }
  }

  // URL Sharing functionality
  const generateShareUrl = (): string => {
    const keyboard = new Keyboard()
    keyboard.keys = keys.value
    keyboard.meta = metadata.value
    return generateShareableUrl(keyboard)
  }

  const loadFromShareUrl = (): boolean => {
    try {
      const sharedLayout = extractLayoutFromCurrentUrl()
      if (sharedLayout) {
        loadKeyboard(sharedLayout)
        clearShareFromUrl() // Clean up URL after loading
        return true
      }
      return false
    } catch (error) {
      console.error('Error loading layout from share URL:', error)
      return false
    }
  }

  const loadFromUrlHash = async (): Promise<boolean> => {
    try {
      // Try #url= format first
      let urlParam = extractUrlFromCurrentUrl()
      let isGistFormat = false

      // Also check #gist= format (both are valid, #gist= is preferred for gists)
      if (!urlParam) {
        const gistId = extractGistFromCurrentUrl()
        if (gistId) {
          urlParam = gistId
          isGistFormat = true
        }
      }

      if (urlParam) {
        const startTime = Date.now()
        let loadingToastId: string | null = null
        let loadingToastTimer: number | null = null
        let isLoadingToastVisible = false

        // Delay showing loading toast to avoid flicker for quick loads
        const showLoadingToast = () => {
          if (!isLoadingToastVisible) {
            loadingToastId = toast.showInfo('Loading keyboard layout from URL...', 'Loading', {
              duration: 0,
            })
            isLoadingToastVisible = true
          }
        }

        // Schedule loading toast to show after 500ms
        loadingToastTimer = window.setTimeout(showLoadingToast, 500)

        try {
          let keyboard: Keyboard

          // Determine the type of URL and load accordingly
          if (urlParam.includes('ergogen.xyz') && urlParam.includes('#')) {
            const ergogenKeyboard = await loadErgogenKeyboard(urlParam)
            if (!ergogenKeyboard) {
              throw new Error('No valid Ergogen data found in URL')
            } else {
              keyboard = ergogenKeyboard
            }
          } else if (urlParam.includes('gist.github.com')) {
            // Full GitHub Gist URL
            const gistMatch = urlParam.match(/gist\.github\.com\/[^/]+\/([a-f0-9]+)/)
            if (gistMatch && gistMatch[1]) {
              keyboard = await fetchGistLayout(gistMatch[1])
            } else {
              throw new Error('Invalid GitHub Gist URL format')
            }
          } else if (/^[a-f0-9]+$/i.test(urlParam)) {
            // Gist ID format (preferred for gists as it's shorter)
            keyboard = await fetchGistLayout(urlParam)
          } else {
            // Direct URL to JSON file
            const response = await fetch(urlParam)
            if (!response.ok) {
              throw new Error(`Failed to fetch layout: ${response.status} ${response.statusText}`)
            }

            const kleData = await response.json()

            if (!Array.isArray(kleData)) {
              throw new Error('Invalid KLE layout data structure - expected array format')
            }

            // Deserialize using KLE's standard format
            keyboard = Serial.deserialize(kleData)
          }

          loadKeyboard(keyboard)

          // Clean up URL after loading
          if (isGistFormat) {
            clearGistFromUrl()
          } else {
            clearUrlFromHash()
          }

          const loadTime = Date.now() - startTime

          // Clear the pending loading toast timer
          if (loadingToastTimer) {
            clearTimeout(loadingToastTimer)
          }

          // Handle loading toast removal with minimum display time
          const handleToastTransition = async () => {
            if (isLoadingToastVisible && loadingToastId) {
              // Ensure loading toast is visible for at least 1000ms
              const minDisplayTime = 1000
              const remainingTime = Math.max(0, minDisplayTime - loadTime)

              if (remainingTime > 0) {
                await new Promise((resolve) => setTimeout(resolve, remainingTime))
              }

              toast.removeToast(loadingToastId)
            }

            // Show success toast
            toast.showSuccess('Keyboard layout loaded successfully from URL!', 'Loaded')
          }

          // Handle toast transition asynchronously to not block the main loading
          handleToastTransition().catch(console.error)

          return true
        } catch (fetchError) {
          // Clear the pending loading toast timer
          if (loadingToastTimer) {
            clearTimeout(loadingToastTimer)
          }

          // Remove loading toast if it was shown
          if (isLoadingToastVisible && loadingToastId) {
            toast.removeToast(loadingToastId)
          }

          // Show specific error based on the type
          const errorMessage =
            fetchError instanceof Error ? fetchError.message : 'Unknown error occurred'

          if (errorMessage.includes('Gist not found')) {
            toast.showError(
              'The specified GitHub Gist could not be found. Please check the URL and try again.',
              'Gist Not Found',
            )
          } else if (errorMessage.includes('Rate limit exceeded')) {
            toast.showError(
              'GitHub API rate limit exceeded. Please try again later.',
              'Rate Limit Exceeded',
            )
          } else if (errorMessage.includes('No keyboard layout file found')) {
            toast.showError(
              'The gist does not contain a valid keyboard layout file. Please ensure the gist has a JSON file with KLE layout data.',
              'Invalid Gist',
            )
          } else if (errorMessage.includes('Invalid JSON format')) {
            toast.showError(
              'The layout file contains invalid JSON. Please check the file format.',
              'Invalid JSON',
            )
          } else if (errorMessage.includes('Invalid KLE layout data structure')) {
            toast.showError(
              'The file is not in the correct KLE format. Expected an array structure.',
              'Invalid Format',
            )
          } else if (errorMessage.includes('Failed to fetch')) {
            toast.showError(
              'Failed to fetch the layout from the URL. Please check the URL and try again.',
              'Fetch Failed',
            )
          } else {
            toast.showError(`Failed to load layout from URL: ${errorMessage}`, 'Load Failed')
          }

          throw fetchError
        }
      }
      return false
    } catch (error) {
      console.error('Error loading layout from URL hash:', error)
      return false
    }
  }

  const loadFromGistUrl = async (): Promise<boolean> => {
    try {
      const gistId = extractGistFromCurrentUrl()
      if (gistId) {
        const startTime = Date.now()
        let loadingToastId: string | null = null
        let loadingToastTimer: number | null = null
        let isLoadingToastVisible = false

        // Delay showing loading toast to avoid flicker for quick loads
        const showLoadingToast = () => {
          if (!isLoadingToastVisible) {
            loadingToastId = toast.showInfo(
              'Loading keyboard layout from GitHub Gist...',
              'Loading',
              { duration: 0 },
            )
            isLoadingToastVisible = true
          }
        }

        // Schedule loading toast to show after 500ms
        loadingToastTimer = window.setTimeout(showLoadingToast, 500)

        try {
          const gistLayout = await fetchGistLayout(gistId)
          loadKeyboard(gistLayout)
          clearGistFromUrl() // Clean up URL after loading

          const loadTime = Date.now() - startTime

          // Clear the pending loading toast timer
          if (loadingToastTimer) {
            clearTimeout(loadingToastTimer)
          }

          // Handle loading toast removal with minimum display time
          const handleToastTransition = async () => {
            if (isLoadingToastVisible && loadingToastId) {
              // Ensure loading toast is visible for at least 1000ms
              const minDisplayTime = 1000
              const remainingTime = Math.max(0, minDisplayTime - loadTime)

              if (remainingTime > 0) {
                await new Promise((resolve) => setTimeout(resolve, remainingTime))
              }

              toast.removeToast(loadingToastId)
            }

            // Show success toast
            toast.showSuccess('Keyboard layout loaded successfully from GitHub Gist!', 'Loaded')
          }

          // Handle toast transition asynchronously to not block the main loading
          handleToastTransition().catch(console.error)

          return true
        } catch (fetchError) {
          // Clear the pending loading toast timer
          if (loadingToastTimer) {
            clearTimeout(loadingToastTimer)
          }

          // Remove loading toast if it was shown
          if (isLoadingToastVisible && loadingToastId) {
            toast.removeToast(loadingToastId)
          }

          // Show specific error based on the type
          const errorMessage =
            fetchError instanceof Error ? fetchError.message : 'Unknown error occurred'

          if (errorMessage.includes('Gist not found')) {
            toast.showError(
              'The specified GitHub Gist could not be found. Please check the gist ID and try again.',
              'Gist Not Found',
            )
          } else if (errorMessage.includes('Rate limit exceeded')) {
            toast.showError(
              'GitHub API rate limit exceeded. Please try again later.',
              'Rate Limit Exceeded',
            )
          } else if (errorMessage.includes('No keyboard layout file found')) {
            toast.showError(
              'The gist does not contain a valid keyboard layout file. Please ensure the gist has a JSON file with KLE layout data.',
              'Invalid Gist',
            )
          } else if (errorMessage.includes('Invalid JSON format')) {
            toast.showError(
              'The layout file in the gist contains invalid JSON. Please check the file format.',
              'Invalid JSON',
            )
          } else if (errorMessage.includes('Invalid KLE layout data structure')) {
            toast.showError(
              'The gist file is not in the correct KLE format. Expected an array structure.',
              'Invalid Format',
            )
          } else {
            toast.showError(`Failed to load gist layout: ${errorMessage}`, 'Load Failed')
          }

          throw fetchError
        }
      }
      return false
    } catch (error) {
      console.error('Error loading layout from gist URL:', error)
      return false
    }
  }

  // VIA annotation detection
  // Check if a label is in valid VIA format (row,col)
  const isValidViaLabel = (label: string): boolean => {
    if (!label || typeof label !== 'string') return false

    // VIA format: "row,col" where row and col are integers
    // Examples: "0,0", "1,5", "2,10"
    const viaPattern = /^(\d+),(\d+)$/
    return viaPattern.test(label.trim())
  }

  // Check if the layout is VIA annotated
  // A layout is considered VIA annotated if all non-decal/non-ghost keys have valid VIA labels
  const isViaAnnotated = computed((): boolean => {
    // Need at least one key to be annotated
    if (keys.value.length === 0) return false

    // Filter out decal and ghost keys
    const regularKeys = keys.value.filter((key) => !key.decal && !key.ghost)

    // Need at least one regular key
    if (regularKeys.length === 0) return false

    // Check if all regular keys have valid VIA labels in position 0 (top-left)
    return regularKeys.every((key) => {
      const label = key.labels && key.labels[0]
      return isValidViaLabel(label)
    })
  })

  // Validate matrix duplicate positions
  // Per VIA spec, keys sharing a matrix position must have option,choice labels
  const matrixDuplicateValidation = computed(() => {
    return validateMatrixDuplicates(keys.value)
  })

  // Check if layout has invalid matrix duplicates (duplicates without option,choice)
  const hasInvalidMatrixDuplicates = computed((): boolean => {
    // Only check if layout is VIA annotated
    if (!isViaAnnotated.value) return false
    return !matrixDuplicateValidation.value.isValid
  })

  // Matrix coordinates functionality
  const addMatrixCoordinates = () => {
    // Save state before making changes
    saveState()

    // Calculate the center of each key and convert to matrix coordinates
    // Skip decal and ghost keys as they don't represent physical switches
    keys.value.forEach((key) => {
      // Ignore decal/ghost keys - they are decorative only
      if (key.decal || key.ghost) {
        return
      }

      // Calculate key center accounting for rotation
      let centerX = D.add(key.x, D.div(key.width || 1, 2))
      let centerY = D.add(key.y, D.div(key.height || 1, 2))

      // Apply rotation transformation if key is rotated
      if (key.rotation_angle && key.rotation_angle !== 0) {
        const originX = key.rotation_x || centerX
        const originY = key.rotation_y || centerY
        const angleRad = D.degreesToRadians(key.rotation_angle)
        const cos = Math.cos(angleRad)
        const sin = Math.sin(angleRad)

        // Translate center relative to rotation origin
        const relativeX = D.sub(centerX, originX)
        const relativeY = D.sub(centerY, originY)

        // Apply rotation transformation
        const rotatedX = D.sub(D.mul(relativeX, cos), D.mul(relativeY, sin))
        const rotatedY = D.add(D.mul(relativeX, sin), D.mul(relativeY, cos))

        // Translate back to absolute coordinates
        centerX = D.add(originX, rotatedX)
        centerY = D.add(originY, rotatedY)
      }

      // Convert to integer coordinates (rounding to nearest integer)
      const row = Math.round(Number(centerY))
      const col = Math.round(Number(centerX))

      // Initialize arrays properly (always 12 elements)
      key.labels = createEmptyLabels()
      key.labels[0] = `${row},${col}`
      key.textColor = createEmptyTextColors()
      key.textSize = createEmptyTextSizes()
    })

    markDirty()
  }

  // Helper functions for legend operations
  const saveToHistory = () => {
    saveState()
  }

  // No-op: dirty is now a computed property based on comparison to baseline
  // Kept for API compatibility with existing code
  const markDirty = () => {}

  // Handle URL hash changes for dynamic gist loading
  const handleHashChange = async () => {
    // Only process gist URLs to avoid interfering with share URLs
    const gistId = extractGistFromCurrentUrl()
    if (gistId) {
      try {
        await loadFromGistUrl()
      } catch (error) {
        console.error('Error loading gist from hash change:', error)
      }
    }
  }

  // Initialize asynchronously to handle gist URLs
  initWithSample().catch(console.error)

  // Add hash change listener for dynamic gist loading
  // Only add listener in browser environment, not during tests
  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    window.addEventListener('hashchange', handleHashChange)
  }

  // Cleanup function for the hash change listener
  const cleanup = () => {
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }

  // Manual URL processing function for programmatic loading
  const processCurrentUrl = async (): Promise<boolean> => {
    // Try to load from share URL first
    if (loadFromShareUrl()) {
      return true
    }

    // Then try to load from gist URL
    return await loadFromGistUrl()
  }

  return {
    keys,
    selectedKeys,
    metadata,
    filename,
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

    // Overlapping key selection popup
    keySelectionPopup,
    popupHoveredKey,

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
    showKeySelectionPopup,
    hideKeySelectionPopup,
    selectKeyFromPopup,
    setPopupHoveredKey,
    copy,
    cut,
    paste,
    handleSystemClipboardData,
    undo,
    redo,
    updateKeyProperty,
    updateSelectedKeys,
    loadKeyboard,
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
    moveRotationOriginsToPosition,

    // Movement functions
    moveSelectedKeys,

    // URL sharing
    generateShareUrl,
    loadFromShareUrl,
    loadFromGistUrl,
    processCurrentUrl,

    // Store management
    cleanup,

    // Legend tools
    saveToHistory,
    markDirty,
    updateBaseline,

    // Matrix coordinates
    addMatrixCoordinates,
    isViaAnnotated,
    matrixDuplicateValidation,
    hasInvalidMatrixDuplicates,
  }
})
