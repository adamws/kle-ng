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
        <i class="bi bi-arrow-counterclockwise"></i>
      </button>

      <button
        class="tool-button"
        data-testid="toolbar-redo"
        @click="$emit('redo')"
        :disabled="!canRedo"
        title="Redo"
      >
        <i class="bi bi-arrow-clockwise"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  canUndo: boolean
  canRedo: boolean
}>()

defineEmits<{
  undo: []
  redo: []
}>()
</script>
