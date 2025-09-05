<template>
  <div class="key-properties-panel">
    <!-- Four-column layout for better space utilization -->
    <div>
      <fieldset :disabled="isDisabled" :class="{ 'opacity-50': isDisabled }">
        <div class="row g-3">
          <!-- Column 1: Position and Rotation -->
          <div class="col-lg-3 col-md-6">
            <div class="property-group position-rotation-container">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <h6 class="property-group-title mb-0">
                  {{
                    isAdvancedPositionMode ? 'Advanced Position & Rotation' : 'Position & Rotation'
                  }}
                </h6>
                <button
                  @click="toggleAdvancedMode"
                  class="btn btn-xs btn-outline-secondary toggle-mode-btn"
                  :title="
                    isAdvancedPositionMode ? 'Switch to Basic Mode' : 'Switch to Advanced Mode'
                  "
                >
                  {{ isAdvancedPositionMode ? 'Basic' : 'Advanced' }}
                </button>
              </div>

              <!-- Basic Mode -->
              <div v-show="!isAdvancedPositionMode" class="position-content">
                <!-- Position -->
                <div class="mb-2">
                  <label class="form-label small mb-1">Position</label>
                  <div class="row g-1">
                    <div class="col-6">
                      <label class="control-label">X</label>
                      <ScrollableNumberInput
                        v-model="currentX"
                        @change="updateX"
                        :step="moveStep"
                        :min="-100"
                        :max="100"
                        title="X Position"
                      />
                    </div>
                    <div class="col-6">
                      <label class="control-label">Y</label>
                      <ScrollableNumberInput
                        v-model="currentY"
                        @change="updateY"
                        :step="moveStep"
                        :min="-100"
                        :max="100"
                        title="Y Position"
                      />
                    </div>
                  </div>
                </div>

                <!-- Size -->
                <div class="mb-2">
                  <label class="form-label small mb-1">Size</label>
                  <div v-if="!isNonRectangular" class="row g-1">
                    <div class="col-6">
                      <label class="control-label">Width</label>
                      <ScrollableNumberInput
                        v-model="currentWidth"
                        @change="updateWidth"
                        :step="moveStep"
                        :min="0.25"
                        :max="24"
                        title="Width"
                      />
                    </div>
                    <div class="col-6">
                      <label class="control-label">Height</label>
                      <ScrollableNumberInput
                        v-model="currentHeight"
                        @change="updateHeight"
                        :step="moveStep"
                        :min="0.25"
                        :max="24"
                        title="Height"
                      />
                    </div>
                  </div>
                  <div v-else class="row g-1">
                    <div class="col-12">
                      <label class="control-label">Non-rectangular Key</label>
                      <div
                        class="d-flex align-items-center form-control form-control-sm bg-light"
                        style="height: 31px"
                      >
                        <small class="text-muted me-2">Size cannot be edited directly</small>
                        <button
                          @click="makeKeyRectangular"
                          class="btn btn-xs btn-outline-primary ms-auto"
                          style="font-size: 10px; padding: 2px 6px"
                        >
                          Make Rectangular
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Rotation -->
                <div class="mb-2">
                  <label class="form-label small mb-1">Rotation</label>
                  <label class="control-label">Degrees</label>
                  <ScrollableNumberInput
                    v-model="currentRotationAngle"
                    @change="updateRotationAngle"
                    :step="15"
                    :min="-180"
                    :max="180"
                    :wrap-around="true"
                    :wrap-min="-180"
                    :wrap-max="180"
                    class="form-control form-control-sm mb-1"
                    title="Rotation Angle in Degrees"
                  />
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="form-label small mb-0">{{
                      isRelativeRotationMode ? 'Origin Point (relative)' : 'Origin Point (absolute)'
                    }}</label>
                    <div
                      class="toggle-switch"
                      :class="{ disabled: selectedKeys.length === 0 }"
                      @click="selectedKeys.length > 0 ? toggleRotationOriginMode() : null"
                    >
                      <input
                        type="checkbox"
                        :checked="isRelativeRotationMode"
                        :disabled="selectedKeys.length === 0"
                        class="toggle-input"
                      />
                      <span class="toggle-slider">
                        <span class="toggle-label toggle-label-left">A</span>
                        <span class="toggle-label toggle-label-right">R</span>
                      </span>
                    </div>
                  </div>
                  <div class="row g-1">
                    <div class="col-6">
                      <label class="control-label">{{
                        isRelativeRotationMode ? 'X offset' : 'X'
                      }}</label>
                      <ScrollableNumberInput
                        v-model="displayRotationX"
                        @change="updateRotationX"
                        :step="moveStep"
                        :min="isRelativeRotationMode ? -2 : 0"
                        :max="isRelativeRotationMode ? 2 : 36"
                        :title="
                          isRelativeRotationMode
                            ? 'Rotation Origin X (relative to key)'
                            : 'Rotation Origin X (absolute)'
                        "
                      />
                    </div>
                    <div class="col-6">
                      <label class="control-label">{{
                        isRelativeRotationMode ? 'Y offset' : 'Y'
                      }}</label>
                      <ScrollableNumberInput
                        v-model="displayRotationY"
                        @change="updateRotationY"
                        :step="moveStep"
                        :min="isRelativeRotationMode ? -2 : 0"
                        :max="isRelativeRotationMode ? 2 : 36"
                        :title="
                          isRelativeRotationMode
                            ? 'Rotation Origin Y (relative to key)'
                            : 'Rotation Origin Y (absolute)'
                        "
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Advanced Mode -->
              <div v-show="isAdvancedPositionMode" class="position-content">
                <!-- Position Row: Primary + Secondary -->
                <div class="mb-2">
                  <label class="form-label small mb-1">Position</label>
                  <div class="row g-1">
                    <div class="col-3">
                      <label class="control-label">X</label>
                      <ScrollableNumberInput
                        v-model="currentX"
                        @change="updateX"
                        :step="moveStep"
                        :min="0"
                        :max="36"
                        title="X Position"
                      />
                    </div>
                    <div class="col-3">
                      <label class="control-label">Y</label>
                      <ScrollableNumberInput
                        v-model="currentY"
                        @change="updateY"
                        :step="moveStep"
                        :min="0"
                        :max="36"
                        title="Y Position"
                      />
                    </div>
                    <div class="col-3">
                      <label class="control-label">X2</label>
                      <ScrollableNumberInput
                        v-model="currentX2"
                        @change="updateX2"
                        :step="moveStep"
                        :min="0"
                        :max="36"
                        title="Secondary X Position"
                      />
                    </div>
                    <div class="col-3">
                      <label class="control-label">Y2</label>
                      <ScrollableNumberInput
                        v-model="currentY2"
                        @change="updateY2"
                        :step="moveStep"
                        :min="0"
                        :max="36"
                        title="Secondary Y Position"
                      />
                    </div>
                  </div>
                </div>

                <!-- Size Row: Primary + Secondary -->
                <div class="mb-2">
                  <label class="form-label small mb-1">Size</label>
                  <div class="row g-1">
                    <div class="col-3">
                      <label class="control-label">Width</label>
                      <ScrollableNumberInput
                        v-model="currentWidth"
                        @change="updateWidth"
                        :step="moveStep"
                        :min="0.25"
                        :max="24"
                        title="Width"
                      />
                    </div>
                    <div class="col-3">
                      <label class="control-label">Height</label>
                      <ScrollableNumberInput
                        v-model="currentHeight"
                        @change="updateHeight"
                        :step="moveStep"
                        :min="0.25"
                        :max="24"
                        title="Height"
                      />
                    </div>
                    <div class="col-3">
                      <label class="control-label">Width2</label>
                      <ScrollableNumberInput
                        v-model="currentWidth2"
                        @change="updateWidth2"
                        :step="moveStep"
                        :min="0.25"
                        :max="24"
                        title="Secondary Width"
                      />
                    </div>
                    <div class="col-3">
                      <label class="control-label">Height2</label>
                      <ScrollableNumberInput
                        v-model="currentHeight2"
                        @change="updateHeight2"
                        :step="moveStep"
                        :min="0.25"
                        :max="24"
                        title="Secondary Height"
                      />
                    </div>
                  </div>
                </div>

                <!-- Rotation (same as basic) -->
                <div class="mb-2">
                  <label class="form-label small mb-1">Rotation</label>
                  <label class="control-label">Degrees</label>
                  <ScrollableNumberInput
                    v-model="currentRotationAngle"
                    @change="updateRotationAngle"
                    :step="15"
                    :min="-180"
                    :max="180"
                    :wrap-around="true"
                    :wrap-min="-180"
                    :wrap-max="180"
                    class="form-control form-control-sm mb-1"
                    title="Rotation Angle in Degrees"
                  />
                  <div class="d-flex justify-content-between align-items-center mb-1">
                    <label class="form-label small mb-0">{{
                      isRelativeRotationMode ? 'Origin Point (relative)' : 'Origin Point (absolute)'
                    }}</label>
                    <div
                      class="toggle-switch"
                      :class="{ disabled: selectedKeys.length === 0 }"
                      @click="selectedKeys.length > 0 ? toggleRotationOriginMode() : null"
                    >
                      <input
                        type="checkbox"
                        :checked="isRelativeRotationMode"
                        :disabled="selectedKeys.length === 0"
                        class="toggle-input"
                      />
                      <span class="toggle-slider">
                        <span class="toggle-label toggle-label-left">A</span>
                        <span class="toggle-label toggle-label-right">R</span>
                      </span>
                    </div>
                  </div>
                  <div class="row g-1">
                    <div class="col-6">
                      <label class="control-label">{{
                        isRelativeRotationMode ? 'X offset' : 'X'
                      }}</label>
                      <ScrollableNumberInput
                        v-model="displayRotationX"
                        @change="updateRotationX"
                        :step="moveStep"
                        :min="isRelativeRotationMode ? -2 : 0"
                        :max="isRelativeRotationMode ? 2 : 36"
                        :title="
                          isRelativeRotationMode
                            ? 'Rotation Origin X (relative to key)'
                            : 'Rotation Origin X (absolute)'
                        "
                      />
                    </div>
                    <div class="col-6">
                      <label class="control-label">{{
                        isRelativeRotationMode ? 'Y offset' : 'Y'
                      }}</label>
                      <ScrollableNumberInput
                        v-model="displayRotationY"
                        @change="updateRotationY"
                        :step="moveStep"
                        :min="isRelativeRotationMode ? -2 : 0"
                        :max="isRelativeRotationMode ? 2 : 36"
                        :title="
                          isRelativeRotationMode
                            ? 'Rotation Origin Y (relative to key)'
                            : 'Rotation Origin Y (absolute)'
                        "
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Column 2: Labels and Colors -->
          <div class="col-lg-3 col-md-6">
            <div class="property-group">
              <h6 class="property-group-title">Labels and Colors</h6>

              <!-- Top Labels -->
              <div class="mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label small mb-0">Top labels</label>
                  <button
                    @click="clearTopLabels"
                    class="btn btn-xs btn-outline-secondary clear-labels-btn"
                    :disabled="isDisabled"
                    title="Clear all top labels"
                  >
                    Clear all
                  </button>
                </div>
                <!-- Main Labels Grid with Color Pickers -->
                <div class="labels-grid">
                  <!-- Row 1 -->
                  <div class="label-input-group">
                    <input
                      v-model="labels[0]"
                      @input="updateLabel(0)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Top Left"
                    />
                    <ColorPicker
                      v-model="labelColors[0]"
                      @change="updateLabelColor(0)"
                      @input="updateLabelColorPreview(0)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Top Left Color"
                    />
                  </div>
                  <div class="label-input-group">
                    <input
                      v-model="labels[1]"
                      @input="updateLabel(1)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Top Center"
                    />
                    <ColorPicker
                      v-model="labelColors[1]"
                      @change="updateLabelColor(1)"
                      @input="updateLabelColorPreview(1)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Top Center Color"
                    />
                  </div>
                  <div class="label-input-group">
                    <input
                      v-model="labels[2]"
                      @input="updateLabel(2)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Top Right"
                    />
                    <ColorPicker
                      v-model="labelColors[2]"
                      @change="updateLabelColor(2)"
                      @input="updateLabelColorPreview(2)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Top Right Color"
                    />
                  </div>

                  <!-- Row 2 -->
                  <div class="label-input-group">
                    <input
                      v-model="labels[3]"
                      @input="updateLabel(3)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Center Left"
                    />
                    <ColorPicker
                      v-model="labelColors[3]"
                      @change="updateLabelColor(3)"
                      @input="updateLabelColorPreview(3)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Center Left Color"
                    />
                  </div>
                  <div class="label-input-group">
                    <input
                      v-model="labels[4]"
                      @input="updateLabel(4)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Center (Main)"
                    />
                    <ColorPicker
                      v-model="labelColors[4]"
                      @change="updateLabelColor(4)"
                      @input="updateLabelColorPreview(4)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Center Color"
                    />
                  </div>
                  <div class="label-input-group">
                    <input
                      v-model="labels[5]"
                      @input="updateLabel(5)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Center Right"
                    />
                    <ColorPicker
                      v-model="labelColors[5]"
                      @change="updateLabelColor(5)"
                      @input="updateLabelColorPreview(5)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Center Right Color"
                    />
                  </div>

                  <!-- Row 3 -->
                  <div class="label-input-group">
                    <input
                      v-model="labels[6]"
                      @input="updateLabel(6)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Bottom Left"
                    />
                    <ColorPicker
                      v-model="labelColors[6]"
                      @change="updateLabelColor(6)"
                      @input="updateLabelColorPreview(6)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Bottom Left Color"
                    />
                  </div>
                  <div class="label-input-group">
                    <input
                      v-model="labels[7]"
                      @input="updateLabel(7)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Bottom Center"
                    />
                    <ColorPicker
                      v-model="labelColors[7]"
                      @change="updateLabelColor(7)"
                      @input="updateLabelColorPreview(7)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Bottom Center Color"
                    />
                  </div>
                  <div class="label-input-group">
                    <input
                      v-model="labels[8]"
                      @input="updateLabel(8)"
                      type="text"
                      class="form-control form-control-sm text-center"
                      title="Bottom Right"
                    />
                    <ColorPicker
                      v-model="labelColors[8]"
                      @change="updateLabelColor(8)"
                      @input="updateLabelColorPreview(8)"
                      :disabled="isDisabled"
                      class="label-color-picker"
                      style="width: 16px; height: 16px; flex: none; border-radius: 0"
                      title="Bottom Right Color"
                    />
                  </div>
                </div>
              </div>

              <!-- Front Labels -->
              <div class="mb-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <label class="form-label small mb-0">Front labels</label>
                  <button
                    @click="clearFrontLabels"
                    class="btn btn-xs btn-outline-secondary clear-labels-btn"
                    :disabled="isDisabled"
                    title="Clear all front labels"
                  >
                    Clear all
                  </button>
                </div>
                <div class="row g-1">
                  <div class="col-4">
                    <div class="front-label-group">
                      <input
                        v-model="labels[9]"
                        @input="updateLabel(9)"
                        type="text"
                        class="form-control form-control-sm text-center"
                        title="Front Left"
                      />
                      <ColorPicker
                        v-model="labelColors[9]"
                        @change="updateLabelColor(9)"
                        @input="updateLabelColorPreview(9)"
                        :disabled="isDisabled"
                        class="label-color-picker-small"
                        style="width: 16px; height: 16px; flex: none; border-radius: 0"
                        title="Front Left Color"
                      />
                    </div>
                  </div>
                  <div class="col-4">
                    <div class="front-label-group">
                      <input
                        v-model="labels[10]"
                        @input="updateLabel(10)"
                        type="text"
                        class="form-control form-control-sm text-center"
                        title="Front Center"
                      />
                      <ColorPicker
                        v-model="labelColors[10]"
                        @change="updateLabelColor(10)"
                        @input="updateLabelColorPreview(10)"
                        :disabled="isDisabled"
                        class="label-color-picker-small"
                        style="width: 16px; height: 16px; flex: none; border-radius: 0"
                        title="Front Center Color"
                      />
                    </div>
                  </div>
                  <div class="col-4">
                    <div class="front-label-group">
                      <input
                        v-model="labels[11]"
                        @input="updateLabel(11)"
                        type="text"
                        class="form-control form-control-sm text-center"
                        title="Front Right"
                      />
                      <ColorPicker
                        v-model="labelColors[11]"
                        @change="updateLabelColor(11)"
                        @input="updateLabelColorPreview(11)"
                        :disabled="isDisabled"
                        class="label-color-picker-small"
                        style="width: 16px; height: 16px; flex: none; border-radius: 0"
                        title="Front Right Color"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <!-- Text Size -->
              <div class="mb-2">
                <label class="form-label small mb-1">Text Size</label>
                <input
                  v-model.number="currentTextSize"
                  @change="updateTextSize"
                  type="number"
                  min="1"
                  max="9"
                  step="1"
                  class="form-control form-control-sm"
                />
              </div>

              <!-- Key and Text Colors -->
              <div class="row g-1 mb-2">
                <div class="col-6">
                  <label class="form-label small mb-1">Key Color</label>
                  <div class="input-group input-group-sm">
                    <ColorPicker
                      v-model="currentColor"
                      @change="updateColor"
                      @input="updateColorPreview"
                      :disabled="isDisabled"
                      class="form-control form-control-color key-color-input"
                      style="width: 24px; flex: none; border-radius: 0"
                      title="Key Color"
                    />
                    <input
                      v-model="currentColor"
                      @change="updateColor"
                      type="text"
                      class="form-control form-control-sm"
                      style="font-size: 0.65rem"
                    />
                  </div>
                </div>
                <div class="col-6">
                  <label class="form-label small mb-1">Text Color</label>
                  <div class="input-group input-group-sm">
                    <ColorPicker
                      v-model="currentTextColor"
                      @change="updateTextColor"
                      @input="updateTextColorPreview"
                      :disabled="isDisabled"
                      class="form-control form-control-color text-color-input"
                      style="width: 24px; flex: none; border-radius: 0"
                      title="Text Color"
                    />
                    <input
                      v-model="currentTextColor"
                      @change="updateTextColor"
                      type="text"
                      class="form-control form-control-sm"
                      style="font-size: 0.65rem"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Column 3: Options -->
          <div class="col-lg-3 col-md-6">
            <div class="property-group">
              <h6 class="property-group-title">Options</h6>

              <!-- Options -->
              <div class="mb-2">
                <label class="form-label small mb-1">Options</label>
                <div class="row g-1">
                  <div class="col-6">
                    <div class="form-check form-check-sm">
                      <input
                        v-model="currentGhost"
                        @change="updateGhost"
                        type="checkbox"
                        class="form-check-input"
                        id="ghostCheck"
                      />
                      <label class="form-check-label small" for="ghostCheck">Ghost</label>
                    </div>
                    <div class="form-check form-check-sm">
                      <input
                        v-model="currentStepped"
                        @change="updateStepped"
                        type="checkbox"
                        class="form-check-input"
                        id="steppedCheck"
                        :disabled="isSteppedDisabled"
                      />
                      <label
                        class="form-check-label small"
                        for="steppedCheck"
                        :class="{ 'text-muted': isSteppedDisabled }"
                        >Step</label
                      >
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="form-check form-check-sm">
                      <input
                        v-model="currentNub"
                        @change="updateNub"
                        type="checkbox"
                        class="form-check-input"
                        id="nubCheck"
                      />
                      <label class="form-check-label small" for="nubCheck">Home</label>
                    </div>
                    <div class="form-check form-check-sm">
                      <input
                        v-model="currentDecal"
                        @change="updateDecal"
                        type="checkbox"
                        class="form-check-input"
                        id="decalCheck"
                      />
                      <label class="form-check-label small" for="decalCheck">Decal</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </fieldset>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import ColorPicker from './ColorPicker.vue'
