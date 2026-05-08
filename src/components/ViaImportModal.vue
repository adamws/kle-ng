<template>
  <KeyboardListImportModal
    :is-visible="isVisible"
    title="Import from VIA"
    list-url="https://adamws.github.io/keyboard-pcbs/keyboard_list.json"
    label="VIA"
    prefix="via"
    :import-fn="importVia"
    @close="emit('close')"
  />
</template>

<script setup lang="ts">
import LZString from 'lz-string'
import KeyboardListImportModal from './KeyboardListImportModal.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { convertViaToKle } from '@/utils/via-import'
import type { ExtendedKeyboardMetadata } from '@/utils/json-layout-processor'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

const importVia = async (name: string) => {
  const url = `https://raw.githubusercontent.com/the-via/keyboards/master/v3/${name}.json`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`)
  const data = await resp.json()

  const kleData = convertViaToKle(data)
  keyboardStore.loadKLELayout(kleData)

  const viaCopy = JSON.parse(JSON.stringify(data)) as Record<string, unknown>
  const layouts = viaCopy.layouts as Record<string, unknown>
  delete layouts.keymap
  const compressedViaData = LZString.compressToBase64(JSON.stringify(viaCopy))
  ;(keyboardStore.metadata as ExtendedKeyboardMetadata)._kleng_via_data = compressedViaData

  keyboardStore.filename = name.replace(/\//g, '-')
  keyboardStore.updateBaseline()
}
</script>
