<template>
  <div
    v-if="visible"
    class="curve-layout-panel"
    data-testid="curve-layout-panel"
    ref="panelRef"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title">
          <BiGripVertical class="me-2 drag-handle" />
          <BiBezier2 class="me-2" />
          Curve Layout
        </div>
        <button
          type="button"
          class="btn-close"
          data-testid="curve-layout-close"
          @click="handleCancel"
          @mousedown.stop
          aria-label="Close"
        ></button>
      </div>

      <div class="panel-body">
        <div class="info-banner mb-3">
          <BiInfoCircle class="me-2 flex-shrink-0" />
          <div>
            <span v-if="curveStore.usingAllKeys">
              No keys selected - will affect <strong>all {{ curveStore.keyCount }} keys</strong>
            </span>
            <span v-else>
              Will affect <strong>{{ curveStore.keyCount }} selected key(s)</strong>
            </span>
            <small class="d-block mt-1">Drag the handles on the canvas to shape the curve.</small>
          </div>
        </div>

        <!-- Bend: moves both inner handles along the normal at once, so the common case
             needs no handle dragging at all. -->
        <div class="controls-section mb-3">
          <label class="form-label small d-flex justify-content-between mb-1">
            <span>Bend</span>
            <span class="text-muted">{{ Math.round(bend) }}%</span>
          </label>
          <input
            :value="bend"
            class="form-range"
            data-testid="curve-layout-bend"
            type="range"
            min="-100"
            max="100"
            step="1"
            @input="handleBendInput"
            @mousedown.stop
          />
        </div>

        <div class="row g-2 mb-3">
          <div class="col-6">
            <label class="form-label small mb-1">Gap</label>
            <CustomNumberInput
              :model-value="curveStore.gap"
              data-testid="curve-layout-gap"
              :step="0.05"
              :min="0"
              :max="5"
              :value-on-clear="0"
              title="Extra clearance between keys"
              @update:model-value="updateGap"
            >
              <template #suffix>U</template>
            </CustomNumberInput>
          </div>
        </div>

        <div class="form-check mb-2">
          <input
            id="curve-layout-follow"
            class="form-check-input"
            data-testid="curve-layout-follow"
            type="checkbox"
            :checked="curveStore.followCurve"
            @change="updateFollowCurve"
          />
          <label class="form-check-label" for="curve-layout-follow">
            Follow curve rotation
            <small class="text-muted d-block">Rotate keys to match the curve direction</small>
          </label>
        </div>

        <div class="form-check mb-3">
          <input
            id="curve-layout-allow-overlaps"
            class="form-check-input"
            data-testid="curve-layout-allow-overlaps"
            type="checkbox"
            :checked="curveStore.allowOverlaps"
            @change="updateAllowOverlaps"
          />
          <label class="form-check-label" for="curve-layout-allow-overlaps">
            Allow overlaps
            <small class="text-muted d-block">
              Keep the curve tight and accept overlapping keys. Usually needed for layouts with wide
              keys such as a spacebar.
            </small>
          </label>
        </div>
      </div>

      <!-- Outside the scrolling body: the verdict must stay visible however long the
           controls list gets. -->
      <div class="panel-status">
        <div class="status-line" :class="statusVariant">
          <component :is="curveStore.collisionFree ? BiCheckCircle : BiExclamationTriangle" />
          <span v-if="curveStore.collisionFree">
            {{ curveStore.keyCount }} keys in {{ curveStore.columnCount }} column(s) — no overlaps
          </span>
          <span v-else-if="curveStore.allowOverlaps">
            {{ curveStore.overlapCount }} overlapping pair(s) — allowed
          </span>
          <span v-else>
            No overlap-free layout exists for this curve — ease the bend, or turn on
            <strong>Allow overlaps</strong>
          </span>
        </div>
      </div>

      <div class="panel-footer">
        <button
          type="button"
          class="btn btn-outline-secondary btn-sm d-flex align-items-center gap-1"
          data-testid="curve-layout-reset"
          @click="handleReset"
          @mousedown.stop
        >
          <BiArrowCounterclockwise />
          Reset
        </button>
        <div class="d-flex gap-2">
          <button
            type="button"
            class="btn btn-secondary btn-sm d-flex align-items-center gap-1"
            data-testid="curve-layout-cancel"
            @click="handleCancel"
            @mousedown.stop
          >
            <BiXCircle />
            Cancel
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm d-flex align-items-center gap-1"
            data-testid="curve-layout-apply"
            :disabled="!curveStore.canApply"
            @click="handleApply"
            @mousedown.stop
          >
            <BiCheckCircle />
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { useDraggablePanel } from '@/composables/useDraggablePanel'
import { useCurveLayoutStore } from '@/stores/curveLayout'
import CustomNumberInput from './CustomNumberInput.vue'
import BiGripVertical from 'bootstrap-icons/icons/grip-vertical.svg'
import BiBezier2 from 'bootstrap-icons/icons/bezier2.svg'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'
import BiCheckCircle from 'bootstrap-icons/icons/check-circle.svg'
import BiExclamationTriangle from 'bootstrap-icons/icons/exclamation-triangle.svg'
import BiXCircle from 'bootstrap-icons/icons/x-circle.svg'
import BiArrowCounterclockwise from 'bootstrap-icons/icons/arrow-counterclockwise.svg'

interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), { visible: false })
const emit = defineEmits<{ close: [] }>()

const curveStore = useCurveLayoutStore()

const { position, panelRef, handleMouseDown, handleHeaderMouseDown, initializePosition } =
  useDraggablePanel({
    defaultPosition: { x: 100, y: 100 },
    margin: 10,
    headerHeight: 45,
  })

/**
 * How far the two inner handles are pushed off the chord, as a percentage.
 *
 * Expressed relative to the block's own length rather than in units: the same deflection in U is
 * a gentle arc across a full keyboard row and a hairpin across three keys, so an absolute slider
 * is unusable at one end of the range or the other. 100% deflects by half the chord length,
 * which is about as far as a layout stays useful.
 *
 * This value only ever *reports* the curve. It is deliberately not watched: an earlier version
 * drove the spine from a watcher on it, and because Vue flushes watchers asynchronously the
 * re-entrancy guard was always stale by the time the callback ran. Releasing a handle would
 * re-derive a percentage and then rewrite both inner handles from it, throwing the drag away.
 * The slider writes the spine from its own input handler instead, so there is no loop to guard.
 */
const bend = ref(0)

/**
 * The straight chord the bend is measured from: the line between the two endpoint handles.
 *
 * Derived from the live spine rather than remembered from when the tool opened, so dragging an
 * endpoint moves the baseline with it and the slider keeps meaning what it says.
 */
const chord = () => {
  const spine = curveStore.spine
  const start = spine[0]
  const end = spine[3]
  const dx = end.x - start.x
  const dy = end.y - start.y
  const length = Math.hypot(dx, dy) || 1
  return {
    start,
    end,
    dx,
    dy,
    normal: { x: -dy / length, y: dx / length },
    // Layout units of deflection at 100%.
    scale: Math.max(0.5, length / 2),
  }
}

/** Move both inner handles off the chord by `percent`, keeping the endpoints where they are. */
const applyBend = (percent: number) => {
  const { start, end, dx, dy, normal, scale } = chord()
  const distance = (percent / 100) * scale
  const at = (fraction: number) => ({
    x: start.x + dx * fraction + normal.x * distance,
    y: start.y + dy * fraction + normal.y * distance,
  })
  // Both handles in one store call, so a slider tick re-solves the layout once, not twice.
  curveStore.setSpine([start, at(1 / 3), at(2 / 3), end])
}

/** Read the current curve back as a percentage, for the slider to display. */
const measureBend = (): number => {
  const { start, dx, dy, normal, scale } = chord()
  const offsetOf = (point: { x: number; y: number }, fraction: number) =>
    (point.x - (start.x + dx * fraction)) * normal.x +
    (point.y - (start.y + dy * fraction)) * normal.y

  const spine = curveStore.spine
  const average = (offsetOf(spine[1], 1 / 3) + offsetOf(spine[2], 2 / 3)) / 2
  return Math.max(-100, Math.min(100, Math.round((average / scale) * 100)))
}

const handleBendInput = (event: Event) => {
  bend.value = Number((event.target as HTMLInputElement).value)
  applyBend(bend.value)
}