import ScrollableNumberInput from './ScrollableNumberInput.vue'
import { D } from '@/utils/decimal-math'

const keyboardStore = useKeyboardStore()

// Helper function to format numbers with maximum 6 decimal places
const formatNumber = (value: number): number => {
  return D.format(value, 6)
}

// Collapse functionality

// Computed
const selectedKeys = computed(() => keyboardStore.selectedKeys)
const isDisabled = computed(() => selectedKeys.value.length === 0)
const moveStep = computed(() => keyboardStore.moveStep)

// Non-rectangular key detection - only for truly J-shaped keys, not stepped keys
const isNonRectangular = computed(() => {
  if (selectedKeys.value.length === 0) return false
  const key = selectedKeys.value[0]

  // Stepped keys are rectangular with visual steps - they should allow size editing
  // Only truly J-shaped keys (like ISO Enter) are non-rectangular

  // Check for J-shaped keys - these have position offsets (x2, y2) or height differences
  const hasJShapeProperties =
    (key.height2 !== undefined && key.height2 !== key.height) || // Different heights (like ISO Enter)
    (key.x2 !== undefined && key.x2 !== 0) || // X position offset
    (key.y2 !== undefined && key.y2 !== 0) // Y position offset

  // Stepped keys with only width differences are still rectangular
  // Only keys with J-shape properties (height/position differences) are non-rectangular
  return hasJShapeProperties
})

