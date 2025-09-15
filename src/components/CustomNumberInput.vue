<template>
  <div
    class="custom-number-input"
    :class="{
      'input-focused': isActive,
      'input-disabled': disabled,
      'has-suffix': $slots.suffix,
      [`size-${size}`]: true,
    }"
  >
    <input
      ref="inputRef"
      :value="displayValue"
      @input="handleInput"
      @change="handleInputChange"
      @wheel="handleWheel"
      @focus="handleFocus"
      @blur="handleBlur"
      @keydown="handleKeydown"
      type="number"
      :step="step"
      :min="min"
      :max="max"
      :class="inputClass"
      :title="title"
      :placeholder="placeholder"
      :disabled="disabled"
    />
    <div class="spinner-buttons">
      <button
        type="button"
        class="spinner-btn spinner-up"
        @click="increment"
        @mousedown.prevent
        :disabled="disabled || (max !== undefined && (modelValue ?? 0) >= max)"
        :title="`Increase by ${step}`"
        tabindex="-1"
      >
        <i class="bi bi-chevron-up"></i>
      </button>
      <button
        type="button"
        class="spinner-btn spinner-down"
        @click="decrement"
        @mousedown.prevent
        :disabled="disabled || (min !== undefined && (modelValue ?? 0) <= min)"
        :title="`Decrease by ${step}`"
        tabindex="-1"
      >
        <i class="bi bi-chevron-down"></i>
      </button>
    </div>
    <div v-if="$slots.suffix" ref="suffixRef" class="input-suffix">
      <slot name="suffix"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import { D } from '@/utils/decimal-math'

/**
 * Props for the CustomNumberInput component
 * @interface Props
 */
interface Props {
  /** The current numeric value of the input, undefined for empty values */
  modelValue: number | undefined

  /** Step increment/decrement value for spinner buttons and arrow keys @default 1 */
  step?: number

  /** Step value when Ctrl key is held during wheel or arrow key operations @default 1 */
  ctrlStep?: number

  /** Minimum allowed value (inclusive) */
  min?: number

  /** Maximum allowed value (inclusive) */
  max?: number

  /** CSS classes to apply to the input element @default 'form-control form-control-sm' */
  class?: string

  /** Tooltip text for the input element */
  title?: string

  /** Placeholder text for the input element */
  placeholder?: string

  /** Whether the input is disabled @default false */
  disabled?: boolean

  /** Enable wrap-around behavior when reaching min/max limits @default false */
  wrapAround?: boolean

  /** Minimum value for wrap-around calculations @default -360 */
  wrapMin?: number

  /** Maximum value for wrap-around calculations @default 360 */
  wrapMax?: number

  /** Visual size variant of the component @default 'default' */
  size?: 'default' | 'compact'

  /**
   * Behavior when input is cleared:
   * - null: allow empty/undefined values
   * - number: default to specific value
   * - undefined: default to min value or 0
   */
  valueOnClear?: number | null

  /** Disable mouse wheel input when focused @default false */
  disableWheel?: boolean
}

/**
 * Events emitted by the CustomNumberInput component
 * @interface Emits
 */
interface Emits {
  /** Emitted when the component value changes (for v-model binding) */
  (e: 'update:modelValue', value: number | undefined): void

  /** Emitted when the input value is committed (on blur or Enter) */
  (e: 'change', value: number | undefined): void
}

const props = withDefaults(defineProps<Props>(), {
  step: 1,
  ctrlStep: 1,
  class: 'form-control form-control-sm',
  disabled: false,
  wrapAround: false,
  wrapMin: -360,
  wrapMax: 360,
  size: 'default',
  disableWheel: false,
  // valueOnClear defaults to undefined, which means use min value when cleared
})

const emit = defineEmits<Emits>()

const inputRef = ref<HTMLInputElement>()
const suffixRef = ref<HTMLDivElement>()
const isActive = ref(false)
const userInput = ref<string | null>(null)

const inputClass = computed(() => {
  return props.class
})

// Get the value to use when input is cleared
const getValueOnClear = (): number | undefined => {
  if (props.valueOnClear !== undefined) {
    // Explicit value-on-clear provided
    return props.valueOnClear === null ? undefined : props.valueOnClear
  }

  // Default behavior: use min value if available, otherwise step or 1
  if (props.min !== undefined) {
    return props.min
  }

  return props.step || 1
}

// Display value shows user input while typing, or formatted model value otherwise
const displayValue = computed(() => {
  if (userInput.value !== null) {
    return userInput.value
  }

  if (props.modelValue === undefined || props.modelValue === null) {
    const fallback = getValueOnClear()
    return fallback !== undefined ? String(fallback) : ''
  }

  return String(props.modelValue)
})

