import { computed } from 'vue'
import { useKeyboardStore, Keyboard } from '@/stores/keyboard'
import { useMatrixDrawingStore } from '@/stores/matrix-drawing'
import { toast } from '@/composables/useToast'
import { parseBorderRadius, createRoundedRectanglePath } from '@/utils/border-radius'
import { createPngWithKleLayout } from '@/utils/png-metadata'
import { embedKleLayoutInImageData } from '@/utils/pixel-metadata'
import { convertKleToVia } from '@/utils/via-import'
import { convertKleToQmk, formatQmkJson } from '@/utils/qmk-export'
import { stringifyWithRounding } from '@/utils/serialization'
import { encodeKeyboardToErgogenUrl } from '@/utils/ergogen-loader'
import { encodeKeyboardToZmkWizardUrl } from '@/utils/url-sharing'
import { normalizeLayoutInput, htmlLayoutRenderer, svgLayoutRenderer } from '@/utils/layout-export'
import type { ExtendedKeyboardMetadata } from '@/utils/json-layout-processor'

interface SaveFilePickerWindow {
  showSaveFilePicker(options?: {
    suggestedName?: string
    types?: Array<{ description?: string; accept?: Record<string, string[]> }>
  }): Promise<FileSystemFileHandle>
}

const createCanvasWithRoundedBackground = (
  sourceCanvas: HTMLCanvasElement,
  radii: string,
): HTMLCanvasElement => {
  const tempCanvas = document.createElement('canvas')
  tempCanvas.width = sourceCanvas.width
  tempCanvas.height = sourceCanvas.height
  const tempCtx = tempCanvas.getContext('2d')!

  const corners = parseBorderRadius(radii, tempCanvas.width, tempCanvas.height)
  createRoundedRectanglePath(tempCtx, 0, 0, tempCanvas.width, tempCanvas.height, corners)
  tempCtx.clip()
  tempCtx.drawImage(sourceCanvas, 0, 0)

  return tempCanvas
}

