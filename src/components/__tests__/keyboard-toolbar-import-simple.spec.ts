import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import KeyboardToolbar from '../KeyboardToolbar.vue'
import { useKeyboardStore } from '@/stores/keyboard'

// Mock presets data
vi.mock('@/data/presets.json', () => ({
  default: {
    presets: [],
  },
}))

// Mock the toast system
vi.mock('@/composables/useToast', () => ({
  toast: {
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
  },
}))

describe('KeyboardToolbar - JSON Import Format Auto-Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  const importJsonFile = async (fileName: string, content: string) => {
    const wrapper = mount(KeyboardToolbar, {
      global: { plugins: [createPinia()] },
    })

    const mockFile = {
      name: fileName,
      text: vi.fn().mockResolvedValue(content),
    }

    const fileInput = wrapper.find('input[type="file"]')
    Object.defineProperty(fileInput.element, 'files', {
      value: [mockFile],
      writable: false,
    })

    await fileInput.trigger('change')
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 100))

    return { wrapper }
  }

  describe('Raw KLE Format Detection', () => {
    it('should detect and import raw KLE format (array of arrays)', async () => {
      const { toast } = await import('@/composables/useToast')

      const rawKleContent = JSON.stringify([
        ['Q', 'W', 'E'],
        ['A', 'S', 'D'],
      ])
      await importJsonFile('simple-raw.json', rawKleContent)

      expect(toast.showSuccess).toHaveBeenCalledWith(
        'KLE layout loaded from simple-raw.json',
        'Import successful',
      )
    })

    it('should store filename for downloads when importing raw KLE format', async () => {
      const rawKleContent = JSON.stringify([['Q', 'W', 'E']])
      await importJsonFile('my-keyboard-layout.json', rawKleContent)

      const store = useKeyboardStore()

      expect(store.filename).toBe('my-keyboard-layout')
      expect(store.metadata.name).toBe('')
    })

    it('should detect raw KLE format with key properties', async () => {
      const { toast } = await import('@/composables/useToast')

      const complexRawKle = JSON.stringify([
        [{ w: 1.5 }, 'Tab', 'Q', 'W'],
        [{ w: 1.75 }, 'Caps', 'A', 'S'],
      ])

      await importJsonFile('complex-raw.json', complexRawKle)

      expect(toast.showSuccess).toHaveBeenCalledWith(
        'KLE layout loaded from complex-raw.json',
        'Import successful',
      )
    })
  })

  describe('Internal KLE Format Detection', () => {
    it('should detect and import internal KLE format (object with meta and keys)', async () => {
      const { toast } = await import('@/composables/useToast')

      const internalKle = JSON.stringify({
        meta: {
          name: 'Test Layout',
          author: 'Test User',
        },
        keys: [
          {
            labels: [null, null, null, null, 'Q'],
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          },
        ],
      })

      await importJsonFile('internal.json', internalKle)

      expect(toast.showSuccess).toHaveBeenCalledWith(
        'Internal KLE layout loaded from internal.json',
        'Import successful',
      )
    })

    it('should store filename for downloads when importing internal format', async () => {
      const internalKle = JSON.stringify({
        meta: {
          author: 'Test User',
        },
        keys: [
          {
            labels: [null, null, null, null, 'Q'],
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          },
        ],
      })

      await importJsonFile('custom-layout.json', internalKle)

      const store = useKeyboardStore()

      expect(store.filename).toBe('custom-layout')
      expect(store.metadata.name).toBe('')
    })

    it('should store filename and preserve existing name when importing internal format with name', async () => {
      const internalKle = JSON.stringify({
        meta: {
          name: 'Existing Layout Name',
          author: 'Test User',
        },
        keys: [
          {
            labels: [null, null, null, null, 'Q'],
            x: 0,
            y: 0,
            width: 1,
            height: 1,
          },
        ],
      })

      await importJsonFile('filename-should-be-ignored.json', internalKle)

      const store = useKeyboardStore()

      expect(store.metadata.name).toBe('Existing Layout Name')
      expect(store.filename).toBe('filename-should-be-ignored')
    })

    it('should detect internal format with minimal structure', async () => {
      const { toast } = await import('@/composables/useToast')

      const minimalInternal = JSON.stringify({
        meta: {},
        keys: [],
      })

      await importJsonFile('minimal-internal.json', minimalInternal)

      expect(toast.showSuccess).toHaveBeenCalledWith(
        'Internal KLE layout loaded from minimal-internal.json',
        'Import successful',
      )
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid JSON gracefully', async () => {
      const { toast } = await import('@/composables/useToast')

      const invalidJson = '{ invalid json without closing brace'
      await importJsonFile('invalid.json', invalidJson)

      expect(toast.showError).toHaveBeenCalled()
      expect(toast.showSuccess).not.toHaveBeenCalled()
    })

    it("should handle objects that don't match either format", async () => {
      const { toast } = await import('@/composables/useToast')

      const randomObject = JSON.stringify({
        someProperty: 'value',
        data: 'not a layout',
      })

      await importJsonFile('random.json', randomObject)

      // Should try to process as raw KLE but fail, showing error
      expect(toast.showError).toHaveBeenCalled()
      expect(toast.showSuccess).not.toHaveBeenCalled()
    })

    it('should fallback to raw format for malformed internal structure', async () => {
      const { toast } = await import('@/composables/useToast')

      const malformedInternal = JSON.stringify({
        meta: { name: 'Test' },
        keys: 'not an array',
      })

      await importJsonFile('malformed.json', malformedInternal)

      // Should fallback to raw format processing and likely fail
      expect(toast.showError).toHaveBeenCalled()
    })
  })

  describe('Real-world Examples', () => {
    it('should handle actual Planck layout in raw format', async () => {
      const { toast } = await import('@/composables/useToast')

      const planckLayout = JSON.stringify([
        [{ a: 7 }, 'Tab', 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', 'Back Space'],
        ['Esc', 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"],
        ['Shift', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', 'Return'],
        ['', 'Ctrl', 'Alt', 'Super', '⇓', { w: 2 }, '', '⇑', '←', '↓', '↑', '→'],
      ])

      await importJsonFile('planck.json', planckLayout)

      expect(toast.showSuccess).toHaveBeenCalledWith(
        'KLE layout loaded from planck.json',
        'Import successful',
      )
    })

    it('should handle internal format with Unicode characters', async () => {
      const { toast } = await import('@/composables/useToast')

      const unicodeLayout = JSON.stringify({
        meta: {
          name: 'Unicode Test 🎹',
        },
        keys: [
          {
            labels: [null, null, null, null, '😊'],
            x: 0,
            y: 0,
          },
          {
            labels: [null, null, null, null, 'ñ'],
            x: 1,
            y: 0,
          },
        ],
      })

      await importJsonFile('unicode-internal.json', unicodeLayout)

      expect(toast.showSuccess).toHaveBeenCalledWith(
        'Internal KLE layout loaded from unicode-internal.json',
        'Import successful',
      )
    })
  })

  describe('Format Detection Logic', () => {
    it('should correctly identify internal format by presence of meta and keys properties', async () => {
      const { toast } = await import('@/composables/useToast')

      // Test edge case: object with meta and keys but keys is not array (should fallback to raw)
      const edgeCase = JSON.stringify({
        meta: { name: 'Edge' },
        keys: 'string instead of array',
      })

      await importJsonFile('edge.json', edgeCase)

      // Should show error because it falls back to raw format processing
      expect(toast.showError).toHaveBeenCalled()
    })

    it('should treat arrays as raw KLE format regardless of content', async () => {
      const { toast } = await import('@/composables/useToast')

      const emptyArray = JSON.stringify([])
      await importJsonFile('empty-array.json', emptyArray)

      expect(toast.showSuccess).toHaveBeenCalledWith(
        'KLE layout loaded from empty-array.json',
        'Import successful',
      )
    })

    it('should treat non-objects as raw KLE format', async () => {
      const { toast } = await import('@/composables/useToast')

      const stringValue = JSON.stringify('just a string')
      await importJsonFile('string.json', stringValue)

      // Should try raw format processing and fail
      expect(toast.showError).toHaveBeenCalled()
    })
  })
})
