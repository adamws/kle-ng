<!--
  TrackEditorToolbar: the drawing controls of the track editor (tool, history,
  copper layer, track width, grid and posture). View controls (layer
  visibility, zoom) sit on the canvas instead. Shortcuts are listed in the
  titles. The Via tool places free vias; while routing it is disabled and V
  places a via at the cursor instead. Buttons that can disable themselves
  (undo, redo, clear) don't
  take the focus on a click: a disabled focused button would drop it out of the
  editor, and its shortcuts with it. It keeps one height in every state, so the canvas below never moves:
  one line, or two in a narrow preview (whose row is then two lines high).

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
import BiTrash3 from 'bootstrap-icons/icons/trash3.svg'
import BiRecordCircle from 'bootstrap-icons/icons/record-circle.svg'

const tracks = usePcbTracksStore()
const { editorSettings, tool, isRouting, canUndo, canRedo, presetItems } = storeToRefs(tracks)
</script>

<template>
  <div
    class="track-editor-toolbar"
    role="toolbar"
    aria-label="Draw"
    data-testid="pcb-track-toolbar"
  >
    <span class="group-caption">Draw</span>
    <div class="btn-group btn-group-sm" role="group" aria-label="Tool">
      <button
        type="button"
        class="btn"
        :class="tool === 'select' ? 'btn-secondary' : 'btn-outline-secondary'"
        :aria-pressed="tool === 'select'"
        title="Select tracks (click, Shift+click, drag a box); click a pad to highlight its net, or an unrouted pad to start a track"
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
      <button
        type="button"
        class="btn"
        :class="tool === 'via' ? 'btn-secondary' : 'btn-outline-secondary'"
        :aria-pressed="tool === 'via'"
        :disabled="isRouting"
        :title="
          isRouting
            ? 'While routing, press V to place a via at the cursor and continue on the other layer'
            : 'Place free vias: click to place one (Esc: back to Select)'
        "
        data-testid="pcb-tool-via"
        @click="tracks.setTool('via')"
      >
        <BiRecordCircle /> Via
      </button>
    </div>

    <div class="btn-group btn-group-sm" role="group" aria-label="History">
      <button
        type="button"
        class="btn btn-outline-secondary"
        :disabled="!canUndo"
        title="Undo (Ctrl+Z)"
        data-testid="pcb-undo"
        @mousedown.prevent
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
        @mousedown.prevent
        @click="tracks.redo()"
      >
        <BiRedo />
      </button>
    </div>

    <button
      type="button"
      class="btn btn-sm btn-outline-danger"
      :disabled="!presetItems.length"
      title="Remove all tracks (Ctrl+Z brings them back)"
      data-testid="pcb-clear-tracks"
      @mousedown.prevent
      @click="tracks.clearAll()"
    >
      <BiTrash3 /> Clear
    </button>

    <!-- a narrow toolbar wraps here: tools and actions, then new-track settings -->
    <span class="row-break" aria-hidden="true"></span>

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
        :title="`Draw new tracks on ${layer}`"
        :data-testid="`pcb-route-layer-${layer}`"
        @click="editorSettings.layer = layer"
      >
        <span class="layer-swatch"></span>{{ layer }}
      </button>
    </div>

    <label
      class="toolbar-field"
      title="Width of new tracks, mm (W / Shift+W: next / previous preset)"
    >
      <span>Width</span>
      <CustomNumberInput
        v-model="editorSettings.width"
        :step="0.05"
        :min="0.1"
        :max="2"
        :value-on-clear="0.25"
        size="compact"
        data-testid="pcb-track-width"
      />
    </label>

    <label class="toolbar-field" title="Snap grid for drawing, mm">
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
        :title="`New tracks bend at ${p}° (/ flips the corner while routing)`"
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
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.375rem;
  height: 100%;
  white-space: nowrap;
  overflow-x: auto;
  scrollbar-width: thin;
}

.track-editor-toolbar > * {
  flex-shrink: 0;
}

.row-break {
  display: none;
}

@container (max-width: 870px) {
  .track-editor-toolbar {
    flex-wrap: wrap;
    align-content: center;
    row-gap: 0.375rem;
  }

  .row-break {
    display: block;
    flex-basis: 100%;
    height: 0;
  }
}

.group-caption {
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--bs-secondary-color);
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
  width: 4.5rem;
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
