<!--
  TrackEditorLayer: the route being drawn, in the switch-local frame. Committed
  segments are drawn in the layer colour, the preview walk to the cursor in a
  lighter tone (red and dashed when it breaks a rule, so it never reads as an
  F.Cu track), plus its vias and the snap target.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { TrackSegment, TrackVia } from '@/types/tracks'
import type { SnapTarget } from '@/utils/pcb-tracks/snap'

const props = defineProps<{
  committed: readonly TrackSegment[]
  vias?: readonly TrackVia[]
  /** The via tool's via at the cursor, red when it can't go there. */
  freeVia?: TrackVia | null
  freeViaBlocked?: boolean
  preview: readonly TrackSegment[]
  blocked: boolean
  target: SnapTarget | null
  /** Screen pixels per mm at the current zoom. */
  pxPerMm: number
}>()

const px = (n: number) => n / props.pxPerMm
const size = computed(() => px(6))
const layerClass = (t: TrackSegment) => (t.layer === 'F.Cu' ? 'route-front' : 'route-back')
/** Dashes in track widths, so they look the same at any zoom (round caps add a width to each). */
const blockedDash = (t: TrackSegment) => `${t.width} ${t.width * 2.5}`
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
      :stroke-dasharray="blocked ? blockedDash(t) : undefined"
      :class="['route', 'route-preview', layerClass(t), { 'route-blocked': blocked }]"
      data-testid="pcb-route-preview"
    />
    <g v-for="(via, i) in vias" :key="`v-${i}`" data-testid="pcb-route-via">
      <circle :cx="via.position.x" :cy="via.position.y" :r="via.diameter / 2" class="via" />
      <circle
        :cx="via.position.x"
        :cy="via.position.y"
        :r="via.drillDiameter / 2"
        class="via-drill"
      />
    </g>
    <g
      v-if="freeVia"
      :class="['free-via', { 'route-blocked': freeViaBlocked }]"
      data-testid="pcb-free-via"
    >
      <circle
        :cx="freeVia.position.x"
        :cy="freeVia.position.y"
        :r="freeVia.diameter / 2"
        :stroke-width="freeViaBlocked ? px(1.5) : undefined"
        :stroke-dasharray="freeViaBlocked ? `${px(3)} ${px(2)}` : undefined"
        class="via"
      />
      <circle
        :cx="freeVia.position.x"
        :cy="freeVia.position.y"
        :r="freeVia.drillDiameter / 2"
        class="via-drill"
      />
    </g>
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
  stroke: var(--pcb-fcu);
}

.route-back {
  stroke: var(--pcb-bcu);
}

.route-preview {
  opacity: 0.6;
}

.route-preview.route-blocked {
  stroke: var(--pcb-error);
  opacity: 0.9;
}

.via {
  fill: var(--pcb-via);
}

.via-drill {
  fill: var(--bs-body-bg);
}

.free-via {
  opacity: 0.7;
}

.free-via.route-blocked .via {
  fill: color-mix(in srgb, var(--pcb-error) 20%, transparent);
  stroke: var(--pcb-error);
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