export function useKeyboardExport() {
  const keyboardStore = useKeyboardStore()
  const matrixDrawingStore = useMatrixDrawingStore()

  const canExportVia = computed(
    () => !!(keyboardStore.metadata as ExtendedKeyboardMetadata)._kleng_via_data,
  )
  const canExportQmk = computed(() => keyboardStore.isViaAnnotated)

  const downloadJson = () => {
    const data = keyboardStore.getSerializedData('kle')
    const blob = new Blob([stringifyWithRounding(data, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.json`
    a.click()
    URL.revokeObjectURL(url)
    keyboardStore.updateBaseline()
  }

  const downloadKleInternalJson = () => {
    const data = keyboardStore.getSerializedData('kle-internal')
    const blob = new Blob([stringifyWithRounding(data, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}-internal.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadViaJson = () => {
    const kleData = keyboardStore.getSerializedData('kle')
    const viaData = convertKleToVia(kleData)

    if (!viaData) {
      toast.showError(
        'VIA metadata not found. Import a VIA layout or add VIA metadata in the Keyboard Metadata tab.',
        'Cannot export VIA JSON',
      )
      return
    }

    const blob = new Blob([JSON.stringify(viaData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}-via.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadQmkJson = () => {
    const kleData = keyboardStore.getSerializedData('kle')
    const qmkData = convertKleToQmk(kleData)

    if (!qmkData) {
      toast.showError(
        'All regular keys must have matrix coordinates (row,col) in label position 0.',
        'Cannot export QMK JSON',
      )
      return
    }

    const blob = new Blob([formatQmkJson(qmkData)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}-qmk.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportToErgogenWebGui = async () => {
    try {
      if (keyboardStore.keys.length === 0) {
        toast.showError('Cannot export empty keyboard layout', 'Export Failed')
        return
      }

      const keyboard = new Keyboard()
      keyboard.keys = JSON.parse(JSON.stringify(keyboardStore.keys))
      keyboard.meta = JSON.parse(JSON.stringify(keyboardStore.metadata))

      const ergogenUrl = await encodeKeyboardToErgogenUrl(keyboard)
      window.open(ergogenUrl, '_blank', 'noopener,noreferrer')
      console.log('Ergogen Web GUI URL generated:', ergogenUrl)
    } catch (error) {
      console.error('Error exporting to Ergogen Web GUI:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to export to Ergogen Web GUI'
      toast.showError(errorMessage, 'Export Failed')
    }
  }

  const exportToZmkWizard = () => {
    try {
      if (keyboardStore.keys.length === 0) {
        toast.showError('Cannot export empty keyboard layout', 'Export Failed')
        return
      }

      const keyboard = new Keyboard()
      keyboard.keys = JSON.parse(JSON.stringify(keyboardStore.keys))
      keyboard.meta = JSON.parse(JSON.stringify(keyboardStore.metadata))

      const zmkWizardUrl = encodeKeyboardToZmkWizardUrl(keyboard)
      window.open(zmkWizardUrl, '_blank', 'noopener,noreferrer')
      console.log('ZMK Shield Wizard URL generated:', zmkWizardUrl)
    } catch (error) {
      console.error('Error exporting to ZMK Shield Wizard:', error)
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to export to ZMK Shield Wizard'
      toast.showError(errorMessage, 'Export Failed')
    }
  }

  // Renders the current keyboard to a PNG blob with the embedded KLE-Layout
  // metadata, exactly as used by Download PNG. Shared by downloadPng and
  // copyPngToClipboard. Throws if the canvas isn't visible.
  const generateLayoutPngBlob = async (): Promise<Blob> => {
    const canvas = document.querySelector('.keyboard-canvas') as HTMLCanvasElement
    if (!canvas) {
      throw new Error('Canvas not found')
    }

    canvas.dispatchEvent(new Event('render-for-export'))

    const radiiValue = keyboardStore.metadata.radii?.trim() || '6px'
    const tempCanvas = createCanvasWithRoundedBackground(canvas, radiiValue)

    canvas.dispatchEvent(new Event('restore-render'))

    const tempCtx = tempCanvas.getContext('2d')

    if (matrixDrawingStore.isModalOpen) {
      const overlayCanvas = document.querySelector(
        '.matrix-annotation-overlay',
      ) as HTMLCanvasElement
      if (overlayCanvas && tempCtx) {
        tempCtx.drawImage(overlayCanvas, 0, 0)
      }
    }

    const layoutData = keyboardStore.getSerializedData('kle')

    // Also embed the layout in the alpha-channel LSBs so it survives a clipboard
    // re-encode that strips the tEXt chunks (see pixel-metadata.ts). Best-effort:
    // skipped if the canvas is too small or reading pixels fails.
    if (tempCtx) {
      try {
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height)
        if (embedKleLayoutInImageData(imageData, layoutData)) {
          tempCtx.putImageData(imageData, 0, 0)
        }
      } catch (error) {
        console.warn('Skipping pixel-embedded layout metadata:', error)
      }
    }

    const basePngBlob = await new Promise<Blob>((resolve) =>
      tempCanvas.toBlob((b) => resolve(b!), 'image/png'),
    )

    return createPngWithKleLayout(basePngBlob, layoutData, {
      Title: keyboardStore.metadata.name || 'Keyboard Layout',
      Author: keyboardStore.metadata.author || '',
      Description: 'Keyboard layout created with Keyboard Layout Editor NG',
    })
  }

  const downloadPng = async () => {
    let pngWithMetadata: Blob
    try {
      pngWithMetadata = await generateLayoutPngBlob()
    } catch {
      toast.showError('Please make sure the keyboard is visible.', 'Canvas not found')
      return
    }

    try {
      if (typeof window.showSaveFilePicker === 'function') {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.png`,
          types: [
            {
              description: 'PNG image with embedded layout',
              accept: { 'image/png': ['.png'] },
            },
          ],
        })

        const writable = await handle.createWritable()
        await writable.write(pngWithMetadata)
        await writable.close()
        toast.showSuccess('PNG image with embedded layout saved successfully', 'Export Successful')
      } else {
        const url = URL.createObjectURL(pngWithMetadata)
        const a = document.createElement('a')
        a.href = url
        a.download = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (
          error.name === 'AbortError' ||
          error.message.includes('aborted') ||
          error.message.includes('cancelled')
        ) {
          return
        } else {
          console.error('Error downloading PNG:', error)
          toast.showError(`Failed to save PNG: ${error.message}`, 'Save Failed')
        }
      } else {
        console.error('Unknown error downloading PNG:', error)
        toast.showError('Failed to save PNG image', 'Save Failed')
      }
    }
  }

  // Copies the layout image to the clipboard. Returns true on success so the
  // caller can render inline feedback (errors are surfaced via toast here since
  // they need more explanation).
  const copyPngToClipboard = async (): Promise<boolean> => {
    if (
      typeof navigator === 'undefined' ||
      !navigator.clipboard ||
      typeof ClipboardItem === 'undefined'
    ) {
      toast.showError(
        'Copying images to the clipboard is not supported in this browser.',
        'Copy Failed',
      )
      return false
    }

    let pngWithMetadata: Blob
    try {
      pngWithMetadata = await generateLayoutPngBlob()
    } catch {
      toast.showError('Please make sure the keyboard is visible.', 'Canvas not found')
      return false
    }

    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngWithMetadata })])
      return true
    } catch (error: unknown) {
      if (error instanceof Error) {
        if (
          error.name === 'AbortError' ||
          error.message.includes('aborted') ||
          error.message.includes('cancelled')
        ) {
          return false
        }
        console.error('Error copying PNG to clipboard:', error)
        toast.showError(`Failed to copy image: ${error.message}`, 'Copy Failed')
      } else {
        console.error('Unknown error copying PNG to clipboard:', error)
        toast.showError('Failed to copy layout image', 'Copy Failed')
      }
      return false
    }
  }

  const downloadHtmlFile = async () => {
    try {
      const keys = keyboardStore.keys
      if (!keys || keys.length === 0) {
        toast.showError('No keys to export. Please load a layout first.', 'Export Failed')
        return
      }

      const input = normalizeLayoutInput(keys, keyboardStore.metadata, keyboardStore.filename)
      const htmlContent = htmlLayoutRenderer.render(input)

      const htmlBlob = new Blob([htmlContent], { type: 'text/html' })
      const suggestedName = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.html`

      const fsWindow = window as unknown as SaveFilePickerWindow
      if (typeof fsWindow.showSaveFilePicker === 'function') {
        const handle = await fsWindow.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'HTML files', accept: { 'text/html': ['.html'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(htmlBlob)
        await writable.close()
        toast.showSuccess('HTML file saved successfully', 'Export Successful')
      } else {
        const url = URL.createObjectURL(htmlBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = suggestedName
        a.click()
        URL.revokeObjectURL(url)
        toast.showSuccess('HTML file download started', 'Export Started')
      }
    } catch (err: unknown) {
      console.error('Error saving HTML file:', err)
      if (
        err instanceof Error &&
        (err.name === 'AbortError' ||
          err.message.includes('aborted') ||
          err.message.includes('cancelled'))
      ) {
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast.showError(`Failed to save HTML file: ${errorMessage}`, 'Export Failed')
    }
  }

  const downloadSvgFile = async () => {
    try {
      const keys = keyboardStore.keys
      if (!keys || keys.length === 0) {
        toast.showError('No keys to export. Please load a layout first.', 'Export Failed')
        return
      }

      const input = normalizeLayoutInput(keys, keyboardStore.metadata, keyboardStore.filename)
      const svgContent = svgLayoutRenderer.render(input)

      const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' })
      const suggestedName = `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}.svg`

      const fsWindow = window as unknown as SaveFilePickerWindow
      if (typeof fsWindow.showSaveFilePicker === 'function') {
        const handle = await fsWindow.showSaveFilePicker({
          suggestedName,
          types: [{ description: 'SVG files', accept: { 'image/svg+xml': ['.svg'] } }],
        })
        const writable = await handle.createWritable()
        await writable.write(svgBlob)
        await writable.close()
        toast.showSuccess('SVG file saved successfully', 'Export Successful')
      } else {
        const url = URL.createObjectURL(svgBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = suggestedName
        a.click()
        URL.revokeObjectURL(url)
        toast.showSuccess('SVG file download started', 'Export Started')
      }
    } catch (err: unknown) {
      console.error('Error saving SVG file:', err)
      if (
        err instanceof Error &&
        (err.name === 'AbortError' ||
          err.message.includes('aborted') ||
          err.message.includes('cancelled'))
      ) {
        return
      }
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      toast.showError(`Failed to save SVG file: ${errorMessage}`, 'Export Failed')
    }
  }

  return {
    canExportVia,
    canExportQmk,
    downloadJson,
    downloadKleInternalJson,
    downloadViaJson,
    downloadQmkJson,
    exportToErgogenWebGui,
    exportToZmkWizard,
    downloadPng,
    copyPngToClipboard,
    generateLayoutPngBlob,
    downloadHtmlFile,
    downloadSvgFile,
  }
}
