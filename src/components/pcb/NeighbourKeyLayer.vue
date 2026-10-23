<!--
  NeighbourKeyLayer: the neighbouring keys a part collides with (see
  courtyard-collisions.ts), drawn faded in the switch-local frame: the key's
  1u outline, the pads and holes and the courtyards of its parts, with this
  key's outline to show the spacing. The
  collision check places them KEY_PITCH apart, and without them the red
  outline of the next key's part would have nothing around it.
-->
<script setup lang="ts">
import { computed } from 'vue'
import type { Point } from '@/composables/usePanZoom'
import type { CopperLayer } from '@/types/tracks'
import { padCopperLayers } from '@/utils/kicad/footprint-pads'
import type { PlacedPad } from '@/utils/pcb-tracks/netlist'
import { drillPath, padCopperPaths, padTransform } from '@/utils/pcb-tracks/pad-paths'
import { KEY_PITCH, type CourtyardPart } from '@/utils/pcb/courtyard-collisions'

const props = defineProps<{
  /** Where the keys are, switch-local. */
  offsets: readonly Point[]
  /** The key's own pads and parts, switch-local; each key repeats them. */
  pads: readonly PlacedPad[]
  parts: readonly CourtyardPart[]
  /** Keys sit on the grid in board axes, the switch-local frame is rotated by this. */
  switchRotation: number
  visibleLayers: Record<CopperLayer, boolean>
  /** Screen pixels per mm at the current zoom. */
  pxPerMm: number
}>()

const px = (n: number) => n / props.pxPerMm

const copper = computed(() =>
  (['F.Cu', 'B.Cu'] as const).map((layer) => ({
    layer,
    pads: props.pads
      .filter((p) => p.pad.type !== 'np_thru_hole' && padCopperLayers(p.pad).includes(layer))
      .map((p) => ({ key: p.key, transform: padTransform(p.pad), paths: padCopperPaths(p.pad) })),
  })),
)
const holes = computed(() =>
  props.pads.flatMap((p) =>
    p.pad.drill ? [{ key: p.key, transform: padTransform(p.pad), d: drillPath(p.pad.drill) }] : [],
  ),
)
const courtyards = computed(() =>
  props.parts.flatMap((part) =>
    [...part.courtyard.front, ...part.courtyard.back].map(
      (pts) => `M${pts.map((p) => `${p.x} ${p.y}`).join('L')}Z`,
    ),
  ),
)
// the key's outline is square in board axes: undo the frame's rotation
const keyTransform = computed(() => `rotate(${props.switchRotation})`)
</script>

<template>
  <g class="neighbour-layer">
    <!-- this key's outline too, to show the spacing -->
    <rect
      v-if="offsets.length"
      :transform="keyTransform"
      :x="-KEY_PITCH / 2"
      :y="-KEY_PITCH / 2"
      :width="KEY_PITCH"
      :height="KEY_PITCH"
      :stroke-width="px(1)"
      :stroke-dasharray="`${px(6)} ${px(4)}`"
      class="key-outline"
      data-testid="pcb-own-key"
    />
    <g
      v-for="o in offsets"
      :key="`${o.x},${o.y}`"
      :transform="`translate(${o.x} ${o.y})`"
      class="neighbour-key"
      data-testid="pcb-neighbour-key"
    >
      <g :transform="keyTransform">
        <rect
          :x="-KEY_PITCH / 2"
          :y="-KEY_PITCH / 2"
          :width="KEY_PITCH"
          :height="KEY_PITCH"
          :stroke-width="px(1)"
          :stroke-dasharray="`${px(6)} ${px(4)}`"
          class="key-outline"
        />
        <text
          :x="-KEY_PITCH / 2 + px(4)"
          :y="-KEY_PITCH / 2 + px(14)"
          :font-size="px(11)"
          class="key-label"
        >
          next key
        </text>
      </g>
      <template v-for="c in copper" :key="c.layer">
        <g v-if="visibleLayers[c.layer]" :class="c.layer === 'F.Cu' ? 'pad-front' : 'pad-back'">
          <g v-for="p in c.pads" :key="p.key" :transform="p.transform">
            <path v-for="(path, i) in p.paths" :key="i" :d="path.d" />
          </g>
        </g>
      </template>
      <g class="holes">
        <g v-for="h in holes" :key="h.key" :transform="h.transform"><path :d="h.d" /></g>
      </g>
      <path v-for="(d, i) in courtyards" :key="i" :d="d" :stroke-width="px(1)" class="courtyard" />
    </g>
  </g>
</template>

<style scoped>
.neighbour-layer {
  pointer-events: none;
}

/* faded colours, not opacity, so overlapping shapes don't darken */
.pad-front {
  fill: color-mix(in srgb, var(--pcb-fcu) 30%, var(--bs-body-bg));
}

.pad-back {
  fill: color-mix(in srgb, var(--pcb-bcu) 30%, var(--bs-body-bg));
}

.holes {
  fill: color-mix(in srgb, var(--pcb-hole) 45%, var(--bs-body-bg));
}

.key-outline,
.courtyard {
  fill: none;
  stroke: var(--bs-secondary-color);
  stroke-opacity: 0.6;
}

.key-label {
  fill: var(--bs-secondary-color);
  font-family: var(--bs-body-font-family);
}
</style>
