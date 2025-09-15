<template>
  <fieldset :disabled="isDisabled" :class="{ 'opacity-50': isDisabled }">
    <div class="mb-2">
      <div class="d-flex justify-content-between align-items-center">
        <small class="text-muted"> Edit the JSON directly </small>
        <div v-if="hasJsonError" class="text-danger small">
          <i class="bi bi-exclamation-triangle"></i> Invalid JSON
        </div>
        <div v-else-if="hasChanges" class="text-warning small">
          <i class="bi bi-pencil"></i> Unsaved changes
        </div>
        <div v-else class="text-success small"><i class="bi bi-check"></i> Valid JSON</div>
        <div class="d-flex gap-2">
          <button
            @click="formatJson"
            class="btn btn-outline-secondary btn-sm"
            :disabled="hasJsonError || isDisabled"
          >
            Format
          </button>
          <button
            @click="applyChanges"
            class="btn btn-primary btn-sm"
            :disabled="hasJsonError || isDisabled"
          >
            Apply Changes
          </button>
        </div>
      </div>
    </div>

    <div class="position-relative">
      <textarea
        v-model="jsonContent"
        @input="onJsonChange"
        class="form-control font-monospace"
        :class="{ 'is-invalid': hasJsonError }"
        rows="20"
        spellcheck="false"
        placeholder="Loading JSON..."
      ></textarea>

      <div v-if="hasJsonError" class="invalid-feedback d-block">
        {{ jsonError }}
      </div>
    </div>

    <div class="mt-2">
      <small class="text-muted">
        This editor supports the
        <a
          href="https://github.com/ijprest/keyboard-layout-editor/wiki/Serialized-Data-Format"
          target="_blank"
          class="text-decoration-none"
        >
          KLE JSON format</a
        >. JSON is validated automatically as you type. Changes are applied when you click "Apply
        Changes" or use Ctrl+Enter.
      </small>
    </div>
  </fieldset>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { parseJsonString } from '@/utils/serialization'
import { D } from '@/utils/decimal-math'

// Store
const keyboardStore = useKeyboardStore()

// Component state
const jsonContent = ref('')
const originalJson = ref('')
const hasJsonError = ref(false)
const jsonError = ref('')

// Compact JSON formatting similar to original KLE
const formatJsonCompact = (data: unknown[]): string => {
  const result: string[] = []

  data.forEach((elem) => {
    // Include all elements - metadata and key rows
    result.push(toJsonCompactLine(elem))
  })

  return '[' + result.join(',\n') + ']'
}

// Convert object/array to compact single-line JSON
const toJsonCompactLine = (obj: unknown): string => {
  if (Array.isArray(obj)) {
    const items = obj.map((elem) => toJsonCompactLine(elem))
    return '[' + items.join(',') + ']'
  }

  if (typeof obj === 'object' && obj !== null) {
    const pairs: string[] = []
    const objAsRecord = obj as Record<string, unknown>
    for (const key in objAsRecord) {
      if (Object.prototype.hasOwnProperty.call(objAsRecord, key)) {
        const value = objAsRecord[key]
        // Skip undefined values to match original keyboard-layout-editor behavior
        if (value !== undefined) {
          pairs.push(`${JSON.stringify(key)}:${toJsonCompactLine(value)}`)
        }
      }
    }
    return '{' + pairs.join(',') + '}'
  }

  if (typeof obj === 'number') {
    // Round to 6 decimal places maximum for better precision display
    return D.format(obj, 6).toString()
  }

  return JSON.stringify(obj)
}

// Actions
const validateJson = () => {
  try {
    parseJsonString(jsonContent.value)
    hasJsonError.value = false
    jsonError.value = ''
    return true
  } catch (error) {
    hasJsonError.value = true
    jsonError.value = error instanceof Error ? error.message : 'Invalid JSON format'
    return false
  }
}

const onJsonChange = () => {
  validateJson()
}

const formatJson = () => {
  if (validateJson()) {
    try {
      const parsed = parseJsonString(jsonContent.value)
      if (Array.isArray(parsed)) {
        jsonContent.value = formatJsonCompact(parsed)
      } else {
        jsonContent.value = JSON.stringify(parsed, null, 2)
      }
    } catch (error) {
      console.error('Error formatting JSON:', error)
    }
  }
}

// Computed
const hasChanges = computed(() => {
  return jsonContent.value !== originalJson.value && !hasJsonError.value
})

const isDisabled = computed(() => {
  return (
    keyboardStore.canvasMode === 'rotate' ||
    keyboardStore.canvasMode === 'mirror-h' ||
    keyboardStore.canvasMode === 'mirror-v'
  )
})

// Load JSON from store
const loadJsonFromStore = () => {
  try {
    const data = keyboardStore.getSerializedData('kle')
    const formatted = Array.isArray(data) ? formatJsonCompact(data) : JSON.stringify(data, null, 2)
    jsonContent.value = formatted
    originalJson.value = formatted
    hasJsonError.value = false
    jsonError.value = ''
  } catch (error) {
    console.error('Error loading JSON from store:', error)
    jsonError.value = 'Error loading layout data'
    hasJsonError.value = true
  }
}

// Watch for store changes and update JSON
watch(
  [() => keyboardStore.keys, () => keyboardStore.metadata],
  () => {
    // Always update JSON editor to synchronize with internal state,
    // even when there are unsaved changes
    loadJsonFromStore()
  },
  { deep: true },
)

// Initialize
loadJsonFromStore()

const applyChanges = () => {
  if (!validateJson()) {
    return
  }

  try {
    const data = parseJsonString(jsonContent.value)
    keyboardStore.updateLayoutFromJson(data) // Use new method that preserves undo history
    // Update the original JSON with compact formatting
    if (Array.isArray(data)) {
      originalJson.value = formatJsonCompact(data)
      jsonContent.value = originalJson.value
    } else {
      originalJson.value = jsonContent.value
    }
    console.log('Applied JSON changes to keyboard layout (with undo support)')
  } catch (error) {
    console.error('Error applying JSON changes:', error)
    jsonError.value = error instanceof Error ? error.message : 'Error applying changes'
    hasJsonError.value = true
  }
}

// Keyboard shortcut for apply changes
const handleKeydown = (event: KeyboardEvent) => {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    applyChanges()
  }
}

// Add keyboard event listener
nextTick(() => {
  document.addEventListener('keydown', handleKeydown)
})

// Cleanup
const cleanup = () => {
  document.removeEventListener('keydown', handleKeydown)
}

// Handle component unmount
onMounted(() => {
  return cleanup
})
</script>

<style scoped>
.font-monospace {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 0.875rem;
  line-height: 1.4;
}

textarea.font-monospace {
  resize: vertical;
  min-height: 300px;
}

.is-invalid {
  border-color: var(--bs-danger);
}

.is-invalid:focus {
  box-shadow: 0 0 0 0.25rem var(--bs-danger-border-subtle);
}
</style>
