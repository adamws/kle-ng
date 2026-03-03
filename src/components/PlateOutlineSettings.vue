<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { usePlateGeneratorStore } from '@/stores/plateGenerator'
import { storeToRefs } from 'pinia'
import CustomNumberInput from './CustomNumberInput.vue'
import type { OutlineSegment } from '@/types/plate'
import BiTrash from 'bootstrap-icons/icons/trash.svg'

const plateStore = usePlateGeneratorStore()
const { settings, hoveredCornerId } = storeToRefs(plateStore)

onMounted(() => { plateStore.outlineTabActive = true })
onUnmounted(() => { plateStore.outlineTabActive = false })

const isRectangle = computed(() => settings.value.outline.type === 'rectangle')
const isCustom = computed(() => settings.value.outline.type === 'custom')
const isActive = computed(() => settings.value.outline.type !== 'none')

function generateCornerId(): string {
  return `seg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

function addCorner(): void {
  const corner: OutlineSegment = { id: generateCornerId(), x: 0, y: 0 }
  settings.value.outline.custom.segments.push(corner)
}

function removeCorner(id: string): void {
  const idx = settings.value.outline.custom.segments.findIndex((s) => s.id === id)
  if (idx !== -1) settings.value.outline.custom.segments.splice(idx, 1)
}

function removeAllCorners(): void {
  settings.value.outline.custom.segments = []
}
</script>

<template>
  <div class="plate-outline-settings">
    <div class="settings-section">
      <!-- Outline Mode -->
      <div class="mb-2">
        <label for="outlineMode" class="form-label form-label-sm">Outline Mode</label>
        <select id="outlineMode" v-model="settings.outline.type" class="form-select form-select-sm">
          <option value="none">None</option>
          <option value="rectangle">Rectangle</option>
          <option value="custom">Custom</option>
        </select>
        <div class="form-text small">
          <span v-if="settings.outline.type === 'none'">No outline generated</span>
          <span v-else-if="settings.outline.type === 'rectangle'"
            >Rectangular outline with configurable margins</span
          >
          <span v-else>Custom polygon defined by explicit corner points</span>
        </div>
      </div>

      <!-- Rectangle Mode Settings -->
      <template v-if="isRectangle">
        <!-- Margins -->
        <div class="mb-2">
          <label class="form-label form-label-sm">Margins</label>
          <div class="margins-grid">
            <div class="margin-input">
              <label for="marginTop" class="form-label form-label-sm margin-sub-label">Top</label>
              <CustomNumberInput
                id="marginTop"
                v-model="settings.outline.marginTop"
                :step="0.5"
                :min="0"
                class="form-control form-control-sm"
                size="default"
                title="Top margin in millimeters"
              >
                <template #suffix>mm</template>
              </CustomNumberInput>
            </div>
            <div class="margin-input">
              <label for="marginBottom" class="form-label form-label-sm margin-sub-label"
                >Bottom</label
              >
              <CustomNumberInput
                id="marginBottom"
                v-model="settings.outline.marginBottom"
                :step="0.5"
                :min="0"
                class="form-control form-control-sm"
                size="default"
                title="Bottom margin in millimeters"
              >
                <template #suffix>mm</template>
              </CustomNumberInput>
            </div>
            <div class="margin-input">
              <label for="marginLeft" class="form-label form-label-sm margin-sub-label">Left</label>
              <CustomNumberInput
                id="marginLeft"
                v-model="settings.outline.marginLeft"
                :step="0.5"
                :min="0"
                class="form-control form-control-sm"
                size="default"
                title="Left margin in millimeters"
              >
                <template #suffix>mm</template>
              </CustomNumberInput>
            </div>
            <div class="margin-input">
              <label for="marginRight" class="form-label form-label-sm margin-sub-label"
                >Right</label
              >
              <CustomNumberInput
                id="marginRight"
                v-model="settings.outline.marginRight"
                :step="0.5"
                :min="0"
                class="form-control form-control-sm"
                size="default"
                title="Right margin in millimeters"
              >
                <template #suffix>mm</template>
              </CustomNumberInput>
            </div>
          </div>
          <div class="form-text small">Distance from cutout bounds to outline edge</div>
        </div>

        <!-- Fillet Radius -->
        <div class="mb-2">
          <label for="outlineFilletRadius" class="form-label form-label-sm">Fillet Radius</label>
          <CustomNumberInput
            id="outlineFilletRadius"
            v-model="settings.outline.filletRadius"
            :step="0.5"
            :min="0"
            class="form-control form-control-sm"
            size="default"
            title="Corner rounding radius for outline in millimeters"
          >
            <template #suffix>mm</template>
          </CustomNumberInput>
          <div class="form-text small">Corner rounding radius (0 = sharp corners)</div>
        </div>
      </template>

      <!-- Custom Mode Settings -->
      <template v-if="isCustom">
        <div class="mb-2">
          <div class="corners-header">
            <label class="form-label form-label-sm mb-0">Corners</label>
            <div class="corners-buttons">
              <button
                type="button"
                class="btn btn-sm btn-outline-primary"
                title="Add a corner point"
                @click="addCorner"
              >
                Add
              </button>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger"
                :disabled="settings.outline.custom.segments.length === 0"
                title="Remove all corners"
                @click="removeAllCorners"
              >
                Remove All
              </button>
            </div>
          </div>

          <div
            v-if="settings.outline.custom.segments.length === 0"
            class="corners-empty form-text small"
          >
            No corners. Add at least 2 to define a shape.
          </div>

          <div v-else class="corners-list">
            <div
              v-for="(seg, index) in settings.outline.custom.segments"
              :key="seg.id"
              class="corner-item"
              :class="{ highlighted: hoveredCornerId === seg.id }"
              @mouseenter="hoveredCornerId = seg.id"
              @mouseleave="hoveredCornerId = null"
            >
              <span class="corner-index">{{ index + 1 }}</span>
              <div class="corner-input-group">
                <label class="form-label form-label-sm margin-sub-label">X</label>
                <CustomNumberInput
                  v-model="seg.x"
                  :step="0.25"
                  class="form-control form-control-sm"
                  size="compact"
                  title="X position in keyboard units (+X right)"
                >
                  <template #suffix>U</template>
                </CustomNumberInput>
              </div>
              <div class="corner-input-group">
                <label class="form-label form-label-sm margin-sub-label">Y</label>
                <CustomNumberInput
                  v-model="seg.y"
                  :step="0.25"
                  class="form-control form-control-sm"
                  size="compact"
                  title="Y position in keyboard units (+Y down)"
                >
                  <template #suffix>U</template>
                </CustomNumberInput>
              </div>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger remove-corner-btn"
                title="Remove this corner"
                @click="removeCorner(seg.id)"
              >
                <BiTrash />
              </button>
            </div>
          </div>

          <div class="form-text small">
            Positions in keyboard units (U) relative to first key center. +X right, +Y down. Shape
            auto-closes.
          </div>
        </div>

        <!-- Snap Grid -->
        <div class="mb-2">
          <label for="gridSize" class="form-label form-label-sm">Snap Grid</label>
          <CustomNumberInput
            id="gridSize"
            v-model="settings.outline.custom.gridSize"
            :step="0.25"
            :min="0.25"
            size="default"
            title="Snap grid size in keyboard units"
          >
            <template #suffix>U</template>
          </CustomNumberInput>
          <div class="form-text small">Corner snap increment in keyboard units</div>
        </div>
      </template>

      <!-- Merge with Cutouts (shared: rectangle + custom) -->
      <div v-if="isActive" class="mb-2">
        <div class="form-check">
          <input
            id="mergeWithCutouts"
            v-model="settings.outline.mergeWithCutouts"
            class="form-check-input"
            type="checkbox"
          />
          <label class="form-check-label form-label-sm" for="mergeWithCutouts"
            >Merge with Cutouts</label
          >
        </div>
        <div class="form-text small">Download outline and cutouts as a single file</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.plate-outline-settings {
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

.margins-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.5rem;
}

.margin-input {
  display: flex;
  flex-direction: column;
}

.margin-sub-label {
  font-weight: 400;
  font-size: 0.8rem;
  margin-bottom: 0.1rem;
}

.corners-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.4rem;
}

.corners-buttons {
  display: flex;
  gap: 0.375rem;
}

.corners-empty {
  padding: 0.5rem;
  text-align: center;
  border: 1px dashed var(--bs-border-color);
  border-radius: 0.25rem;
}

.corners-list {
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--bs-border-color);
  border-radius: 0.25rem;
  padding: 0.5rem;
}

.corner-item {
  display: grid;
  grid-template-columns: 1.25rem 1fr 1fr auto;
  gap: 0.375rem;
  align-items: end;
  padding: 0.375rem 0;
  border-bottom: 1px solid var(--bs-border-color-translucent);
}

.corner-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.corner-item:first-child {
  padding-top: 0;
}

.corner-index {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  text-align: right;
  padding-bottom: 0.3rem;
  line-height: 1;
  align-self: end;
}

.corner-input-group {
  display: flex;
  flex-direction: column;
}

.remove-corner-btn {
  display: flex;
  align-items: center;
  padding: 0.2rem 0.5rem;
  line-height: 1;
  font-size: 1rem;
  align-self: end;
}

.corner-item.highlighted {
  background: rgba(0, 102, 204, 0.08);
  border-radius: 4px;
}

/* Ensure consistent spacing */
.mb-2:last-child {
  margin-bottom: 0 !important;
}
</style>
