<script setup lang="ts">
import { ref, watch, computed, onUnmounted, nextTick } from 'vue'
import CustomColorPicker from './CustomColorPicker.vue'
import { recentlyUsedColorsManager } from '../utils/recently-used-colors'
import { isValidHex } from '../utils/color-utils'
import { useDraggablePanel } from '../composables/useDraggablePanel'
import BiGripVertical from 'bootstrap-icons/icons/grip-vertical.svg'

type Placement = 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end' | 'auto'

interface Props {
  modelValue?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  class?: string
  style?: string | Record<string, string | number>
  title?: string
  showAlpha?: boolean
  placement?: Placement
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'input', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'sm',
  showAlpha: false,
  placement: 'auto',
})

const emit = defineEmits<Emits>()

const showPicker = ref(false)
const pickerVisible = ref(false)
const colorValue = ref(props.modelValue || '#CCCCCC')
const originalValue = ref(props.modelValue || '#CCCCCC')
const customColorPickerRef = ref<InstanceType<typeof CustomColorPicker>>()

const safeColorValue = computed(() => {
  return isValidHex(colorValue.value) ? colorValue.value : '#CCCCCC'
})

watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue && newValue !== colorValue.value) {
      colorValue.value = newValue
      originalValue.value = newValue
    }
  },
)

const handleColorChange = (color: string) => {
  colorValue.value = color
  emit('update:modelValue', color)
  emit('input', color)
}

// Draggable popup via shared composable
const POPUP_W = 280

const {
  position,
  panelRef: popupRef,
  handleHeaderMouseDown,
  handleMouseDown: handlePanelMouseDown,
} = useDraggablePanel({
  defaultPosition: { x: -9999, y: -9999 },
  headerHeight: 28,
})

const triggerRef = ref<HTMLElement>()

const calculateInitialPosition = () => {
  if (!triggerRef.value || !popupRef.value) return
  const triggerRect = triggerRef.value.getBoundingClientRect()
  const popupRect = popupRef.value.getBoundingClientRect()
  const actualW = popupRect.width || POPUP_W
  const actualH = popupRect.height

  let placement = props.placement
  if (placement === 'auto') {
    const openUp = window.innerHeight - triggerRect.bottom < actualH && triggerRect.top > actualH
    const openLeft = window.innerWidth - triggerRect.left < actualW
    placement = `${openUp ? 'top' : 'bottom'}-${openLeft ? 'end' : 'start'}` as Placement
  }

  let x = placement.endsWith('end') ? triggerRect.right - actualW : triggerRect.left
  let y = placement.startsWith('top') ? triggerRect.top - actualH - 2 : triggerRect.bottom + 2

  // Clamp to viewport so the full popup (including OK button) stays on screen
  const margin = 4
  x = Math.max(margin, Math.min(x, window.innerWidth - actualW - margin))
  y = Math.max(margin, Math.min(y, window.innerHeight - actualH - margin))

  // Set position directly (no smooth transition) — popup is hidden during measurement,
  // so it must appear at the correct position instantly when revealed.
  position.value = { x, y }
}

// Toggle picker visibility
const togglePicker = async () => {
  if (props.disabled) return
  if (!showPicker.value) {
    originalValue.value = colorValue.value
    pickerVisible.value = false // hidden while we measure
    showPicker.value = true
    await nextTick() // wait for popup to mount and onMounted hooks to fire
    await nextTick() // wait for onMounted-triggered reactive updates (e.g. recentlyUsedColors) to flush
    calculateInitialPosition()
    pickerVisible.value = true
  } else {
    showPicker.value = false
    pickerVisible.value = false
  }
}

// Accept changes and emit final events
const acceptChanges = () => {
  recentlyUsedColorsManager.addColor(colorValue.value)
  customColorPickerRef.value?.refreshRecentlyUsedColors()
  emit('update:modelValue', colorValue.value)
  emit('change', colorValue.value)
  emit('input', colorValue.value)
  showPicker.value = false
  pickerVisible.value = false
}

// Cancel changes and restore original value
const cancelChanges = () => {
  colorValue.value = originalValue.value
  emit('update:modelValue', originalValue.value)
  emit('change', originalValue.value)
  emit('input', originalValue.value)
  showPicker.value = false
  pickerVisible.value = false
}

