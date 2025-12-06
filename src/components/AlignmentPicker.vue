<template>
  <div :class="['alignment-picker', sizeClass]" data-testid="alignment-picker">
    <!-- Layer 1: Outer border -->
    <div class="key-outer" data-testid="alignment-key-outer"></div>

    <!-- Layer 2: Bevel/base color -->
    <div class="key-bevel" data-testid="alignment-key-bevel"></div>

    <!-- Layer 3: Inner surface (lightened) -->
    <div class="key-inner" data-testid="alignment-key-inner"></div>

    <!-- Layer 4: Alignment buttons grid -->
    <div class="alignment-buttons" data-testid="alignment-buttons">
      <button
        v-for="(button, index) in alignmentButtons"
        :key="index"
        type="button"
        :class="['align-btn', `align-btn${index}`]"
        :data-testid="`align-btn-${index}`"
        @click="handleAlign(button.flags)"
        :title="button.tooltip"
        v-html="button.label"
      ></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface AlignmentButton {
  label: string
  flags: number
  tooltip: string
}

interface Props {
  size?: 'small' | 'medium'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
})

const emit = defineEmits<{
  align: [flags: number]
}>()

// Alignment flags (matching LegendToolsPanel)
const align = {
  hmask: 0x0f,
  hcenter: 0x00,
  left: 0x01,
  right: 0x02,
  vmask: 0xf0,
  vcenter: 0x00,
  top: 0x10,
  bottom: 0x20,
  center: 0x00,
}

const alignmentButtons: AlignmentButton[] = [
  { label: '↖', flags: align.left | align.top, tooltip: 'Align to top-left' },
  { label: '↑', flags: align.hcenter | align.top, tooltip: 'Align to top-center' },
  { label: '↗', flags: align.right | align.top, tooltip: 'Align to top-right' },
  { label: '←', flags: align.left | align.vcenter, tooltip: 'Align to center-left' },
  { label: '•', flags: align.center, tooltip: 'Align to center' },
  { label: '→', flags: align.right | align.vcenter, tooltip: 'Align to center-right' },
  { label: '↙', flags: align.left | align.bottom, tooltip: 'Align to bottom-left' },
  { label: '↓', flags: align.hcenter | align.bottom, tooltip: 'Align to bottom-center' },
  { label: '↘', flags: align.right | align.bottom, tooltip: 'Align to bottom-right' },
]

const sizeClass = computed(() => `size-${props.size}`)

const handleAlign = (flags: number) => {
  emit('align', flags)
}
</script>

<style scoped>
.alignment-picker {
  /* Base dimensions - will be overridden by size variants */
  --outer-width: 150px;
  --outer-height: 150px;

  /* Layer constants */
  --bevel-margin: 17px;
  --bevel-offset: 8px; /* 3px at 54px unit = 8.3px at 150px (scaled 2.78x) */
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
.alignment-picker.size-medium {
  --outer-width: 150px;
  --outer-height: 150px;
  --bevel-margin: 17px;
  --bevel-offset: 8px; /* 3px × 2.78 scale */
  --round-outer: 14px;
  --round-inner: 8px;
}

.alignment-picker.size-small {
  --outer-width: 120px;
  --outer-height: 120px;
  --bevel-margin: 14px;
  --bevel-offset: 7px; /* 3px × 2.22 scale */
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

/* Layer 4: Alignment buttons grid - only on keytop surface (9 buttons, no front row) */
.alignment-buttons {
  position: absolute;
  inset: 0;
  z-index: 10;
}

.align-btn {
  position: absolute;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  font-size: 16px;
  font-weight: bold;
  color: var(--bs-body-color);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
  border-radius: 4px;
}

/* Calculate keytop surface dimensions for button positioning */
/* Keytop height = 100% - 2*bevel-margin */
/* Each row: (100% - 2*bevel-margin) / 3 */

/* Top row buttons (0-2) */
.align-btn0 {
  top: calc(var(--bevel-margin) - var(--bevel-offset));
  left: var(--bevel-margin);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.align-btn1 {
  top: calc(var(--bevel-margin) - var(--bevel-offset));
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.align-btn2 {
  top: calc(var(--bevel-margin) - var(--bevel-offset));
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}

/* Center row buttons (3-5) */
.align-btn3 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) / 3);
  left: var(--bevel-margin);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.align-btn4 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) / 3);
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.align-btn5 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) / 3);
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}

/* Bottom row buttons (6-8) */
.align-btn6 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  left: var(--bevel-margin);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.align-btn7 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}
.align-btn8 {
  top: calc(var(--bevel-margin) - var(--bevel-offset) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  left: calc(var(--bevel-margin) + (100% - var(--bevel-margin) * 2) * 2 / 3);
  width: calc((100% - var(--bevel-margin) * 2) / 3);
  height: calc((100% - var(--bevel-margin) * 2) / 3);
}

.align-btn:hover {
  background: var(--bs-secondary-bg);
}

.align-btn:active {
  background: var(--bs-primary);
  color: white;
}

/* Dark theme overrides */
[data-bs-theme='dark'] .alignment-picker {
  --key-border: #000000;
  --key-base: #343a40;
  --key-surface: #495057;
}
</style>
