<!--
  TrackSelectionBar: width and layer of the selected tracks, size of the
  selected vias, and delete (vias are moved by dragging), as KiCad's
  Properties panel: a title, then one property per row (.pcb-panel). It
  floats over the canvas's top-left corner, by the view tools, so a selection
  never moves the preview.

  Via fields are the sizes kbplacer's preset format holds: diameter and
  drill (through vias only, nets from connectivity). Their limits are
  KiCad's constraints for a new board, which kle-ng-api boards use.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { usePcbTracksStore } from '@/stores/pcbTracks'
import type { CopperLayer, TrackSegment, TrackVia } from '@/types/tracks'
import { DEFAULT_DRC_RULES } from '@/utils/pcb-tracks/drc'
import CustomNumberInput from '../CustomNumberInput.vue'
import BiTrash3 from 'bootstrap-icons/icons/trash3.svg'

const tracks = usePcbTracksStore()

const selected = computed(() =>
  tracks.selection
    .map((i) => tracks.presetItems[i])
    .filter((item): item is TrackSegment => item?.type === 'track'),
)
const selectedVias = computed(() =>
  tracks.selection
    .map((i) => ({ index: i, via: tracks.presetItems[i] }))
    .filter((v): v is { index: number; via: TrackVia } => v.via?.type === 'via'),
)
const viaCount = computed(() => selectedVias.value.length)
const summary = computed(() => {
  const parts = []
  const n = selected.value.length
  if (n) parts.push(`${n} track${n > 1 ? 's' : ''}`)
  if (viaCount.value) parts.push(`${viaCount.value} via${viaCount.value > 1 ? 's' : ''}`)
  return `${parts.join(', ')} selected`
})

/** Shared value of the selection, undefined when mixed. */
function common<T>(values: T[]): T | undefined {
  return values.length && values.every((v) => v === values[0]) ? values[0] : undefined
}

const width = computed({
  get: () => common(selected.value.map((t) => t.width)),
  set: (w: number | undefined) => {
    if (w !== undefined && w > 0) tracks.updateSelection({ width: w })
  },
})
const layer = computed(() => common(selected.value.map((t) => t.layer)))

function setLayer(value: CopperLayer) {
  tracks.updateSelection({ layer: value })
}

const RULES = DEFAULT_DRC_RULES
const diameter = computed(() => common(selectedVias.value.map((v) => v.via.diameter)))
const drill = computed(() => common(selectedVias.value.map((v) => v.via.drillDiameter)))
/** Largest drill that keeps the copper ring of the smallest selected via. */
const maxDrill = computed(
  () => Math.min(...selectedVias.value.map((v) => v.via.diameter)) - 2 * RULES.viaMinAnnular,
)

function setDiameter(d: number | undefined) {
  if (d !== undefined && d >= RULES.viaMinDiameter) tracks.updateSelection({ diameter: d })
}
function setDrill(d: number | undefined) {
  if (d !== undefined && d >= RULES.minThroughDrill) tracks.updateSelection({ drillDiameter: d })
}
</script>

<template>
  <div
    v-if="selected.length || viaCount"
    class="pcb-panel"
    role="group"
    aria-label="Properties"
    data-testid="pcb-selection-bar"
  >
    <div class="pcb-panel-title">Properties</div>
    <span class="selection-count" data-testid="pcb-selection-count">{{ summary }}</span>
    <label v-if="selected.length" class="pcb-panel-field">
      <span>Width</span>
      <CustomNumberInput
        v-model="width"
        :step="0.05"
        :min="0.1"
        :max="2"
        :value-on-clear="null"
        placeholder="mixed"
        size="small"
        data-testid="pcb-selection-width"
      />
    </label>
    <div
      v-if="selected.length"
      class="btn-group btn-group-sm"
      role="group"
      aria-label="Layer of the selected tracks"
    >
      <button
        v-for="l in ['F.Cu', 'B.Cu'] as const"
        :key="l"
        type="button"
        class="btn btn-toggle"
        :class="l === 'F.Cu' ? 'layer-front' : 'layer-back'"
        :aria-pressed="layer === l"
        :data-testid="`pcb-selection-layer-${l}`"
        @click="setLayer(l)"
      >
        <span class="layer-swatch"></span>{{ l }}
      </button>
    </div>
    <template v-if="viaCount">
      <label class="pcb-panel-field">
        <span>Via ⌀</span>
        <CustomNumberInput
          :model-value="diameter"
          :step="0.05"
          :min="RULES.viaMinDiameter"
          :max="2"
          :value-on-clear="null"
          placeholder="mixed"
          size="small"
          data-testid="pcb-selection-via-diameter"
          @commit="setDiameter"
        />
      </label>
      <label class="pcb-panel-field">
        <span>Drill</span>
        <CustomNumberInput
          :model-value="drill"
          :step="0.05"
          :min="RULES.minThroughDrill"
          :max="Math.max(RULES.minThroughDrill, maxDrill)"
          :value-on-clear="null"
          placeholder="mixed"
          size="small"
          data-testid="pcb-selection-via-drill"
          @commit="setDrill"
        />
      </label>
    </template>
    <button
      type="button"
      class="btn btn-sm btn-outline-danger justify-content-center"
      data-testid="pcb-selection-delete"
      @click="tracks.deleteSelection()"
    >
      <BiTrash3 /> Delete
    </button>
  </div>
</template>

<style scoped>
.selection-count {
  font-weight: 600;
}
</style>
