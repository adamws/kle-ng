<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import KeyboardToolbar from './components/KeyboardToolbar.vue'
import KeyboardCanvas from './components/KeyboardCanvas.vue'
import KeyPropertiesPanel from './components/KeyPropertiesPanel.vue'
import JsonEditorPanel from './components/JsonEditorPanel.vue'
import AppFooter from './components/AppFooter.vue'
import CanvasToolbar from './components/CanvasToolbar.vue'
import CanvasFooter from './components/CanvasFooter.vue'
import CanvasHelpModal from './components/CanvasHelpModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import { useKeyboardStore } from '@/stores/keyboard'

const canvasRef = ref<InstanceType<typeof KeyboardCanvas>>()

const keyboardStore = useKeyboardStore()

const sectionOrder = ref(['canvas', 'properties', 'json'])
const draggedSection = ref<string | null>(null)
const dragOverSection = ref<string | null>(null)

const collapsedSections = ref<Record<string, boolean>>({
  properties: false,
  canvas: false,
  json: false,
})

onMounted(() => {
  const savedOrder = localStorage.getItem('kle-ng-section-order')
  if (savedOrder) {
    try {
      const parsedOrder = JSON.parse(savedOrder)
      if (Array.isArray(parsedOrder) && parsedOrder.length === 3) {
        sectionOrder.value = parsedOrder
      }
    } catch (error) {
      console.warn('Failed to parse saved section order:', error)
    }
  }

  const savedCollapsed = localStorage.getItem('kle-ng-section-collapsed')
  if (savedCollapsed) {
    try {
      const parsedCollapsed = JSON.parse(savedCollapsed)
      if (typeof parsedCollapsed === 'object') {
        collapsedSections.value = { ...collapsedSections.value, ...parsedCollapsed }
      }
    } catch (error) {
      console.warn('Failed to parse saved collapsed states:', error)
    }
  }

  // Load saved Layout Editor height
  const savedHeight = localStorage.getItem('kle-ng-layout-editor-height')
  if (savedHeight) {
    const height = parseInt(savedHeight, 10)
    if (height >= minLayoutEditorHeight && height <= window.innerHeight - 200) {
      layoutEditorHeight.value = height
    } else if (height > 0 && height < minLayoutEditorHeight) {
      // If saved height is too small, use minimum height
      layoutEditorHeight.value = minLayoutEditorHeight
    }
  } else {
    // If no saved height, ensure initial height meets minimum requirement
    layoutEditorHeight.value = Math.max(layoutEditorHeight.value, minLayoutEditorHeight)
  }
})

// Save section order to localStorage
const saveSectionOrder = () => {
  localStorage.setItem('kle-ng-section-order', JSON.stringify(sectionOrder.value))
}

// Save collapsed states to localStorage
const saveCollapsedStates = () => {
  localStorage.setItem('kle-ng-section-collapsed', JSON.stringify(collapsedSections.value))
}

// Toggle section collapse
const toggleSectionCollapse = (sectionId: string) => {
  collapsedSections.value[sectionId] = !collapsedSections.value[sectionId]
  saveCollapsedStates()
}

// Drag and drop handlers
const handleDragStart = (sectionId: string) => {
  draggedSection.value = sectionId
}

const handleDragOver = (event: DragEvent, sectionId: string) => {
  event.preventDefault()
  dragOverSection.value = sectionId
}

const handleDragLeave = () => {
  dragOverSection.value = null
}

const handleDrop = (event: DragEvent, targetSectionId: string) => {
  event.preventDefault()

  if (!draggedSection.value || draggedSection.value === targetSectionId) {
    draggedSection.value = null
    dragOverSection.value = null
    return
  }

  // Find current positions
  const draggedIndex = sectionOrder.value.indexOf(draggedSection.value)
  const targetIndex = sectionOrder.value.indexOf(targetSectionId)

  if (draggedIndex !== -1 && targetIndex !== -1) {
    // Remove dragged item and insert it at target position
    const newOrder = [...sectionOrder.value]
    const [draggedItem] = newOrder.splice(draggedIndex, 1)
    newOrder.splice(targetIndex, 0, draggedItem)

    sectionOrder.value = newOrder
    saveSectionOrder()
  }

  draggedSection.value = null
  dragOverSection.value = null
}

const handleDragEnd = () => {
  draggedSection.value = null
  dragOverSection.value = null
}

// Define section components and their configurations
const sections = computed(() => ({
  canvas: {
    id: 'canvas',
    title: 'Layout Editor',
    component: 'CanvasSection',
  },
  properties: {
    id: 'properties',
    title: 'Key Properties',
    component: 'KeyPropertiesPanel',
  },
  json: {
    id: 'json',
    title: 'JSON Editor',
    component: 'JsonEditorPanel',
  },
}))

