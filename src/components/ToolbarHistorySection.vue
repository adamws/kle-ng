<template>
  <div class="toolbar-section">
    <label class="section-label">History</label>
    <div class="tool-buttons">
      <button
        class="tool-button"
        data-testid="toolbar-undo"
        @click="$emit('undo')"
        :disabled="!canUndo"
        title="Undo"
      >
        <BiArrowCounterclockwise />
      </button>

      <button
        class="tool-button"
        data-testid="toolbar-redo"
        @click="$emit('redo')"
        :disabled="!canRedo"
        title="Redo"
      >
        <BiArrowClockwise />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import BiArrowCounterclockwise from 'bootstrap-icons/icons/arrow-counterclockwise.svg'
import BiArrowClockwise from 'bootstrap-icons/icons/arrow-clockwise.svg'

defineProps<{
  canUndo: boolean
  canRedo: boolean
}>()

defineEmits<{
  undo: []
  redo: []
}>()
</script>
