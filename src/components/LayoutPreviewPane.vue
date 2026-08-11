<template>
  <div class="layout-preview-pane" data-testid="layout-preview-pane">
    <div class="preview-stage" ref="stageRef">
      <!-- Loading -->
      <div v-if="state === 'loading'" class="preview-status" data-testid="layout-preview-loading">
        <div
          class="progress"
          role="progressbar"
          aria-label="Downloading layout preview"
          aria-valuetext="Loading…"
          data-testid="layout-preview-progress"
        >
          <div
            class="progress-bar progress-bar-striped progress-bar-animated progress-bar-indeterminate"
          ></div>
        </div>
        <p class="text-muted small mb-0 text-truncate w-100 text-center">{{ name }}</p>
      </div>

      <!-- Error -->
      <div v-else-if="state === 'error'" class="preview-status" data-testid="layout-preview-error">
        <BiExclamationTriangle class="text-warning preview-icon" />
        <p class="text-muted small mb-0 text-center">{{ errorMessage || 'Preview unavailable' }}</p>
      </div>

      <!-- Too large to import -->
      <div
        v-else-if="state === 'too-large'"
        class="preview-status"
        data-testid="layout-preview-too-large"
      >
        <BiExclamationTriangle class="text-warning preview-icon" />
        <p class="text-muted small mb-0 text-center">
          {{ layout?.keyCount }} keys — exceeds the {{ MAX_PREVIEW_KEYS }} key limit and cannot be
          imported.
        </p>
      </div>

      <!-- Idle -->
      <div v-else-if="state === 'idle'" class="preview-status" data-testid="layout-preview-idle">
        <BiKeyboard class="text-secondary preview-icon" />
        <p class="text-muted small mb-0 text-center">Hover a keyboard to preview its layout</p>
      </div>

      <!-- Rendered canvas is mounted into this host by the watcher below -->
      <div v-show="state === 'ready'" ref="canvasHostRef" class="preview-canvas-host"></div>
    </div>

    <div class="preview-meta" aria-live="polite" aria-atomic="true">
      <template v-if="state === 'ready' && layout">
        <div class="preview-name">
          <span class="text-truncate fw-medium" :title="layout.name">{{ layout.name }}</span>
          <span
            v-if="pinned"
            class="badge text-bg-secondary flex-shrink-0"
            title="Click the highlighted result again to deselect"
            data-testid="layout-preview-pinned"
            >Selected</span
          >
        </div>
        <div class="text-muted small">{{ dimensionsLabel }}</div>
        <div v-if="layout.variants.length > 1" class="variant-switcher">
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            aria-label="Previous layout variant"
            data-testid="layout-preview-variant-prev"
            @click="emit('previous-variant')"
          >
            <BiChevronLeft />
          </button>
          <span class="variant-label text-truncate" :title="variantLabel">
            {{ variantLabel }} ({{ variantIndex + 1 }}/{{ layout.variants.length }})
          </span>
          <button
            type="button"
            class="btn btn-sm btn-outline-secondary"
            aria-label="Next layout variant"
            data-testid="layout-preview-variant-next"
            @click="emit('next-variant')"
          >
            <BiChevronRight />
          </button>
        </div>
      </template>
      <div v-else class="text-muted small">&nbsp;</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'
import BiKeyboard from 'bootstrap-icons/icons/keyboard.svg'
import BiChevronLeft from 'bootstrap-icons/icons/chevron-left.svg'
import BiChevronRight from 'bootstrap-icons/icons/chevron-right.svg'
import type { LayoutPreviewRenderer } from '@/utils/preview/layout-preview-renderer'
import { MAX_PREVIEW_KEYS, type PreviewLayout } from '@/utils/preview/layout-source'
import type { PreviewState } from '@/composables/useLayoutPreview'

interface Props {
  state: PreviewState
  layout: PreviewLayout | null
  variantIndex: number
  name: string | null
  errorMessage: string | null
  renderer: LayoutPreviewRenderer
  /** True while a result is selected and the preview is held on it */
  pinned?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'next-variant'): void
  (e: 'previous-variant'): void
}>()

const stageRef = ref<HTMLElement | null>(null)
const canvasHostRef = ref<HTMLElement | null>(null)

