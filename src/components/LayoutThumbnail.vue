<template>
  <div ref="hostRef" class="layout-thumbnail" :class="{ 'is-empty': !rendered }">
    <BiExclamationTriangle v-if="failed" class="text-warning" :title="'Preview unavailable'" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import type { Key, KeyboardMetadata } from '@adamws/kle-serial'
import { LayoutPreviewRenderer } from '@/utils/preview/layout-preview-renderer'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'

/**
 * Inline layout thumbnail, rendered from the layout itself rather than a stored image.
 *
 * Reuses the headless renderer that drives the QMK/VIA import preview
 * (utils/preview/layout-preview-renderer.ts), so saved layouts need no stored image:
 * every row is drawn from its payload on the fly.
 *
 * One renderer per instance: `LayoutPreviewRenderer` owns and reuses a single canvas,
 * so instances cannot be shared between rows.
 */

const props = defineProps<{
  keys: Key[]
  metadata: KeyboardMetadata
}>()

const hostRef = ref<HTMLElement | null>(null)
const rendered = ref(false)
const failed = ref(false)

const renderer = new LayoutPreviewRenderer()

const draw = () => {
  const host = hostRef.value
  if (!host) return

  const maxWidth = Math.max(1, host.clientWidth)
  const maxHeight = Math.max(1, host.clientHeight)
  if (maxWidth <= 1 || maxHeight <= 1) return // not laid out yet; the observer retries

  try {
    const result = renderer.render(props.keys, props.metadata, {
      maxWidth,
      maxHeight,
      onUpdate: () => {
        /* canvas is live in the DOM — the repaint is already visible */
      },
    })
    if (result.canvas.parentElement !== host) {
      host.replaceChildren(result.canvas)
    }
    rendered.value = true
    failed.value = false
  } catch (error) {
    console.error('Error rendering layout thumbnail:', error)
    failed.value = true
  }
}

let resizeObserver: ResizeObserver | null = null

watch(
  () => [props.keys, props.metadata] as const,
  () => void nextTick(draw),
)

onMounted(() => {
  resizeObserver = new ResizeObserver(() => draw())
  if (hostRef.value) resizeObserver.observe(hostRef.value)
  void nextTick(draw)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
  renderer.dispose()
})
</script>

<style scoped>
.layout-thumbnail {
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.layout-thumbnail.is-empty {
  background: var(--bs-tertiary-bg);
  border-radius: var(--bs-border-radius-sm);
}
</style>