// Step property should be disabled for pure 1x1 keys (no secondary dimensions)
const isSteppedDisabled = computed(() => {
  if (selectedKeys.value.length === 0) return false
  const key = selectedKeys.value[0]

  // Allow step if the key has secondary dimensions that make it non-rectangular
  const hasSecondaryDimensions =
    (key.width2 && key.width2 !== key.width) ||
    (key.height2 && key.height2 !== key.height) ||
    key.x2 !== 0 ||
    key.y2 !== 0

  // Disable step for pure 1x1 keys without any secondary dimensions
  return key.width === 1 && key.height === 1 && !hasSecondaryDimensions
})

// Advanced mode state
const isAdvancedPositionMode = ref(false)
const toggleAdvancedMode = () => {
  isAdvancedPositionMode.value = !isAdvancedPositionMode.value
  // Store preference in localStorage
  localStorage.setItem('kle-ng-advanced-position', isAdvancedPositionMode.value.toString())
}

// Load advanced mode preference from localStorage
const loadAdvancedModePreference = () => {
  const stored = localStorage.getItem('kle-ng-advanced-position')
  if (stored !== null) {
    isAdvancedPositionMode.value = stored === 'true'
  }
}

// Load preference on component mount
loadAdvancedModePreference()

// Rotation origin mode state
const isRelativeRotationMode = ref(false)
const toggleRotationOriginMode = () => {
  isRelativeRotationMode.value = !isRelativeRotationMode.value
  // Store preference in localStorage
  localStorage.setItem('kle-ng-relative-rotation', isRelativeRotationMode.value.toString())
  // The computed properties will automatically update the display when mode changes
}

