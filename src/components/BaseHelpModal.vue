<template>
  <div
    v-if="isVisible"
    class="modal fade show d-block"
    tabindex="-1"
    role="dialog"
    aria-modal="true"
    @click.self="close"
  >
    <div class="modal-dialog modal-help" :class="{ 'modal-help--full-height': fullHeight }">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <slot name="icon">
              <i class="bi bi-question-circle"></i>
            </slot>
            {{ title }}
          </h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body scrollable-content">
          <slot></slot>
        </div>
        <div class="modal-footer">
          <slot name="footer">
            <button type="button" class="btn btn-primary" @click="close">Got it!</button>
          </slot>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

interface Props {
  isVisible: boolean
  title: string
  maxWidth?: number
  fullHeight?: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = withDefaults(defineProps<Props>(), {
  maxWidth: 900,
  fullHeight: false,
})

const emit = defineEmits<Emits>()

const close = () => {
  emit('close')
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

/* Modal sizing - default behavior */
.modal-help {
  max-width: v-bind('`${maxWidth}px`');
  max-height: 90vh;
  margin: 5vh auto;
}

.modal-help .modal-content {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
}

/* Full height variant (for CanvasHelpModal) */
.modal-help--full-height {
  height: 95vh;
  max-height: 95vh;
  margin: 2.5vh auto;
}

.modal-help--full-height .modal-content {
  max-height: 95vh;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
}

.modal-header .modal-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.modal-header .modal-title > :first-child {
  display: inline-flex;
  align-items: center;
  line-height: 1;
}

/* Shared help section styles - use :deep() for slot content */
:deep(.help-section) {
  margin-bottom: 1.5rem;
}

:deep(.help-section:last-child) {
  margin-bottom: 0;
}

:deep(.help-section-title) {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--bs-body-color);
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--bs-border-color);
}

:deep(.help-content) {
  padding-left: 1.5rem;
}

:deep(.help-content p) {
  margin-bottom: 0.75rem;
}

:deep(.help-content p:last-child) {
  margin-bottom: 0;
}

:deep(.help-content ol) {
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}

:deep(.help-content ol li) {
  margin-bottom: 0.5rem;
}

:deep(.help-content ol li:last-child) {
  margin-bottom: 0;
}

:deep(.help-content code) {
  background-color: var(--bs-secondary-bg);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
}

:deep(.tips-list) {
  padding-left: 1.25rem;
  margin-bottom: 0;
}

:deep(.tips-list li) {
  margin-bottom: 0.5rem;
}

:deep(.tips-list li:last-child) {
  margin-bottom: 0;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .modal-help {
    margin: 1rem;
    height: calc(100vh - 2rem);
    max-width: none;
  }

  .scrollable-content {
    padding: 1rem;
  }

  :deep(.help-content) {
    padding-left: 0;
  }
}
</style>
