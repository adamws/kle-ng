<script setup lang="ts">
import { usePlateGeneratorStore } from '@/stores/plateGenerator'
import { storeToRefs } from 'pinia'
import CustomNumberInput from './CustomNumberInput.vue'

const plateStore = usePlateGeneratorStore()
const { settings } = storeToRefs(plateStore)
</script>

<template>
  <div class="plate-outline-settings">
    <div class="settings-section">
      <!-- Outline Type -->
      <div class="mb-2 d-flex align-items-center gap-2">
        <label for="outlineType" class="form-label form-label-sm mb-0 flex-shrink-0"
          >Outline Type</label
        >
        <select
          id="outlineType"
          v-model="settings.outline.outlineType"
          class="form-select form-select-sm"
        >
          <option value="none">None</option>
          <option value="rectangular" title="Axis-aligned bounding box">Rectangular</option>
          <option value="tight" title="Expanded hull that follows key cluster shape">Tight</option>
        </select>
      </div>

      <!-- Merge with Cutouts -->
      <div class="mb-2">
        <div class="form-check">
          <input
            id="mergeWithCutouts"
            v-model="settings.outline.mergeWithCutouts"
            class="form-check-input"
            type="checkbox"
            :disabled="settings.outline.outlineType === 'none'"
          />
          <label class="form-check-label form-label-sm" for="mergeWithCutouts"
            >Merge with Cutouts</label
          >
        </div>
        <div class="form-text small">
          Outline and cutouts in a single file. Off: separate files, downloaded together as a .zip
        </div>
      </div>

      <!-- Rectangular: 4-directional margins -->
      <div v-show="settings.outline.outlineType === 'rectangular'" class="mb-2">
        <label class="form-label form-label-sm">Margins</label>
        <div class="margins-grid">
          <div class="margin-input">
            <label for="marginTop" class="form-label form-label-sm margin-sub-label">Top</label>
            <CustomNumberInput
              id="marginTop"
              v-model="settings.outline.marginTop"
              :step="0.5"
              :min="0"
              :value-on-clear="5"
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
              :value-on-clear="5"
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
              :value-on-clear="5"
              class="form-control form-control-sm"
              size="default"
              title="Left margin in millimeters"
            >
              <template #suffix>mm</template>
            </CustomNumberInput>
          </div>
          <div class="margin-input">
            <label for="marginRight" class="form-label form-label-sm margin-sub-label">Right</label>
            <CustomNumberInput
              id="marginRight"
              v-model="settings.outline.marginRight"
              :step="0.5"
              :min="0"
              :value-on-clear="5"
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

      <!-- Tight: uniform margin -->
      <div v-show="settings.outline.outlineType === 'tight'" class="mb-2">
        <label for="tightMargin" class="form-label form-label-sm">Margin</label>
        <CustomNumberInput
          id="tightMargin"
          v-model="settings.outline.tightMargin"
          :step="0.5"
          :min="0.5"
          :value-on-clear="5"
          class="form-control form-control-sm"
          size="default"
          title="Uniform margin in millimeters"
        >
          <template #suffix>mm</template>
        </CustomNumberInput>
        <div class="form-text small">Uniform expansion around key cluster</div>
      </div>

      <!-- Fillet Radius (shared by rectangular and tight) -->
      <div v-show="settings.outline.outlineType !== 'none'" class="mb-2">
        <label for="outlineFilletRadius" class="form-label form-label-sm">Fillet Radius</label>
        <CustomNumberInput
          id="outlineFilletRadius"
          v-model="settings.outline.filletRadius"
          :step="0.5"
          :min="0"
          :value-on-clear="1"
          class="form-control form-control-sm"
          size="default"
          title="Corner rounding radius for outline in millimeters"
        >
          <template #suffix>mm</template>
        </CustomNumberInput>
        <div class="form-text small">Corner rounding radius (0 = sharp corners)</div>
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

/* Ensure consistent spacing */
.mb-2:last-child {
  margin-bottom: 0 !important;
}
</style>
