<template>
  <KeyboardListImportModal
    :is-visible="isVisible"
    title="Import from QMK"
    list-url="https://keyboards.qmk.fm/v1/keyboard_list.json"
    label="QMK"
    prefix="qmk"
    :import-fn="importQmk"
    @close="emit('close')"
  />
</template>

<script setup lang="ts">
import KeyboardListImportModal from './KeyboardListImportModal.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { convertQmkToKle } from '@/utils/qmk-import'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

const importQmk = async (name: string) => {
  const url = `https://keyboards.qmk.fm/v1/keyboards/${name}/info.json`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`)
  const data = await resp.json()
  const keyboardData = data.keyboards?.[name]
  if (!keyboardData) throw new Error(`Keyboard data not found for "${name}"`)
  const keyboard = convertQmkToKle(keyboardData)
  keyboardStore.loadKeyboard(keyboard)
  keyboardStore.filename = name.replace(/\//g, '-')
  keyboardStore.updateBaseline()
}
</script>
