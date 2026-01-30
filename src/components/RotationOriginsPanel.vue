<template>
  <div
    v-if="visible"
    class="rotation-origins-panel"
    ref="panelRef"
    :style="{ transform: `translate(${position.x}px, ${position.y}px)` }"
    @mousedown="handleMouseDown"
  >
    <div class="panel-content">
      <div class="panel-header" @mousedown="handleHeaderMouseDown">
        <div class="panel-title">
          <BiGripVertical class="me-2 drag-handle" />
          <BiArrowRepeat class="me-2" />
          Move Rotation Origins
        </div>
        <button
          type="button"
          class="btn-close"
          @click="handleClose"
          @mousedown.stop
          aria-label="Close"
        ></button>
      </div>

      <div class="panel-body">
        <!-- Info banner -->
        <div class="info-banner mb-3">
          <BiInfoCircle class="me-2" />
          <span v-if="selectedKeysCount === 0">
            No keys selected - will affect <strong>all keys</strong>
          </span>
          <span v-else>
            Will affect <strong>{{ selectedKeysCount }} selected key(s)</strong>
          </span>
        </div>

        <!-- Position controls -->
        <div class="controls-section mb-3">
          <h6 class="section-title">New Rotation Origin Position</h6>

          <!-- Use Key Centers checkbox -->
          <div class="form-check mb-3">
            <input
              class="form-check-input"
              type="checkbox"
              id="useKeyCenters"
              v-model="useKeyCenters"
            />
            <label class="form-check-label" for="useKeyCenters">
              Use key centers
              <small class="text-muted d-block">
                Automatically calculate center position for each key
              </small>
            </label>
          </div>

          <!-- Manual position inputs (disabled when useKeyCenters is checked) -->
          <div class="row g-2">
            <div class="col-6">
              <label class="form-label small">X Position</label>
              <input
                type="number"
                class="form-control form-control-sm"
                v-model.number="manualX"
                :disabled="useKeyCenters"
                step="0.25"
                placeholder="X"
              />
            </div>
            <div class="col-6">
              <label class="form-label small">Y Position</label>
              <input
                type="number"
                class="form-control form-control-sm"
                v-model.number="manualY"
                :disabled="useKeyCenters"
                step="0.25"
                placeholder="Y"
              />
            </div>
          </div>

          <div v-if="!useKeyCenters" class="small text-muted mt-2">
            <BiLightbulb />
            Enter coordinates for a shared rotation origin point
          </div>
        </div>

        <!-- Preview section -->
        <div v-if="hasPreview" class="preview-section mb-3">
          <div class="preview-indicator">
            <BiEye class="me-1" />
            Preview active - rotate keys to see changes
          </div>
        </div>

        <!-- Action buttons -->
        <div class="action-buttons">
          <button type="button" class="btn btn-secondary btn-sm flex-fill" @click="handleCancel">
            <span class="d-flex align-items-center justify-content-center gap-1">
              <BiXCircle />
              Cancel
            </span>
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm flex-fill"
            @click="handleApply"
            :disabled="!canApply"
          >
            <span class="d-flex align-items-center justify-content-center gap-1">
              <BiCheckCircle />
              Apply
            </span>
          </button>
        </div>

        <!-- Help text -->
        <div class="help-text mt-3">
          <small class="text-muted">
            <ul class="mb-0">
              <li>This tool changes rotation origins without affecting position</li>
              <li>Use "key centers" for independent rotation of each key</li>
              <li>Use manual coordinates for defining shared rotation point</li>
            </ul>
          </small>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { useDraggablePanel } from '@/composables/useDraggablePanel'
import BiGripVertical from 'bootstrap-icons/icons/grip-vertical.svg'
import BiArrowRepeat from 'bootstrap-icons/icons/arrow-repeat.svg'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'
import BiLightbulb from 'bootstrap-icons/icons/lightbulb.svg'
import BiEye from 'bootstrap-icons/icons/eye.svg'
import BiXCircle from 'bootstrap-icons/icons/x-circle.svg'
import BiCheckCircle from 'bootstrap-icons/icons/check-circle.svg'

// Props
interface Props {
  visible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
})

// Emits
interface Emits {
  (e: 'close'): void
}

const emit = defineEmits<Emits>()

const keyboardStore = useKeyboardStore()

// Local state
const useKeyCenters = ref(true)
const manualX = ref(0)
const manualY = ref(0)
const hasPreview = ref(false)