// Get ordered sections
const orderedSections = computed(() =>
  sectionOrder.value.map((id) => sections.value[id as keyof typeof sections.value]),
)

// Help modal state
const isHelpVisible = ref(false)

const showHelp = () => {
  isHelpVisible.value = true
}

const closeHelp = () => {
  isHelpVisible.value = false
}

// Layout Editor container resize functionality
const layoutEditorHeight = ref(600) // Initial height
const isResizing = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(0)

// Calculate minimum height for layout editor based on toolbar content
const calculateMinLayoutEditorHeight = () => {
  // Canvas toolbar minimum requirements for single-column layout:
  // - 4 sections with gaps (3 × 16px = 48px)
  // - Section labels (4 × 16px = 64px)
  // - Tools section: 3 buttons + gaps (3×38 + 2×4 = 122px)
  // - Edit section: Add key group + delete + gap (54 + 38 + 4 = 96px)
  // - History section: 2 buttons + gap (2×38 + 4 = 80px)
  // - Clipboard section: 3 buttons + gaps (3×38 + 2×4 = 122px)
  // - Container padding: 32px
  // - Footer height: ~50px
  // Total: 48 + 64 + 122 + 96 + 80 + 122 + 32 + 50 = 614px
  //
  // For compact two-column layout, height would be approximately:
  // - 4 sections with gaps: 48px
  // - Section labels: 64px
  // - Tools section: 2 rows (2×34 + 4 = 72px)
  // - Edit section: 1 row (34 + gap = 38px)
  // - History section: 1 row (34 + gap = 38px)
  // - Clipboard section: 2 rows (2×34 + 4 = 72px)
  // - Container padding: 24px
  // - Footer: 50px
  // Total compact: 48 + 64 + 72 + 38 + 38 + 72 + 24 + 50 = 406px
  //
  // We'll use the single-column requirement as minimum to ensure all tools are always visible
  return 600 // Conservative minimum to ensure all tools fit comfortably
}

const minLayoutEditorHeight = calculateMinLayoutEditorHeight()

const startResize = (event: MouseEvent) => {
  isResizing.value = true
  resizeStartY.value = event.clientY
  resizeStartHeight.value = layoutEditorHeight.value
  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'ns-resize'
  document.body.style.userSelect = 'none'
}

const handleResize = (event: MouseEvent) => {
  if (!isResizing.value) return
  const deltaY = event.clientY - resizeStartY.value
  const newHeight = Math.max(
    minLayoutEditorHeight,
    Math.min(window.innerHeight - 200, resizeStartHeight.value + deltaY),
  )
  layoutEditorHeight.value = newHeight
}

const stopResize = () => {
  isResizing.value = false
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
  // Save height to localStorage
  localStorage.setItem('kle-ng-layout-editor-height', layoutEditorHeight.value.toString())
}

// Layout Editor height will be loaded in the existing onMounted function
</script>

