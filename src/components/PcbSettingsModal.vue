<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="close">
    <div class="modal-dialog modal-settings">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">PCB Generator Settings</h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body">
          <div class="settings-section">
            <label for="backend-url" class="form-label"> Backend Server URL </label>
            <div class="input-group">
              <input
                id="backend-url"
                type="text"
                class="form-control"
                v-model="localBackendUrl"
                placeholder="Enter backend URL"
              />
              <button
                type="button"
                class="btn btn-outline-secondary d-flex align-items-center gap-2"
                @click="resetToDefault"
                title="Reset to default"
              >
                <BiArrowCounterclockwise />
                Reset
              </button>
            </div>
            <div class="form-text">
              <span v-if="isUsingDefault" class="text-muted">
                Using default URL from environment
              </span>
              <span v-else class="text-info">
                <BiInfoCircle />
                Custom URL (session only)
              </span>
            </div>
          </div>
        </div>
        <div class="modal-footer">
          <button type="button" class="btn btn-primary" @click="close">Done</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { getDefaultBackendUrl } from '@/config/api'
import BiArrowCounterclockwise from 'bootstrap-icons/icons/arrow-counterclockwise.svg'
import BiInfoCircle from 'bootstrap-icons/icons/info-circle.svg'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const pcbStore = usePcbGeneratorStore()

// Local state for the input (to avoid immediate store updates on every keystroke)
const localBackendUrl = ref('')

// Check if using default URL
const isUsingDefault = computed(() => {
  return pcbStore.customBackendUrl === null
})

const close = () => {
  // Save to store before closing
  const trimmedUrl = localBackendUrl.value.trim()
  const defaultUrl = getDefaultBackendUrl()

  if (trimmedUrl === defaultUrl || trimmedUrl === '') {
    // If matches default or empty, reset to use default
    pcbStore.resetBackendUrl()
  } else {
    pcbStore.setBackendUrl(trimmedUrl)
  }

  emit('close')
}

const resetToDefault = () => {
  const defaultUrl = getDefaultBackendUrl()
  localBackendUrl.value = defaultUrl
  pcbStore.resetBackendUrl()
}

// Close on Escape key
const handleKeyDown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') {
    close()
  }
}

// Add/remove escape key listener when modal visibility changes
watch(
  () => props.isVisible,
  (visible) => {
    if (visible) {
      // Initialize with effective URL when modal opens
      localBackendUrl.value = pcbStore.effectiveBackendUrl
      document.addEventListener('keydown', handleKeyDown)
      document.body.classList.add('modal-open')
    } else {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.classList.remove('modal-open')
    }
  },
)

onMounted(() => {
  if (props.isVisible) {
    localBackendUrl.value = pcbStore.effectiveBackendUrl
    document.addEventListener('keydown', handleKeyDown)
    document.body.classList.add('modal-open')
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.body.classList.remove('modal-open')
})
</script>

<style scoped>
.modal {
  background: rgba(0, 0, 0, 0.5);
}

.modal-settings {
  max-width: 500px;
  margin: 10vh auto;
}

.modal-header .modal-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.settings-section {
  margin-bottom: 1rem;
}

.settings-section:last-child {
  margin-bottom: 0;
}

.settings-section .form-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.form-text {
  margin-top: 0.5rem;
  font-size: 0.875rem;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .modal-settings {
    margin: 1rem;
    max-width: none;
  }

  .input-group {
    flex-direction: column;
  }

  .input-group .btn {
    border-radius: 0.375rem;
    margin-top: 0.5rem;
  }
}
</style>
