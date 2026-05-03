import type { Key, KeyboardMetadata } from '@/stores/keyboard'
import { useKeyboardStore } from '@/stores/keyboard'
import { parseJsonString } from '@/utils/serialization'
import { toast } from '@/composables/useToast'
import { isViaFormat, convertViaToKle } from '@/utils/via-import'
import { isQmkFormat, convertQmkToKle } from '@/utils/qmk-import'
import LZString from 'lz-string'

export interface ExtendedKeyboardMetadata extends KeyboardMetadata {
  _kleng_via_data?: string
}

interface InternalKleFormat {
  meta: KeyboardMetadata
  keys: Key[]
}

const isInternalKleFormat = (data: unknown): data is InternalKleFormat => {
  return (
    typeof data === 'object' &&
    data !== null &&
    'meta' in data &&
    'keys' in data &&
    Array.isArray((data as Record<string, unknown>).keys)
  )
}

export async function processJsonLayout(
  jsonText: string,
  displayFilename: string,
  storedFilename: string,
  keyboardStore: ReturnType<typeof useKeyboardStore>,
): Promise<void> {
  const data = parseJsonString(jsonText)

  if (isQmkFormat(data)) {
    console.log(`Loading QMK format from: ${displayFilename}`)
    try {
      const keyboard = convertQmkToKle(data)
      keyboardStore.loadKeyboard(keyboard)
      toast.showSuccess(`QMK layout loaded from ${displayFilename}`, 'Import successful')
    } catch (error) {
      console.error('Error converting QMK format:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert QMK format'
      toast.showError(errorMessage, 'QMK Import Failed')
      throw error
    }
  } else if (isViaFormat(data)) {
    console.log(`Loading VIA format from: ${displayFilename}`)
    try {
      const kleData = convertViaToKle(data)
      keyboardStore.loadKLELayout(kleData)

      const viaDataObj = data as Record<string, unknown>
      const viaCopy = JSON.parse(JSON.stringify(viaDataObj))
      const layouts = viaCopy.layouts as Record<string, unknown>
      delete layouts.keymap

      const viaMetadataJson = JSON.stringify(viaCopy)
      const compressedViaData = LZString.compressToBase64(viaMetadataJson)
      ;(keyboardStore.metadata as ExtendedKeyboardMetadata)._kleng_via_data = compressedViaData

      toast.showSuccess(`VIA layout loaded from ${displayFilename}`, 'Import successful')
    } catch (error) {
      console.error('Error converting VIA format:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to convert VIA format'
      toast.showError(errorMessage, 'VIA Import Failed')
      throw error
    }
  } else if (isInternalKleFormat(data)) {
    console.log(`Loading internal KLE format from: ${displayFilename}`)
    keyboardStore.loadKeyboard(data)
    toast.showSuccess(`Internal KLE layout loaded from ${displayFilename}`, 'Import successful')
  } else {
    console.log(`Loading raw KLE format from: ${displayFilename}`)
    keyboardStore.loadKLELayout(data)
    toast.showSuccess(`KLE layout loaded from ${displayFilename}`, 'Import successful')
  }

  keyboardStore.filename = storedFilename
  keyboardStore.updateBaseline()
}
