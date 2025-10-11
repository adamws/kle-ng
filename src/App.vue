<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import KeyboardToolbar from './components/KeyboardToolbar.vue'
import KeyboardCanvas from './components/KeyboardCanvas.vue'
import KeyPropertiesPanel from './components/KeyPropertiesPanel.vue'
import KeyboardMetadataPanel from './components/KeyboardMetadataPanel.vue'
import SummaryPanel from './components/SummaryPanel.vue'
import JsonEditorPanel from './components/JsonEditorPanel.vue'
import AppFooter from './components/AppFooter.vue'
import CanvasToolbar from './components/CanvasToolbar.vue'
import CanvasFooter from './components/CanvasFooter.vue'
import CanvasHelpModal from './components/CanvasHelpModal.vue'
import ToastContainer from './components/ToastContainer.vue'
import ThemeToggle from './components/ThemeToggle.vue'
import GitHubStarPopup from './components/GitHubStarPopup.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { useTheme } from '@/composables/useTheme'

const canvasRef = ref<InstanceType<typeof KeyboardCanvas>>()

const keyboardStore = useKeyboardStore()

// Initialize theme composable (theme will be initialized automatically on mount)
useTheme()

const sectionOrder = ref(['canvas', 'properties', 'json'])
const draggedSection = ref<string | null>(null)
const dragOverSection = ref<string | null>(null)

// Tab state for Key Properties section
const activePropertiesTab = ref<'properties' | 'metadata' | 'summary'>('properties')

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
  // Only highlight sections when dragging sections (not files)
  if (draggedSection.value) {
    dragOverSection.value = sectionId
  }
}

const handleDragLeave = () => {
  // Only clear section highlight when dragging sections (not files)
  if (draggedSection.value) {
    dragOverSection.value = null
  }
}

const handleDrop = (event: DragEvent, targetSectionId: string) => {
  event.preventDefault()

  // Only handle section reordering if we're dragging a section (not files)
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

// Conservative minimum to ensure all tools fit comfortably
const minLayoutEditorHeight = 530

// Layout Editor container resize functionality
const layoutEditorHeight = ref(minLayoutEditorHeight) // Initial height
const isResizing = ref(false)
const resizeStartY = ref(0)
const resizeStartHeight = ref(0)

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
    <header class="navbar app-header border-bottom py-2">
      <div class="container-fluid">
        <div
          class="w-100 d-flex flex-column flex-md-row align-items-stretch align-items-md-center gap-2"
        >
          <h1 class="navbar-brand mb-0 flex-shrink-0 text-center text-md-start">
            <strong>Keyboard Layout Editor NG</strong>
          </h1>
          <!-- On small screens: toolbar and theme toggle in same row -->
          <div class="d-flex flex-row flex-grow-1 align-items-center gap-2">
            <div class="flex-grow-1">
              <KeyboardToolbar />
            </div>
            <!-- Theme toggle grouped with toolbar buttons on small screens -->
            <div class="d-flex align-items-center flex-shrink-0">
              <ThemeToggle />
            </div>
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
              <!-- Tabs for Properties Section -->
              <div v-if="section.id === 'properties'" class="section-tabs">
                <button
                  class="tab-btn"
                  :class="{ active: activePropertiesTab === 'properties' }"
                  @click.stop="activePropertiesTab = 'properties'"
                >
                  Key Properties
                </button>
                <button
                  class="tab-btn"
                  :class="{ active: activePropertiesTab === 'metadata' }"
                  @click.stop="activePropertiesTab = 'metadata'"
                >
                  Keyboard Metadata
                </button>
                <button
                  class="tab-btn"
                  :class="{ active: activePropertiesTab === 'summary' }"
                  @click.stop="activePropertiesTab = 'summary'"
                >
                  Summary
                </button>
              </div>
              <!-- Regular title for other sections -->
              <span v-else class="section-title">{{ section.title }}</span>
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
          <!-- Key Properties Section Content -->
          <div
            v-if="section.id === 'properties' && !collapsedSections[section.id]"
            class="card-body"
          >
            <KeyPropertiesPanel v-if="activePropertiesTab === 'properties'" />
            <KeyboardMetadataPanel v-else-if="activePropertiesTab === 'metadata'" />
            <SummaryPanel v-else-if="activePropertiesTab === 'summary'" />
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

    <!-- GitHub Star Encouragement Popup -->
    <GitHubStarPopup />
  </div>
</template>

<style scoped>
/* Custom overrides for the application */
.card {
  box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075);
  border: 1px solid var(--bs-border-color);
}

/* Header theme support */
.app-header {
  background-color: var(--bs-tertiary-bg);
  color: var(--bs-body-color);
}

.navbar-brand {
  color: var(--bs-primary) !important;
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
  margin-top: 1rem;
  margin-left: 6px;
  margin-right: 6px;
}

.drag-handle {
  background-color: var(--bs-secondary-bg);
  border-bottom: 1px solid var(--bs-border-color);
  user-select: none;
  min-height: 28px;
  padding: 4px 12px !important;
}

.drag-grip {
  color: var(--bs-secondary-color);
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
  background-color: var(--bs-secondary-bg);
}

.section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--bs-secondary-color);
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
  border-color: var(--bs-primary);
  box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
}

.draggable-container.drag-over .drag-handle {
  background-color: var(--bs-primary-bg-subtle);
  border-color: var(--bs-primary);
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
  background: var(--bs-tertiary-bg);
  border-top: 1px solid var(--bs-border-color);
  border-bottom: 1px solid var(--bs-border-color);
  cursor: ns-resize;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.2s;
}

.layout-editor-resize-handle:hover,
.layout-editor-resize-handle.active {
  background: var(--bs-secondary-bg);
}

.resize-handle-line {
  width: 40px;
  height: 2px;
  background: var(--bs-secondary);
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

/* Header Tab Styles for Key Properties Section */
.section-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab-btn {
  background: none;
  border: none;
  color: var(--bs-secondary-color);
  padding: 0.25rem 0.5rem;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.15s ease-in-out;
  border-radius: 0.25rem;
  font-weight: 400;
}

.tab-btn:hover {
  color: var(--bs-secondary-color);
  background-color: var(--bs-secondary-bg);
}

.tab-btn.active {
  color: var(--bs-body-color);
  font-weight: 600;
  background-color: var(--bs-tertiary-bg);
}
</style>
