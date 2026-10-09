<!--
  TrackEditorLayer: the route being drawn, in the switch-local frame. Committed
  segments are drawn in the layer colour, the preview walk to the cursor in a
  lighter tone (red when it breaks a rule), plus the snap target.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { TrackSegment } from '@/types/tracks'
import type { SnapTarget } from '@/utils/pcb-tracks/snap'

const props = defineProps<{
  committed: readonly TrackSegment[]
  preview: readonly TrackSegment[]
  blocked: boolean
  target: SnapTarget | null
  /** Screen pixels per mm at the current zoom. */
  pxPerMm: number
}>()

const px = (n: number) => n / props.pxPerMm
const size = computed(() => px(6))
const layerClass = (t: TrackSegment) => (t.layer === 'F.Cu' ? 'route-front' : 'route-back')
</script>

<template>
  <g class="track-editor-layer" data-testid="pcb-route-layer">
    <line
      v-for="(t, i) in committed"
      :key="`c-${i}`"
      :x1="t.start.x"
      :y1="t.start.y"
      :x2="t.end.x"
      :y2="t.end.y"
      :stroke-width="t.width"
      :class="['route', layerClass(t)]"
      data-testid="pcb-route-committed"
    />
    <line
      v-for="(t, i) in preview"
      :key="`p-${i}`"
      :x1="t.start.x"
      :y1="t.start.y"
      :x2="t.end.x"
      :y2="t.end.y"
      :stroke-width="t.width"
      :class="['route', 'route-preview', layerClass(t), { 'route-blocked': blocked }]"
      data-testid="pcb-route-preview"
    />
    <g
      v-if="target"
      :transform="`translate(${target.point.x} ${target.point.y})`"
      :class="['snap-target', `snap-${target.kind}`]"
      :data-kind="target.kind"
      data-testid="pcb-snap-target"
    >
      <circle v-if="target.kind !== 'grid'" :r="size" :stroke-width="px(1.5)" />
      <path
        :d="`M${-size} 0H${size}M0 ${-size}V${size}`"
        :stroke-width="px(1)"
        class="snap-cross"
      />
    </g>
  </g>
</template>

<style scoped>
.track-editor-layer {
  pointer-events: none;
}

.route {
  stroke-linecap: round;
}

.route-front {
  stroke: #c83434;
}

.route-back {
  stroke: #4d7fc4;
}

.route-preview {
  opacity: 0.6;
}

.route-preview.route-blocked {
  stroke: #ff2d55;
  opacity: 0.85;
}

.snap-target circle {
  fill: none;
  stroke: var(--bs-emphasis-color);
}

.snap-cross {
  stroke: var(--bs-emphasis-color);
  opacity: 0.8;
}
</style>