// Dragging functionality
const { position, panelRef, handleMouseDown, handleHeaderMouseDown, initializePosition } =
  useDraggablePanel({
    defaultPosition: { x: 100, y: 100 },
    margin: 10,
    headerHeight: 45,
  })

// Computed properties
const selectedKeysCount = computed(() => keyboardStore.selectedKeys.length)

const targetKeys = computed(() => {
  return selectedKeysCount.value > 0 ? keyboardStore.selectedKeys : keyboardStore.keys
})

const canApply = computed(() => {
  if (useKeyCenters.value) {
    return true
  }
  // For manual mode, require both X and Y to be set (can be 0)
  return manualX.value !== null && manualY.value !== null
})

// Watch for panel visibility
watch(
  () => props.visible,
  async (isVisible) => {
    if (isVisible) {
      // Reset state when opening
      useKeyCenters.value = true
      manualX.value = 0
      manualY.value = 0
      hasPreview.value = false

      // Position panel on the right side
      initializePosition({ x: window.innerWidth - 420, y: 100 })
      await nextTick()
    }
  },
)

// Methods
const handleApply = () => {
  if (!canApply.value) return

  if (useKeyCenters.value) {
    // Use the store method to move rotation origins to key centers
    keyboardStore.moveRotationOriginsToPosition(null, targetKeys.value)
  } else {
    // Use manual coordinates
    keyboardStore.moveRotationOriginsToPosition(
      { x: manualX.value, y: manualY.value },
      targetKeys.value,
    )
  }

  hasPreview.value = false
  emit('close')
}

const handleCancel = () => {
  hasPreview.value = false
  emit('close')
}

const handleClose = () => {
  handleCancel()
}
</script>

<style scoped>
.rotation-origins-panel {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 1000;
  width: 400px;
  user-select: none;
}

/* Mobile anchoring */
@media (max-width: 767px) {
  .rotation-origins-panel {
    position: fixed !important;
    top: auto !important;
    bottom: 0 !important;
    left: 0 !important;
    right: 0 !important;
    width: 100% !important;
    height: auto !important;
    max-height: 50vh !important;
    transform: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    border-left: none !important;
    border-right: none !important;
    border-bottom: none !important;
  }

  .rotation-origins-panel .panel-content {
    border-radius: 0 !important;
    height: 100% !important;
    display: flex !important;
    flex-direction: column !important;
  }

  .rotation-origins-panel .panel-body {
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
  background-color: var(--bs-tertiary-bg);
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
  color: #6c757d;
  cursor: grab;
}

.drag-handle:active {
  cursor: grabbing;
}

.panel-body {
  padding: 12px;
  max-height: 500px;
  overflow-y: auto;
}

.info-banner {
  background: var(--bs-primary-bg-subtle);
  border: 1px solid var(--bs-primary-border-subtle);
  border-radius: 4px;
  padding: 8px 12px;
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: var(--bs-emphasis-color);
}

.info-banner i {
  color: var(--bs-primary);
  flex-shrink: 0;
}

.controls-section {
  background: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 4px;
  padding: 12px;
}

.section-title {
  font-size: 0.85rem;
  font-weight: 600;
  margin-bottom: 10px;
  color: var(--bs-emphasis-color);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-label {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 4px;
  color: var(--bs-secondary-color);
}

.form-check {
  padding-left: 1.5rem;
  margin-bottom: 0;
}

.form-check-input {
  margin-top: 0.25rem;
}

.form-check-label {
  font-size: 0.875rem;
  color: var(--bs-emphasis-color);
}

.form-check-label small {
  font-size: 0.75rem;
  margin-top: 2px;
  color: var(--bs-secondary-color);
}

.preview-section {
  background: var(--bs-info-bg-subtle);
  border: 1px solid var(--bs-info-border-subtle);
  border-radius: 4px;
  padding: 8px 12px;
}

.preview-indicator {
  display: flex;
  align-items: center;
  font-size: 0.875rem;
  color: var(--bs-emphasis-color);
}

.preview-indicator i {
  color: var(--bs-info);
  flex-shrink: 0;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.help-text {
  border-top: 1px solid var(--bs-border-color);
  padding-top: 10px;
  margin-top: 2px;
}

.help-text small {
  color: var(--bs-secondary-color);
}

.help-text ul {
  padding-left: 1.25rem;
  margin-bottom: 0;
}

.help-text li {
  margin-bottom: 3px;
  line-height: 1.4;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .rotation-origins-panel {
    width: 320px;
  }

  .panel-body {
    padding: 10px;
  }
}
</style>
