<template>
  <KeyboardListImportModal
    :is-visible="isVisible"
    title="Import from VIA"
    :list-url="viaLayoutSource.listUrl"
    label="VIA"
    prefix="via"
    :source="viaLayoutSource"
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
import { viaLayoutSource, type PreviewLayout } from '@/utils/preview/layout-source'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

const fetchViaDefinition = async (name: string): Promise<unknown> => {
  const resp = await fetch(viaLayoutSource.layoutUrl(name))
  if (!resp.ok) throw new Error(`Failed to fetch: ${resp.status} ${resp.statusText}`)
  return resp.json()
}

const importVia = async (name: string, cached?: PreviewLayout) => {
  // The preview already downloaded this definition — don't ask for it twice.
  const data = cached?.raw ?? (await fetchViaDefinition(name))

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
