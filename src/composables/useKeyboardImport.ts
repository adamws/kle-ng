import type { Ref } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { toast } from '@/composables/useToast'
import { extractKleLayoutWithFallback } from '@/utils/pixel-metadata'
import { parseErgogenConfig } from '@/utils/ergogen-loader'
import { processJsonLayout } from '@/utils/json-layout-processor'

export function useKeyboardImport(fileInput: Ref<HTMLInputElement | undefined>) {
  const keyboardStore = useKeyboardStore()

  const triggerFileUpload = () => {
    fileInput.value?.click()
  }

  const handleFileUpload = async (event: Event) => {
    const input = event.target as HTMLInputElement
    const file = input.files?.[0]

    if (!file) return

    try {
      const filenameWithoutExt = file.name.replace(/\.[^/.]+$/, '')

      if (file.type === 'image/png' || file.name.toLowerCase().endsWith('.png')) {
        console.log(`Checking PNG file for embedded layout: ${file.name}`)

        const layoutData = await extractKleLayoutWithFallback(file)

        if (layoutData) {
          console.log(`Loading layout from PNG metadata: ${file.name}`)
          keyboardStore.loadKLELayout(layoutData)
          keyboardStore.filename = filenameWithoutExt
          keyboardStore.updateBaseline()
          toast.showSuccess(`Layout imported from PNG metadata: ${file.name}`, 'Import Successful')
        } else {
          toast.showError(
            'This PNG file does not contain layout data. Only PNG files exported from this tool contain the necessary metadata to import layouts.',
            'No Layout Data',
          )
        }
        return
      }

      if (file.name.toLowerCase().endsWith('.yaml') || file.name.toLowerCase().endsWith('.yml')) {
        console.log(`Processing Ergogen YAML file: ${file.name}`)

        try {
          const text = await file.text()
          const keyboard = await parseErgogenConfig(text)

          keyboardStore.loadKeyboard(keyboard)
          keyboardStore.filename = filenameWithoutExt
          keyboardStore.updateBaseline()

          toast.showSuccess(`Ergogen layout imported`, 'Import Successful')
        } catch (error) {
          console.error('Error processing Ergogen YAML:', error)
          const errorMessage =
            error instanceof Error
              ? `Ergogen conversion failed: ${error.message}`
              : 'Failed to process Ergogen YAML'
          toast.showError(errorMessage, 'Ergogen Import Failed')
          throw error
        }
        return
      }

      const text = await file.text()
      await processJsonLayout(text, file.name, filenameWithoutExt, keyboardStore)
    } catch (error) {
      console.error('Error loading file:', error)
      const errorMessage = error instanceof Error ? error.message : 'Invalid file format'
      toast.showError(errorMessage, 'Error loading file')
    } finally {
      input.value = ''
    }
  }

  return { triggerFileUpload, handleFileUpload }
}