// Load rotation mode preference from localStorage
const loadRotationModePreference = () => {
  const stored = localStorage.getItem('kle-ng-relative-rotation')
  if (stored !== null) {
    isRelativeRotationMode.value = stored === 'true'
  }
}

// Load preference on component mount
loadRotationModePreference()

// Reactive property values
const labels = ref<(string | undefined)[]>(Array(12).fill(undefined))
const labelColors = ref<(string | undefined)[]>(Array(12).fill(undefined))
const currentWidth = ref(1)
const currentHeight = ref(1)
const currentWidth2 = ref(1)
const currentHeight2 = ref(1)
const currentX = ref(0)
const currentY = ref(0)
const currentX2 = ref(0)
const currentY2 = ref(0)
const currentColor = ref('#cccccc')
const currentTextColor = ref('#000000')
const currentTextSize = ref(3)
const currentGhost = ref(false)
const currentStepped = ref(false)
const currentNub = ref(false)
const currentDecal = ref(false)
const currentRotationAngle = ref(0)
const currentRotationX = ref(0)
const currentRotationY = ref(0)

// Coordinate conversion functions
const absoluteToRelative = (absoluteCoord: number, keyPosition: number): number => {
  return D.sub(absoluteCoord, keyPosition)
}

const relativeToAbsolute = (relativeCoord: number, keyPosition: number): number => {
  return D.add(relativeCoord, keyPosition)
}