// Handle keyboard events for the color picker
const handleKeydown = (event: KeyboardEvent) => {
  if (!showPicker.value) return
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return
  if (event.key === 'Escape') {
    event.preventDefault()
    event.stopPropagation()
    cancelChanges()
  } else if (event.key === 'Enter') {
    event.preventDefault()
    event.stopPropagation()
    acceptChanges()
  }
}

// Add/remove event listeners when picker is shown/hidden
watch(showPicker, (newValue) => {
  if (newValue) {
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

// Cleanup on unmount
onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="vue-color-picker-wrapper">
    <!-- Color preview button that triggers the picker -->
    <div
      ref="triggerRef"
      @click="!disabled && togglePicker()"
      :class="[props.class, { disabled: disabled }]"
      :style="props.style"
      :title="title"
      :aria-label="title"
      role="button"
      class="color-picker-button"
    >
      <div class="color-preview-swatch" :class="{ 'has-alpha': showAlpha }">
        <div class="color-preview-color" :style="{ backgroundColor: safeColorValue }"></div>
      </div>
    </div>

    <!-- Draggable color picker popup, teleported to body to escape overflow/stacking constraints -->
    <Teleport to="body">
      <div
        v-if="showPicker"
        ref="popupRef"
        class="color-picker-popup"
        :style="{
          transform: `translate(${position.x}px, ${position.y}px)`,
          visibility: pickerVisible ? 'visible' : 'hidden',
        }"
        @mousedown="handlePanelMouseDown"
        data-testid="modal-color-picker"
      >
        <div class="color-picker-drag-handle" @mousedown="handleHeaderMouseDown">
          <BiGripVertical class="drag-icon" />
          <span v-if="title" class="color-picker-title">{{ title }}</span>
          <button
            type="button"
            class="btn-close"
            aria-label="Close"
            @click="cancelChanges"
            @mousedown.stop
          ></button>
        </div>
        <div class="color-picker-popup-body">
          <CustomColorPicker
            ref="customColorPickerRef"
            :model-value="colorValue"
            :show-alpha="showAlpha"
            @update:model-value="handleColorChange"
          />
          <div class="color-picker-footer">
            <button @click="cancelChanges" type="button" class="btn btn-secondary btn-sm me-2">
              Cancel
            </button>
            <button @click="acceptChanges" type="button" class="btn btn-primary btn-sm">OK</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.vue-color-picker-wrapper {
  position: relative;
  display: inline-block;
}

.color-picker-button {
  cursor: pointer;
  border-radius: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  min-height: auto;
  overflow: hidden;
  position: relative;
}

.color-picker-button:hover:not(.disabled) {
  border-color: var(--input-focus-border-color);
  box-shadow: 0 0 0 2px var(--input-focus-border-color);
  z-index: 9999;
}

.color-picker-button.disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.color-picker-button:not(.disabled) {
  cursor: pointer;
}

.color-preview-swatch {
  width: 100%;
  height: 100%;
  border-radius: 0;
  min-height: auto;
  position: relative;
}

.color-preview-swatch.has-alpha {
  background-image:
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%);
  background-size: 8px 8px;
  background-position:
    0 0,
    0 4px,
    4px -4px,
    -4px 0;
}

.color-preview-color {
  width: 100%;
  height: 100%;
}

.color-picker-popup {
  position: fixed;
  top: 0;
  left: 0;
  z-index: 9999;
  width: 280px;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  user-select: none;
  overflow: hidden;
}

.color-picker-drag-handle {
  background-color: var(--bs-tertiary-bg);
  border-bottom: 1px solid var(--bs-border-color);
  padding: 4px 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: move;
}

.drag-icon {
  color: var(--bs-secondary-color);
  flex-shrink: 0;
}

.color-picker-title {
  flex: 1;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--bs-body-color);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 0 6px;
  user-select: none;
}

.drag-icon:active {
  cursor: grabbing;
}

.color-picker-popup-body {
  padding: 15px;
}

.color-picker-footer {
  margin-top: 10px;
  text-align: center;
  border-top: 1px solid var(--bs-border-color);
  padding-top: 10px;
}
</style>
