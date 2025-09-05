import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useKeyboardStore } from '@/stores/keyboard'

// Simulate the updateMoveStep function from App.vue
const updateMoveStep = (inputValue: string, store: ReturnType<typeof useKeyboardStore>) => {
  // Create mock input element
  const mockInput = { value: inputValue } as HTMLInputElement

  let value = parseFloat(mockInput.value)

  // Handle invalid numbers (NaN)
  if (isNaN(value)) {
    value = 0.25 // Reset to default value
  }

  // Constrain to valid range
  value = Math.max(0.05, Math.min(5, value))

  // Update store with constrained value
  store.setMoveStep(value)

  // Update input to show corrected value
  mockInput.value = value.toString()

  return mockInput.value
}

describe('App.vue - Move Step Validation', () => {
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useKeyboardStore()
  })

  describe('updateMoveStep validation', () => {
    it('should accept valid values within range', () => {
      const correctedValue = updateMoveStep('0.25', store)
      expect(correctedValue).toBe('0.25')
      expect(store.moveStep).toBe(0.25)
    })

    it('should accept valid values at range boundaries', () => {
      const minValue = updateMoveStep('0.05', store)
      expect(minValue).toBe('0.05')
      expect(store.moveStep).toBe(0.05)

      const maxValue = updateMoveStep('5', store)
      expect(maxValue).toBe('5')
      expect(store.moveStep).toBe(5)
    })

    it('should constrain values below minimum to 0.05', () => {
      const correctedValue = updateMoveStep('0.01', store)
      expect(correctedValue).toBe('0.05')
      expect(store.moveStep).toBe(0.05)
    })

    it('should constrain values above maximum to 5', () => {
      const correctedValue = updateMoveStep('10', store)
      expect(correctedValue).toBe('5')
      expect(store.moveStep).toBe(5)
    })

    it('should handle negative values by constraining to minimum', () => {
      const correctedValue = updateMoveStep('-1', store)
      expect(correctedValue).toBe('0.05')
      expect(store.moveStep).toBe(0.05)
    })

    it('should handle invalid input (NaN) by resetting to default', () => {
      const correctedValue = updateMoveStep('invalid', store)
      expect(correctedValue).toBe('0.25')
      expect(store.moveStep).toBe(0.25)
    })

    it('should handle empty string by resetting to default', () => {
      const correctedValue = updateMoveStep('', store)
      expect(correctedValue).toBe('0.25')
      expect(store.moveStep).toBe(0.25)
    })

    it('should handle decimal values correctly', () => {
      const correctedValue = updateMoveStep('1.75', store)
      expect(correctedValue).toBe('1.75')
      expect(store.moveStep).toBe(1.75)
    })
  })
})
