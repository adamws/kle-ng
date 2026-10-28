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

  it('should default to a rectangular outline, and keep a saved none outline', () => {
    expect(usePlateGeneratorStore().settings.outline.outlineType).toBe('rectangular')

    localStorage.setItem(
      'kle-ng-plate-settings',
      JSON.stringify({ outline: { outlineType: 'none' } }),
    )
    setActivePinia(createPinia())
    expect(usePlateGeneratorStore().settings.outline.outlineType).toBe('none')
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
      store.settings.outline.marginTop = 42
      store.settings.backsideFeatures[0]!.enabled = true

      const defaults = store.getDefaultSettingsJson()
      expect(defaults.outline).toMatchObject({ outlineType: 'rectangular', marginTop: 5 })

      store.applySettings({ outline: { outlineType: 'rectangular' } })
      expect(store.settings.outline.marginTop).toBe(5)
      expect(store.settings.backsideFeatures[0]!.enabled).toBe(false)
    })
  })
})