const updateSuffixWidth = async () => {
  if (!suffixRef.value) return

  await nextTick()

  // Reset width to auto to measure content
  suffixRef.value.style.width = 'auto'

  // Measure the actual content width
  const contentWidth = suffixRef.value.scrollWidth + 12 // Add padding

  // Set the CSS variable for the suffix width
  if (suffixRef.value.parentElement) {
    suffixRef.value.parentElement.style.setProperty('--suffix-width', `${contentWidth}px`)
  }
}

// Relaxed input handling during typing - track user input and provide immediate feedback
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  userInput.value = target.value

  // Provide immediate feedback for valid numbers, but don't validate constraints
  // This maintains reactivity while preventing focus loss during typing
  if (target.value === '') {
    // For empty values, immediately apply value-on-clear logic if configured
    const clearValue = getValueOnClear()
    if (clearValue !== undefined) {
      emit('update:modelValue', clearValue)
    }
    return
  }

  const numValue = parseFloat(target.value)
  if (!isNaN(numValue)) {
    // Emit the raw number without constraint validation
    // Constraint validation happens on blur/change
    emit('update:modelValue', numValue)
  } else {
    // For invalid input, apply value-on-clear logic immediately
    // This handles cases like programmatically set invalid values
    const clearValue = getValueOnClear()
    if (clearValue !== undefined) {
      emit('update:modelValue', clearValue)
      // Clear the userInput to prevent display issues
      userInput.value = null
    }
  }
}

// Strict validation on change/blur
const handleInputChange = () => {
  if (userInput.value === null) return

  const inputValue = userInput.value.trim()

  // Handle empty input
  if (inputValue === '') {
    const clearValue = getValueOnClear()
    setValidatedValue(clearValue)
    userInput.value = null
    return
  }

  // Parse and validate the number
  const numValue = parseFloat(inputValue)
  if (isNaN(numValue)) {
    // Invalid input - revert to current model value
    userInput.value = null
    return
  }

  setValidatedValue(numValue)
  userInput.value = null
}

const handleFocus = () => {
  isActive.value = true
}

const handleBlur = () => {
  isActive.value = false
  // Perform validation on blur
  handleInputChange()
}

// Validate and constrain a value according to props
const validateValue = (value: number | undefined): number | undefined => {
  if (value === undefined || value === null) {
    return value // Pass through undefined/null as-is
  }

  if (isNaN(value)) {
    return undefined
  }

  let newValue = value

  if (props.wrapAround) {
    const min = props.wrapMin || -360
    const max = props.wrapMax || 360

    // Special handling for rotation values: wrap to 0 when doing full circles
    if (Math.abs(max - min) >= 360) {
      // For full circle ranges like -360 to 360, normalize to -180 to 180
      // This ensures values wrap around 0 properly
      while (newValue > 180) {
        newValue -= 360
      }
      while (newValue < -180) {
        newValue += 360
      }
    } else {
      // Standard wrap-around logic for smaller ranges
      if (newValue > max) {
        newValue = min + (newValue - max)
      } else if (newValue < min) {
        newValue = max - (min - newValue)
      }
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

  return newValue
}

// Set a validated value and emit events
const setValidatedValue = (value: number | undefined) => {
  const validatedValue = validateValue(value)
  emit('update:modelValue', validatedValue)
  emit('change', validatedValue)
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    inputRef.value?.blur()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    increment()
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    decrement()
  }
}

const adjustValue = (delta: number, stepSize?: number) => {
  const actualStep = stepSize !== undefined ? stepSize : props.step || 1
  // If modelValue is undefined and canBeEmpty is true, start from 0
  const currentValue = props.modelValue ?? 0
  const newValue = D.add(currentValue, D.mul(delta, actualStep))

  // Clear user input since we're setting a programmatic value
  userInput.value = null

  setValidatedValue(newValue)
}

const increment = () => {
  adjustValue(1)
}

const decrement = () => {
  adjustValue(-1)
}

const handleWheel = (event: WheelEvent) => {
  // Skip wheel handling if disabled
  if (props.disableWheel) {
    return
  }

  // Only handle wheel events when the input is focused/active OR when hovering over the component
  // This ensures wheel works even if focus state tracking is inconsistent
  const isInputFocused = document.activeElement === inputRef.value
  if (!isActive.value && !isInputFocused) {
    return
  }

  event.preventDefault()

  // Determine direction (negative deltaY means scroll up, positive means scroll down)
  const delta = event.deltaY > 0 ? -1 : 1

  // Use ctrlStep when Ctrl key is pressed, otherwise use regular step
  const stepSize = event.ctrlKey ? props.ctrlStep : props.step
  adjustValue(delta, stepSize)
}

defineExpose({
  focus: () => {
    inputRef.value?.focus()
  },
  select: () => {
    inputRef.value?.select()
  },
})

// Update suffix width on mount and when suffix content changes
onMounted(() => {
  updateSuffixWidth()
})

// Clear user input when model value changes externally
watch(
  () => props.modelValue,
  (newValue, oldValue) => {
    // Only clear user input if the change came from outside (not from our own input)
    if (userInput.value === null && newValue !== oldValue) {
      nextTick(updateSuffixWidth)
    }
  },
  { flush: 'post' },
)

// Clear user input when component becomes disabled or min/max changes
watch([() => props.disabled, () => props.min, () => props.max], () => {
  if (userInput.value !== null) {
    userInput.value = null
  }
})
</script>

<style scoped>
.custom-number-input {
  position: relative;
  display: inline-block;
  width: 100%;
}

.custom-number-input input {
  width: 100%;
  /* Hide native spinners */
  -webkit-appearance: none;
  -moz-appearance: textfield;
}

.custom-number-input input::-webkit-outer-spin-button,
.custom-number-input input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

.custom-number-input input::-moz-spinner {
  display: none;
}

.input-suffix {
  position: absolute;
  top: 1px;
  width: var(--suffix-width, auto);
  min-width: 20px;
  max-width: 80px;
  background: var(--bs-secondary-bg);
  border-left: 1px solid var(--bs-border-color);
  color: var(--bs-secondary-color);
  font-size: inherit;
  font-weight: 500;
  pointer-events: none;
  user-select: none;
  white-space: nowrap;
  box-sizing: border-box;
  text-align: center;
  height: 30px;
  line-height: 30px;
  padding: 0 6px;
}

.spinner-buttons {
  position: absolute;
  right: 0px;
  top: 0px;
  height: 32px;
  width: 30px;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--bs-border-color);
  border-left: 1px solid var(--bs-border-color);
  border-top-right-radius: var(--bs-border-radius);
  border-bottom-right-radius: var(--bs-border-radius);
  overflow: hidden;
}

