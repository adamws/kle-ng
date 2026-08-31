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
      <div class="mirror-group">
        <button
          class="tool-button primary-mirror-btn"
          :class="{ active: canvasMode === 'mirror-v' || canvasMode === 'mirror-h' }"
          :disabled="!canUseMirrorTools"
          data-testid="toolbar-mirror-vertical"
          @click="$emit('set-mode', 'mirror-v')"
          title="Mirror Vertical"
        >
          <BiSymmetryVertical />
        </button>

        <div class="btn-group-vertical dropend">
          <button
            class="tool-button dropdown-btn dropdown-toggle"
            :disabled="!canUseMirrorTools"
            data-bs-toggle="dropdown"
          >
            <BiChevronDown />
          </button>

          <ul class="dropdown-menu">
            <li>
              <button
                @click="$emit('select-mirror-mode', 'mirror-v')"
                class="dropdown-item"
                title="Mirror keys across a vertical line"
              >
                <BiSymmetryVertical />
                Mirror Vertical
              </button>
            </li>
            <li>
              <button
                @click="$emit('select-mirror-mode', 'mirror-h')"
                class="dropdown-item"
                title="Mirror keys across a horizontal line"
              >
                <BiSymmetryHorizontal />
                Mirror Horizontal
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Extra Tools Dropdown -->
      <div class="btn-group-vertical extra-tools-group dropend">
        <button
          class="tool-button dropdown-toggle"
          data-bs-toggle="dropdown"
          aria-expanded="false"
          title="Extra Tools"
        >
          <BiTools />
        </button>
        <ul class="dropdown-menu">
          <li v-for="tool in extraTools" :key="tool.id">
            <button
              class="dropdown-item"
              :class="{ disabled: tool.disabled }"
              @click="tool.disabled ? null : $emit('execute-extra-tool', tool)"
              :title="tool.description"
              :disabled="tool.disabled"
            >
              {{ tool.name }}
            </button>
          </li>
        </ul>
      </div>
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
import type { CanvasMode } from '@/stores/keyboard'

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
  extraTools: ExtraTool[]
}>()

defineEmits<{
  'set-mode': [mode: CanvasMode]
  'select-mirror-mode': [mode: 'mirror-v' | 'mirror-h']
  'execute-extra-tool': [tool: ExtraTool]
}>()
</script>

<style scoped>
.mirror-group .dropdown-toggle::after,
.extra-tools-group .dropdown-toggle::after {
  display: none;
}
</style>
