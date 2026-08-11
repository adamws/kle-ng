import { ref, computed, shallowRef, type Ref } from 'vue'
import { LayoutPrefetcher, isCancellation } from '@/utils/preview/layout-prefetcher'
import { LayoutPreviewRenderer } from '@/utils/preview/layout-preview-renderer'
import type { LayoutSource, PreviewLayout } from '@/utils/preview/layout-source'

/**
 * Drives the hover-preview pane in the QMK/VIA import modal.
 *
 * Owns one prefetcher and one renderer per modal instance. Hovering an item
 * downloads it at high priority; moving to another item abandons the previous
 * request. Rows scrolled into view are downloaded speculatively at low
 * priority and dropped whenever the search query changes.
 */

export type PreviewState = 'idle' | 'loading' | 'ready' | 'error' | 'too-large'

/** How long the pointer must rest on a row before we spend a request on it */
const HOVER_INTENT_MS = 120

export interface UseLayoutPreview {
  state: Ref<PreviewState>
  layout: Ref<PreviewLayout | null>
  errorMessage: Ref<string | null>
  variantIndex: Ref<number>
  /** Name currently driving the pane, or null when nothing is hovered */
  activeName: Ref<string | null>
  hover(name: string | null): void
  prefetchVisible(names: string[]): void
  onQueryChange(): void
  nextVariant(): void
  previousVariant(): void
  getCached(name: string): PreviewLayout | undefined
  renderer: LayoutPreviewRenderer
  dispose(): void
}

export function useLayoutPreview(source: LayoutSource): UseLayoutPreview {
  const prefetcher = new LayoutPrefetcher(source)
  const renderer = new LayoutPreviewRenderer()

  const state = ref<PreviewState>('idle')
  const layout = shallowRef<PreviewLayout | null>(null)
  const errorMessage = ref<string | null>(null)
  const variantIndex = ref(0)
  const activeName = ref<string | null>(null)

  let hoverTimer: ReturnType<typeof setTimeout> | null = null
  let disposed = false

  const clearHoverTimer = () => {
    if (hoverTimer !== null) {
      clearTimeout(hoverTimer)
      hoverTimer = null
    }
  }

  const show = (result: PreviewLayout) => {
    layout.value = result
    variantIndex.value = 0
    errorMessage.value = null
    state.value = result.tooLarge ? 'too-large' : 'ready'
  }

  const load = (name: string) => {
    state.value = 'loading'
    prefetcher
      .request(name, 'high')
      .then((result) => {
        // A slower response for an abandoned row must not overwrite the pane.
        if (disposed || activeName.value !== name) return
        show(result)
      })
      .catch((error: unknown) => {
        if (disposed || activeName.value !== name || isCancellation(error)) return
        layout.value = null
        errorMessage.value = error instanceof Error ? error.message : 'Failed to load preview'
        state.value = 'error'
      })
  }

  const hover = (name: string | null) => {
    if (name === null) {
      // Keep whatever is on screen: the pane shouldn't flicker empty as the
      // pointer crosses the gap between rows or moves to the Import button.
      return
    }

    // Already showing (or already waiting on) this one. Checked before the
    // timer is cleared — a repeat hover must not cancel its own pending load.
    if (activeName.value === name && state.value !== 'error') return

    clearHoverTimer()
    activeName.value = name

    const cached = prefetcher.peek(name)
    if (cached) {
      show(cached)
      return
    }

    state.value = 'loading'
    hoverTimer = setTimeout(() => {
      hoverTimer = null
      if (!disposed && activeName.value === name) load(name)
    }, HOVER_INTENT_MS)
  }

  const prefetchVisible = (names: string[]) => {
    if (disposed || names.length === 0) return
    prefetcher.prefetch(names)
  }

  const onQueryChange = () => {
    prefetcher.cancelLowPriority()
    clearHoverTimer()
    activeName.value = null
    layout.value = null
    errorMessage.value = null
    variantIndex.value = 0
    state.value = 'idle'
  }

  const variantCount = computed(() => layout.value?.variants.length ?? 0)

  const nextVariant = () => {
    if (variantCount.value < 2) return
    variantIndex.value = (variantIndex.value + 1) % variantCount.value
  }

  const previousVariant = () => {
    if (variantCount.value < 2) return
    variantIndex.value = (variantIndex.value - 1 + variantCount.value) % variantCount.value
  }

  const dispose = () => {
    disposed = true
    clearHoverTimer()
    prefetcher.dispose()
    renderer.dispose()
  }

  return {
    state,
    layout,
    errorMessage,
    variantIndex,
    activeName,
    hover,
    prefetchVisible,
    onQueryChange,
    nextVariant,
    previousVariant,
    getCached: (name: string) => prefetcher.peek(name),
    renderer,
    dispose,
  }
}
