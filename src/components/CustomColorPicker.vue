<script setup lang="ts">
import { ref, computed, watch, onUnmounted, onMounted } from 'vue'
import CustomNumberInput from './CustomNumberInput.vue'
import {
  hexToRgb,
  rgbToHex,
  hsvToHex,
  hexToHsv,
  isValidHex,
  normalizeHex,
  hexToAlpha,
  hexWithAlpha,
} from '../utils/color-utils'
import { recentlyUsedColorsManager } from '../utils/recently-used-colors'

interface Props {
  modelValue: string
  showAlpha?: boolean
}

interface Emits {
  (e: 'update:modelValue', value: string): void
}

const props = withDefaults(defineProps<Props>(), {
  showAlpha: false,
})
const emit = defineEmits<Emits>()

// HSV state
const hue = ref(0)
const saturation = ref(0)
const value = ref(100)

// Input field state
const hexInput = ref('')
const rInput = ref(0)
const gInput = ref(0)
const bInput = ref(0)

// Alpha state
const alpha = ref(100)

// UI refs
const saturationCanvas = ref<HTMLCanvasElement>()
const hueSlider = ref<HTMLElement>()
const alphaSlider = ref<HTMLElement>()
const isDraggingSaturation = ref(false)
const isDraggingHue = ref(false)
const isDraggingAlpha = ref(false)

// Preset colors
const presetColors = [
  '#D0021B',
  '#F5A623',
  '#F8E71C',
  '#8B572A',
  '#7ED321',
  '#417505',
  '#BD10E0',
  '#9013FE',
  '#4A90E2',
  '#50E3C2',
  '#B8E986',
  '#000000',
  '#FF6B6B',
  '#4ECDC4',
  '#45B7D1',
  '#96CEB4',
  '#FFEAA7',
  '#DDA0DD',
  '#98D8C8',
  '#F7DC6F',
  '#BB8FCE',
  '#4A4A4A',
  '#9B9B9B',
  '#FFFFFF',
]

// Recently used colors state
const recentlyUsedColors = ref<string[]>([])

// Computed values
const saturationPercent = computed(() => saturation.value)
const valuePercent = computed(() => 100 - value.value)

const saturationPointerStyle = computed(() => ({
  top: `${valuePercent.value}%`,
  left: `${saturationPercent.value}%`,
}))

const saturationBackgroundStyle = computed(() => ({
  backgroundColor: hsvToHex(hue.value, 100, 100),
}))

const huePointerStyle = computed(() => ({
  left: `${(hue.value / 360) * 100}%`,
}))

const currentColor = computed(() => {
  const hex6 = hsvToHex(hue.value, saturation.value, value.value)
  return props.showAlpha ? hexWithAlpha(hex6, alpha.value) : hex6
})

const opaqueColor = computed(() => hsvToHex(hue.value, saturation.value, value.value))

const alphaSliderStyle = computed(() => ({
  background: `linear-gradient(to right, transparent, ${opaqueColor.value})`,
}))

const alphaPointerStyle = computed(() => ({
  left: `${alpha.value}%`,
}))

// Initialize from prop value
const initializeFromHex = (hex: string) => {
  const hsv = hexToHsv(hex)
  hue.value = hsv.h
  saturation.value = hsv.s
  value.value = hsv.v

  const rgb = hexToRgb(hex)
  rInput.value = rgb.r
  gInput.value = rgb.g
  bInput.value = rgb.b

  if (props.showAlpha) {
    alpha.value = hexToAlpha(hex)
    // Show 8-digit hex (without #) for alpha mode
    const hex6 = rgbToHex(rgb.r, rgb.g, rgb.b)
    hexInput.value = hexWithAlpha(hex6, alpha.value).replace('#', '')
  } else {
    hexInput.value = hex.replace('#', '').substring(0, 6)
  }
}

// Watch for external changes
watch(
  () => props.modelValue,
  (newValue) => {
    if (newValue.toLowerCase() !== currentColor.value.toLowerCase()) {
      initializeFromHex(newValue)
    }
  },
  { immediate: true },
)

// Emit color changes
const emitColorChange = () => {
  const color = currentColor.value
  emit('update:modelValue', color)
}

// Load recently used colors from storage
const loadRecentlyUsedColors = () => {
  recentlyUsedColors.value = recentlyUsedColorsManager.getRecentlyUsedColors()
}

// Initialize recently used colors on mount
onMounted(() => {
  loadRecentlyUsedColors()
})

// Expose method to refresh recently used colors
defineExpose({
  refreshRecentlyUsedColors: loadRecentlyUsedColors,
})

