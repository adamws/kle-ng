<template>
  <KeyboardListImportModal
    :is-visible="isVisible"
    title="Import from QMK"
    :list-url="qmkLayoutSource.listUrl"
    label="QMK"
    prefix="qmk"
    :source="qmkLayoutSource"
    :import-fn="importQmk"
    @close="emit('close')"
  />
</template>

<script setup lang="ts">
import KeyboardListImportModal from './KeyboardListImportModal.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { convertQmkToKle } from '@/utils/qmk-import'
import { qmkLayoutSource, type PreviewLayout } from '@/utils/preview/layout-source'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

const fetchInfoJson = async (name: string): Promise<unknown> => {
  const resp = await fetch(qmkLayoutSource.layoutUrl(name))
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`)
  return resp.json()
}

const importQmk = async (name: string, cached?: PreviewLayout) => {
  // The preview already downloaded this definition — don't ask for it twice.
  const data = cached?.raw ?? (await fetchInfoJson(name))
  const keyboardData = (data as { keyboards?: Record<string, unknown> })?.keyboards?.[name]
  if (!keyboardData) throw new Error(`Keyboard data not found for "${name}"`)
  const keyboard = convertQmkToKle(keyboardData)
  keyboardStore.loadKeyboard(keyboard)
  keyboardStore.filename = name.replace(/\//g, '-')
  keyboardStore.updateBaseline()
}
</script>
