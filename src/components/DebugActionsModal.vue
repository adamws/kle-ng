<template>
  <div v-if="visible" class="debug-panel" @click.stop>
    <div class="panel-header">
      <span>Debug Tools</span>
      <button class="close-btn" @click="$emit('close')" title="Close">×</button>
    </div>

    <div class="panel-body">
      <!-- Line Drawing Section -->
      <div class="section">
        <div class="line-inputs">
          <div class="input-with-label">
            <label>x1</label>
            <CustomNumberInput
              v-model="lineOptions.point1.x"
              :step="0.1"
              placeholder="X1"
              class="form-control form-control-sm"
            />
          </div>
          <div class="input-with-label">
            <label>y1</label>
            <CustomNumberInput
              v-model="lineOptions.point1.y"
              :step="0.1"
              placeholder="Y1"
              class="form-control form-control-sm"
            />
          </div>
          <div class="input-with-label">
            <label>x2</label>
            <CustomNumberInput
              v-model="lineOptions.point2.x"
              :step="0.1"
              placeholder="X2"
              class="form-control form-control-sm"
            />
          </div>
          <div class="input-with-label">
            <label>y2</label>
            <CustomNumberInput
              v-model="lineOptions.point2.y"
              :step="0.1"
              placeholder="Y2"
              class="form-control form-control-sm"
            />
          </div>
        </div>
        <div class="input-with-label full-width">
          <label>Sensitivity (0.0 = permissive, 1.0 = strict)</label>
          <CustomNumberInput
            v-model="lineOptions.sensitivity"
            :step="0.1"
            :min="0"
            :max="1"
            placeholder="Sensitivity"
            class="form-control form-control-sm"
          />
        </div>
        <label>
          <input v-model="lineOptions.showKeyLabels" type="checkbox" />
          Key Labels
        </label>
        <button @click="drawLine">Draw Line</button>
      </div>

      <!-- Clear All Section -->
      <div class="section">
        <button @click="clearAll" class="clear-btn">Clear All</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useKeyboardStore, type Key } from '@/stores/keyboard'
import { findKeysAlongLine } from '@/utils/line-intersection'
import CustomNumberInput from '@/components/CustomNumberInput.vue'

interface DebugOverlayRef {
  drawDebugLine: (lineData: {
    point1: { x: number; y: number }
    point2: { x: number; y: number }
    lineColor: string
    showKeyLabels: boolean
    intersectingKeys: Key[]
  }) => void
  clearDebugLine: () => void
  isMatrixOverlayActive?: () => boolean
}

interface Props {
  visible: boolean
  debugOverlayRef?: DebugOverlayRef
}

const props = defineProps<Props>()
defineEmits<{
  (e: 'close'): void
}>()

const keyboardStore = useKeyboardStore()

const lineOptions = ref({
  point1: { x: 0, y: 0 },
  point2: { x: 5, y: 5 },
  lineColor: '#ff0000',
  showKeyLabels: true,
  sensitivity: 0.0,
})

const drawLine = () => {
  if (props.debugOverlayRef) {
    const intersectingKeys = findKeysAlongLine(
      lineOptions.value.point1,
      lineOptions.value.point2,
      keyboardStore.keys,
      lineOptions.value.sensitivity,
    )

    props.debugOverlayRef.drawDebugLine({
      point1: lineOptions.value.point1,
      point2: lineOptions.value.point2,
      lineColor: lineOptions.value.lineColor,
      showKeyLabels: lineOptions.value.showKeyLabels,
      intersectingKeys,
    })
  }
}

const clearLine = () => {
  if (props.debugOverlayRef) {
    props.debugOverlayRef.clearDebugLine()
  }
}

const clearAll = () => {
  clearLine()
}
</script>

<style scoped>
.debug-panel {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: white;
  border: 1px solid #999;
  border-radius: 4px;
  padding: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  z-index: 10000;
  min-width: 200px;
  font-size: 13px;
  pointer-events: auto;
}

.panel-body {
  pointer-events: auto;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 4px;
  border-bottom: 1px solid #ddd;
  font-weight: bold;
  font-size: 14px;
}

.close-btn {
  background: none !important;
  border: none !important;
  color: #666 !important;
  font-size: 24px !important;
  line-height: 1 !important;
  padding: 0 !important;
  margin: 0 !important;
  width: 20px !important;
  height: 20px !important;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #000 !important;
}

.section {
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #eee;
}

.section:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

label {
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  margin-bottom: 4px;
  user-select: none;
}

input[type='checkbox'] {
  cursor: pointer;
  margin: 0;
}

.line-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  margin-bottom: 4px;
}

.input-with-label {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.input-with-label.full-width {
  grid-column: 1 / -1;
  margin-bottom: 4px;
}

.input-with-label > label {
  font-size: 10px;
  font-weight: 600;
  margin: 0;
  padding: 0;
  cursor: default;
  color: #666;
}

.line-inputs :deep(.custom-number-input) {
  width: 100%;
  font-size: 11px;
}

.line-inputs :deep(.custom-number-input input) {
  font-size: 11px;
  padding: 2px 4px;
}

.line-inputs :deep(.spinner-buttons) {
  width: 14px;
}

.line-inputs :deep(.spinner-btn) {
  height: 10px;
  font-size: 8px;
}

button {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid #007bff;
  border-radius: 3px;
  background: #007bff;
  color: white;
  cursor: pointer;
  font-size: 12px;
  margin-top: 2px;
}

button:hover {
  background: #0056b3;
  border-color: #0056b3;
}

button:active {
  transform: scale(0.98);
}

button.active {
  background: #28a745;
  border-color: #28a745;
}

button.active:hover {
  background: #218838;
  border-color: #218838;
}

.clear-btn {
  background: #dc3545;
  border-color: #dc3545;
}

.clear-btn:hover {
  background: #c82333;
  border-color: #c82333;
}
</style>
