<!--
  TrackRouteSettings: how the Route tool draws new tracks (width, copper layer
  and corner angle), in a panel over the canvas's top-left corner like the
  selection's Properties (.pcb-panel). It shows while the Route tool is
  active, so a click on a tool never moves the preview. Shortcuts are listed in
  the tooltips. The layer is fixed while routing: V places a via and continues
  on the other layer.

  Clearance is not editable: kle-ng-api boards use KiCad's default netclass
  (0.2 mm), so a smaller value would only make presets kbplacer rejects.
-->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePcbTracksStore } from '@/stores/pcbTracks'
import CustomNumberInput from '../CustomNumberInput.vue'
import PcbIcon from './PcbIcon.vue'
import { vTooltip } from '@/directives/vTooltip'

const tracks = usePcbTracksStore()
const { editorSettings, isRouting } = storeToRefs(tracks)
</script>

<template>
  <div class="pcb-panel" role="group" aria-label="Route tracks" data-testid="pcb-route-settings">
    <div class="pcb-panel-title">Route tracks</div>
    <label
      class="pcb-panel-field"
      v-tooltip:right="'Width of new tracks, mm (W / Shift+W: next / previous preset)'"
    >
      <span>Width</span>
      <CustomNumberInput
        v-model="editorSettings.width"
        :step="0.05"
        :min="0.1"
        :max="2"
        :value-on-clear="0.25"
        size="small"
        data-testid="pcb-track-width"
      />
    </label>
    <div class="btn-group btn-group-sm" role="group" aria-label="Copper layer">
      <button
        v-for="layer in ['F.Cu', 'B.Cu'] as const"
        :key="layer"
        type="button"
        class="btn btn-toggle"
        :class="layer === 'F.Cu' ? 'layer-front' : 'layer-back'"
        :aria-pressed="editorSettings.layer === layer"
        :disabled="isRouting"
        v-tooltip:right="
          isRouting
            ? 'Press V to change layer while routing (it places a via)'
            : `Draw new tracks on ${layer}`
        "
        :data-testid="`pcb-route-layer-${layer}`"
        @click="editorSettings.layer = layer"
      >
        <span class="layer-swatch"></span>{{ layer }}
      </button>
    </div>
    <div class="btn-group btn-group-sm" role="group" aria-label="Corner angle">
      <button
        v-for="p in ['45', '90'] as const"
        :key="p"
        type="button"
        class="btn btn-toggle"
        :aria-pressed="editorSettings.posture === p"
        v-tooltip:right="`New tracks bend at ${p}° (/ flips the corner while routing)`"
        :data-testid="`pcb-posture-${p}`"
        @click="editorSettings.posture = p"
      >
        <PcbIcon :name="`posture-${p}`" />
        {{ p }}°
      </button>
    </div>
  </div>
</template>
