<!--
  GridLayer: grid dots and origin axes in the switch-local frame (the parent
  group applies the switch rotation), as in KiCad. When the grid is too dense
  to see at the current zoom, a coarser multiple of it is drawn.
-->
<script setup lang="ts">
import { computed, useId } from 'vue'

const props = defineProps<{
  /** Grid pitch in mm. */
  grid: number
  /** Screen pixels per mm at the current zoom. */
  pxPerMm: number
  /** Half size of the area to cover, in mm around the switch origin. */
  extent: number
}>()

/** Smallest dot spacing on screen, in px. */
const MIN_SPACING_PX = 8

const id = `pcb-grid-${useId()}`

/** Drawn pitch: the grid, doubled until it is visible, so every dot is a grid point. */
const pitch = computed(() => {
  let pitch = props.grid
  for (let i = 0; pitch * props.pxPerMm < MIN_SPACING_PX && i < 30; i++) pitch *= 2
  return pitch
})

// about 1.5 px dots and 1 px axes at any zoom
const dotRadius = computed(() => 0.75 / props.pxPerMm)
const axisWidth = computed(() => 1 / props.pxPerMm)
</script>

<template>
  <g class="grid-layer" data-testid="pcb-grid-layer" :data-grid-pitch="pitch">
    <defs>
      <pattern
        :id="id"
        patternUnits="userSpaceOnUse"
        :x="-pitch / 2"
        :y="-pitch / 2"
        :width="pitch"
        :height="pitch"
      >
        <circle :cx="pitch / 2" :cy="pitch / 2" :r="dotRadius" class="grid-dot" />
      </pattern>
    </defs>
    <rect
      :x="-extent"
      :y="-extent"
      :width="2 * extent"
      :height="2 * extent"
      :fill="`url(#${id})`"
    />
    <line :x1="-extent" y1="0" :x2="extent" y2="0" class="grid-axis" :stroke-width="axisWidth" />
    <line x1="0" :y1="-extent" x2="0" :y2="extent" class="grid-axis" :stroke-width="axisWidth" />
  </g>
</template>

<style scoped>
.grid-layer {
  pointer-events: none;
}

.grid-dot {
  fill: var(--bs-secondary-color);
  fill-opacity: 0.6;
}

.grid-axis {
  stroke: var(--bs-secondary-color);
  stroke-opacity: 0.35;
  stroke-dasharray: none;
}
</style>
