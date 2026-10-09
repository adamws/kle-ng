<!--
  PadLayer: copper pads and holes of the placed footprints, drawn from the pad
  geometry JSON (public/data/footprints/pads) in the switch-local frame, so
  what the editor shows is exactly what kbplacer and KiCad see.

  The active layer is drawn over the other one, as in KiCad, holes on top.
  Each pad carries data-pad-key.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { placedPadNet, type NetName, type PlacedPad } from '@/utils/pcb-tracks/netlist'
import { padCopperLayers } from '@/utils/kicad/footprint-pads'
import { drillPath, padCopperPaths, padTransform, type PadPath } from '@/utils/pcb-tracks/pad-paths'
import type { CopperLayer } from '@/types/tracks'

const props = defineProps<{
  pads: readonly PlacedPad[]
  visibleLayers: Record<CopperLayer, boolean>
  hoveredKey?: string | null
  /** Layer drawn on top. */
  activeLayer?: CopperLayer
  /** Net to highlight; pads of other nets are dimmed. */
  highlightNet?: NetName | null
}>()

const emit = defineEmits<{ hover: [key: string | null] }>()

interface DrawnPad {
  key: string
  owner: string
  number: string
  transform: string
  copper: { layer: CopperLayer; paths: PadPath[] }[]
  hole: string | null
  npth: boolean
  dimmed: boolean
}

const drawn = computed<DrawnPad[]>(() =>
  props.pads.map((placed) => {
    const { key, owner, pad } = placed
    const npth = pad.type === 'np_thru_hole'
    const paths = padCopperPaths(pad)
    return {
      key,
      owner,
      number: pad.number,
      transform: padTransform(pad),
      // an NPTH has no copper, only its hole
      copper: npth ? [] : padCopperLayers(pad).map((layer) => ({ layer, paths })),
      hole: pad.drill ? drillPath(pad.drill) : null,
      npth,
      dimmed: !!props.highlightNet && placedPadNet(placed) !== props.highlightNet,
    }
  }),
)

const layerOrder = computed<CopperLayer[]>(() =>
  (props.activeLayer ?? 'B.Cu') === 'B.Cu' ? ['F.Cu', 'B.Cu'] : ['B.Cu', 'F.Cu'],
)
const layerClass = (layer: CopperLayer) => (layer === 'F.Cu' ? 'pad-front' : 'pad-back')
</script>

<template>
  <g class="pad-layer" data-testid="pcb-pad-layer">
    <template v-for="layer in layerOrder" :key="layer">
      <g v-if="visibleLayers[layer]" :class="['pad-copper', layerClass(layer)]" :data-layer="layer">
        <template v-for="p in drawn" :key="`${layer}-${p.key}`">
          <g
            v-if="p.copper.some((c) => c.layer === layer)"
            :transform="p.transform"
            :class="{ hovered: p.key === hoveredKey, dimmed: p.dimmed }"
            :data-pad-key="p.key"
            :data-pad-number="p.number"
            @pointerenter="emit('hover', p.key)"
            @pointerleave="emit('hover', null)"
          >
            <path
              v-for="(path, i) in p.copper.find((c) => c.layer === layer)!.paths"
              :key="i"
              :d="path.d"
              :stroke-width="path.strokeWidth || undefined"
              :class="{ 'pad-stroked': path.strokeWidth > 0 }"
            />
          </g>
        </template>
      </g>
    </template>
    <g class="pad-holes">
      <template v-for="p in drawn" :key="`hole-${p.key}`">
        <g
          v-if="p.hole"
          :transform="p.transform"
          :class="{ npth: p.npth, hovered: p.key === hoveredKey, dimmed: p.dimmed }"
          :data-pad-key="p.npth ? p.key : undefined"
          @pointerenter="p.npth && emit('hover', p.key)"
          @pointerleave="p.npth && emit('hover', null)"
        >
          <path :d="p.hole" />
        </g>
      </template>
    </g>
  </g>
</template>

<style scoped>
.pad-copper .pad-stroked {
  stroke-linejoin: round;
}

.pad-front {
  fill: #c83434;
  stroke: #c83434;
}

.pad-back {
  fill: #4d7fc4;
  stroke: #4d7fc4;
}

.pad-copper path:not(.pad-stroked) {
  stroke: none;
}

.pad-holes {
  fill: #afafaf;
}

/* a plated drill belongs to its copper pad, which takes the pointer */
.pad-holes g:not(.npth) {
  pointer-events: none;
}

.pad-holes .npth path {
  stroke: #585d84;
  stroke-width: 0.05;
}

.pad-copper g,
.pad-holes .npth {
  cursor: crosshair;
}

/* dim with a faded colour, not opacity, so stacked layers don't mix */
.pad-front .dimmed path {
  fill: color-mix(in srgb, #c83434 30%, var(--bs-body-bg));
}

.pad-back .dimmed path {
  fill: color-mix(in srgb, #4d7fc4 30%, var(--bs-body-bg));
}

.pad-holes .dimmed {
  opacity: 0.4;
}

.hovered path {
  stroke: var(--bs-emphasis-color);
  stroke-width: 0.08;
  stroke-opacity: 0.9;
}
</style>
