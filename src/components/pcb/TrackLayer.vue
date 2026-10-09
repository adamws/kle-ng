<!--
  TrackLayer: the tracks and vias of a track preset, drawn in the switch-local
  frame (the parent group applies the switch rotation). Read-only.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { TrackItem, TrackSegment, TrackVia } from '@/types/tracks'

const props = defineProps<{ items: readonly TrackItem[] }>()

const tracks = computed(() => props.items.filter((i): i is TrackSegment => i.type === 'track'))
const vias = computed(() => props.items.filter((i): i is TrackVia => i.type === 'via'))
</script>

<template>
  <g class="track-overlay" data-testid="pcb-track-overlay">
    <line
      v-for="(track, i) in tracks"
      :key="`track-${i}`"
      :x1="track.start.x"
      :y1="track.start.y"
      :x2="track.end.x"
      :y2="track.end.y"
      :stroke-width="track.width"
      :class="['track', track.layer === 'F.Cu' ? 'track-front' : 'track-back']"
      data-testid="pcb-track-overlay-track"
    />
    <g v-for="(via, i) in vias" :key="`via-${i}`" data-testid="pcb-track-overlay-via">
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

.via {
  fill: #b3b3b3;
}

.via-drill {
  fill: var(--bs-body-bg);
}
</style>
