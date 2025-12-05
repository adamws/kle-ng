<template>
  <div :class="['label-position-picker', sizeClass]">
    <!-- Layer 1: Outer border -->
    <div class="key-outer"></div>

    <!-- Layer 2: Bevel/base color -->
    <div class="key-bevel"></div>

    <!-- Layer 3: Inner surface (lightened) -->
    <div class="key-inner"></div>

    <!-- Layer 4: Labels grid -->
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
  /* Base dimensions - will be overridden by size variants */
  --outer-width: 150px;
  --outer-height: 150px;

  /* Layer constants */
  --bevel-margin: 17px;
  --bevel-offset: 8px; /* 3px at 54px unit = 8.3px at 150px (scaled 2.78x) */
  --padding: 8px; /* 3px at 54px unit = 8.3px at 150px (text padding inside inner surface) */
  --round-outer: 14px;
  --round-inner: 8px;

  /* Theme-aware colors - default (light theme) */
  --key-border: #000000;
  --key-base: #cccccc;
  --key-surface: #fbfbfb;

  position: relative;
  margin: 0 auto;
  width: var(--outer-width);
  height: var(--outer-height);
}

/* Size variants */
.label-position-picker.size-medium {
  --outer-width: 150px;
  --outer-height: 150px;
  --bevel-margin: 17px;
  --bevel-offset: 8px; /* 3px × 2.78 scale */
  --padding: 8px; /* 3px × 2.78 scale */
  --round-outer: 14px;
  --round-inner: 8px;
}

.label-position-picker.size-small {
  --outer-width: 120px;
  --outer-height: 120px;
  --bevel-margin: 14px;
  --bevel-offset: 7px; /* 3px × 2.22 scale */
  --padding: 7px; /* 3px × 2.22 scale */
  --round-outer: 11px;
  --round-inner: 6px;
}

/* Layer 1: Outer border (black) */
.key-outer {
  position: absolute;
  inset: 0;
  background: var(--key-border);
  border-radius: var(--round-outer);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
}

/* Layer 2: Bevel (base gray) */
.key-bevel {
  position: absolute;
  inset: 2px;
  background: var(--key-base);
  border-radius: calc(var(--round-outer) - 2px);
}

/* Layer 3: Inner surface (lightened) - offset upward like real keycaps */
.key-inner {
  position: absolute;
  top: calc(var(--bevel-margin) - var(--bevel-offset)); /* Shift up by bevelOffsetTop */
  left: var(--bevel-margin);
  right: var(--bevel-margin);
  bottom: calc(var(--bevel-margin) + var(--bevel-offset)); /* More space at bottom due to offset */
  background: var(--key-surface);
  border-radius: var(--round-inner);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Layer 4: Labels container - covers full key area */
.keylabels {
  position: absolute;
  inset: 0;
  z-index: 10;
}

.keylabel {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Calculate keytop surface dimensions for label positioning */
/* Keytop starts at: bevel-margin - bevel-offset = 9px */
/* Front labels start at: 100% - bevel-margin - bevel-offset = 125px */
/* Keytop height: (100% - bevel-margin - bevel-offset) - (bevel-margin - bevel-offset) */
/*             = 100% - 2*bevel-margin = 116px */
/* Each row: (100% - 2*bevel-margin) / 3 */

/* Top row labels (0-2) - positioned on keytop */
.keylabel0 {
  top: calc(var(--bevel-margin) - var(--bevel-offset));
  left: var(--bevel-margin);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.keylabel1 {
  top: calc(var(--bevel-margin) - var(--bevel-offset));
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.keylabel2 {
  top: calc(var(--bevel-margin) - var(--bevel-offset));
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}

/* Center row labels (3-5) - positioned on keytop */
.keylabel3 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) / 3);
  left: var(--bevel-margin);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.keylabel4 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) / 3);
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.keylabel5 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) / 3);
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}

/* Bottom row labels (6-8) - positioned on keytop */
.keylabel6 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  left: var(--bevel-margin);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.keylabel7 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.keylabel8 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}

/* Front row labels (9-11) - positioned BELOW the keytop on the bevel */
.keylabel9 {
  top: calc(100% - var(--bevel-margin) - var(--bevel-offset));
  left: var(--bevel-margin);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc(var(--bevel-margin) + var(--bevel-offset));
}
.keylabel10 {
  top: calc(100% - var(--bevel-margin) - var(--bevel-offset));
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc(var(--bevel-margin) + var(--bevel-offset));
}
.keylabel11 {
  top: calc(100% - var(--bevel-margin) - var(--bevel-offset));
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc(var(--bevel-margin) + var(--bevel-offset));
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
  font-size: 12px;
  font-weight: bold;
  color: var(--bs-body-color);
  pointer-events: none;
  text-align: center;
  line-height: 1;
  position: relative;
  z-index: 2;
  padding: 4px 6px;
  border-radius: 4px;
  transition: all 0.15s ease;
}

.position-radio:checked + .position-label {
  color: white;
  background: var(--bs-primary);
  border-radius: 4px;
  padding: 4px 6px;
}

.position-radio:hover + .position-label {
  color: var(--bs-primary);
  background: var(--bs-secondary-bg);
  border-radius: 4px;
  padding: 4px 6px;
}

/* Front row labels (9-11) - smaller padding to prevent overflow */
.keylabel9 .position-radio:checked + .position-label,
.keylabel9 .position-radio:hover + .position-label,
.keylabel10 .position-radio:checked + .position-label,
.keylabel10 .position-radio:hover + .position-label,
.keylabel11 .position-radio:checked + .position-label,
.keylabel11 .position-radio:hover + .position-label {
  padding: 2px 6px;
}

.position-radio:disabled + .position-label {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Dark theme overrides */
[data-bs-theme='dark'] .label-position-picker {
  --key-border: #000000;
  --key-base: #343a40;
  --key-surface: #495057;
}
</style>