// Computed properties for display values
const displayRotationX = computed({
  get: () => {
    if (selectedKeys.value.length === 0) return 0
    const key = selectedKeys.value[0]
    const absoluteValue = key.rotation_x || 0
    return isRelativeRotationMode.value
      ? formatNumber(absoluteToRelative(absoluteValue, key.x))
      : formatNumber(absoluteValue)
  },
  set: (value: number) => {
    currentRotationX.value = value
  },
})

const displayRotationY = computed({
  get: () => {
    if (selectedKeys.value.length === 0) return 0
    const key = selectedKeys.value[0]
    const absoluteValue = key.rotation_y || 0
    return isRelativeRotationMode.value
      ? formatNumber(absoluteToRelative(absoluteValue, key.y))
      : formatNumber(absoluteValue)
  },
  set: (value: number) => {
    currentRotationY.value = value
  },
})

const updateCurrentValues = () => {
  if (selectedKeys.value.length === 0) {
    // Reset to defaults when no selection
    labels.value = Array(12).fill(undefined)
    labelColors.value = Array(12).fill(undefined)
    currentWidth.value = 1
    currentHeight.value = 1
    currentWidth2.value = 1
    currentHeight2.value = 1
    currentX.value = 0
    currentY.value = 0
    currentX2.value = 0
    currentY2.value = 0
    currentColor.value = '#cccccc'
    currentTextColor.value = '#000000'
    currentTextSize.value = 3
    currentGhost.value = false
    currentStepped.value = false
    currentNub.value = false
    currentDecal.value = false
    currentRotationAngle.value = 0
    currentRotationX.value = 0
    currentRotationY.value = 0
    return
  }

  const firstKey = selectedKeys.value[0]

  // For single selection, use the key's values directly
  if (selectedKeys.value.length === 1) {
    labels.value = [...firstKey.labels]
    // Map per-label colors, falling back to default color
    labelColors.value = firstKey.textColor.map(
      (color: string | undefined) => color || firstKey.default.textColor,
    )
    // Ensure we have 12 colors
    while (labelColors.value.length < 12) {
      labelColors.value.push(firstKey.default.textColor)
    }

    currentWidth.value = formatNumber(firstKey.width)
    currentHeight.value = formatNumber(firstKey.height)
    currentWidth2.value = formatNumber(firstKey.width2 || firstKey.width)
    currentHeight2.value = formatNumber(firstKey.height2 || firstKey.height)
    currentX.value = formatNumber(firstKey.x)
    currentY.value = formatNumber(firstKey.y)
    currentX2.value = formatNumber(firstKey.x2 || 0)
    currentY2.value = formatNumber(firstKey.y2 || 0)
    currentColor.value = firstKey.color
    currentTextColor.value = firstKey.default.textColor
    currentTextSize.value = firstKey.default.textSize
    currentGhost.value = !!firstKey.ghost
    currentStepped.value = !!firstKey.stepped
    currentNub.value = !!firstKey.nub
    currentDecal.value = !!firstKey.decal
    currentRotationAngle.value = formatNumber(firstKey.rotation_angle || 0)
    currentRotationX.value = formatNumber(firstKey.rotation_x || 0)
    currentRotationY.value = formatNumber(firstKey.rotation_y || 0)
  } else {
    // For multi-selection, clear labels and use first key for other values
    labels.value = Array(12).fill(undefined)
    labelColors.value = Array(12).fill(firstKey.default.textColor)

    currentWidth.value = formatNumber(firstKey.width)
    currentHeight.value = formatNumber(firstKey.height)
    currentWidth2.value = formatNumber(firstKey.width2 || firstKey.width)
    currentHeight2.value = formatNumber(firstKey.height2 || firstKey.height)
    currentX.value = formatNumber(firstKey.x)
    currentY.value = formatNumber(firstKey.y)
    currentX2.value = formatNumber(firstKey.x2 || 0)
    currentY2.value = formatNumber(firstKey.y2 || 0)
    currentColor.value = firstKey.color
    currentTextColor.value = firstKey.default.textColor
    currentTextSize.value = firstKey.default.textSize
    currentGhost.value = !!firstKey.ghost
    currentStepped.value = !!firstKey.stepped
    currentNub.value = !!firstKey.nub
    currentDecal.value = !!firstKey.decal
    currentRotationAngle.value = formatNumber(firstKey.rotation_angle || 0)
    currentRotationX.value = formatNumber(firstKey.rotation_x || 0)
    currentRotationY.value = formatNumber(firstKey.rotation_y || 0)
  }
}

