<!--
  TrackLayer: the tracks and vias of a track preset, drawn in the switch-local
  frame (the parent group applies the switch rotation). Read-only.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { TrackItem, TrackSegment, TrackVia } from '@/types/tracks'
import type { NetName } from '@/utils/pcb-tracks/netlist'

const props = defineProps<{
  items: readonly TrackItem[]
  /** Net of each item; with highlightNet, items of other nets are dimmed. */
  itemNets?: readonly (NetName | null)[]
  highlightNet?: NetName | null
}>()

const dimmed = (i: number) =>
  !!props.highlightNet && (props.itemNets?.[i] ?? null) !== props.highlightNet
const tracks = computed(() =>
  props.items.flatMap((item, i) =>
    item.type === 'track' ? [{ track: item as TrackSegment, dimmed: dimmed(i) }] : [],
  ),
)
const vias = computed(() =>
  props.items.flatMap((item, i) =>
    item.type === 'via' ? [{ via: item as TrackVia, dimmed: dimmed(i) }] : [],
  ),
)
</script>

<template>
  <g class="track-overlay" data-testid="pcb-track-overlay">
    <line
      v-for="({ track, dimmed: dim }, i) in tracks"
      :key="`track-${i}`"
      :x1="track.start.x"
      :y1="track.start.y"
      :x2="track.end.x"
      :y2="track.end.y"
      :stroke-width="track.width"
      :class="['track', track.layer === 'F.Cu' ? 'track-front' : 'track-back', { dimmed: dim }]"
      data-testid="pcb-track-overlay-track"
    />
    <g
      v-for="({ via, dimmed: dim }, i) in vias"
      :key="`via-${i}`"
      :class="{ dimmed: dim }"
      data-testid="pcb-track-overlay-via"
    >
      <circle :cx="via.position.x" :cy="via.position.y" :r="via.diameter / 2" class="via" />
      <circle
        :cx="via.position.x"
        :cy="via.position.y"
        :r="via.drillDiameter / 2"
        class="via-drill"
      />
    </g>
  </g>
</template>

<style scoped>
/* colours match the copper layers of the footprint SVGs */
.track-overlay {
  pointer-events: none;
}

.track {
  stroke-linecap: round;
  opacity: 0.85;
}

.track-front {
  stroke: #c83434;
}

.track-back {
  stroke: #4d7fc4;
}

.dimmed {
  opacity: 0.25;
}

.via {
  fill: #b3b3b3;
}

.via-drill {
  fill: var(--bs-body-bg);
}
</style>
