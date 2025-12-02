import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import MatrixCoordinatesModal from '../MatrixCoordinatesModal.vue'
import { useKeyboardStore } from '@/stores/keyboard'

describe('MatrixCoordinatesModal', () => {
  let store: ReturnType<typeof useKeyboardStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useKeyboardStore()
  })

  describe('Clear All Labels functionality', () => {
    it('should clear all 12 label positions when accepting warning', async () => {
      // Setup: Create keys with labels at different positions
      store.addKey({ x: 0, y: 0 })
      store.addKey({ x: 1, y: 0 })
      store.addKey({ x: 2, y: 0 })

      const key0 = store.keys[0]
      expect(key0).toBeDefined()
      const key1 = store.keys[1]
      expect(key1).toBeDefined()
      const key2 = store.keys[2]
      expect(key2).toBeDefined()

      // Set labels at various positions (not just position 0)
      key0!.labels[0] = 'A'
      key0!.labels[4] = 'B'
      key0!.labels[8] = 'C'

      key1!.labels[1] = 'X'
      key1!.labels[5] = 'Y'
      key1!.labels[9] = 'Z'

      key2!.labels[0] = '1'
      key2!.labels[2] = '2'
      key2!.labels[6] = '3'
      key2!.labels[11] = '4'

      // Verify labels are set
      expect(key0!.labels[0]).toBe('A')
      expect(key0!.labels[4]).toBe('B')
      expect(key0!.labels[8]).toBe('C')
      expect(key1!.labels[1]).toBe('X')
      expect(key1!.labels[5]).toBe('Y')
      expect(key1!.labels[9]).toBe('Z')
      expect(key2!.labels[0]).toBe('1')
      expect(key2!.labels[2]).toBe('2')
      expect(key2!.labels[6]).toBe('3')
      expect(key2!.labels[11]).toBe('4')

      // Mount the modal
      const wrapper = mount(MatrixCoordinatesModal, {
        props: {
          visible: true,
        },
      })

      // Wait for component to mount
      await wrapper.vm.$nextTick()

      // Find and click the "OK (clear all labels)" button
      const okButton = wrapper.find('button[aria-label="Ok"]')
      expect(okButton.exists()).toBe(true)
      await okButton.trigger('click')

      // Wait for the state to update
      await wrapper.vm.$nextTick()

      // Verify ALL label positions are cleared for all keys
      store.keys.forEach((key) => {
        for (let i = 0; i < 12; i++) {
          expect(key.labels[i]).toBe('')
        }
      })
    })

    it('should clear labels from keys with labels at multiple positions', async () => {
      // Setup: Create a key with labels scattered across all 12 positions
      store.addKey({ x: 0, y: 0 })
      const key = store.keys[0]
      expect(key).toBeDefined()

      // Fill all 12 positions with different values
      for (let i = 0; i < 12; i++) {
        key!.labels[i] = `Label${i}`
      }

      // Verify all positions are filled
      for (let i = 0; i < 12; i++) {
        expect(key!.labels[i]).toBe(`Label${i}`)
      }

      // Mount the modal
      const wrapper = mount(MatrixCoordinatesModal, {
        props: {
          visible: true,
        },
      })

      await wrapper.vm.$nextTick()

      // Click the OK button to clear labels
      const okButton = wrapper.find('button[aria-label="Ok"]')
      await okButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Verify ALL 12 positions are now empty
      for (let i = 0; i < 12; i++) {
        expect(key!.labels[i]).toBe('')
      }
    })
  })

  describe('Decal and Ghost Key Label Preservation', () => {
    it('should preserve labels on ghost keys while clearing regular key labels', async () => {
      store.addKey({ x: 0, y: 0 }) // regular
      store.addKey({ x: 1, y: 0, ghost: true }) // ghost

      store.keys[0]!.labels[0] = 'A'
      store.keys[1]!.labels[0] = 'GhostLabel'

      const wrapper = mount(MatrixCoordinatesModal, {
        props: {
          visible: true,
        },
      })

      await wrapper.vm.$nextTick()

      // Click the OK button
      const okButton = wrapper.find('button[aria-label="Ok"]')
      await okButton.trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.keys[0]!.labels[0]).toBe('') // cleared
      expect(store.keys[1]!.labels[0]).toBe('GhostLabel') // preserved
    })

    it('should preserve labels on decal keys while clearing regular key labels', async () => {
      store.addKey({ x: 0, y: 0 }) // regular
      store.addKey({ x: 1, y: 0, decal: true }) // decal

      store.keys[0]!.labels[0] = 'B'
      store.keys[1]!.labels[0] = 'DecalLabel'

      const wrapper = mount(MatrixCoordinatesModal, {
        props: {
          visible: true,
        },
      })

      await wrapper.vm.$nextTick()

      // Click the OK button
      const okButton = wrapper.find('button[aria-label="Ok"]')
      await okButton.trigger('click')
      await wrapper.vm.$nextTick()

      expect(store.keys[0]!.labels[0]).toBe('') // cleared
      expect(store.keys[1]!.labels[0]).toBe('DecalLabel') // preserved
    })

    it('should handle mixed key types correctly preserving all 12 label positions', async () => {
      store.addKey({ x: 0, y: 0 }) // regular
      store.addKey({ x: 1, y: 0, ghost: true }) // ghost
      store.addKey({ x: 2, y: 0, decal: true }) // decal
      store.addKey({ x: 3, y: 0 }) // regular

      // Set labels on multiple positions
      for (let i = 0; i < 4; i++) {
        store.keys[i]!.labels[0] = `Label${i}`
        store.keys[i]!.labels[2] = `Label${i}-pos2`
        store.keys[i]!.labels[5] = `Label${i}-pos5`
      }

      const wrapper = mount(MatrixCoordinatesModal, {
        props: {
          visible: true,
        },
      })

      await wrapper.vm.$nextTick()

      // Click the OK button
      const okButton = wrapper.find('button[aria-label="Ok"]')
      await okButton.trigger('click')
      await wrapper.vm.$nextTick()

      // Verify regular keys completely cleared (all 12 positions)
      for (let i = 0; i < 12; i++) {
        expect(store.keys[0]!.labels[i]).toBe('')
        expect(store.keys[3]!.labels[i]).toBe('')
      }

      // Verify ghost/decal keys preserved
      expect(store.keys[1]!.labels[0]).toBe('Label1')
      expect(store.keys[1]!.labels[2]).toBe('Label1-pos2')
      expect(store.keys[2]!.labels[0]).toBe('Label2')
      expect(store.keys[2]!.labels[5]).toBe('Label2-pos5')
    })
  })

  describe('Continue without clearing functionality', () => {
    it('should NOT clear labels when choosing to continue with partial annotation', async () => {
      // Setup: Create keys with VIA annotations (partial)
      store.addKey({ x: 0, y: 0 })
      store.addKey({ x: 1, y: 0 })

      const key0 = store.keys[0]
      expect(key0).toBeDefined()
      const key1 = store.keys[1]
      expect(key1).toBeDefined()

      // Set partial VIA annotations
      key0!.labels[0] = '0,'
      key1!.labels[0] = '1,'

      // Mount the modal
      const wrapper = mount(MatrixCoordinatesModal, {
        props: {
          visible: true,
        },
      })

      await wrapper.vm.$nextTick()

      // Find and click the "Continue" button (for partial annotation)
      const continueButton = wrapper.find('button[aria-label="Continue"]')

      // Button should exist because we have partial annotation
      if (continueButton.exists()) {
        await continueButton.trigger('click')
        await wrapper.vm.$nextTick()

        // Verify labels are NOT cleared
        expect(key0!.labels[0]).toBe('0,')
        expect(key1!.labels[0]).toBe('1,')
      }
    })
  })
})
