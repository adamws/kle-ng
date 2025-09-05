<template>
  <input
    ref="inputRef"
    :value="modelValue"
    @input="handleInput"
    @wheel="handleWheel"
    @focus="handleFocus"
    @blur="handleBlur"
    @keydown="handleKeydown"
    :type="type"
    :step="step"
    :min="min"
    :max="max"
    :class="inputClass"
    :title="title"
    :placeholder="placeholder"
    :disabled="disabled"
  />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { D } from '@/utils/decimal-math'

interface Props {
  modelValue: number
  step?: number
  min?: number
  max?: number
  type?: string
  class?: string
  title?: string
  placeholder?: string
  disabled?: boolean
  wrapAround?: boolean
  wrapMin?: number
  wrapMax?: number
}

interface Emits {
  (e: 'update:modelValue', value: number): void
  (e: 'change', value: number): void
}

const props = withDefaults(defineProps<Props>(), {
  step: 1,
  type: 'number',
  class: 'form-control form-control-sm',
  disabled: false,
  wrapAround: false,
  wrapMin: -180,
  wrapMax: 180,
})

const emit = defineEmits<Emits>()

const inputRef = ref<HTMLInputElement>()
const isActive = ref(false)

const inputClass = computed(() => {
  let classes = props.class
  if (isActive.value) {
    classes += ' scrollable-active'
  }
  return classes
})

const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  const value = parseFloat(target.value)
  if (!isNaN(value)) {
    emit('update:modelValue', value)
    emit('change', value)
  }
}

const handleFocus = () => {
  isActive.value = true
}

const handleBlur = () => {
  isActive.value = false
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    inputRef.value?.blur()
  }
}

const adjustValue = (delta: number) => {
  let newValue = D.add(props.modelValue, D.mul(delta, props.step || 1))

  if (props.wrapAround) {
    // Handle wrapping for rotation values (-180 to 180)
    const min = props.wrapMin || -180
    const max = props.wrapMax || 180
    const range = D.sub(max, min)

    // Normalize to 0-range, wrap, then shift back
    let normalized = D.sub(newValue, min)
    normalized = D.mod(D.add(D.mod(normalized, range), range), range)
    newValue = D.add(normalized, min)

    // Ensure we stay within the exact bounds
    if (newValue > max) {
      newValue = D.add(min, D.sub(newValue, max))
    } else if (newValue < min) {
      newValue = D.sub(max, D.sub(min, newValue))
    }
  } else {
    // Apply min/max constraints for non-wrapping values
    if (props.min !== undefined && newValue < props.min) {
      newValue = props.min
    }
    if (props.max !== undefined && newValue > props.max) {
      newValue = props.max
    }
  }

  emit('update:modelValue', newValue)
  emit('change', newValue)
}

const handleWheel = (event: WheelEvent) => {
  // Only handle wheel events when the input is focused/active
  if (!isActive.value) {
    return
  }

  event.preventDefault()

  // Determine direction (negative deltaY means scroll up, positive means scroll down)
  const delta = event.deltaY > 0 ? -1 : 1
  adjustValue(delta)
}
</script>

<style scoped>
.scrollable-active {
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25) !important;
  border-color: #007bff !important;
}

input:focus.scrollable-active {
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.35) !important;
}
</style>
