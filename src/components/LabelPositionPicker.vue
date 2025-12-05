<template>
  <div :class="['label-position-picker', sizeClass]">
    <div class="keyborder"></div>
    <div class="keylabels">
      <!-- Top Row: positions 0-2 -->
      <div v-for="pos in [0, 1, 2]" :key="pos" :class="['keylabel', `keylabel${pos}`]">
        <input
          type="radio"
          :id="`${idPrefix}-${pos}`"
          :value="pos"
          :checked="modelValue === pos"
          @change="handleChange(pos)"
          :disabled="disabled"
          class="position-radio"
        />
        <label :for="`${idPrefix}-${pos}`" class="position-label">
          {{ labelPositions[pos]?.label }}
        </label>
      </div>

      <!-- Center Row: positions 3-5 -->
      <div v-for="pos in [3, 4, 5]" :key="pos" :class="['keylabel', `keylabel${pos}`]">
        <input
          type="radio"
          :id="`${idPrefix}-${pos}`"
          :value="pos"
          :checked="modelValue === pos"
          @change="handleChange(pos)"
          :disabled="disabled"
          class="position-radio"
        />
        <label :for="`${idPrefix}-${pos}`" class="position-label">
          {{ labelPositions[pos]?.label }}
        </label>
      </div>

      <!-- Bottom Row: positions 6-8 -->
      <div v-for="pos in [6, 7, 8]" :key="pos" :class="['keylabel', `keylabel${pos}`]">
        <input
          type="radio"
          :id="`${idPrefix}-${pos}`"
          :value="pos"
          :checked="modelValue === pos"
          @change="handleChange(pos)"
          :disabled="disabled"
          class="position-radio"
        />
        <label :for="`${idPrefix}-${pos}`" class="position-label">
          {{ labelPositions[pos]?.label }}
        </label>
      </div>

      <!-- Front Row: positions 9-11 -->
      <div v-for="pos in [9, 10, 11]" :key="pos" :class="['keylabel', `keylabel${pos}`]">
        <input
          type="radio"
          :id="`${idPrefix}-${pos}`"
          :value="pos"
          :checked="modelValue === pos"
          @change="handleChange(pos)"
          :disabled="disabled"
          class="position-radio"
        />
        <label :for="`${idPrefix}-${pos}`" class="position-label">
          {{ labelPositions[pos]?.label }}
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface LabelPosition {
  index: number
  label: string
  description: string
}

interface Props {
  modelValue: number | null
  idPrefix: string
  size?: 'small' | 'medium'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
  disabled: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: number | null]
}>()

const labelPositions: LabelPosition[] = [
  { index: 0, label: 'TL', description: 'Top Left' },
  { index: 1, label: 'TC', description: 'Top Center' },
  { index: 2, label: 'TR', description: 'Top Right' },
  { index: 3, label: 'CL', description: 'Center Left' },
  { index: 4, label: 'CC', description: 'Center Center' },
  { index: 5, label: 'CR', description: 'Center Right' },
  { index: 6, label: 'BL', description: 'Bottom Left' },
  { index: 7, label: 'BC', description: 'Bottom Center' },
  { index: 8, label: 'BR', description: 'Bottom Right' },
  { index: 9, label: 'FL', description: 'Front Left' },
  { index: 10, label: 'FC', description: 'Front Center' },
  { index: 11, label: 'FR', description: 'Front Right' },
]

const sizeClass = computed(() => `size-${props.size}`)

const handleChange = (position: number) => {
  if (!props.disabled) {
    emit('update:modelValue', position)
  }
}
</script>

<style scoped>
.label-position-picker {
  position: relative;
  margin: 0 auto;
  border-radius: 6px;
  background: var(--bs-secondary-bg);
  border: 2px solid var(--bs-border-color);
  box-shadow: 0 1px 3px var(--bs-box-shadow-sm);
}

/* Size variants */
.label-position-picker.size-medium {
  width: 140px;
  height: 105px;
}

.label-position-picker.size-small {
  width: 120px;
  height: 90px;
}

.keyborder {
  position: absolute;
  inset: 3px;
  border-radius: 4px;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color-translucent);
}

.keylabels {
  position: absolute;
  inset: 6px;
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  grid-template-rows: 1fr 1fr 1fr 0.5fr;
  gap: 1px;
}

.keylabel {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Explicit grid positioning for each label */
/* Top row */
.keylabel0 {
  grid-row: 1;
  grid-column: 1;
}
.keylabel1 {
  grid-row: 1;
  grid-column: 2;
}
.keylabel2 {
  grid-row: 1;
  grid-column: 3;
}

/* Center row */
.keylabel3 {
  grid-row: 2;
  grid-column: 1;
}
.keylabel4 {
  grid-row: 2;
  grid-column: 2;
}
.keylabel5 {
  grid-row: 2;
  grid-column: 3;
}

/* Bottom row */
.keylabel6 {
  grid-row: 3;
  grid-column: 1;
}
.keylabel7 {
  grid-row: 3;
  grid-column: 2;
}
.keylabel8 {
  grid-row: 3;
  grid-column: 3;
}

/* Front row */
.keylabel9 {
  grid-row: 4;
  grid-column: 1;
}
.keylabel10 {
  grid-row: 4;
  grid-column: 2;
}
.keylabel11 {
  grid-row: 4;
  grid-column: 3;
}

.position-radio {
  position: absolute;
  top: 0;
  left: 0;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  z-index: 1;
}

.position-label {
  font-size: 10px;
  font-weight: bold;
  color: var(--bs-text-primary);
  pointer-events: none;
  text-align: center;
  line-height: 1;
  position: relative;
  z-index: 2;
  padding: 2px 3px;
  border-radius: 3px;
  transition: all 0.15s ease;
}

.position-radio:checked + .position-label {
  color: white;
  background: var(--bs-primary);
  border-radius: 3px;
  padding: 2px 3px;
  box-shadow: 0 1px 3px rgba(13, 110, 253, 0.4);
  transform: scale(1.05);
}

.position-radio:hover + .position-label {
  color: var(--bs-primary);
  background: rgba(13, 110, 253, 0.15);
  border-radius: 3px;
  box-shadow: 0 1px 2px rgba(13, 110, 253, 0.2);
  transform: scale(1.02);
}

.position-radio:disabled + .position-label {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
