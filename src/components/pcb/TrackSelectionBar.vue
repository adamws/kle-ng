<!--
  TrackSelectionBar: width, layer and delete for the selected tracks. A panel
  floating over the canvas's top-right corner, so a selection never moves the
  preview.
-->
<script setup lang="ts">
import { computed } from 'vue'
import { usePcbTracksStore } from '@/stores/pcbTracks'
import type { CopperLayer, TrackSegment } from '@/types/tracks'
import CustomNumberInput from '../CustomNumberInput.vue'
import BiTrash3 from 'bootstrap-icons/icons/trash3.svg'

const tracks = usePcbTracksStore()

const selected = computed(() =>
  tracks.selection
    .map((i) => tracks.presetItems[i])
    .filter((item): item is TrackSegment => item?.type === 'track'),
)

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
</script>

<template>
  <div
    v-if="selected.length"
    class="track-selection-bar"
    role="group"
    aria-label="Selected tracks"
    data-testid="pcb-selection-bar"
  >
    <span class="selection-count" data-testid="pcb-selection-count">
      {{ selected.length }} track{{ selected.length > 1 ? 's' : '' }} selected
    </span>
    <label class="bar-field" title="Width of the selected tracks, mm">
      <span>Width mm</span>
      <CustomNumberInput
        v-model="width"
        :step="0.05"
        :min="0.1"
        :max="2"
        :value-on-clear="null"
        placeholder="mixed"
        size="compact"
        data-testid="pcb-selection-width"
      />
    </label>
    <div class="btn-group btn-group-sm" role="group" aria-label="Layer of the selected tracks">
      <button
        v-for="l in ['F.Cu', 'B.Cu'] as const"
        :key="l"
        type="button"
        class="btn"
        :class="[
          layer === l ? 'btn-secondary' : 'btn-outline-secondary',
          l === 'F.Cu' ? 'layer-front' : 'layer-back',
        ]"
        :aria-pressed="layer === l"
        :title="`Move the selected tracks to ${l}`"
        :data-testid="`pcb-selection-layer-${l}`"
        @click="setLayer(l)"
      >
        <span class="layer-swatch"></span>{{ l }}
      </button>
    </div>
    <button
      type="button"
      class="btn btn-sm btn-outline-danger justify-content-center"
      title="Delete the selected tracks (Delete)"
      data-testid="pcb-selection-delete"
      @click="tracks.deleteSelection()"
    >
      <BiTrash3 /> Delete
    </button>
  </div>
</template>

<style scoped>
.track-selection-bar {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 20;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.375rem;
  padding: 0.5rem;
  font-size: 0.8125rem;
  background-color: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 0.375rem;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
}

.track-selection-bar .btn-group {
  display: flex;
}

.track-selection-bar .btn-group .btn {
  flex: 1 1 0;
  justify-content: center;
}

.track-selection-bar .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.selection-count {
  font-weight: 600;
}

.bar-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.375rem;
  margin: 0;
  color: var(--bs-secondary-color);
}

.bar-field :deep(.custom-number-input) {
  width: 4.5rem;
}

.layer-swatch {
  display: inline-block;
  width: 0.65rem;
  height: 0.65rem;
  border-radius: 2px;
}

.layer-front .layer-swatch {
  background-color: #c83434;
}

.layer-back .layer-swatch {
  background-color: #4d7fc4;
}
</style>
