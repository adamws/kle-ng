<template>
  <div class="keyboard-metadata-panel">
    <div class="row g-3 h-100">
      <!-- Left Column: Basic Fields -->
      <div class="col-md-6">
        <div class="mb-3">
          <label class="form-label small mb-1">Name</label>
          <input
            v-model="currentName"
            @input="updateMetadata('name', currentName)"
            type="text"
            class="form-control form-control-sm"
            placeholder="My Keyboard Layout"
          />
        </div>
        <div class="mb-3">
          <label class="form-label small mb-1">Author</label>
          <input
            v-model="currentAuthor"
            @input="updateMetadata('author', currentAuthor)"
            type="text"
            class="form-control form-control-sm"
            placeholder="Your Name"
          />
        </div>
        <div class="mb-3">
          <label class="form-label small mb-1">Background Color</label>
          <div class="input-group input-group-sm">
            <ColorPicker
              v-model="currentBackcolor"
              @change="updateBackcolor"
              @input="updateBackcolorPreview"
              class="form-control form-control-color key-color-input"
              style="width: 24px; flex: none; border-radius: 0"
              title="Background Color"
            />
            <input
              v-model="currentBackcolor"
              @change="updateBackcolor"
              type="text"
              class="form-control form-control-sm"
              style="font-size: 0.65rem"
            />
          </div>
        </div>
      </div>

      <!-- Right Column: Notes -->
      <div class="col-md-6">
        <div class="h-100 d-flex flex-column">
          <label class="form-label small mb-1">Notes</label>
          <textarea
            v-model="currentNotes"
            @input="updateMetadata('notes', currentNotes)"
            class="form-control form-control-sm flex-grow-1"
            placeholder="Add notes about your keyboard layout..."
            style="min-height: 120px; resize: none"
          ></textarea>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import ColorPicker from './ColorPicker.vue'

const keyboardStore = useKeyboardStore()

// Reactive property values
const currentName = ref('')
const currentAuthor = ref('')
const currentNotes = ref('')
const currentBackcolor = ref('#ffffff')

// Update current values from store
const updateCurrentValues = () => {
  const metadata = keyboardStore.metadata
  currentName.value = metadata.name || ''
  currentAuthor.value = metadata.author || ''
  currentNotes.value = metadata.notes || ''
  currentBackcolor.value = metadata.backcolor || '#ffffff'
}

// Watch for metadata changes from store
watch(
  () => keyboardStore.metadata,
  () => {
    updateCurrentValues()
  },
  { deep: true, immediate: true },
)

// Update metadata in store
const updateMetadata = (field: keyof typeof keyboardStore.metadata, value: string) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(keyboardStore.metadata as any)[field] = value
  keyboardStore.saveState()
}

// Live preview background color update (no state save)
const updateBackcolorPreview = () => {
  // Force reactivity by reassigning the entire metadata object
  keyboardStore.metadata = {
    ...keyboardStore.metadata,
    backcolor: currentBackcolor.value,
  }
}

const updateBackcolor = () => {
  // Force reactivity by reassigning the entire metadata object
  keyboardStore.metadata = {
    ...keyboardStore.metadata,
    backcolor: currentBackcolor.value,
  }
  keyboardStore.saveState()
}
</script>

<style scoped>
.keyboard-metadata-panel {
  background: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 12px;
  height: 100%;
}

.form-control-sm {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
}

.form-control-color {
  padding: 0.125rem;
  border: 1px solid var(--bs-border-color);
}

.form-label.small {
  font-size: 0.7rem;
  color: #666;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.row.h-100 > .col-md-6 {
  display: flex;
  flex-direction: column;
}
</style>