// Update values when selection changes
watch(
  selectedKeys,
  () => {
    updateCurrentValues()
  },
  { deep: true, immediate: true },
)

// Actions
const updateLabel = (index: number) => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.labels[index] = labels.value[index] || ''
  })

  keyboardStore.saveState()
}

// Live preview text color update (no state save)
const updateTextColorPreview = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.default.textColor = currentTextColor.value
    key.textColor = key.textColor.map(() => undefined)
  })
}

const updateTextColor = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.default.textColor = currentTextColor.value
    key.textColor = key.textColor.map(() => undefined)
  })

  keyboardStore.saveState()
}

const updateTextSize = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.default.textSize = currentTextSize.value
    key.textSize = Array(12).fill(0)
  })

  keyboardStore.saveState()
}

const updateWidth = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.width = currentWidth.value

    // If key has secondary dimensions and should remain rectangular,
    // sync the secondary width to match primary width
    if (key.width2 !== undefined && !key.stepped && !key.x2 && !key.y2) {
      key.width2 = currentWidth.value
    }
  })

  keyboardStore.saveState()
}

const updateHeight = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.height = currentHeight.value

    // If key has secondary dimensions and should remain rectangular,
    // sync the secondary height to match primary height
    if (key.height2 !== undefined && !key.stepped && !key.x2 && !key.y2) {
      key.height2 = currentHeight.value
    }
  })

  keyboardStore.saveState()
}

