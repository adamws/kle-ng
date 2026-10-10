<!--
  TrackEditorToolbar: tool, history, copper layer, track width, grid and
  posture of the track editor. Shortcuts are listed in the titles.

  Clearance is not editable: kle-ng-api boards use KiCad's default netclass
  (0.2 mm), so a smaller value would only make presets kbplacer rejects.
-->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { GRID_OPTIONS, usePcbTracksStore } from '@/stores/pcbTracks'
import CustomNumberInput from '../CustomNumberInput.vue'
import BiBezier2 from 'bootstrap-icons/icons/bezier2.svg'
import BiCursor from 'bootstrap-icons/icons/cursor.svg'
import BiUndo from 'bootstrap-icons/icons/arrow-counterclockwise.svg'
import BiRedo from 'bootstrap-icons/icons/arrow-clockwise.svg'

const tracks = usePcbTracksStore()
const { editorSettings, tool, isRouting, canUndo, canRedo } = storeToRefs(tracks)
</script>

<template>
  <div class="track-editor-toolbar" data-testid="pcb-track-toolbar">
    <div class="btn-group btn-group-sm" role="group" aria-label="Tool">
      <button
        type="button"
        class="btn"
        :class="tool === 'select' ? 'btn-secondary' : 'btn-outline-secondary'"
        :aria-pressed="tool === 'select'"
        title="Select tracks (click, Shift+click, drag a box); click a pad to highlight its net"
        data-testid="pcb-tool-select"
        @click="tracks.setTool('select')"
      >
        <BiCursor /> Select
      </button>
      <button
        type="button"
        class="btn"
        :class="tool === 'route' ? 'btn-secondary' : 'btn-outline-secondary'"
        :aria-pressed="tool === 'route'"
        title="Route tracks (X)"
        data-testid="pcb-tool-route"
        @click="tracks.setTool('route')"
      >
        <BiBezier2 /> Route
      </button>
    </div>

    <div class="btn-group btn-group-sm" role="group" aria-label="History">
      <button
        type="button"
        class="btn btn-outline-secondary"
        :disabled="!canUndo"
        title="Undo (Ctrl+Z)"
        data-testid="pcb-undo"
        @click="tracks.undo()"
      >
        <BiUndo />
      </button>
      <button
        type="button"
        class="btn btn-outline-secondary"
        :disabled="!canRedo"
        title="Redo (Ctrl+Shift+Z, Ctrl+Y)"
        data-testid="pcb-redo"
        @click="tracks.redo()"
      >
        <BiRedo />
      </button>
    </div>

    <div class="btn-group btn-group-sm" role="group" aria-label="Copper layer">
      <button
        v-for="layer in ['F.Cu', 'B.Cu'] as const"
        :key="layer"
        type="button"
        class="btn"
        :class="[
          editorSettings.layer === layer ? 'btn-secondary' : 'btn-outline-secondary',
          layer === 'F.Cu' ? 'layer-front' : 'layer-back',
        ]"
        :aria-pressed="editorSettings.layer === layer"
        :disabled="isRouting"
        :title="`Route on ${layer}`"
        :data-testid="`pcb-route-layer-${layer}`"
        @click="editorSettings.layer = layer"
      >
        <span class="layer-swatch"></span>{{ layer }}
      </button>
    </div>

    <label class="toolbar-field" title="Track width (W / Shift+W: next / previous preset)">
      <span>Width</span>
      <CustomNumberInput
        v-model="editorSettings.width"
        :step="0.05"
        :min="0.1"
        :max="2"
        :value-on-clear="0.25"
        size="compact"
        data-testid="pcb-track-width"
      >
        <template #suffix>mm</template>
      </CustomNumberInput>
    </label>

    <label class="toolbar-field" title="Grid (mm)">
      <span>Grid</span>
      <select
        v-model.number="editorSettings.grid"
        class="form-select form-select-sm"
        data-testid="pcb-grid-select"
      >
        <option v-for="g in GRID_OPTIONS" :key="g" :value="g">{{ g }}</option>
      </select>
    </label>

    <div class="btn-group btn-group-sm" role="group" aria-label="Posture">
      <button
        v-for="p in ['45', '90'] as const"
        :key="p"
        type="button"
        class="btn"
        :class="editorSettings.posture === p ? 'btn-secondary' : 'btn-outline-secondary'"
        :aria-pressed="editorSettings.posture === p"
        :title="`${p}° corners (/ flips the corner while routing)`"
        :data-testid="`pcb-posture-${p}`"
        @click="editorSettings.posture = p"
      >
        {{ p }}°
      </button>
    </div>
  </div>
</template>

<style scoped>
.track-editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.375rem 0.5rem;
  padding: 0.375rem 0;
}

.track-editor-toolbar .btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
}

.toolbar-field {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  margin: 0;
  font-size: 0.8125rem;
  color: var(--bs-secondary-color);
}

.toolbar-field :deep(.custom-number-input) {
  width: 5.25rem;
}

.toolbar-field select {
  width: auto;
  padding-right: 1.75rem;
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
