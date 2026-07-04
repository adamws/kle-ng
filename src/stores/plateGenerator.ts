import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type {
  PlateSettings,
  GenerationState,
  PlateGenerationResult,
  BacksideFeature,
} from '@/types/plate'
import {
  validateFilletRadius,
  validateStabilizerFilletRadius,
  validateCustomCutoutDimension,
} from '@/utils/plate/cutout-generator'
import { useKeyboardStore } from '@/stores/keyboard'
import { collapseViaLayout } from '@/utils/layout-options'
import type { PlateWorkerResponse } from '@/utils/plate/plate-worker'
import PlateWorker from '@/utils/plate/plate-worker?worker'
import {
  serializePlateSettings,
  deserializePlateSettings,
  type PlateSettingsJson,
} from '@/utils/plate/plate-settings-serializer'
import { validatePlateSettingsJson } from '@/utils/plate/plate-settings-validator'

const STORAGE_KEY = 'kle-ng-plate-settings'

/**
 * Default plate settings
 */
const defaultSettings: PlateSettings = {
  cutoutType: 'cherry-mx-basic',
  stabilizerType: 'mx-basic',
  filletRadius: 0.5,
  stabilizerFilletRadius: 0.5,
  sizeAdjust: 0,
  customCutoutWidth: 14,
  customCutoutHeight: 14,
  mergeCutouts: false,
  rotaryEncoderHandwired: false,
  thickness: 1.5,
  outline: {
    outlineType: 'none' as const,
    marginTop: 5,
    marginBottom: 5,
    marginLeft: 5,
    marginRight: 5,
    tightMargin: 5,
    mergeWithCutouts: true,
    filletRadius: 1,
  },
  mountingHoles: {
    enabled: false,
    diameter: 3,
    edgeDistance: 3,
  },
  customHoles: {
    enabled: false,
    holes: [],
  },
  backsideFeatures: [{ type: 'cherry-mx-snap-notch', enabled: false } satisfies BacksideFeature],
  backsideDepth: 0,
}