const activeVariant = computed(() => props.layout?.variants[props.variantIndex] ?? null)
const variantLabel = computed(() => activeVariant.value?.label ?? '')

const dimensionsLabel = computed(() => {
  const variant = activeVariant.value
  if (!variant || !props.layout) return ''
  const count = variant.keys.length
  return `${count} ${count === 1 ? 'key' : 'keys'}${lastSize.value}`
})

const lastSize = ref('')

const draw = () => {
  const variant = activeVariant.value
  const host = canvasHostRef.value
  const stage = stageRef.value
  if (!variant || !host || !stage || !props.layout) return

  // Measure the host, not the stage: the host is absolutely positioned to the
  // stage's content box, so this is the space actually available. The stage's
  // clientWidth/clientHeight include its padding, and sizing the canvas to
  // those made every scaled-down layout overflow by the padding — which used
  // to push the stage, the row and the modal taller.
  // Fall back to the stage while the modal is animating in and nothing is laid
  // out yet; the ResizeObserver redraws once it has real dimensions.
  const maxWidth = Math.max(1, host.clientWidth || stage.clientWidth || 1)
  const maxHeight = Math.max(1, host.clientHeight || stage.clientHeight || 1)

  const result = props.renderer.render(variant.keys, props.layout.keyboard.meta, {
    maxWidth,
    maxHeight,
    onUpdate: () => {
      /* canvas is live in the DOM — the repaint is already visible */
    },
  })

  if (result.canvas.parentElement !== host) {
    host.replaceChildren(result.canvas)
  }

  const round = (value: number) => Math.round(value * 100) / 100
  lastSize.value = ` · ${round(result.unitsWide)} × ${round(result.unitsTall)}u`
}

watch(
  () => [props.layout, props.variantIndex, props.state] as const,
  () => {
    if (props.state !== 'ready') return
    void nextTick(draw)
  },
  { immediate: true },
)

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    if (props.state === 'ready') draw()
  })
  if (stageRef.value) resizeObserver.observe(stageRef.value)
})

onBeforeUnmount(() => {
  resizeObserver?.disconnect()
  resizeObserver = null
})
</script>

<style scoped>
.layout-preview-pane {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 100%;
}

.preview-stage {
  --preview-stage-padding: 0.5rem;
  position: relative;
  /* Basis 0, not auto: the stage takes its height from the space the pane has
     to give, never from the layout being previewed. A tall keyboard must be
     scaled down to fit the modal, not grow it. */
  flex: 1 1 0;
  min-height: 260px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--preview-stage-padding);
  border: 1px solid var(--bs-border-color);
  border-radius: var(--bs-border-radius);
  background-color: var(--bs-tertiary-bg);
  overflow: hidden;
}

.preview-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0 1rem;
}

.preview-status .progress {
  width: 100%;
  max-width: 220px;
  height: 8px;
  overflow: hidden;
}

/* Indeterminate loader: the download has no meaningful percentage, so a
   partial bar slides across to show that work is happening. */
.progress-bar-indeterminate {
  width: 40%;
  border-radius: inherit;
  animation: layout-preview-indeterminate 1.4s ease-in-out infinite;
}

@keyframes layout-preview-indeterminate {
  0% {
    margin-left: -40%;
  }
  100% {
    margin-left: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .progress-bar-indeterminate {
    width: 100%;
    animation: none;
  }
}

.preview-name {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

.preview-icon {
  width: 1.75rem;
  height: 1.75rem;
}

/* Absolutely positioned over the stage's content box so the canvas is out of
   flow entirely: it cannot contribute to the stage's height, so no layout it
   draws can resize the container. This also makes the host's client box the
   authoritative "space available" measurement for draw(). */
.preview-canvas-host {
  position: absolute;
  inset: var(--preview-stage-padding);
  display: flex;
  align-items: center;
  justify-content: center;
}

.preview-canvas-host :deep(canvas) {
  display: block;
  max-width: 100%;
  max-height: 100%;
}

.preview-meta {
  min-height: 3.25rem;
  font-size: 0.875rem;
}

.variant-switcher {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin-top: 0.25rem;
}

.variant-switcher .variant-label {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  text-align: center;
}
</style>
