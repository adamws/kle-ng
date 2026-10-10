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
      @keyup="handleKeyup"
      type="text"
      inputmode="decimal"
      autocomplete="off"
      spellcheck="false"
      :step="step"
      :min="min"
      :max="max"
      :class="inputClass"
      :title="title"
      :placeholder="placeholder"
      :disabled="disabled"
      :aria-invalid="isInvalid"
    />
    <div v-if="isInvalid" class="invalid-icon-tooltip" :title="invalidMessage"></div>
    <div class="spinner-buttons">
      <button
        type="button"
        class="spinner-btn spinner-up"
        @click="increment"
        @mousedown.prevent
        :disabled="disabled || (max !== undefined && (modelValue ?? referenceValue ?? 0) >= max)"
        :title="`Increase by ${step}`"
        tabindex="-1"
      >
        <BiChevronUp style="width: 0.8em; height 0.8em;" />
      </button>
      <button
        type="button"
        class="spinner-btn spinner-down"
        @click="decrement"
        @mousedown.prevent
        :disabled="disabled || (min !== undefined && (modelValue ?? referenceValue ?? 0) <= min)"
        :title="`Decrease by ${step}`"
        tabindex="-1"
      >
        <BiChevronDown style="width: 0.8em; height 0.8em;" />
      </button>
    </div>
    <div v-if="$slots.suffix" ref="suffixRef" class="input-suffix">
      <slot name="suffix"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onBeforeUnmount } from 'vue'
import { D } from '@/utils/decimal-math'
import BiChevronDown from 'bootstrap-icons/icons/chevron-down.svg'
import BiChevronUp from 'bootstrap-icons/icons/chevron-up.svg'

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

  /**
   * Visual size variant of the component @default 'default'. 'small' matches
   * Bootstrap's small buttons and selects (30 px, 0.875rem), for toolbars.
   */
  size?: 'default' | 'small' | 'compact'

  /**
   * Behavior when input is cleared:
   * - null: allow empty/undefined values
   * - number: default to specific value
   * - undefined: default to min value or 0
   */
  valueOnClear?: number | null

  /** Disable mouse wheel input when focused @default false */
  disableWheel?: boolean

  /**
   * Reference value to use as base when incrementing/decrementing from empty
   * When modelValue is undefined and this is set, increment/decrement will use this as starting point
   * For example, if referenceValue is 3 and field is empty, first increment gives 4, first decrement gives 2
   */
  referenceValue?: number
}

/**
 * Events emitted by the CustomNumberInput component
 * @interface Emits
 */
interface Emits {
  /** Emitted when the component value changes (for v-model binding) */
  (e: 'update:modelValue', value: number | undefined): void

  /** Emitted when the input value changes (on every tick for live preview) */
  (e: 'change', value: number | undefined): void

  /** Emitted when a continuous interaction ends (blur after wheel, keyup after arrow hold, spinner click, typed input commit). Use for undo save points. */
  (e: 'commit', value: number | undefined): void
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
const hasUncommittedChanges = ref(false)
// '' when valid; otherwise the reason, so the error icon's tooltip can
// differentiate "not a number" from "out of range" instead of a generic message.
const invalidReason = ref<'' | 'nan' | 'range'>('')
const isInvalid = computed(() => invalidReason.value !== '')

// True during our own update:modelValue flush, so the watcher below can spot
// its own echo. Time-scoped, not value-scoped: a genuine external change can
// coincidentally match our last echoed value.
let isOwnEmitEchoing = false

// Last value actually committed — distinct from props.modelValue, which live
// typing/wheel/arrow preview overwrites before a commit lands. Invalid input
// reverts to this on blur.
let lastCommittedValue: number | undefined = props.modelValue

// Value a deferred wheel/arrow-hold commit will use, captured at set time so
// unrelated typing before flush can't change it.
let pendingCommitValue: number | undefined = undefined

const inputClass = computed(() => {
  return [props.class, { 'is-invalid': isInvalid.value }]
})

const invalidMessage = computed(() => {
  if (invalidReason.value === 'nan') return 'Not a valid number'
  if (invalidReason.value === 'range') {
    if (props.min !== undefined && props.max !== undefined) {
      return `Value must be between ${props.min} and ${props.max}`
    }
    if (props.min !== undefined) return `Value must be at least ${props.min}`
    if (props.max !== undefined) return `Value must be at most ${props.max}`
  }
  return ''
})

const emitModelValue = (value: number | undefined) => {
  isOwnEmitEchoing = true
  emit('update:modelValue', value)
  nextTick(() => {
    isOwnEmitEchoing = false
  })
}

// Emit a commit and record it as the new last-committed value baseline.
const emitCommit = (value: number | undefined) => {
  const validated = validateValue(value)
  lastCommittedValue = validated
  emit('commit', validated)
}

// Out of range is only meaningful for non-wrap-around fields — wrap-around
// fields (e.g. rotation angle) never have an "invalid" range.
const isOutOfRange = (value: number): boolean => {
  if (props.wrapAround) return false
  if (props.min !== undefined && value < props.min) return true
  if (props.max !== undefined && value > props.max) return true
  return false
}

// Strict numeric parse: unlike parseFloat, this rejects strings with trailing
// garbage (e.g. "5x") instead of silently returning the valid numeric prefix —
// needed now that the input is a plain text field and can contain anything.
const parseNumericInput = (value: string): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : NaN
}

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