const updateX = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.x = currentX.value
  })

  keyboardStore.saveState()
}

const updateY = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.y = currentY.value
  })

  keyboardStore.saveState()
}

const updateX2 = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.x2 = currentX2.value
  })

  keyboardStore.saveState()
}

const updateY2 = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.y2 = currentY2.value
  })

  keyboardStore.saveState()
}

const updateWidth2 = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.width2 = currentWidth2.value
  })

  keyboardStore.saveState()
}

const updateHeight2 = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.height2 = currentHeight2.value
  })

  keyboardStore.saveState()
}

// Live preview color update (no state save)
const updateColorPreview = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.color = currentColor.value
  })
}

const updateColor = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.color = currentColor.value
  })

  keyboardStore.saveState()
}

const updateGhost = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.ghost = currentGhost.value
  })

  keyboardStore.saveState()
}

const updateStepped = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.stepped = currentStepped.value
  })

  keyboardStore.saveState()
}

const updateNub = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.nub = currentNub.value
  })

  keyboardStore.saveState()
}

const updateDecal = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.decal = currentDecal.value
  })

  keyboardStore.saveState()
}

const updateRotationAngle = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    key.rotation_angle = currentRotationAngle.value
  })

  keyboardStore.saveState()
}

const updateRotationX = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    const displayValue = currentRotationX.value
    key.rotation_x = isRelativeRotationMode.value
      ? relativeToAbsolute(displayValue, key.x)
      : displayValue
  })

  keyboardStore.saveState()
}

const updateRotationY = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    const displayValue = currentRotationY.value
    key.rotation_y = isRelativeRotationMode.value
      ? relativeToAbsolute(displayValue, key.y)
      : displayValue
  })

  keyboardStore.saveState()
}

// Live preview label color update (no state save)
const updateLabelColorPreview = (index: number) => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    // Ensure textColor array is at least as long as needed
    while (key.textColor.length <= index) {
      key.textColor.push(undefined)
    }

    // Set the color for this specific label
    const newColor = labelColors.value[index]
    if (newColor === key.default.textColor) {
      // If it's the same as default, store undefined to use default
      key.textColor[index] = undefined
    } else {
      key.textColor[index] = newColor
    }
  })
}

const updateLabelColor = (index: number) => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    // Ensure textColor array is at least as long as needed
    while (key.textColor.length <= index) {
      key.textColor.push(undefined)
    }

    // Set the color for this specific label
    const newColor = labelColors.value[index]
    if (newColor === key.default.textColor) {
      // If it's the same as default, store undefined to use default
      key.textColor[index] = undefined
    } else {
      key.textColor[index] = newColor
    }
  })

  keyboardStore.saveState()
}

const makeKeyRectangular = async () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    // Remove all non-rectangular properties by casting to any to bypass TypeScript restrictions
    const anyKey = key as unknown as Record<string, unknown>
    delete anyKey.width2
    delete anyKey.height2
    delete anyKey.x2
    delete anyKey.y2
    delete anyKey.stepped
  })

  keyboardStore.saveState()

  // Wait for next tick to ensure DOM updates, then force update of current values
  await nextTick()
  updateCurrentValues()
}

// Clear all top labels (indices 0-8)
const clearTopLabels = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    // Clear labels 0-8 (top labels)
    for (let i = 0; i <= 8; i++) {
      key.labels[i] = ''
    }
  })

  // Update reactive values
  for (let i = 0; i <= 8; i++) {
    labels.value[i] = ''
  }

  keyboardStore.saveState()
}