.spinner-btn {
  flex: 1;
  background: var(--bs-secondary-bg);
  border: none;
  color: var(--bs-secondary-color);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
  transition: all 0.15s ease;
  user-select: none;
  position: relative;
}

.spinner-btn:first-child {
  border-bottom: 1px solid var(--bs-border-color);
}

.spinner-btn:hover {
  background: var(--bs-primary);
  color: var(--bs-primary-text-emphasis);
}

.spinner-btn:disabled {
  color: var(--bs-secondary-color);
  cursor: not-allowed;
}

.spinner-btn:disabled:hover {
  background: var(--bs-secondary-bg);
  color: var(--bs-secondary-color);
}

.input-focused .spinner-buttons {
  border-top-color: var(--input-focus-border-color);
  border-right-color: var(--input-focus-border-color);
  border-bottom-color: var(--input-focus-border-color);
}

/* Disabled state */
.input-disabled .spinner-btn {
  background: var(--bs-secondary-bg-subtle);
  color: var(--bs-secondary-color);
  cursor: not-allowed;
}

/* Size variants */
.custom-number-input input.form-control-sm {
  padding-right: 28px;
}

.custom-number-input input.form-control-sm ~ .spinner-buttons {
  width: 26px;
  height: 32px;
}

.custom-number-input input.form-control-sm ~ .spinner-buttons .spinner-btn {
  font-size: 9px;
}

.custom-number-input.size-default input {
  height: 32px;
  padding: 6px 10px;
  padding-right: 32px;
  font-size: 0.875rem;
  border-radius: var(--bs-border-radius);
}

.custom-number-input.size-default .spinner-buttons {
  width: 30px !important;
  height: 32px !important;
  font-size: 10px;
}

.custom-number-input.size-default .input-suffix {
  right: 30px;
  font-size: 0.875rem;
  height: 30px;
  line-height: 30px;
  padding: 0 6px;
}

.custom-number-input.size-compact {
  height: 24px;
}

.custom-number-input.size-compact input {
  min-height: 24px;
  padding: 2px 6px;
  padding-right: 20px;
  font-size: 0.7rem;
  box-sizing: border-box;
  border-radius: var(--bs-border-radius-sm);
}

.custom-number-input.size-compact .spinner-buttons {
  width: 18px !important;
  height: 24px !important;
  top: 0px !important;
  right: 0px !important;
  font-size: 7px;
  line-height: 1;
  border-top-right-radius: var(--bs-border-radius-sm);
  border-bottom-right-radius: var(--bs-border-radius-sm);
}

.custom-number-input.size-compact .input-suffix {
  right: 18px;
  font-size: 0.7rem;
  height: 22px;
  line-height: 22px;
  padding: 0 6px;
}

/* Override form-control-sm rules for compact variant */
.custom-number-input.size-compact input.form-control-sm ~ .spinner-buttons {
  width: 18px !important;
  height: 24px !important;
}

.custom-number-input.size-compact input.form-control-sm ~ .spinner-buttons .spinner-btn {
  font-size: 7px !important;
}
</style>
