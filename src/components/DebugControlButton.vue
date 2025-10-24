<template>
  <div v-if="isDevMode" class="debug-control-button-container">
    <button
      type="button"
      class="debug-control-button btn btn-sm"
      @click="toggleModal"
      title="Debug Geometry Tools"
    >
      <i class="bi bi-bug"></i>
    </button>

    <DebugActionsModal
      v-if="showModal"
      :visible="showModal"
      @close="showModal = false"
      :debugOverlayRef="debugOverlayRef"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { type Key } from '@/stores/keyboard'
import DebugActionsModal from './DebugActionsModal.vue'

interface DebugOverlayRef {
  setDebugOptions: (options: {
    markerSize?: number
    markerColor?: string
    showLabels?: boolean
    showDistances?: boolean
  }) => void
  clearDebugMarkers: () => void
  drawDebugLine: (lineData: {
    point1: { x: number; y: number }
    point2: { x: number; y: number }
    lineColor: string
    showKeyLabels: boolean
    intersectingKeys: Key[]
  }) => void
  clearDebugLine: () => void
}

interface Props {
  debugOverlayRef?: DebugOverlayRef
}

defineProps<Props>()

const isDevMode = import.meta.env.DEV
const showModal = ref(false)

const toggleModal = () => {
  showModal.value = !showModal.value
}
</script>

<style scoped>
.debug-control-button-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  z-index: 1000;
}

.debug-control-button {
  background-color: #6c757d;
  color: white;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;
}

.debug-control-button:hover {
  background-color: #5a6268;
  transform: scale(1.05);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.debug-control-button:active {
  transform: scale(0.95);
}
</style>
