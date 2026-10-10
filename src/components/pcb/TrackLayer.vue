<!--
  TrackLayer: the tracks and vias of a track preset, drawn in the switch-local
  frame (the parent group applies the switch rotation). Selected tracks get a
  halo of a fixed screen width.
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
  /** Indexes of selected items. */
  selected?: readonly number[]
  /** Screen pixels per mm at the current zoom (for the selection halo). */
  pxPerMm?: number
}>()

const halo = (width: number) => width + 6 / (props.pxPerMm ?? 1)

const dimmed = (i: number) =>
  !!props.highlightNet && (props.itemNets?.[i] ?? null) !== props.highlightNet
const tracks = computed(() =>
  props.items.flatMap((item, i) =>
    item.type === 'track'
      ? [
          {
            track: item as TrackSegment,
            index: i,
            dimmed: dimmed(i),
            selected: !!props.selected?.includes(i),
          },
        ]
      : [],
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
    <template v-for="{ track, index } in tracks" :key="`halo-${index}`">
      <line
        v-if="selected?.includes(index)"
        :x1="track.start.x"
        :y1="track.start.y"
        :x2="track.end.x"
        :y2="track.end.y"
        :stroke-width="halo(track.width)"
        class="track-halo"
      />
    </template>
    <line
      v-for="{ track, index, dimmed: dim, selected: sel } in tracks"
      :key="`track-${index}`"
      :x1="track.start.x"
      :y1="track.start.y"
      :x2="track.end.x"
      :y2="track.end.y"
      :stroke-width="track.width"
      :class="[
        'track',
        track.layer === 'F.Cu' ? 'track-front' : 'track-back',
        { dimmed: dim, selected: sel },
      ]"
      :data-item-index="index"
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

.track-halo {
  stroke: var(--bs-emphasis-color);
  stroke-opacity: 0.55;
  stroke-linecap: round;
}

.track.selected {
  opacity: 1;
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
