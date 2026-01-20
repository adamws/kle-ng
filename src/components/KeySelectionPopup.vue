<template>
  <Teleport to="body">
    <div v-if="visible" class="key-selection-overlay" @click.self="close" @contextmenu.prevent>
      <div
        ref="popupRef"
        class="key-selection-popup"
        :style="popupStyle"
        role="listbox"
        aria-label="Select overlapping key"
        @keydown="handleKeyDown"
      >
        <div class="popup-header">Select Key</div>
        <ul class="popup-list" role="presentation">
          <li
            v-for="(key, index) in keys"
            :key="index"
            class="popup-item"
            :class="{ 'popup-item--focused': focusedIndex === index }"
            role="option"
            :aria-selected="focusedIndex === index"
            @click="selectKey(key)"
            @mouseenter="handleMouseEnter(key, index)"
            @mouseleave="handleMouseLeave"
          >
            <span class="key-color" :style="{ backgroundColor: key.color || '#cccccc' }"></span>
            <span class="key-label">{{ getKeyLabel(key) }}</span>
            <span class="key-info">{{ getKeyInfo(key) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import type { Key } from '@adamws/kle-serial'

interface Props {
  visible: boolean
  position: { x: number; y: number }
  keys: Key[]
}

interface Emits {
  (e: 'select', key: Key): void
  (e: 'close'): void
  (e: 'highlight', key: Key): void
  (e: 'unhighlight'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const popupRef = ref<HTMLElement | null>(null)
const focusedIndex = ref(0)

// Calculate popup position with viewport clamping
const popupStyle = computed(() => {
  const padding = 8
  const popupWidth = 280
  const popupMaxHeight = 300

  let x = props.position.x
  let y = props.position.y

  // Clamp to viewport boundaries
  if (typeof window !== 'undefined') {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    // Horizontal clamping
    if (x + popupWidth + padding > viewportWidth) {
      x = viewportWidth - popupWidth - padding
    }
    if (x < padding) {
      x = padding
    }

    // Vertical clamping
    if (y + popupMaxHeight + padding > viewportHeight) {
      y = viewportHeight - popupMaxHeight - padding
    }
    if (y < padding) {
      y = padding
    }
  }

  return {
    left: `${x}px`,
    top: `${y}px`,
  }
})

// Get primary label for display
function getKeyLabel(key: Key): string {
  if (key.labels) {
    const primaryLabel = key.labels.find((l) => l && l.trim())
    if (primaryLabel) {
      // Truncate long labels
      return primaryLabel.length > 12 ? primaryLabel.substring(0, 12) + '...' : primaryLabel
    }
  }
  return '[no label]'
}

// Get key info (dimensions, position, rotation)
function getKeyInfo(key: Key): string {
  const width = key.width || 1
  const height = key.height || 1
  const dims = `${width}×${height}u`
  const pos = `(at ${key.x}, ${key.y})`
  return `${dims} ${pos}`
}

function selectKey(key: Key) {
  emit('select', key)
}

function close() {
  emit('close')
}

function handleMouseEnter(key: Key, index: number) {
  focusedIndex.value = index
  emit('highlight', key)
}

function handleMouseLeave() {
  emit('unhighlight')
}

function handleKeyDown(event: KeyboardEvent) {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      focusedIndex.value = (focusedIndex.value + 1) % props.keys.length
      {
        const key = props.keys[focusedIndex.value]
        if (key) emit('highlight', key)
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      focusedIndex.value = (focusedIndex.value - 1 + props.keys.length) % props.keys.length
      {
        const key = props.keys[focusedIndex.value]
        if (key) emit('highlight', key)
      }
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      {
        const key = props.keys[focusedIndex.value]
        if (key) selectKey(key)
      }
      break
    case 'Escape':
      event.preventDefault()
      close()
      break
  }
}

// Global escape key handler
function handleGlobalKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.visible) {
    close()
  }
}

// Focus popup when it becomes visible
watch(
  () => props.visible,
  async (visible) => {
    if (visible) {
      focusedIndex.value = 0
      document.addEventListener('keydown', handleGlobalKeyDown)
      await nextTick()
      popupRef.value?.focus()
      // Highlight first key
      const firstKey = props.keys[0]
      if (firstKey) {
        emit('highlight', firstKey)
      }
    } else {
      document.removeEventListener('keydown', handleGlobalKeyDown)
      emit('unhighlight')
    }
  },
)

onMounted(() => {
  if (props.visible) {
    document.addEventListener('keydown', handleGlobalKeyDown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleGlobalKeyDown)
})
</script>

<style scoped>
.key-selection-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1050;
}

.key-selection-popup {
  position: fixed;
  min-width: 200px;
  max-width: 280px;
  max-height: 300px;
  background: var(--bs-body-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 0.5rem;
  box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 1051;
  outline: none;
}

.popup-header {
  padding: 0.5rem 0.75rem;
  font-weight: 600;
  font-size: 0.875rem;
  color: var(--bs-secondary-color);
  border-bottom: 1px solid var(--bs-border-color);
  background: var(--bs-tertiary-bg);
}

.popup-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 250px;
  overflow-y: auto;
}

.popup-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.popup-item:hover,
.popup-item--focused {
  background: var(--bs-tertiary-bg);
}

.popup-item:active {
  background: var(--bs-secondary-bg);
}

.key-color {
  width: 16px;
  height: 16px;
  border-radius: 3px;
  border: 1px solid var(--bs-border-color);
  flex-shrink: 0;
}

.key-label {
  font-weight: 500;
  flex-shrink: 0;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.key-info {
  font-size: 0.75rem;
  color: var(--bs-secondary-color);
  margin-left: auto;
  white-space: nowrap;
}
</style>