// Clear all front labels (indices 9-11)
const clearFrontLabels = () => {
  if (selectedKeys.value.length === 0) return

  selectedKeys.value.forEach((key) => {
    // Clear labels 9-11 (front labels)
    for (let i = 9; i <= 11; i++) {
      key.labels[i] = ''
    }
  })

  // Update reactive values
  for (let i = 9; i <= 11; i++) {
    labels.value[i] = ''
  }

  keyboardStore.saveState()
}
</script>

<style scoped>
/* Property groups styling */
.property-group {
  background: #f8f9fa;
  border: 1px solid #e9ecef;
  border-radius: 6px;
  padding: 12px;
  height: 100%;
}

.property-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: #495057;
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  border-bottom: 1px solid #dee2e6;
  padding-bottom: 4px;
}

/* Compact form controls */
.form-control-sm {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.form-select-sm {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.form-control-color {
  padding: 0.125rem;
  border: 1px solid #ced4da;
}

/* Labels grid - 3x3 layout with color pickers */
.labels-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 4px;
  background: #fff;
  border: 1px solid #dee2e6;
  border-radius: 4px;
  padding: 6px;
}

.label-input-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.labels-grid .form-control {
  border: 1px solid #e9ecef;
  font-size: 0.7rem;
  padding: 0.125rem 0.25rem;
  min-height: 24px;
  flex: 1;
}

.label-color-picker {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
}

.label-color-picker::-webkit-color-swatch-wrapper {
  padding: 0;
}

.label-color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}

.front-label-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.label-color-picker-small {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 2px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}

.label-color-picker-small::-webkit-color-swatch-wrapper {
  padding: 0;
}

.label-color-picker-small::-webkit-color-swatch {
  border: none;
  border-radius: 2px;
}

.form-check-sm .form-check-input {
  margin-top: 0.125em;
  transform: scale(0.9);
}

.form-check-sm .form-check-label {
  font-size: 0.7rem;
  line-height: 1.2;
}

/* Responsive adjustments */
@media (max-width: 1199.98px) {
  .property-group {
    margin-bottom: 1rem;
  }
}

@media (max-width: 767.98px) {
  .labels-grid {
    grid-template-columns: 1fr 1fr;
    gap: 2px;
  }

  .labels-grid .form-control {
    font-size: 0.65rem;
    padding: 0.1rem 0.2rem;
    min-height: 20px;
  }

  .label-color-picker {
    width: 14px;
    height: 14px;
  }
}

.control-label {
  font-size: 0.65rem;
  color: #666;
  font-weight: 500;
  display: block;
  margin-bottom: 1px;
  line-height: 1;
}

/* Advanced position mode styles */
.position-rotation-container .property-group-title {
  margin-bottom: 0;
  border-bottom: none;
  padding-bottom: 0;
}

.toggle-mode-btn {
  font-size: 10px;
  padding: 2px 8px;
  line-height: 1.2;
  height: 20px;
}

.clear-labels-btn {
  font-size: 10px;
  padding: 2px 8px;
  line-height: 1.2;
  height: 20px;
}

/* Toggle switch styling */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 48px;
  height: 20px;
  cursor: pointer;
}

.toggle-input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-slider {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #dee2e6;
  border: 1px solid #ced4da;
  border-radius: 10px;
  transition: 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Remove the different background for checked state - keep consistent */
.toggle-input:checked + .toggle-slider {
  background-color: #dee2e6;
  border-color: #ced4da;
}

.toggle-slider::before {
  content: '';
  position: absolute;
  height: 14px;
  width: 14px;
  left: 2px;
  top: 2px;
  background-color: white;
  border-radius: 50%;
  transition: 0.2s ease;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  z-index: 2;
}

.toggle-input:checked + .toggle-slider::before {
  transform: translateX(28px);
}

.toggle-label {
  font-size: 9px;
  font-weight: 700;
  line-height: 1;
  z-index: 1;
  position: absolute;
  transition: 0.2s;
  top: 50%;
  transform: translateY(-50%);
}

.toggle-label-left {
  left: 6px;
  color: #666;
}

.toggle-label-right {
  right: 6px;
  color: rgba(102, 102, 102, 0.6);
}

.toggle-input:checked + .toggle-slider .toggle-label-left {
  color: #666;
}

.toggle-input:checked + .toggle-slider .toggle-label-right {
  color: #666;
}

/* Disabled state styling */
.toggle-switch.disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.toggle-switch.disabled .toggle-slider {
  background-color: #f8f9fa;
  border-color: #e9ecef;
}

.toggle-switch.disabled .toggle-label {
  color: #adb5bd;
}

.toggle-switch.disabled .toggle-slider::before {
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

.toggle-input:not(:checked) + .toggle-slider .toggle-label-left {
  color: #666;
}

.toggle-input:not(:checked) + .toggle-slider .toggle-label-right {
  color: rgba(102, 102, 102, 0.4);
}

.position-content .mb-2:last-child {
  margin-bottom: 0;
}
</style>
