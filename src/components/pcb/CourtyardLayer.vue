<!--
  CourtyardLayer: the courtyards that overlap another part's, in the
  switch-local frame, dashed in the error colour (see courtyard-collisions.ts).
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { CourtyardCollision } from '@/utils/pcb/courtyard-collisions'

const props = defineProps<{
  collisions: readonly CourtyardCollision[]
  /** Screen pixels per mm at the current zoom. */
  pxPerMm: number
}>()

const px = (n: number) => n / props.pxPerMm
const paths = computed(() =>
  props.collisions.flatMap((c) =>
    c.outlines.map((pts) => `M${pts.map((p) => `${p.x} ${p.y}`).join('L')}Z`),
  ),
)
</script>

<template>
  <g class="courtyard-layer">
    <path
      v-for="(d, i) in paths"
      :key="i"
      :d="d"
      :stroke-width="px(1.5)"
      :stroke-dasharray="`${px(5)} ${px(3)}`"
      class="courtyard"
      data-testid="pcb-courtyard-outline"
    />
  </g>
</template>

<style scoped>
.courtyard-layer {
  pointer-events: none;
}

.courtyard {
  fill: color-mix(in srgb, var(--pcb-error) 8%, transparent);
  stroke: var(--pcb-error);
  stroke-linejoin: round;
}
</style>