// Live-preview value while invalid: the last committed value, so invalid
// text doesn't visibly change anything. Falls back to value-on-clear, then
// referenceValue, then min/0, only when nothing has been committed yet.
const getInvalidFallback = (): number => {
  return lastCommittedValue ?? getValueOnClear() ?? props.referenceValue ?? props.min ?? 0
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

  // Re-check after await since ref could become null
  if (!suffixRef.value) return

  // Reset width to auto to measure content
  suffixRef.value.style.width = 'auto'

  // Measure the actual content width
  const contentWidth = suffixRef.value.scrollWidth + 12 // Add padding

  // Set the CSS variable for the suffix width
  if (suffixRef.value.parentElement) {
    suffixRef.value.parentElement.style.setProperty('--suffix-width', `${contentWidth}px`)
  }
}

// Live input handling during typing - emits update:modelValue AND change on every
// keystroke so live preview tracks typing exactly like spinner/wheel interactions.
// Invalid or out-of-range text is never wiped from the field while the user is
// still typing — it stays visible with an is-invalid indicator, and any live
// preview falls back to the field's default (value-on-clear/min) value instead.
const handleInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  userInput.value = target.value

  if (target.value.trim() === '') {
    invalidReason.value = ''
    const clearValue = getValueOnClear()
    if (clearValue !== undefined) {
      setValidatedValue(clearValue)
    }
    return
  }

  const numValue = parseNumericInput(target.value.trim())

  if (isNaN(numValue)) {
    invalidReason.value = 'nan'
    setValidatedValue(getInvalidFallback())
    return
  }

  if (isOutOfRange(numValue)) {
    invalidReason.value = 'range'
    setValidatedValue(getInvalidFallback())
    return
  }

  invalidReason.value = ''
  setValidatedValue(numValue)
}

// Strict validation on change/blur — emits both change and commit (typed input is always a discrete action)
const handleInputChange = () => {
  if (userInput.value === null) return

  const inputValue = userInput.value.trim()

  // Handle empty input
  if (inputValue === '') {
    const clearValue = getValueOnClear()
    setValidatedValue(clearValue)
    emitCommit(clearValue)
    userInput.value = null
    invalidReason.value = ''
    return
  }

  // Parse and validate the number
  const numValue = parseNumericInput(inputValue)
  if (isNaN(numValue) || isOutOfRange(numValue)) {
    // Discard and revert to the last committed value, not props.modelValue.
    // No new commit needed — this restores exactly the last-committed state.
    invalidReason.value = ''
    userInput.value = null
    setValidatedValue(lastCommittedValue)
    return
  }

  setValidatedValue(numValue)
  emitCommit(numValue)
  userInput.value = null
  invalidReason.value = ''
}

const handleFocus = () => {
  isActive.value = true
}