// Saturation picker handlers
const updateSaturation = (event: MouseEvent) => {
  if (!saturationCanvas.value) return

  const rect = saturationCanvas.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
  const y = Math.max(0, Math.min(event.clientY - rect.top, rect.height))

  saturation.value = (x / rect.width) * 100
  value.value = 100 - (y / rect.height) * 100

  updateInputsFromHsv()
  emitColorChange()
}

const handleSaturationMouseDown = (event: MouseEvent) => {
  isDraggingSaturation.value = true
  updateSaturation(event)
  document.addEventListener('mousemove', handleSaturationMouseMove)
  document.addEventListener('mouseup', handleSaturationMouseUp)
}

const handleSaturationMouseMove = (event: MouseEvent) => {
  if (isDraggingSaturation.value) {
    updateSaturation(event)
  }
}

const handleSaturationMouseUp = () => {
  isDraggingSaturation.value = false
  document.removeEventListener('mousemove', handleSaturationMouseMove)
  document.removeEventListener('mouseup', handleSaturationMouseUp)
}

// Hue slider handlers
const updateHue = (event: MouseEvent) => {
  if (!hueSlider.value) return

  const rect = hueSlider.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
  hue.value = (x / rect.width) * 360

  updateInputsFromHsv()
  emitColorChange()
}

const handleHueMouseDown = (event: MouseEvent) => {
  isDraggingHue.value = true
  updateHue(event)
  document.addEventListener('mousemove', handleHueMouseMove)
  document.addEventListener('mouseup', handleHueMouseUp)
}

const handleHueMouseMove = (event: MouseEvent) => {
  if (isDraggingHue.value) {
    updateHue(event)
  }
}

const handleHueMouseUp = () => {
  isDraggingHue.value = false
  document.removeEventListener('mousemove', handleHueMouseMove)
  document.removeEventListener('mouseup', handleHueMouseUp)
}

// Alpha slider handlers
const updateAlpha = (event: MouseEvent) => {
  if (!alphaSlider.value) return

  const rect = alphaSlider.value.getBoundingClientRect()
  const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width))
  alpha.value = Math.round((x / rect.width) * 100)

  updateInputsFromHsv()
  emitColorChange()
}

const handleAlphaMouseDown = (event: MouseEvent) => {
  isDraggingAlpha.value = true
  updateAlpha(event)
  document.addEventListener('mousemove', handleAlphaMouseMove)
  document.addEventListener('mouseup', handleAlphaMouseUp)
}

const handleAlphaMouseMove = (event: MouseEvent) => {
  if (isDraggingAlpha.value) {
    updateAlpha(event)
  }
}

const handleAlphaMouseUp = () => {
  isDraggingAlpha.value = false
  document.removeEventListener('mousemove', handleAlphaMouseMove)
  document.removeEventListener('mouseup', handleAlphaMouseUp)
}

// Alpha input handler
const handleAlphaInput = (value: number | undefined) => {
  alpha.value = Math.max(0, Math.min(100, value ?? 100))
  updateInputsFromHsv()
  emitColorChange()
}

// Input field handlers
const updateInputsFromHsv = () => {
  const hex = hsvToHex(hue.value, saturation.value, value.value)
  const rgb = hexToRgb(hex)

  if (props.showAlpha) {
    hexInput.value = hexWithAlpha(hex, alpha.value).replace('#', '')
  } else {
    hexInput.value = hex.replace('#', '')
  }
  rInput.value = rgb.r
  gInput.value = rgb.g
  bInput.value = rgb.b
}

const handleHexInput = (event: Event) => {
  const target = event.target as HTMLInputElement
  let value = target.value

  if (value.startsWith('#')) {
    value = value.substring(1)
  }

  const maxLen = props.showAlpha ? 8 : 6
  value = value.replace(/[^0-9a-fA-F]/g, '').substring(0, maxLen)
  target.value = value
  hexInput.value = value

  const validLen = props.showAlpha ? value.length === 6 || value.length === 8 : value.length === 6
  if (validLen && isValidHex(`#${value}`)) {
    const hex = normalizeHex(value)
    if (props.showAlpha && value.length === 8) {
      alpha.value = hexToAlpha(hex)
    }
    initializeFromHex(hex)
    emitColorChange()
  }
}

const handleRgbInputNumber = (component: 'r' | 'g' | 'b', value: number | undefined) => {
  const numValue = value ?? 0

  if (component === 'r') rInput.value = numValue
  else if (component === 'g') gInput.value = numValue
  else if (component === 'b') bInput.value = numValue

  const hex = rgbToHex(rInput.value, gInput.value, bInput.value)
  initializeFromHex(hex)
  emitColorChange()
}

