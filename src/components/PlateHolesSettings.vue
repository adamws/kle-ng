<script setup lang="ts">
import { usePlateGeneratorStore } from '@/stores/plateGenerator'
import { storeToRefs } from 'pinia'
import CustomNumberInput from './CustomNumberInput.vue'
import type { CustomHole } from '@/types/plate'

const plateStore = usePlateGeneratorStore()
const { settings } = storeToRefs(plateStore)

function generateHoleId(): string {
  return `hole_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function addCustomHole(): void {
  const newHole: CustomHole = {
    id: generateHoleId(),
    type: 'hole',
    diameter: 3,
    offsetX: 0,
    offsetY: 0,
    endOffsetX: 0,
    endOffsetY: 0,
  }
  settings.value.customHoles.holes.push(newHole)
}

function removeCustomHole(id: string): void {
  const index = settings.value.customHoles.holes.findIndex((h) => h.id === id)
  if (index !== -1) {
    settings.value.customHoles.holes.splice(index, 1)
  }
}

function removeAllCustomHoles(): void {
  settings.value.customHoles.holes = []
}
</script>

<template>
  <div class="plate-holes-settings">
    <div class="settings-section">
      <!-- Corner Mounting Holes -->
      <div class="mb-2">
        <div class="form-check">
          <input
            id="enableMountingHoles"
            v-model="settings.mountingHoles.enabled"
            class="form-check-input"
            type="checkbox"
            :disabled="!settings.outline.enabled"
          />
          <label class="form-check-label form-label-sm" for="enableMountingHoles"
            >Corner Mounting Holes</label
          >
        </div>
        <div class="form-text small">Add circular holes at each corner of the outline</div>
      </div>

      <!-- Mounting Hole Settings -->
      <div class="mb-2">
        <div class="holes-grid">
          <div class="hole-input">
            <label for="mountingHoleDiameter" class="form-label form-label-sm sub-label"
              >Diameter</label
            >
            <CustomNumberInput
              id="mountingHoleDiameter"
              v-model="settings.mountingHoles.diameter"
              :step="0.5"
              :min="0.5"
              :disabled="!settings.outline.enabled || !settings.mountingHoles.enabled"
              class="form-control form-control-sm"
              size="default"
              title="Mounting hole diameter in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
          </div>
          <div class="hole-input">
            <label for="mountingHoleEdgeDistance" class="form-label form-label-sm sub-label"
              >Edge Distance</label
            >
            <CustomNumberInput
              id="mountingHoleEdgeDistance"
              v-model="settings.mountingHoles.edgeDistance"
              :step="0.5"
              :min="0.5"
              :disabled="!settings.outline.enabled || !settings.mountingHoles.enabled"
              class="form-control form-control-sm"
              size="default"
              title="Distance from outline edge to hole center in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
          </div>
        </div>
        <div class="form-text small">Requires outline to be enabled (for corner positions)</div>
      </div>

      <!-- Custom Holes Section -->
      <div class="section-divider"></div>

      <div class="mb-2">
        <div class="custom-holes-header">
          <div class="form-check">
            <input
              id="enableCustomHoles"
              v-model="settings.customHoles.enabled"
              class="form-check-input"
              type="checkbox"
            />
            <label class="form-check-label form-label-sm" for="enableCustomHoles"
              >Custom Holes &amp; Slots</label
            >
          </div>
          <div class="custom-holes-buttons">
            <button
              type="button"
              class="btn btn-sm btn-outline-primary"
              :disabled="!settings.customHoles.enabled"
              @click="addCustomHole"
            >
              Add
            </button>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger"
              :disabled="!settings.customHoles.enabled || settings.customHoles.holes.length === 0"
              @click="removeAllCustomHoles"
            >
              Remove All
            </button>
          </div>
        </div>
        <div class="form-text small">Add holes and slots at arbitrary positions</div>
      </div>

      <!-- Custom Holes List -->
      <div
        v-if="settings.customHoles.holes.length > 0"
        class="custom-holes-list"
        :class="{ disabled: !settings.customHoles.enabled }"
      >
        <div v-for="hole in settings.customHoles.holes" :key="hole.id" class="custom-hole-item">
          <div class="hole-header-row">
            <div class="hole-input-group">
              <label class="form-label form-label-sm sub-label">Type</label>
              <select
                v-model="hole.type"
                class="form-select form-select-sm compact-select"
                :disabled="!settings.customHoles.enabled"
              >
                <option value="hole">Hole</option>
                <option value="slot">Slot</option>
              </select>
            </div>
            <div class="hole-input-group">
              <label class="form-label form-label-sm sub-label">Diameter</label>
              <CustomNumberInput
                v-model="hole.diameter"
                :step="0.5"
                :min="0.5"
                :disabled="!settings.customHoles.enabled"
                class="form-control form-control-sm"
                size="compact"
                title="Hole diameter in millimeters"
              >
                <template #suffix>mm</template>
              </CustomNumberInput>
            </div>
            <button
              type="button"
              class="btn btn-sm btn-outline-danger remove-hole-btn"
              :disabled="!settings.customHoles.enabled"
              title="Remove this item"
              @click="removeCustomHole(hole.id)"
            >
              &times;
            </button>
          </div>
          <div v-if="hole.type === 'slot'" class="slot-inputs">
            <div class="hole-input-group">
              <label class="form-label form-label-sm sub-label">Start X</label>
              <CustomNumberInput
                v-model="hole.offsetX"
                :step="0.25"
                :disabled="!settings.customHoles.enabled"
                class="form-control form-control-sm"
                size="compact"
                title="Start X in keyboard units (U)"
              >
                <template #suffix>U</template>
              </CustomNumberInput>
            </div>
            <div class="hole-input-group">
              <label class="form-label form-label-sm sub-label">Start Y</label>
              <CustomNumberInput
                v-model="hole.offsetY"
                :step="0.25"
                :disabled="!settings.customHoles.enabled"
                class="form-control form-control-sm"
                size="compact"
                title="Start Y in keyboard units (U)"
              >
                <template #suffix>U</template>
              </CustomNumberInput>
            </div>
            <div class="hole-input-group">
              <label class="form-label form-label-sm sub-label">End X</label>
              <CustomNumberInput
                v-model="hole.endOffsetX"
                :step="0.25"
                :disabled="!settings.customHoles.enabled"
                class="form-control form-control-sm"
                size="compact"
                title="End X in keyboard units (U)"
              >
                <template #suffix>U</template>
              </CustomNumberInput>
            </div>
            <div class="hole-input-group">
              <label class="form-label form-label-sm sub-label">End Y</label>
              <CustomNumberInput
                v-model="hole.endOffsetY"
                :step="0.25"
                :disabled="!settings.customHoles.enabled"
                class="form-control form-control-sm"
                size="compact"
                title="End Y in keyboard units (U)"
              >
                <template #suffix>U</template>
              </CustomNumberInput>
            </div>
          </div>
          <div v-else class="hole-inputs">
            <div class="hole-input-group">
              <label class="form-label form-label-sm sub-label">X Offset</label>
              <CustomNumberInput
                v-model="hole.offsetX"
                :step="0.25"
                :disabled="!settings.customHoles.enabled"
                class="form-control form-control-sm"
                size="compact"
                title="X offset from origin in keyboard units (U)"
              >
                <template #suffix>U</template>
              </CustomNumberInput>
            </div>
            <div class="hole-input-group">
              <label class="form-label form-label-sm sub-label">Y Offset</label>
              <CustomNumberInput
                v-model="hole.offsetY"
                :step="0.25"
                :disabled="!settings.customHoles.enabled"
                class="form-control form-control-sm"
                size="compact"
                title="Y offset from origin in keyboard units (U)"
              >
                <template #suffix>U</template>
              </CustomNumberInput>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plate-holes-settings {
  padding: 0;
}

.form-label-sm {
  font-size: 0.875rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.settings-section {
  padding-top: 0;
  padding-bottom: 0;
}

.holes-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.hole-input {
  display: flex;
  flex-direction: column;
}

.sub-label {
  font-weight: 400;
  font-size: 0.8rem;
  margin-bottom: 0.1rem;
}

/* Ensure consistent spacing */
.mb-2:last-child {
  margin-bottom: 0 !important;
}

.section-divider {
  border-top: 1px solid var(--bs-border-color);
  margin: 0.75rem 0;
}

.custom-holes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.custom-holes-buttons {
  display: flex;
  gap: 0.5rem;
}

.custom-holes-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.25rem;
  padding: 0.5rem;
}

.custom-holes-list.disabled {
  opacity: 0.6;
  pointer-events: none;
}

.custom-hole-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--bs-border-color-translucent);
}

.custom-hole-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.custom-hole-item:first-child {
  padding-top: 0;
}

.hole-header-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 0.5rem;
  align-items: end;
}

.hole-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
  align-items: end;
  margin-top: 0.35rem;
}

.slot-inputs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr 1fr;
  gap: 0.5rem;
  align-items: end;
  margin-top: 0.35rem;
}

.compact-select {
  font-size: 0.8rem;
  padding: 0.2rem 0.4rem;
}

.hole-input-group {
  display: flex;
  flex-direction: column;
}

.remove-hole-btn {
  padding: 0.2rem 0.5rem;
  line-height: 1;
  font-size: 1rem;
  align-self: end;
  margin-bottom: 0.1rem;
}
</style>
