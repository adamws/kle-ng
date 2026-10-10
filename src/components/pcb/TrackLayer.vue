<!--
  TrackLayer: the tracks and vias of a track preset, drawn in the switch-local
  frame (the parent group applies the switch rotation). Selected tracks get a
  halo of a fixed screen width, the track under the cursor a fainter one.
  Every track has a darker edge, so one lying on a pad of its own colour still
  shows. Tracks on hidden layers aren't drawn.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { CopperLayer, TrackItem, TrackSegment, TrackVia } from '@/types/tracks'
import type { NetName } from '@/utils/pcb-tracks/netlist'

const props = defineProps<{
  items: readonly TrackItem[]
  /** Net of each item; with highlightNet, items of other nets are dimmed. */
  itemNets?: readonly (NetName | null)[]
  highlightNet?: NetName | null
  /** Indexes of selected items. */
  selected?: readonly number[]
  /** Index of the item a click would select. */
  hovered?: number | null
  /** Copper layers shown; tracks on others are hidden (all shown when absent). */
  visibleLayers?: Record<CopperLayer, boolean>
  /** Screen pixels per mm at the current zoom (for the selection halo). */
  pxPerMm?: number
}>()

const px = (n: number) => n / (props.pxPerMm ?? 1)
const halo = (width: number) => width + px(6)
const edge = (width: number) => width + px(1.5)
const shown = (layer: CopperLayer) => props.visibleLayers?.[layer] ?? true

const dimmed = (i: number) =>
  !!props.highlightNet && (props.itemNets?.[i] ?? null) !== props.highlightNet
const tracks = computed(() =>
  props.items.flatMap((item, i) =>
    item.type === 'track' && shown(item.layer)
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
    item.type === 'via' && (shown('F.Cu') || shown('B.Cu'))
      ? [
          {
            via: item as TrackVia,
            index: i,
            dimmed: dimmed(i),
            selected: !!props.selected?.includes(i),
          },
        ]
      : [],
  ),
)
</script>

<template>
  <g class="track-overlay" data-testid="pcb-track-overlay">
    <template v-for="{ track, index, selected: sel } in tracks" :key="`halo-${index}`">
      <line
        v-if="sel || index === hovered"
        :x1="track.start.x"
        :y1="track.start.y"
        :x2="track.end.x"
        :y2="track.end.y"
        :stroke-width="sel ? halo(track.width) : track.width + px(10)"
        :class="['track-halo', { 'track-hover': !sel }]"
        :data-testid="sel ? undefined : 'pcb-track-hover'"
      />
    </template>
    <line
      v-for="{ track, index, dimmed: dim } in tracks"
      :key="`edge-${index}`"
      :x1="track.start.x"
      :y1="track.start.y"
      :x2="track.end.x"
      :y2="track.end.y"
      :stroke-width="edge(track.width)"
      :class="['track-edge', track.layer === 'F.Cu' ? 'edge-front' : 'edge-back', { dimmed: dim }]"
    />
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
      v-for="{ via, index, dimmed: dim, selected: sel } in vias"
      :key="`via-${index}`"
      :class="{ dimmed: dim }"
      :data-item-index="index"
      data-testid="pcb-track-overlay-via"
    >
      <circle
        v-if="sel || index === hovered"
        :cx="via.position.x"
        :cy="via.position.y"
        :r="via.diameter / 2 + px(sel ? 3 : 5)"
        :class="['via-halo', { 'via-hover': !sel }]"
        :data-testid="sel ? undefined : 'pcb-track-hover'"
      />
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

.track-hover {
  stroke: var(--bs-primary);
  stroke-opacity: 0.5;
}

.track-edge {
  stroke-linecap: round;
}

/* darker than the pads, so a track on a pad of its colour keeps its outline */
.edge-front {
  stroke: color-mix(in srgb, var(--pcb-fcu) 55%, black);
}

.edge-back {
  stroke: color-mix(in srgb, var(--pcb-bcu) 55%, black);
}

.track.selected {
  opacity: 1;
}

.track-front {
  stroke: var(--pcb-fcu);
}

.track-back {
  stroke: var(--pcb-bcu);
}

.dimmed {
  opacity: 0.25;
}

.via {
  fill: var(--pcb-via);
  stroke: var(--pcb-via-edge);
  stroke-width: 0.03;
}

.via-halo {
  fill: var(--bs-emphasis-color);
  fill-opacity: 0.55;
}

.via-halo.via-hover {
  fill: var(--bs-primary);
  fill-opacity: 0.5;
}

.via-drill {
  fill: var(--bs-body-bg);
}
</style>