// Dragging a handle directly leaves the slider showing a stale number. Re-derive it from where
// the handles actually ended up, so the two controls agree. Display only — this moves nothing.
watch(
  () => curveStore.isDraggingHandle,
  (isDragging, wasDragging) => {
    if (isDragging || !wasDragging) return
    bend.value = measureBend()
  },
)

watch(
  () => props.visible,
  (isVisible) => {
    if (!isVisible) return
    bend.value = 0
    initializePosition({ x: window.innerWidth - 380, y: 100 })
  },
)

const updateGap = (value: number | undefined) => {
  curveStore.gap = value ?? 0
  curveStore.preview()
}

const updateFollowCurve = (event: Event) => {
  curveStore.followCurve = (event.target as HTMLInputElement).checked
  curveStore.preview()
}

const updateAllowOverlaps = (event: Event) => {
  curveStore.allowOverlaps = (event.target as HTMLInputElement).checked
  curveStore.preview()
}

/**
 * Clean, tolerated, or blocking.
 *
 * Overlaps the user has explicitly allowed are informational, not a warning to act on, so they
 * get the neutral treatment rather than the same alarm as a layout that cannot be applied.
 */
const statusVariant = computed(() => {
  if (curveStore.collisionFree) return 'is-clear'
  return curveStore.allowOverlaps ? 'is-allowed' : 'is-blocked'
})

const handleReset = () => {
  curveStore.resetSpine()
  bend.value = 0
}

const handleApply = () => {
  curveStore.apply()
  emit('close')
}

const handleCancel = () => {
  curveStore.cancel()
  emit('close')
}

/**
 * Enter applies and Escape cancels, but only when focus is not inside a text field — otherwise
 * typing a gap value and pressing Enter would apply the tool instead of committing the number.
 */
const handleKeydown = (event: KeyboardEvent) => {
  if (!props.visible) return

  const target = event.target as HTMLElement | null
  const isEditing =
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target?.isContentEditable === true

  if (event.key === 'Escape') {
    event.preventDefault()
    handleCancel()
  } else if (event.key === 'Enter' && !isEditing && curveStore.canApply) {
    event.preventDefault()
    handleApply()
  }
}

onMounted(() => document.addEventListener('keydown', handleKeydown))
onUnmounted(() => document.removeEventListener('keydown', handleKeydown))
</script>

<style scoped>
.curve-layout-panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 320px;
  user-select: none;
}

@media (max-width: 767.98px) {
  .curve-layout-panel {
    position: fixed !important;
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    max-height: 60vh !important;
    transform: none !important;
    border-radius: 0 !important;
  }

  .curve-layout-panel .panel-content {
    border-radius: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .curve-layout-panel .panel-body {
    flex: 1 !important;
    overflow-y: auto !important;
    max-height: none !important;
  }
}

.panel-content {
  background-color: var(--bs-body-bg);
  border-radius: 8px;
  box-shadow: var(--bs-box-shadow-lg);
  border: 1px solid var(--bs-border-color);
  overflow: hidden;
}

.panel-header {
  background: var(--bs-tertiary-bg);
  border-bottom: 1px solid var(--bs-border-color);
  padding: 8px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
  user-select: none;
}

.panel-title {
  font-size: 0.9rem;
  font-weight: 600;
  margin: 0;
  color: var(--bs-text-primary);
  display: flex;
  align-items: center;
}

.drag-handle {
  color: var(--bs-secondary-color);
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.panel-body {
  padding: 12px;
  max-height: 340px;
  overflow-y: auto;
}

.panel-status {
  padding: 0 12px 10px;
}

.panel-footer {
  border-top: 1px solid var(--bs-border-color);
  padding: 8px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.info-banner {
  display: flex;
  align-items: flex-start;
  font-size: 0.8rem;
  color: var(--bs-secondary-color);
  background: var(--bs-tertiary-bg);
  border-radius: 6px;
  padding: 8px 10px;
}

.status-line {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  border-radius: 6px;
  padding: 6px 10px;
}

.status-line.is-clear {
  color: var(--bs-success-text-emphasis);
  background: var(--bs-success-bg-subtle);
}

.status-line.is-allowed {
  color: var(--bs-secondary-color);
  background: var(--bs-tertiary-bg);
}

.status-line.is-blocked {
  color: var(--bs-warning-text-emphasis);
  background: var(--bs-warning-bg-subtle);
}
</style>
