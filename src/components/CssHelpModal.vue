<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="close">
    <div class="modal-dialog modal-help">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-question-circle"></i>
            CSS Metadata - Help
          </h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body scrollable-content">
          <div class="help-section">
            <h6 class="help-section-title">
              <i class="bi bi-info-circle"></i>
              What is CSS Metadata?
            </h6>
            <div class="help-content">
              <p>
                The original
                <a href="https://www.keyboard-layout-editor.com/" target="_blank"
                  >Keyboard Layout Editor</a
                >
                provided
                <a
                  href="https://github.com/ijprest/keyboard-layout-editor/wiki/Custom-Styles"
                  target="_blank"
                  >fine-grained</a
                >
                control over keyboard CSS style via <code>css</code> metadata field defined in a
                layout.
              </p>
              <p>
                When you import a KLE layout, kle-ng displays that metadata value in this field.
              </p>
            </div>
          </div>

          <div class="help-section">
            <h6 class="help-section-title">
              <i class="bi bi-lightbulb"></i>
              Supported CSS Features
            </h6>
            <div class="help-content">
              <p>The kle-ng supports only a minimal subset of CSS:</p>
              <ol>
                <li>
                  <code>@import url(...);</code> - Loads external font stylesheet (e.g., Google
                  Fonts)
                </li>
              </ol>

              <p>
                The font name is automatically extracted from the URL and applied globally to all
                canvas text. It is not possible to define different fonts for different key labels.
              </p>
              <p>All other CSS expressions are ignored and have no effect.</p>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button type="button" class="btn btn-primary" @click="close">Got it!</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

const props = defineProps<Props>()
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
import { watch, onMounted, onUnmounted } from 'vue'

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

/* Modal sizing */
.modal-help {
  max-width: 900px;
  max-height: 90vh;
  margin: 5vh auto;
}

.modal-help .modal-content {
  display: flex;
  flex-direction: column;
  max-height: 90vh;
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

/* Help sections */
.help-section {
  margin-bottom: 1.5rem;
}

.help-section:last-child {
  margin-bottom: 0;
}

.help-section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--bs-body-color);
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--bs-border-color);
}

.help-content {
  padding-left: 1.5rem;
}

.help-content p {
  margin-bottom: 0.75rem;
}

.help-content p:last-child {
  margin-bottom: 0;
}

.tips-list {
  padding-left: 1.25rem;
  margin-bottom: 0;
}

.tips-list li {
  margin-bottom: 0.5rem;
}

.tips-list li:last-child {
  margin-bottom: 0;
}

.help-content ol {
  padding-left: 1.25rem;
  margin-bottom: 0.75rem;
}

.help-content ol li {
  margin-bottom: 0.5rem;
}

.help-content ol li:last-child {
  margin-bottom: 0;
}

.help-content code {
  background-color: var(--bs-secondary-bg);
  padding: 0.125rem 0.25rem;
  border-radius: 0.25rem;
  font-size: 0.9em;
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

  .help-content {
    padding-left: 0;
  }
}
</style>
