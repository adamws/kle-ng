<template>
  <div :class="['legend-position-remover', sizeClass]" data-testid="legend-position-remover">
    <!-- Layer 1: Outer border -->
    <div class="key-outer"></div>

    <!-- Layer 2: Bevel/base color -->
    <div class="key-bevel"></div>

    <!-- Layer 3: Inner surface (lightened) -->
    <div class="key-inner"></div>

    <!-- Layer 4: One remove button per legend position, front row included -->
    <div class="remove-buttons">
      <HintTooltip
        v-for="position in labelPositions"
        :key="position.index"
        :class="['remove-cell', `remove-cell${position.index}`]"
        :text="isAvailable(position.index) ? '' : `No ${position.description} legends to remove`"
        :focusable="!isAvailable(position.index)"
      >
        <button
          type="button"
          class="remove-btn"
          :data-testid="`remove-position-${position.index}`"
          :aria-label="`Remove ${position.description} legends`"
          :disabled="!isAvailable(position.index)"
          @click="emit('remove', position.index)"
        >
          <BiTrash />
        </button>
      </HintTooltip>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HintTooltip from './HintTooltip.vue'
import BiTrash from 'bootstrap-icons/icons/trash.svg'

interface Props {
  /** One flag per legend position: whether any affected key has a legend there. */
  available: readonly boolean[]
  size?: 'small' | 'medium'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'medium',
})

const emit = defineEmits<{
  remove: [position: number]
}>()

const labelPositions = [
  { index: 0, description: 'top left' },
  { index: 1, description: 'top center' },
  { index: 2, description: 'top right' },
  { index: 3, description: 'center left' },
  { index: 4, description: 'center' },
  { index: 5, description: 'center right' },
  { index: 6, description: 'bottom left' },
  { index: 7, description: 'bottom center' },
  { index: 8, description: 'bottom right' },
  { index: 9, description: 'front left' },
  { index: 10, description: 'front center' },
  { index: 11, description: 'front right' },
]

const sizeClass = computed(() => `size-${props.size}`)

const isAvailable = (position: number) => props.available[position] === true
</script>

<style scoped>
.legend-position-remover {
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
.legend-position-remover.size-medium {
  --outer-width: 150px;
  --outer-height: 150px;
  --bevel-margin: 17px;
  --bevel-offset: 8px; /* 3px × 2.78 scale */
  --round-outer: 14px;
  --round-inner: 8px;
}

.legend-position-remover.size-small {
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
  top: calc(var(--bevel-margin) - var(--bevel-offset));
  left: var(--bevel-margin);
  right: var(--bevel-margin);
  bottom: calc(var(--bevel-margin) + var(--bevel-offset));
  background: var(--key-surface);
  border-radius: var(--round-inner);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Layer 4: Remove buttons - same grid as LabelPositionPicker */
.remove-buttons {
  position: absolute;
  inset: 0;
  z-index: 10;
}

.remove-cell {
  position: absolute;
  width: calc((var(--outer-width) - var(--bevel-margin) * 2) / 3);
  height: calc((var(--outer-height) - var(--bevel-margin) * 2) / 3);
  align-items: center;
  justify-content: center;
}

/* Columns */
.remove-cell0,
.remove-cell3,
.remove-cell6,
.remove-cell9 {
  left: var(--bevel-margin);
}
.remove-cell1,
.remove-cell4,
.remove-cell7,
.remove-cell10 {
  left: calc(var(--bevel-margin) + (var(--outer-width) - var(--bevel-margin) * 2) / 3);
}
.remove-cell2,
.remove-cell5,
.remove-cell8,
.remove-cell11 {
  left: calc(var(--bevel-margin) + (var(--outer-width) - var(--bevel-margin) * 2) * 2 / 3);
}

/* Rows on the keytop (0-8) */
.remove-cell0,
.remove-cell1,
.remove-cell2 {
  top: calc(var(--bevel-margin) - var(--bevel-offset));
}
.remove-cell3,
.remove-cell4,
.remove-cell5 {
  top: calc(
    var(--bevel-margin) - var(--bevel-offset) + (var(--outer-height) - var(--bevel-margin) * 2) / 3
  );
}
.remove-cell6,
.remove-cell7,
.remove-cell8 {
  top: calc(
    var(--bevel-margin) - var(--bevel-offset) + (var(--outer-height) - var(--bevel-margin) * 2) *
      2 / 3
  );
}

/* Front row (9-11) - below the keytop, on the bevel */
.remove-cell9,
.remove-cell10,
.remove-cell11 {
  top: calc(var(--outer-height) - var(--bevel-margin) - var(--bevel-offset));
  height: calc(var(--bevel-margin) + var(--bevel-offset));
}

.remove-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  /* Inset so the hover fill stays clear of the keytop's rounded corners */
  width: calc(100% - 4px);
  height: calc(100% - 4px);
  border: none;
  background: transparent;
  font-size: 13px;
  color: var(--bs-danger);
  cursor: pointer;
  transition: all 0.15s ease;
  padding: 0;
  border-radius: 4px;
}

.remove-btn:hover:not(:disabled) {
  background: var(--bs-secondary-bg);
}

.remove-btn:active:not(:disabled) {
  background: var(--bs-danger);
  color: white;
}

.remove-btn:disabled {
  color: var(--bs-secondary-color);
  opacity: 0.35;
  /* Let hover reach the HintTooltip wrapper, as Bootstrap's .btn:disabled does */
  pointer-events: none;
}

/* Dark theme overrides */
[data-bs-theme='dark'] .legend-position-remover {
  --key-border: #000000;
  --key-base: #343a40;
  --key-surface: #495057;
}
</style>
