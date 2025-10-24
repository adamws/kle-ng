<template>
  <div
    v-if="visible"
    ref="menuRef"
    class="matrix-context-menu"
    :style="{ top: position.y + 'px', left: position.x + 'px' }"
    @mousedown.stop
  >
    <div class="menu-content">
      <!-- Remove Node action (for single node hover) -->
      <button v-if="showRemoveNode" type="button" class="menu-item" disabled @mousedown.stop>
        <i class="bi bi-circle me-2"></i>
        Remove Node
      </button>

      <!-- Remove Row action (for row line hover) -->
      <button v-if="showRemoveRow" type="button" class="menu-item" disabled @mousedown.stop>
        <i class="bi bi-diagram-3 me-2"></i>
        Remove Row
      </button>

      <!-- Remove Column action (for column line hover) -->
      <button v-if="showRemoveColumn" type="button" class="menu-item" disabled @mousedown.stop>
        <i class="bi bi-diagram-2 me-2"></i>
        Remove Column
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { type Key } from '@/stores/keyboard'

// Props
interface Props {
  visible?: boolean
  position?: { x: number; y: number }
  hoverState?: {
    hoveredRow: number | null
    hoveredColumn: number | null
    hoveredAnchor: {
      type: 'row' | 'column' | 'overlap'
      index: number
      key: Key
      overlappingNodes?: Array<{
        type: 'row' | 'column'
        index: number
        key: Key
        distance: number
      }>
    } | null
  }
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  position: () => ({ x: 0, y: 0 }),
  hoverState: () => ({
    hoveredRow: null,
    hoveredColumn: null,
    hoveredAnchor: null,
  }),
})

const menuRef = ref<HTMLDivElement>()

// Computed properties to determine which menu items to show
const showRemoveNode = computed(() => {
  // Show "Remove Node" when hovering over a single node
  return (
    props.hoverState?.hoveredAnchor !== null &&
    !props.hoverState?.hoveredRow &&
    !props.hoverState?.hoveredColumn
  )
})

const showRemoveRow = computed(() => {
  // Show "Remove Row" when hovering over a row line (not a node)
  return props.hoverState?.hoveredRow !== null && props.hoverState?.hoveredAnchor === null
})

const showRemoveColumn = computed(() => {
  // Show "Remove Column" when hovering over a column line (not a node)
  return props.hoverState?.hoveredColumn !== null && props.hoverState?.hoveredAnchor === null
})
</script>

<style scoped>
.matrix-context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ccc;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 180px;
}

.menu-content {
  padding: 4px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 8px 16px;
  border: none;
  background: none;
  text-align: left;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background-color 0.15s;
}

.menu-item:not(:disabled):hover {
  background-color: #f0f0f0;
}

.menu-item:disabled {
  color: #999;
  cursor: not-allowed;
  opacity: 0.6;
}

.menu-item i {
  font-size: 14px;
}
</style>