// Preset color handler
const handlePresetSelect = (color: string) => {
  initializeFromHex(color)
  emitColorChange()
}

// Cleanup
onUnmounted(() => {
  document.removeEventListener('mousemove', handleSaturationMouseMove)
  document.removeEventListener('mouseup', handleSaturationMouseUp)
  document.removeEventListener('mousemove', handleHueMouseMove)
  document.removeEventListener('mouseup', handleHueMouseUp)
  document.removeEventListener('mousemove', handleAlphaMouseMove)
  document.removeEventListener('mouseup', handleAlphaMouseUp)
})
</script>

<template>
  <div class="custom-color-picker">
    <!-- Saturation picker -->
    <div class="saturation-picker">
      <canvas
        ref="saturationCanvas"
        class="saturation-canvas"
        :style="saturationBackgroundStyle"
        @mousedown="handleSaturationMouseDown"
        width="250"
        height="150"
      >
      </canvas>
      <div class="saturation-white"></div>
      <div class="saturation-black"></div>
      <div class="saturation-pointer" :style="saturationPointerStyle">
        <div class="saturation-circle"></div>
      </div>
    </div>

    <!-- Controls -->
    <div class="sketch-controls">
      <div class="sketch-sliders">
        <!-- Hue slider -->
        <div class="hue-slider-wrap">
          <div ref="hueSlider" class="hue-slider" @mousedown="handleHueMouseDown">
            <div class="hue-pointer" :style="huePointerStyle">
              <div class="hue-picker"></div>
            </div>
          </div>
        </div>

        <!-- Alpha slider -->
        <div v-if="showAlpha" class="alpha-slider-wrap">
          <div ref="alphaSlider" class="alpha-slider" @mousedown="handleAlphaMouseDown">
            <div class="alpha-slider-bg" :style="alphaSliderStyle"></div>
            <div class="alpha-pointer" :style="alphaPointerStyle">
              <div class="alpha-picker"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Color preview -->
      <div class="sketch-color-wrap" :class="{ 'has-alpha': showAlpha }">
        <div class="sketch-active-color" :style="{ background: currentColor }"></div>
      </div>
    </div>

    <!-- Input fields -->
    <div class="color-inputs">
      <div class="input-wrapper" :class="{ 'hex-alpha': showAlpha }">
        <label class="control-label">hex</label>
        <input
          :value="hexInput"
          @input="handleHexInput"
          class="color-input"
          :maxlength="showAlpha ? 8 : 6"
          :placeholder="showAlpha ? '000000ff' : '000000'"
        />
      </div>

      <div class="input-wrapper">
        <label class="control-label">r</label>
        <CustomNumberInput
          :model-value="rInput"
          @update:model-value="(value) => handleRgbInputNumber('r', value)"
          :min="0"
          :max="255"
          :step="1"
          size="compact"
        />
      </div>

      <div class="input-wrapper">
        <label class="control-label">g</label>
        <CustomNumberInput
          :model-value="gInput"
          @update:model-value="(value) => handleRgbInputNumber('g', value)"
          :min="0"
          :max="255"
          :step="1"
          size="compact"
        />
      </div>

      <div class="input-wrapper">
        <label class="control-label">b</label>
        <CustomNumberInput
          :model-value="bInput"
          @update:model-value="(value) => handleRgbInputNumber('b', value)"
          :min="0"
          :max="255"
          :step="1"
          size="compact"
        />
      </div>

      <div v-if="showAlpha" class="input-wrapper">
        <label class="control-label">a</label>
        <CustomNumberInput
          :model-value="alpha"
          @update:model-value="handleAlphaInput"
          :min="0"
          :max="100"
          :step="1"
          size="compact"
        />
      </div>
    </div>

    <!-- Preset colors -->
    <div class="color-presets">
      <div
        v-for="color in presetColors"
        :key="color"
        class="preset-color"
        :style="{ backgroundColor: color }"
        @click="handlePresetSelect(color)"
        :title="`Color: ${color}`"
      ></div>
    </div>

    <!-- Recently used colors -->
    <div v-if="recentlyUsedColors.length > 0" class="recently-used-colors">
      <div class="recently-used-header">Recently used colors</div>
      <div class="recently-used-grid">
        <div
          v-for="color in recentlyUsedColors"
          :key="color"
          class="recently-used-color"
          :style="{ backgroundColor: color }"
          @click="handlePresetSelect(color)"
          :title="`Color: ${color}`"
        ></div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.custom-color-picker {
  font-family: 'Menlo', 'Monaco', monospace;
}

