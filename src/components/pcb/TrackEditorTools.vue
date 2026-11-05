<!--
  TrackEditorTools: the track editor's tools in a vertical strip docked on the
  canvas's right edge, like KiCad's right toolbar (Select, Route tracks, Add
  vias), with undo, redo and Clear apart at its foot. Icons only; the tooltips
  name them and list their shortcuts. The Via tool places free vias; while
  routing it is disabled and V places a via at the cursor instead. The buttons
  that can disable themselves (undo, redo, Clear) don't take the focus on a
  click: a disabled focused button would drop it out of the editor, and its
  shortcuts with it.
-->
<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { usePcbTracksStore } from '@/stores/pcbTracks'
import BiCursor from 'bootstrap-icons/icons/cursor.svg'
import PcbIcon from './PcbIcon.vue'
import { vTooltip } from '@/directives/vTooltip'
import BiTrash3 from 'bootstrap-icons/icons/trash3.svg'
import BiUndo from 'bootstrap-icons/icons/arrow-counterclockwise.svg'
import BiRedo from 'bootstrap-icons/icons/arrow-clockwise.svg'

const tracks = usePcbTracksStore()
const { tool, isRouting, presetItems, canUndo, canRedo } = storeToRefs(tracks)
</script>

<template>
  <div
    class="pcb-toolstrip pcb-toolstrip-right"
    role="toolbar"
    aria-label="Tools"
    aria-orientation="vertical"
    data-testid="pcb-track-tools"
    @pointerdown.stop
  >
    <button
      type="button"
      class="btn btn-sm btn-toggle"
      :aria-pressed="tool === 'select'"
      aria-label="Select"
      v-tooltip:left="
        'Select tracks (click, Shift+click, drag a box); click a pad to highlight its net, or an unrouted pad to start a track'
      "
      data-testid="pcb-tool-select"
      @click="tracks.setTool('select')"
    >
      <BiCursor />
    </button>
    <button
      type="button"
      class="btn btn-sm btn-toggle"
      :aria-pressed="tool === 'route'"
      aria-label="Route tracks"
      v-tooltip:left="'Route tracks (X)'"
      data-testid="pcb-tool-route"
      @click="tracks.setTool('route')"
    >
      <PcbIcon name="route" />
    </button>
    <button
      type="button"
      class="btn btn-sm btn-toggle"
      :aria-pressed="tool === 'via'"
      :disabled="isRouting"
      aria-label="Add vias"
      v-tooltip:left="
        isRouting
          ? 'While routing, press V to place a via at the cursor and continue on the other layer'
          : 'Add vias: click to place one (Esc: back to Select)'
      "
      data-testid="pcb-tool-via"
      @click="tracks.setTool('via')"
    >
      <PcbIcon name="via" />
    </button>

    <button
      type="button"
      class="btn btn-sm btn-toggle history-btn"
      :disabled="!canUndo"
      aria-label="Undo"
      v-tooltip:left="'Undo (Ctrl+Z)'"
      data-testid="pcb-undo"
      @mousedown.prevent
      @click="tracks.undo()"
    >
      <BiUndo />
    </button>
    <button
      type="button"
      class="btn btn-sm btn-toggle"
      :disabled="!canRedo"
      aria-label="Redo"
      v-tooltip:left="'Redo (Ctrl+Shift+Z, Ctrl+Y)'"
      data-testid="pcb-redo"
      @mousedown.prevent
      @click="tracks.redo()"
    >
      <BiRedo />
    </button>
    <span class="pcb-toolstrip-separator" aria-hidden="true"></span>
    <button
      type="button"
      class="btn btn-sm btn-outline-danger"
      :disabled="!presetItems.length"
      aria-label="Clear"
      v-tooltip:left="'Clear: remove all tracks (Ctrl+Z brings them back)'"
      data-testid="pcb-clear-tracks"
      @mousedown.prevent
      @click="tracks.clearAll()"
    >
      <BiTrash3 />
    </button>
  </div>
</template>

<style scoped>
/* apart from the tools, at the foot */
.history-btn {
  margin-top: auto;
}
</style>