const handleBlur = () => {
  isActive.value = false
  flushCommit()
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

    // Modulo-based wrap: correct for arbitrarily large/small inputs in O(1).
    // A loop that subtracts/adds the range per iteration (the previous
    // approach) would spin for an unbounded number of iterations — and
    // freeze the page — on a typed value like 1e20.
    let lo: number
    let hi: number
    if (Math.abs(max - min) >= 360) {
      // For full circle ranges like -360 to 360, normalize to -180 to 180
      // This ensures values wrap around 0 properly
      lo = -180
      hi = 180
    } else {
      // Standard wrap-around logic for smaller ranges
      lo = min
      hi = max
    }

    // The interval is closed at both ends. Modulo alone lands in [lo, hi), which
    // would rewrite a typed 180 to -180 and make 180 unreachable by stepping up
    // from 165. Only values congruent to the boundary hit this, and for those the
    // end the user was heading towards is the one to keep — matching the loop
    // this replaced.
    const range = hi - lo
    const wrapped = ((((newValue - lo) % range) + range) % range) + lo
    newValue = wrapped === lo && newValue >= hi ? hi : wrapped
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

// Set a validated value and emit both update:modelValue and change (for live preview)
const setValidatedValue = (value: number | undefined) => {
  const validatedValue = validateValue(value)
  emitModelValue(validatedValue)
  emit('change', validatedValue)
}

// Emit commit when a continuous interaction ends (save point for undo)
const flushCommit = () => {
  if (hasUncommittedChanges.value) {
    hasUncommittedChanges.value = false
    emitCommit(pendingCommitValue)
    pendingCommitValue = undefined
  }
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    inputRef.value?.blur()
  } else if (event.key === 'Enter') {
    // Commit explicitly rather than relying on the browser's native change-on-Enter
    // timing, and stay focused/selected so the user can keep editing quickly.
    event.preventDefault()
    handleInputChange()
    inputRef.value?.select()
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    adjustValue(1, undefined, true)
  } else if (event.key === 'ArrowDown') {
    event.preventDefault()
    adjustValue(-1, undefined, true)
  }
}

const handleKeyup = (event: KeyboardEvent) => {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    flushCommit()
  }
}

const adjustValue = (delta: number, stepSize?: number, deferCommit = false) => {
  const actualStep = stepSize !== undefined ? stepSize : props.step || 1
  // If modelValue is undefined, use referenceValue if available, otherwise default to 0
  const currentValue = props.modelValue ?? props.referenceValue ?? 0
  const newValue = D.add(currentValue, D.mul(delta, actualStep))

  // Clear user input/invalid state since we're setting a programmatic, valid value
  userInput.value = null
  invalidReason.value = ''

  setValidatedValue(newValue)

  if (deferCommit) {
    hasUncommittedChanges.value = true
    pendingCommitValue = validateValue(newValue)
  } else {
    emitCommit(newValue)
  }
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
  adjustValue(delta, stepSize, true)
}

defineExpose({
  focus: () => {
    inputRef.value?.focus()
  },
  select: () => {
    inputRef.value?.select()
  },
  flushCommit,
})

// Update suffix width on mount and when suffix content changes
onMounted(() => {
  updateSuffixWidth()
})

onBeforeUnmount(() => {
  flushCommit()
})

// Clear user input when model value changes externally (undo/redo, selection
// change, etc.) — but not when the change is just our own emit echoing back
// through v-model, which would otherwise clobber active typing.
watch(
  () => props.modelValue,
  (newValue, oldValue) => {
    if (newValue === oldValue) return
    if (!isOwnEmitEchoing) {
      userInput.value = null
      invalidReason.value = ''
      lastCommittedValue = newValue
    }
    nextTick(updateSuffixWidth)
  },
  { flush: 'post' },
)