/* Saturation Picker */
.saturation-picker {
  position: relative;
  width: 250px;
  height: 150px;
  cursor: crosshair;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 10px;
}

.saturation-canvas {
  width: 100%;
  height: 100%;
  display: block;
}

.saturation-white {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to right, #fff, transparent);
  pointer-events: none;
}

.saturation-black {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(to top, #000, transparent);
  pointer-events: none;
}

.saturation-pointer {
  position: absolute;
  width: 14px;
  height: 14px;
  transform: translate(-7px, -7px);
  pointer-events: none;
}

.saturation-circle {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.3),
    inset 0 0 1px rgba(0, 0, 0, 0.3);
}

/* Controls */
.sketch-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.sketch-sliders {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Hue Slider */
.hue-slider-wrap {
  height: 10px;
}

.hue-slider {
  position: relative;
  height: 10px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    #f00 0%,
    #ff0 16.66%,
    #0f0 33.33%,
    #0ff 50%,
    #00f 66.66%,
    #f0f 83.33%,
    #f00 100%
  );
  cursor: pointer;
}

.hue-pointer {
  position: absolute;
  top: 0;
  width: 4px;
  height: 10px;
  transform: translateX(-2px);
}

.hue-picker {
  width: 4px;
  height: 10px;
  border-radius: 1px;
  background: #fff;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
  transform: translateX(0);
}

/* Alpha Slider */
.alpha-slider-wrap {
  height: 10px;
}

.alpha-slider {
  position: relative;
  height: 10px;
  border-radius: 2px;
  cursor: pointer;
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

.alpha-slider-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  border-radius: 2px;
}

.alpha-pointer {
  position: absolute;
  top: 0;
  width: 4px;
  height: 10px;
  transform: translateX(-2px);
}

.alpha-picker {
  width: 4px;
  height: 10px;
  border-radius: 1px;
  background: #fff;
  box-shadow: 0 0 2px rgba(0, 0, 0, 0.6);
}

/* Checkerboard pattern for transparency preview */
.checkerboard {
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

/* Color Preview */
.sketch-color-wrap {
  width: 32px;
  height: 32px;
  border: 1px solid var(--bs-border-color);
  border-radius: 2px;
  position: relative;
}

.sketch-color-wrap.has-alpha {
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

.sketch-active-color {
  width: 100%;
  height: 100%;
  border-radius: 2px;
}

/* Input Fields */
.color-inputs {
  display: flex;
  gap: 6px;
  margin: 10px 0;
  width: 100%;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.input-wrapper.hex-alpha {
  flex: 1.5;
}

.control-label {
  font-size: 11px;
  color: var(--bs-secondary-color);
  margin-bottom: 2px;
  text-transform: lowercase;
  text-align: center;
}

.color-input {
  width: 100%;
  height: 24px;
  padding: 4px;
  border: 1px solid var(--bs-border-color);
  border-radius: 2px;
  text-align: center;
  font-size: 11px;
  font-family: 'Menlo', 'Monaco', monospace;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  box-sizing: border-box;
}

.color-input:focus {
  outline: none;
  border-color: var(--input-focus-border-color);
  box-shadow: 0 0 0 2px var(--input-focus-border-color);
}

/* Preset Colors */
.color-presets {
  display: grid;
  grid-template-columns: repeat(12, 16px);
  grid-template-rows: repeat(2, 16px);
  column-gap: calc((100% - 12 * 16px) / 11);
  row-gap: 5.27px;
  margin: 10px 0 5px 0;
  width: 100%;
  justify-content: start;
}

.preset-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  cursor: pointer;
  border: 1px solid var(--bs-border-color);
  position: relative;
  overflow: hidden;
}

.preset-color:hover {
  transform: scale(1.1);
  border-color: var(--bs-primary);
}

/* Recently Used Colors */
.recently-used-colors {
  margin: 10px 0 5px 0;
  width: 100%;
}

.recently-used-header {
  font-size: 11px;
  color: var(--bs-secondary-color);
  margin-bottom: 6px;
  text-transform: lowercase;
}

.recently-used-grid {
  display: grid;
  grid-template-columns: repeat(12, 16px);
  column-gap: calc((100% - 12 * 16px) / 11);
  row-gap: calc((100% - 12 * 16px) / 11);
  width: 100%;
  justify-content: start;
}

.recently-used-color {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  cursor: pointer;
  border: 1px solid var(--bs-border-color);
  position: relative;
  overflow: hidden;
}

.recently-used-color:hover {
  transform: scale(1.1);
  border-color: var(--bs-primary);
}
</style>