export const usePlateGeneratorStore = defineStore('plateGenerator', () => {
  // Settings state
  const settings = ref<PlateSettings>({ ...defaultSettings })

  // Auto-refresh state (persisted separately from plate settings)
  const autoRefresh = ref(false)

  // Generation state
  const generationState = ref<GenerationState>({
    status: 'idle',
    error: null,
    result: null,
  })

  // Persistent worker instance (created lazily on first generate)
  let worker: Worker | null = null

  // Counter to ignore stale worker responses when a newer generation is in flight
  let generationId = 0

  // Cache of previously computed plate results, keyed by JSON-stringified options.
  // Cleared on layout change (requestRegenerate), so growth is naturally bounded.
  const cache = new Map<string, PlateGenerationResult>()

  // Flag to defer regeneration when a generation is already in-flight.
  // Multiple mid-flight setting changes collapse into a single deferred generation.
  let pendingRegeneration = false

  function getWorker(): Worker {
    if (!worker) {
      worker = new PlateWorker()
    }
    return worker
  }

  /**
   * Generate a plate from the current keyboard layout.
   * Dispatches work to a Web Worker so the main thread stays responsive.
   */
  function generatePlate(): void {
    const keyboardStore = useKeyboardStore()

    // Get spacing from keyboard metadata
    const spacingX = keyboardStore.metadata.spacing_x || 19.05
    const spacingY = keyboardStore.metadata.spacing_y || 19.05

    // Serialize options once — used as both cache key and worker payload.
    const optionsJson = JSON.stringify({
      cutoutType: settings.value.cutoutType,
      stabilizerType: settings.value.stabilizerType,
      filletRadius: settings.value.filletRadius,
      stabilizerFilletRadius: settings.value.stabilizerFilletRadius,
      sizeAdjust: settings.value.sizeAdjust,
      customCutoutWidth: settings.value.customCutoutWidth,
      customCutoutHeight: settings.value.customCutoutHeight,
      mergeCutouts: settings.value.mergeCutouts,
      rotaryEncoderHandwired: settings.value.rotaryEncoderHandwired,
      thickness: settings.value.thickness,
      outline: settings.value.outline,
      mountingHoles: settings.value.mountingHoles,
      customHoles: settings.value.customHoles,
      backsideFeatures: settings.value.backsideFeatures,
      backsideDepth: settings.value.backsideDepth,
      spacingX,
      spacingY,
    })

    // Check cache — return instantly on hit
    const cached = cache.get(optionsJson)
    if (cached) {
      ++generationId // invalidate any in-flight worker response
      generationState.value = {
        status: 'success',
        error: null,
        result: cached,
      }
      return
    }

    // If a generation is already in-flight, defer to avoid queueing
    // redundant work on the worker. The flag is checked on completion.
    if (generationState.value.status === 'generating') {
      pendingRegeneration = true
      return
    }

    // Preserve previous result so the UI can show it dimmed during regeneration
    const previousResult = generationState.value.result

    generationState.value = {
      status: 'generating',
      error: null,
      result: previousResult,
    }

    // Collapse VIA-annotated layouts into a superset physical layout (default keys
    // plus repositioned, de-duplicated alternatives) so the plate supports every
    // layout option — mirroring the PCB backend. Non-VIA layouts pass through
    // unchanged. See utils/layout-options.ts / docs/development/via-layout-collapsing.md.
    const sourceKeys = keyboardStore.isViaAnnotated
      ? collapseViaLayout(keyboardStore.keys)
      : keyboardStore.keys

    // Serialize reactive data to plain objects for postMessage.
    // JSON round-trip strips Vue Proxy wrappers that structuredClone cannot handle.
    const keys = JSON.parse(JSON.stringify(sourceKeys))
    const options = JSON.parse(optionsJson)

    const currentId = ++generationId
    const w = getWorker()

    w.onmessage = (event: MessageEvent<PlateWorkerResponse>) => {
      // Stale response (generationId was bumped by a cache hit or layout change).
      // Don't cache or display — but still check pendingRegeneration so a
      // deferred layout-change regeneration can proceed.
      if (currentId !== generationId) {
        if (pendingRegeneration) {
          pendingRegeneration = false
          generationState.value = {
            status: 'success',
            error: null,
            result: generationState.value.result,
          }
          generatePlate()
        }
        return
      }

      const data = event.data
      if (data.type === 'success') {
        cache.set(optionsJson, data.result)
        generationState.value = {
          status: 'success',
          error: null,
          result: data.result,
        }
      } else {
        generationState.value = {
          status: 'error',
          error: data.message,
          result: null,
        }
      }

      if (pendingRegeneration) {
        pendingRegeneration = false
        generatePlate()
      }
    }

    w.onerror = (event: ErrorEvent) => {
      if (currentId !== generationId) {
        if (pendingRegeneration) {
          pendingRegeneration = false
          generationState.value = {
            status: 'success',
            error: null,
            result: generationState.value.result,
          }
          generatePlate()
        }
        return
      }

      generationState.value = {
        status: 'error',
        error: event.message || 'An unexpected error occurred in the plate generation worker.',
        result: null,
      }

      if (pendingRegeneration) {
        pendingRegeneration = false
        generatePlate()
      }
    }

    w.postMessage({ keys, options })
  }

  /**
   * Reset generation state to idle
   */
  function resetGeneration(): void {
    generationState.value = {
      status: 'idle',
      error: null,
      result: null,
    }
  }

  /**
   * Download the generated SVG
   */
  function downloadSvg(): void {
    const result = generationState.value.result
    if (!result) return

    downloadFile(result.svgDownload, 'keyboard-plate.svg', 'image/svg+xml')
  }

  /**
   * Download the generated DXF
   */
  function downloadDxf(): void {
    const result = generationState.value.result
    if (!result) return

    downloadFile(result.dxfContent, 'keyboard-plate.dxf', 'application/dxf')
  }

  /**
   * Download all SVG files (cutouts and outline if enabled)
   * If merge is enabled, downloads single combined file; otherwise separate files
   */
  function downloadAllSvg(): void {
    const result = generationState.value.result
    if (!result) return

    if (result.mergedSvgDownload) {
      // Merge enabled: download single combined file
      downloadFile(result.mergedSvgDownload, 'keyboard-plate.svg', 'image/svg+xml')
    } else {
      // Merge disabled: download separate files
      downloadFile(result.svgDownload, 'keyboard-plate.svg', 'image/svg+xml')

      if (result.outlineSvgDownload) {
        downloadFile(result.outlineSvgDownload, 'keyboard-plate-outline.svg', 'image/svg+xml')
      }
    }
  }

  /**
   * Download all DXF files (cutouts and outline if enabled)
   * If merge is enabled, downloads single combined file; otherwise separate files
   */
  function downloadAllDxf(): void {
    const result = generationState.value.result
    if (!result) return

    if (result.mergedDxfContent) {
      // Merge enabled: download single combined file
      downloadFile(result.mergedDxfContent, 'keyboard-plate.dxf', 'application/dxf')
    } else {
      // Merge disabled: download separate files
      downloadFile(result.dxfContent, 'keyboard-plate.dxf', 'application/dxf')

      if (result.outlineDxfContent) {
        downloadFile(result.outlineDxfContent, 'keyboard-plate-outline.dxf', 'application/dxf')
      }
    }
  }

  /**
   * Download the generated STL file
   */
  function downloadStl(): void {
    const data = generationState.value.result?.stlData
    if (!data) return
    downloadFile(data, 'keyboard-plate.stl', 'model/stl')
  }

  /**
   * Download the generated JSCAD script
   */
  function downloadJscad(): void {
    const script = generationState.value.result?.jscadScript
    if (!script) return
    downloadFile(script, 'keyboard-plate.jscad', 'text/plain')
  }

  /**
   * Helper function to trigger file download
   */
  function downloadFile(content: string, filename: string, mimeType: string): void {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  // Settings persistence
  function loadSettings(): void {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const result = validatePlateSettingsJson(saved)
      if (!result.valid) {
        console.warn('Plate settings: invalid format, resetting to defaults:', result.error)
        localStorage.removeItem(STORAGE_KEY)
        return
      }
      settings.value = deserializePlateSettings(result.json, defaultSettings)
    } catch (error) {
      console.warn('Failed to load plate settings:', error)
    }
  }

  function saveSettings(): void {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(serializePlateSettings(settings.value), null, 2),
    )
  }

  function applySettings(json: PlateSettingsJson): void {
    settings.value = deserializePlateSettings(json, defaultSettings)
  }

  // Manual debounce helper
  function useDebounceFn<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
    let timeoutId: number | null = null
    return (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => fn(...args), delay)
    }
  }

  // Watch settings for changes with debouncing (500ms) to prevent excessive writes
  const debouncedSave = useDebounceFn(saveSettings, 500)
  watch(settings, debouncedSave, { deep: true })

  /**
   * Check whether all settings are valid for regeneration.
   */
  function hasSettingsErrors(): boolean {
    const s = settings.value
    const cw = s.customCutoutWidth
    const ch = s.customCutoutHeight
    if (validateFilletRadius(s.cutoutType, s.filletRadius, cw, ch)) return true
    if (validateStabilizerFilletRadius(s.stabilizerType, s.stabilizerFilletRadius)) return true
    if (s.cutoutType === 'custom-rectangle') {
      if (validateCustomCutoutDimension(cw, 'width')) return true
      if (validateCustomCutoutDimension(ch, 'height')) return true
    }
    return false
  }

  // Auto-refresh: regenerate plate when cutout settings change (only if already generated)
  const debouncedRegenerate = useDebounceFn(() => {
    const status = generationState.value.status
    if ((status === 'success' || status === 'generating') && !hasSettingsErrors()) {
      generatePlate()
    }
  }, 300)
  watch(settings, debouncedRegenerate, { deep: true })

  // Persist autoRefresh changes and trigger generation when enabled
  watch(autoRefresh, (enabled) => {
    debouncedSave()
    if (enabled && generationState.value.status !== 'success' && !hasSettingsErrors()) {
      generatePlate()
    }
  })

  function clearCache(): void {
    cache.clear()
  }

  /**
   * Called by the keyboard store when the layout changes (saveState, undo, redo).
   * Clears the cache immediately (layout changed, all cached results are stale),
   * then debounces the actual regeneration.
   */
  const debouncedLayoutRegenerate = useDebounceFn(() => {
    if (autoRefresh.value && !hasSettingsErrors()) {
      generatePlate()
    }
  }, 500)

  function requestRegenerate(): void {
    clearCache()
    if (generationState.value.status === 'generating') {
      ++generationId // mark in-flight result as stale (layout changed)
      pendingRegeneration = true
    }
    debouncedLayoutRegenerate()
  }

  // Load settings on store creation
  loadSettings()

  return {
    settings,
    autoRefresh,
    generationState,
    generatePlate,
    resetGeneration,
    requestRegenerate,
    applySettings,
    downloadSvg,
    downloadDxf,
    downloadAllSvg,
    downloadAllDxf,
    downloadStl,
    downloadJscad,
  }
})