<template>
  <div id="app" class="d-flex flex-column min-vh-100">
    <!-- Header with integrated toolbar -->
    <header class="navbar navbar-light bg-light border-bottom py-2">
      <div class="container-fluid">
        <div
          class="w-100 d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2"
        >
          <h1 class="navbar-brand mb-0 flex-shrink-0 text-center text-md-start">
            Keyboard Layout Editor NG
          </h1>
          <div class="flex-grow-1">
            <KeyboardToolbar />
          </div>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <div class="flex-grow-1">
      <!-- Dynamic Reorderable Sections -->
      <div
        v-for="section in orderedSections"
        :key="section.id"
        class="draggable-container"
        :class="{
          dragging: draggedSection === section.id,
          'drag-over': dragOverSection === section.id,
        }"
        @dragover="handleDragOver($event, section.id)"
        @dragleave="handleDragLeave"
        @drop="handleDrop($event, section.id)"
      >
        <div class="card mb-3 draggable-section">
          <!-- Section Header with Drag Handle -->
          <div
            class="card-header d-flex align-items-center justify-content-between py-1 drag-handle"
          >
            <div class="d-flex align-items-center gap-2">
              <span class="section-title">{{ section.title }}</span>
              <!-- Unsaved indicator for canvas section only -->
              <div v-if="section.id === 'canvas' && keyboardStore.dirty" class="small text-warning">
                • Unsaved changes
              </div>
            </div>
            <div class="d-flex align-items-center gap-2">
              <!-- Help button only for Layout Editor section -->
              <button
                v-if="section.id === 'canvas'"
                @click.stop="showHelp"
                class="btn btn-sm btn-outline-secondary help-btn"
                title="Help"
              >
                <i class="bi bi-question-circle"></i>
              </button>
              <button
                @click.stop="toggleSectionCollapse(section.id)"
                class="btn btn-sm btn-outline-secondary collapse-btn"
                :title="collapsedSections[section.id] ? 'Expand' : 'Collapse'"
              >
                <i
                  :class="collapsedSections[section.id] ? 'bi bi-chevron-down' : 'bi bi-chevron-up'"
                ></i>
              </button>
              <span
                class="drag-grip"
                title="Drag to reorder"
                draggable="true"
                @dragstart="handleDragStart(section.id)"
                @dragend="handleDragEnd"
                ><i class="bi bi-grip-vertical"></i
              ></span>
            </div>
          </div>

          <!-- Section Content -->
          <!-- Key Properties Section -->
          <div
            v-if="section.id === 'properties' && !collapsedSections[section.id]"
            class="card-body"
          >
            <KeyPropertiesPanel />
          </div>

          <!-- Canvas Section -->
          <div
            v-else-if="section.id === 'canvas' && !collapsedSections[section.id]"
            class="card-body p-0 d-flex layout-editor-container"
            :style="{ height: layoutEditorHeight + 'px' }"
          >
            <!-- Left: Canvas Toolbar -->
            <CanvasToolbar />

            <!-- Right: Canvas Area -->
            <div class="canvas-area flex-grow-1">
              <KeyboardCanvas ref="canvasRef" />
            </div>
          </div>

          <!-- Canvas Footer (only for canvas section) -->
          <CanvasFooter v-if="section.id === 'canvas' && !collapsedSections[section.id]" />

          <!-- Layout Editor Resize Handle (only for canvas section) -->
          <div
            v-if="section.id === 'canvas' && !collapsedSections[section.id]"
            class="layout-editor-resize-handle"
            @mousedown="startResize"
            :class="{ active: isResizing }"
          >
            <div class="resize-handle-line"></div>
          </div>

          <!-- JSON Editor Section -->
          <div
            v-else-if="section.id === 'json' && !collapsedSections[section.id]"
            class="card-body"
          >
            <JsonEditorPanel />
          </div>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <AppFooter />

    <!-- Canvas Help Modal -->
    <CanvasHelpModal :is-visible="isHelpVisible" @close="closeHelp" />

    <!-- Toast Notifications -->
    <ToastContainer />
  </div>
</template>

<style scoped>
/* Custom overrides for the application */
.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  border: 1px solid #dee2e6;
}

.navbar-brand {
  font-weight: 500;
}

.canvas-area {
  position: relative;
  flex: 1;
}

/* Drag and Drop Styles */
.draggable-container {
  width: 100%;
  margin: 0;
  padding: 0;
}

.draggable-section {
  transition: all 0.2s ease;
  margin-left: 0;
  margin-right: 0;
}

.drag-handle {
  background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
  border-bottom: 1px solid #dee2e6;
  user-select: none;
  min-height: 28px;
  padding: 4px 12px !important;
}

.drag-grip {
  color: #6c757d;
  font-size: 14px;
  line-height: 1;
  cursor: grab;
  padding: 2px;
  border-radius: 2px;
  transition: background-color 0.15s ease;
  user-select: none;
}

.drag-grip:active {
  cursor: grabbing;
}

.drag-grip:hover {
  background-color: rgba(0, 0, 0, 0.05);
}

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: #495057;
}

.collapse-btn,
.help-btn {
  min-width: 28px;
  height: 28px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  line-height: 1;
  border-radius: 4px;
}

.help-btn:hover {
  color: #007bff;
  border-color: #007bff;
}

/* Drag States */
.draggable-container.dragging {
  opacity: 0.7;
  transform: scale(0.98);
  z-index: 1000;
  pointer-events: none;
}

.draggable-container.drag-over {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(0, 123, 255, 0.15);
}

.draggable-container.drag-over .draggable-section {
  border-color: #007bff;
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.draggable-container.drag-over .drag-handle {
  background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
  border-color: #007bff;
}

/* Smooth transitions for reordering */
.draggable-container {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

/* Layout Editor Container */
.layout-editor-container {
  position: relative;
  overflow: hidden;
}

.canvas-area {
  overflow: hidden;
  position: relative;
}

/* Layout Editor Resize Handle */
.layout-editor-resize-handle {
  height: 6px;
  background: #f8f9fa;
  border-top: 1px solid #dee2e6;
  border-bottom: 1px solid #dee2e6;
  cursor: ns-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.layout-editor-resize-handle:hover,
.layout-editor-resize-handle.active {
  background: #e9ecef;
}

.resize-handle-line {
  width: 40px;
  height: 2px;
  background: #6c757d;
  border-radius: 1px;
  opacity: 0.5;
  transition: opacity 0.2s;
}

.layout-editor-resize-handle:hover .resize-handle-line,
.layout-editor-resize-handle.active .resize-handle-line {
  opacity: 0.8;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .drag-handle {
    padding: 3px 8px !important;
    min-height: 24px;
  }

  .drag-grip {
    font-size: 12px;
  }
}
</style>
