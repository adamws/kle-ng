<!--
  DrcLayer: DRC markers and the ratsnest of a track preset, in the switch-local
  frame (the parent group applies the switch rotation). Markers keep a fixed
  size on screen and name the problem in a tooltip.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Violation } from '@/utils/pcb-tracks/drc'
import type { RatsnestLine } from '@/utils/pcb-tracks/connectivity'

const props = defineProps<{
  violations: readonly Violation[]
  ratsnest: readonly RatsnestLine[]
  /** Screen pixels per mm at the current zoom. */
  pxPerMm: number
}>()

const px = (n: number) => n / props.pxPerMm
const markerR = computed(() => px(7))
const cross = computed(() => px(3.5))
</script>

<template>
  <g class="drc-layer" data-testid="pcb-drc-layer">
    <line
      v-for="(line, i) in ratsnest"
      :key="`rat-${i}`"
      :x1="line.from.x"
      :y1="line.from.y"
      :x2="line.to.x"
      :y2="line.to.y"
      class="ratsnest"
      :stroke-width="px(1.25)"
      :stroke-dasharray="`${px(4)} ${px(3)}`"
      :data-net="line.net"
      data-testid="pcb-ratsnest"
    />
    <g
      v-for="(v, i) in violations"
      :key="`drc-${i}`"
      :transform="`translate(${v.at.x} ${v.at.y})`"
      class="drc-marker"
      :data-kind="v.kind"
      data-testid="pcb-drc-marker"
    >
      <title>{{ v.message }}</title>
      <circle :r="markerR" :stroke-width="px(1.5)" />
      <path
        :d="`M${-cross} ${-cross}L${cross} ${cross}M${-cross} ${cross}L${cross} ${-cross}`"
        :stroke-width="px(1.75)"
      />
    </g>
  </g>
</template>

<style scoped>
.ratsnest {
  stroke: var(--bs-emphasis-color);
  stroke-opacity: 0.75;
  stroke-linecap: round;
  pointer-events: none;
}

.drc-marker circle {
  fill: var(--pcb-error);
  fill-opacity: 0.25;
  stroke: var(--pcb-error);
}

.drc-marker path {
  fill: none;
  stroke: var(--pcb-error);
  stroke-linecap: round;
}
</style>
