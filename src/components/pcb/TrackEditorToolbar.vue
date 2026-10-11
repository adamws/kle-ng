<!--
  TrackEditorToolbar: the drawing controls of the track editor (tool, history,
  copper layer, track width and posture). View controls (layer visibility,
  grid, zoom) sit on the canvas instead. Shortcuts are listed in the
  titles. The Via tool places free vias; while routing it is disabled and V
  places a via at the cursor instead. Buttons that can disable themselves
  (undo, redo, clear) don't
  take the focus on a click: a disabled focused button would drop it out of the
  editor, and its shortcuts with it. It keeps one height in every state, so the canvas below never moves:
  one line, or its two rows stacked in a narrow preview (whose row is then two lines high); a
  narrower one shows icons only.

  Clearance is not editable: kle-ng-api boards use KiCad's default netclass
  (0.2 mm), so a smaller value would only make presets kbplacer rejects.
-->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePcbTracksStore } from '@/stores/pcbTracks'
import CustomNumberInput from '../CustomNumberInput.vue'
import BiBezier2 from 'bootstrap-icons/icons/bezier2.svg'
import BiCursor from 'bootstrap-icons/icons/cursor.svg'
import BiUndo from 'bootstrap-icons/icons/arrow-counterclockwise.svg'
import BiRedo from 'bootstrap-icons/icons/arrow-clockwise.svg'
import BiTrash3 from 'bootstrap-icons/icons/trash3.svg'
import BiRecordCircle from 'bootstrap-icons/icons/record-circle.svg'
import BiBorderWidth from 'bootstrap-icons/icons/border-width.svg'

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
    <!-- tools and actions -->
    <div class="toolbar-row">
      <span class="group-caption">Draw</span>
      <div class="btn-group btn-group-sm" role="group" aria-label="Tool">
        <button
          type="button"
          class="btn btn-toggle"
          :aria-pressed="tool === 'select'"
          title="Select tracks (click, Shift+click, drag a box); click a pad to highlight its net, or an unrouted pad to start a track"
          data-testid="pcb-tool-select"
          @click="tracks.setTool('select')"
        >
          <BiCursor /> <span class="btn-label">Select</span>
        </button>
        <button
          type="button"
          class="btn btn-toggle"
          :aria-pressed="tool === 'route'"
          title="Route tracks (X)"
          data-testid="pcb-tool-route"
          @click="tracks.setTool('route')"
        >
          <BiBezier2 /> <span class="btn-label">Route</span>
        </button>
        <button
          type="button"
          class="btn btn-toggle"
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
          <BiRecordCircle /> <span class="btn-label">Via</span>
        </button>
      </div>

      <div class="btn-group btn-group-sm" role="group" aria-label="History">
        <button
          type="button"
          class="btn btn-toggle"
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
          class="btn btn-toggle"
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
        title="Clear: remove all tracks (Ctrl+Z brings them back)"
        data-testid="pcb-clear-tracks"
        @mousedown.prevent
        @click="tracks.clearAll()"
      >
        <BiTrash3 /> <span class="btn-label">Clear</span>
      </button>
    </div>

    <!-- how new tracks are drawn -->
    <div class="toolbar-row">
      <div class="btn-group btn-group-sm" role="group" aria-label="Copper layer">
        <button
          v-for="layer in ['F.Cu', 'B.Cu'] as const"
          :key="layer"
          type="button"
          class="btn btn-toggle"
          :class="layer === 'F.Cu' ? 'layer-front' : 'layer-back'"
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
        <BiBorderWidth class="field-icon" aria-hidden="true" />
        <span class="field-label">Width</span>
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

      <div class="btn-group btn-group-sm" role="group" aria-label="Posture">
        <button
          v-for="p in ['45', '90'] as const"
          :key="p"
          type="button"
          class="btn btn-toggle"
          :aria-pressed="editorSettings.posture === p"
          :title="`New tracks bend at ${p}° (/ flips the corner while routing)`"
          :data-testid="`pcb-posture-${p}`"
          @click="editorSettings.posture = p"
        >
          {{ p }}°
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* one line; two stacked rows of fixed height when that doesn't fit, so a wrap
   never makes the toolbar taller than its row (FootprintPreview's breakpoints) */
.track-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 0.25rem 0.75rem;
  height: 100%;
  white-space: nowrap;
}

.toolbar-row {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.375rem;
  height: 2rem;
  min-width: 0;
  /* only narrower than the narrowest layout: scroll rather than clip */
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.toolbar-row > * {
  flex-shrink: 0;
}

.field-icon {
  display: none;
}

@container (max-width: 760px) {
  .track-editor-toolbar {
    flex-direction: column;
    align-items: stretch;
    justify-content: center;
  }
}

/* icons only; the titles still name them */
@container (max-width: 480px) {
  .btn-label,
  .field-label {
    display: none;
  }

  .field-icon {
    display: inline;
  }

  .toolbar-field :deep(.custom-number-input) {
    width: 4.25rem;
  }
}

/* the layer names still tell them apart */
@container (max-width: 360px) {
  .toolbar-row .layer-swatch {
    display: none;
  }
}

.group-caption {
  /* like the layout editor toolbar's section labels */
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--bs-body-color);
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
  font-size: 0.875rem;
  color: var(--bs-body-color);
}

.toolbar-field :deep(.custom-number-input) {
  width: 5rem;
}
</style>
