<script setup lang="ts">
import { ref, watch } from 'vue'
import CustomColorPicker from './CustomColorPicker.vue'

interface Props {
  modelValue?: string
  disabled?: boolean
  size?: 'sm' | 'md' | 'lg'
  class?: string
  style?: string | Record<string, string | number>
  title?: string
}

interface Emits {
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string): void
  (e: 'input', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'sm',
})

const emit = defineEmits<Emits>()

const showPicker = ref(false)
const colorValue = ref(props.modelValue || '#CCCCCC')
const originalValue = ref(props.modelValue || '#CCCCCC')

// Watch for external changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue && newValue !== colorValue.value) {
      colorValue.value = newValue
      originalValue.value = newValue
    }
  },
)

// Handle color changes from the custom picker
const handleColorChange = (color: string) => {
  colorValue.value = color
  emit('update:modelValue', color)
  emit('input', color)
}

// Toggle picker visibility
const togglePicker = () => {
  if (props.disabled) {
    return // Don't do anything if disabled
  }
  if (!showPicker.value) {
    // Store original value when opening picker
    originalValue.value = colorValue.value
  }
  showPicker.value = !showPicker.value
}

// Accept changes and emit final events
const acceptChanges = () => {
  emit('change', colorValue.value)
  emit('input', colorValue.value)
  showPicker.value = false
}

// Cancel changes and restore original value
const cancelChanges = () => {
  colorValue.value = originalValue.value
  emit('update:modelValue', originalValue.value)
  emit('change', originalValue.value)
  emit('input', originalValue.value)
  showPicker.value = false
}

// Close picker when clicking outside (accept changes)
const pickerRef = ref<HTMLElement>()
const handleClickOutside = (event: Event) => {
  if (pickerRef.value && !pickerRef.value.contains(event.target as Node)) {
    acceptChanges()
  }
}

// Handle keyboard events for the color picker
const handleKeydown = (event: KeyboardEvent) => {
  if (!showPicker.value) return

  // Don't handle keyboard events if they're from input fields
  const target = event.target as HTMLElement
  if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
    return
  }

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
    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('click', handleClickOutside)
    document.removeEventListener('keydown', handleKeydown)
  }
})

// Cleanup on unmount
import { onUnmounted } from 'vue'
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="vue-color-picker-wrapper" ref="pickerRef">
    <!-- Color preview button that triggers the picker -->
    <div
      @click="!disabled && togglePicker()"
      :class="[props.class, { disabled: disabled }]"
      :style="props.style"
      :title="title"
      class="color-picker-button"
    >
      <div class="color-preview-swatch" :style="{ backgroundColor: colorValue }"></div>
    </div>

    <!-- Custom color picker popup -->
    <div v-if="showPicker" class="color-picker-popup">
      <CustomColorPicker :model-value="colorValue" @update:model-value="handleColorChange" />

      <div class="color-picker-footer">
        <button @click="cancelChanges" type="button" class="btn btn-secondary btn-sm me-2">
          Cancel
        </button>
        <button @click="acceptChanges" type="button" class="btn btn-primary btn-sm">OK</button>
      </div>
    </div>
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
}

.color-picker-button:hover:not(.disabled) {
  border-color: var(--input-focus-border-color);
  box-shadow: 0 0 0 0.25rem var(--bs-focus-ring-color);
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
}

.color-picker-popup {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 1000;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 4px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  padding: 15px;
  margin-top: 2px;
  min-width: 280px;
}

.color-picker-footer {
  margin-top: 10px;
  text-align: center;
  border-top: 1px solid var(--bs-border-color);
  padding-top: 10px;
}
</style>