// Clear user input when component becomes disabled or min/max changes
watch([() => props.disabled, () => props.min, () => props.max], () => {
  if (userInput.value !== null) {
    userInput.value = null
    invalidReason.value = ''
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

/* Invisible hover target over Bootstrap's is-invalid background-icon so its
   tooltip can be scoped to just the icon rather than the whole field — the
   icon itself is a background-image, not a real element, so it can't carry
   a title on its own. Positioned to match the icon's reserved padding gap:
   between the spinner buttons and the start of the invalid-state padding. */
.invalid-icon-tooltip {
  position: absolute;
  top: 0;
}

.custom-number-input.size-default .invalid-icon-tooltip {
  right: calc(30px + var(--suffix-width, 0px));
  width: 24px;
  height: 32px;
}

.custom-number-input.size-small .invalid-icon-tooltip {
  right: calc(22px + var(--suffix-width, 0px));
  width: 20px;
  height: 30px;
}

.custom-number-input.size-compact .invalid-icon-tooltip {
  right: calc(18px + var(--suffix-width, 0px));
  width: 20px;
  height: 24px;
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
  min-height: 0;
  transition: all 0.15s ease;
  user-select: none;
  position: relative;
}

.spinner-btn:first-child {
  border-bottom: 1px solid var(--bs-border-color);
}

.spinner-btn:hover:not(:disabled) {
  background: var(--bs-primary);
  color: var(--bs-primary-text-emphasis);
}

.spinner-btn:disabled {
  cursor: not-allowed;
}

.input-focused .spinner-buttons {
  border-top-color: var(--input-focus-border-color);
  border-right-color: var(--input-focus-border-color);
  border-bottom-color: var(--input-focus-border-color);
}

.custom-number-input input.is-invalid ~ .spinner-buttons {
  border-top-color: var(--bs-form-invalid-border-color, #dc3545);
  border-right-color: var(--bs-form-invalid-border-color, #dc3545);
  border-bottom-color: var(--bs-form-invalid-border-color, #dc3545);
}

/* Size variants */

.custom-number-input.size-default input {
  height: 32px;
  padding: 6px 10px;
  padding-right: 32px;
  font-size: 0.875rem;
  border-radius: var(--bs-border-radius);
}

/* Bootstrap's .is-invalid draws a warning icon at the input's own right edge
   — exactly where our custom spinner buttons (and, if present, the suffix
   box) are absolutely positioned on top, so it would otherwise render
   hidden underneath them. Push the icon (and the padding that makes room
   for it) further left by however much of the right edge those overlays
   occupy, so it lands in the clear space just to their left instead. Uses
   fixed px offsets sized to our own fixed-size spinner/icon dimensions
   rather than Bootstrap's em-based defaults, which assume no other
   right-side decoration and are too generous for the compact size. */
.custom-number-input.size-default input.is-invalid {
  padding-right: calc(54px + var(--suffix-width, 0px));
  background-position: right calc(34px + var(--suffix-width, 0px)) center;
}

.custom-number-input.size-default .spinner-buttons {
  width: 30px !important;
  height: 32px !important;
}

.custom-number-input.size-default .input-suffix {
  right: 30px;
  font-size: 0.875rem;
  height: 30px;
  line-height: 30px;
  padding: 0 6px;
}

.custom-number-input.size-small {
  height: 30px;
}

.custom-number-input.size-small input {
  height: 30px;
  min-height: 30px;
  padding: 4px 8px;
  padding-right: 26px;
  font-size: 0.875rem;
  border-radius: var(--bs-border-radius-sm);
}

.custom-number-input.size-small input.is-invalid {
  padding-right: calc(46px + var(--suffix-width, 0px));
  background-position: right calc(26px + var(--suffix-width, 0px)) center;
  background-size: 14px 14px;
}

.custom-number-input.size-small .spinner-buttons {
  width: 22px !important;
  height: 30px !important;
  border-top-right-radius: var(--bs-border-radius-sm);
  border-bottom-right-radius: var(--bs-border-radius-sm);
}

.custom-number-input.size-small .input-suffix {
  right: 22px;
  font-size: 0.875rem;
  height: 28px;
  line-height: 28px;
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

.custom-number-input.size-compact input.is-invalid {
  padding-right: calc(38px + var(--suffix-width, 0px));
  background-position: right calc(21px + var(--suffix-width, 0px)) center;
  background-size: 12px 12px;
}

.custom-number-input.size-compact .spinner-buttons {
  width: 18px !important;
  height: 24px !important;
  top: 0px !important;
  right: 0px !important;
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
</style>
