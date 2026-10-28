import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePlateGeneratorStore } from '../plateGenerator'
import type { PlateGenerationResult } from '@/types/plate'
import { saveBlob } from '@/utils/download'
import { createZip } from '@/utils/zip'

vi.mock('@/utils/download', () => ({ saveBlob: vi.fn() }))
vi.mock('@/utils/zip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/utils/zip')>()
  return { ...actual, createZip: vi.fn(actual.createZip) }
})

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

  it('should default to sharp cutout corners', () => {
    const store = usePlateGeneratorStore()
    expect(store.settings.filletRadius).toBe(0)
    expect(store.settings.stabilizerFilletRadius).toBe(0)
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

  describe('SVG and DXF downloads', () => {
    beforeEach(() => {
      vi.mocked(saveBlob).mockClear()
      vi.mocked(createZip).mockClear()
    })

    function storeWithResult(result: Partial<PlateGenerationResult>) {
      const store = usePlateGeneratorStore()
      store.generationState = {
        status: 'success',
        error: null,
        result: {
          svgDownload: 'CUT-SVG',
          dxfContent: 'CUT-DXF',
          ...result,
        } as PlateGenerationResult,
      }
      return store
    }

    /** [filename, MIME type] of each saved file. */
    const saved = () => vi.mocked(saveBlob).mock.calls.map(([blob, name]) => [name, blob.type])

    it('saves only the cutouts when there is no outline', () => {
      const store = storeWithResult({})

      store.downloadAllSvg()
      store.downloadAllDxf()

      expect(saved()).toEqual([
        ['keyboard-plate.svg', 'image/svg+xml'],
        ['keyboard-plate.dxf', 'application/dxf'],
      ])
      expect(createZip).not.toHaveBeenCalled()
    })

    it('saves the merged file when the outline is merged with the cutouts', async () => {
      const store = storeWithResult({
        mergedSvgDownload: 'MERGED-SVG',
        mergedDxfContent: 'MERGED-DXF',
      })

      store.downloadAllSvg()
      store.downloadAllDxf()

      expect(saved()).toEqual([
        ['keyboard-plate.svg', 'image/svg+xml'],
        ['keyboard-plate.dxf', 'application/dxf'],
      ])
      expect(await vi.mocked(saveBlob).mock.calls[0]![0].text()).toBe('MERGED-SVG')
      expect(createZip).not.toHaveBeenCalled()
    })

    // Two downloads from one click get blocked or dropped by browsers
    it('saves the cutouts and a separate outline as one zip', () => {
      const store = storeWithResult({ outlineSvgDownload: 'OUT-SVG', outlineDxfContent: 'OUT-DXF' })

      store.downloadAllSvg()
      store.downloadAllDxf()

      expect(saved()).toEqual([
        ['keyboard-plate-svg.zip', 'application/zip'],
        ['keyboard-plate-dxf.zip', 'application/zip'],
      ])
      expect(vi.mocked(createZip).mock.calls.map(([entries]) => entries)).toEqual([
        [
          { name: 'keyboard-plate.svg', text: 'CUT-SVG' },
          { name: 'keyboard-plate-outline.svg', text: 'OUT-SVG' },
        ],
        [
          { name: 'keyboard-plate.dxf', text: 'CUT-DXF' },
          { name: 'keyboard-plate-outline.dxf', text: 'OUT-DXF' },
        ],
      ])
    })
  })
})
