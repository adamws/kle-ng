import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlateGeneratorStore } from '../plateGenerator'

describe('plateGenerator store', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('getDefaultSettingsJson', () => {
    it('should give the defaults, which applySettings restores after edits', () => {
      localStorage.setItem(
        'kle-ng-plate-settings',
        JSON.stringify({ cutout: { switchType: 'alps-skcm' }, thickness: 3 }),
      )
      const store = usePlateGeneratorStore()
      expect(store.settings.cutoutType).toBe('alps-skcm')

      store.applySettings(store.getDefaultSettingsJson())

      expect(store.settings.cutoutType).toBe('cherry-mx-basic')
      expect(store.settings.thickness).toBe(1.5)
    })

    it('should not let edits of the initial settings leak into the defaults', () => {
      // The initial settings once shared nested objects with the defaults, so
      // editing them changed the defaults too.
      const store = usePlateGeneratorStore()
      store.settings.outline.outlineType = 'rectangular'
      store.settings.outline.marginTop = 42
      store.settings.backsideFeatures[0]!.enabled = true

      const defaults = store.getDefaultSettingsJson()
      expect(defaults.outline).toEqual({ outlineType: 'none' })

      store.applySettings({ outline: { outlineType: 'rectangular' } })
      expect(store.settings.outline.marginTop).toBe(5)
      expect(store.settings.backsideFeatures[0]!.enabled).toBe(false)
    })
  })
})
