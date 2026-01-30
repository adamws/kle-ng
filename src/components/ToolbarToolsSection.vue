<template>
  <div class="toolbar-section">
    <label class="section-label">Tools</label>
    <div class="tool-buttons">
      <button
        :class="{ 'tool-button': true, active: canvasMode === 'select' }"
        @click="$emit('set-mode', 'select')"
        title="Selection Mode - Left click to select, middle drag to move"
      >
        <BiCursor />
      </button>

      <button
        :class="{ 'tool-button': true, active: canvasMode === 'move-exactly' }"
        :disabled="!canUseMoveExactlyTool"
        data-testid="toolbar-move-exactly"
        @click="$emit('set-mode', 'move-exactly')"
        title="Move Exactly - Move selected keys by exact X/Y values"
      >
        <BiArrowsMove />
      </button>

      <button
        :class="{ 'tool-button': true, active: canvasMode === 'rotate' }"
        :disabled="!canUseRotateTool"
        data-testid="toolbar-rotate-selection"
        @click="$emit('set-mode', 'rotate')"
        title="Rotate Selection"
      >
        <BiArrowRepeat />
      </button>

      <!-- Mirror Button Group -->
      <div class="btn-group-vertical mirror-group">
        <button
          :class="{
            'tool-button': true,
            'primary-mirror-btn': true,
            active: canvasMode === 'mirror-v' || canvasMode === 'mirror-h',
          }"
          :disabled="!canUseMirrorTools"
          data-testid="toolbar-mirror-vertical"
          @click="$emit('set-mode', 'mirror-v')"
          title="Mirror Vertical"
        >
          <BiSymmetryVertical />
        </button>
        <button
          ref="mirrorDropdownBtnRef"
          class="tool-button dropdown-btn"
          :disabled="!canUseMirrorTools"
          @click="$emit('toggle-mirror-dropdown')"
          title="Mirror Options"
        >
          <BiChevronDown />
        </button>
      </div>

      <!-- Mirror Dropdown -->
      <div
        v-if="showMirrorDropdown"
        ref="mirrorDropdownRef"
        class="mirror-dropdown"
        style="opacity: 0"
      >
        <div class="dropdown-header">Mirror Direction</div>
        <button
          @click="$emit('select-mirror-mode', 'mirror-v')"
          class="dropdown-item"
          :class="{ active: canvasMode === 'mirror-v' }"
          title="Mirror keys across a vertical line"
        >
          <BiSymmetryVertical />
          Mirror Vertical
        </button>
        <button
          @click="$emit('select-mirror-mode', 'mirror-h')"
          class="dropdown-item"
          :class="{ active: canvasMode === 'mirror-h' }"
          title="Mirror keys across a horizontal line"
        >
          <BiSymmetryHorizontal />
          Mirror Horizontal
        </button>
      </div>

      <!-- Extra Tools Dropdown -->
      <div class="btn-group-vertical extra-tools-group">
        <button
          ref="extraToolsBtnRef"
          class="tool-button"
          @click="$emit('toggle-extra-tools')"
          title="Extra Tools"
        >
          <BiTools />
        </button>
      </div>
    </div>

    <!-- Extra Tools Dropdown -->
    <div
      v-if="showExtraToolsDropdown"
      ref="extraToolsDropdownRef"
      class="extra-tools-dropdown"
      style="opacity: 0"
    >
      <div class="dropdown-header">Extra Tools</div>
      <button
        v-for="tool in extraTools"
        :key="tool.id"
        @click="tool.disabled ? null : $emit('execute-extra-tool', tool)"
        :class="['dropdown-item', { disabled: tool.disabled }]"
        :title="tool.description"
        :disabled="tool.disabled"
      >
        {{ tool.name }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import BiCursor from 'bootstrap-icons/icons/cursor.svg'
import BiArrowsMove from 'bootstrap-icons/icons/arrows-move.svg'
import BiArrowRepeat from 'bootstrap-icons/icons/arrow-repeat.svg'
import BiSymmetryVertical from 'bootstrap-icons/icons/symmetry-vertical.svg'
import BiSymmetryHorizontal from 'bootstrap-icons/icons/symmetry-horizontal.svg'
import BiChevronDown from 'bootstrap-icons/icons/chevron-down.svg'
import BiTools from 'bootstrap-icons/icons/tools.svg'
import { ref } from 'vue'

interface ExtraTool {
  id: string
  name: string
  description: string
  disabled?: boolean
  action: () => void
}

defineProps<{
  canvasMode: string
  canUseMoveExactlyTool: boolean
  canUseRotateTool: boolean
  canUseMirrorTools: boolean
  showMirrorDropdown: boolean
  showExtraToolsDropdown: boolean
  extraTools: ExtraTool[]
}>()

defineEmits<{
  'set-mode': [mode: 'select' | 'mirror-h' | 'mirror-v' | 'rotate' | 'move-exactly']
  'toggle-mirror-dropdown': []
  'select-mirror-mode': [mode: 'mirror-v' | 'mirror-h']
  'toggle-extra-tools': []
  'execute-extra-tool': [tool: ExtraTool]
}>()

const mirrorDropdownBtnRef = ref<HTMLElement>()
const mirrorDropdownRef = ref<HTMLElement>()
const extraToolsBtnRef = ref<HTMLElement>()
const extraToolsDropdownRef = ref<HTMLElement>()

defineExpose({
  mirrorDropdownBtnRef,
  mirrorDropdownRef,
  extraToolsBtnRef,
  extraToolsDropdownRef,
})
</script>
