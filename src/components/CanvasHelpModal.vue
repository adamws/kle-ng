<template>
  <div v-if="isVisible" class="modal fade show d-block" tabindex="-1" @click.self="close">
    <div class="modal-dialog modal-help">
      <div class="modal-content">
        <div class="modal-header">
          <h5 class="modal-title">
            <i class="bi bi-question-circle"></i>
            Keyboard Layout Editor NG - Help
          </h5>
          <button type="button" class="btn-close" @click="close" aria-label="Close"></button>
        </div>
        <div class="modal-body scrollable-content">
          <!-- Interactions Section -->
          <div class="interactions-grid">
            <!-- Mouse Interactions -->
            <div class="interaction-column">
              <h6 class="section-title">
                <i class="bi bi-mouse"></i>
                Mouse Controls
              </h6>
              <div class="controls-list">
                <div class="control-item">
                  <i class="bi bi-mouse-left control-icon"></i>
                  <div>
                    <strong>Left Click</strong>
                    <div class="control-desc">Select keys, drag for multi-select</div>
                  </div>
                </div>
                <div class="control-item">
                  <i class="bi bi-mouse-wheel control-icon"></i>
                  <div>
                    <strong>Middle Drag</strong>
                    <div class="control-desc">Move selected keys</div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Keyboard Shortcuts -->
            <div class="interaction-column">
              <h6 class="section-title">
                <i class="bi bi-keyboard"></i>
                Keyboard Shortcuts
              </h6>
              <div class="controls-list">
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>C</kbd></div>
                  <div>
                    <strong>Copy</strong>
                    <div class="control-desc">Copy selected keys</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>V</kbd></div>
                  <div>
                    <strong>Paste</strong>
                    <div class="control-desc">Paste keys from clipboard</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>X</kbd></div>
                  <div>
                    <strong>Cut</strong>
                    <div class="control-desc">Cut selected keys</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Del</kbd>/<kbd>Backspace</kbd></div>
                  <div>
                    <strong>Delete</strong>
                    <div class="control-desc">Remove selected keys</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>]</kbd></div>
                  <div>
                    <strong>Next Key</strong>
                    <div class="control-desc">Select next key in layout order</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>[</kbd></div>
                  <div>
                    <strong>Previous Key</strong>
                    <div class="control-desc">Select previous key in layout order</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>Z</kbd></div>
                  <div>
                    <strong>Undo</strong>
                    <div class="control-desc">Undo last action</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Arrows</kbd></div>
                  <div>
                    <strong>Move keys</strong>
                    <div class="control-desc">Nudge selected keys</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>A</kbd></div>
                  <div>
                    <strong>Add key</strong>
                    <div class="control-desc">Add new key to layout</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Shift</kbd><kbd>←</kbd><kbd>→</kbd></div>
                  <div>
                    <strong>Adjust width</strong>
                    <div class="control-desc">Change width of selected keys</div>
                  </div>
                </div>
                <div class="control-item">
                  <div class="kbd-combo"><kbd>Shift</kbd><kbd>↑</kbd><kbd>↓</kbd></div>
                  <div>
                    <strong>Adjust height</strong>
                    <div class="control-desc">Change height of selected keys</div>
                  </div>
                </div>
              </div>
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

/* Modal sizing for single viewport */
.modal-help {
  max-width: 900px;
  height: 95vh;
  margin: 2.5vh auto;
}

.modal-help .modal-content {
  display: flex;
  flex-direction: column;
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
  color: #007bff;
  font-weight: 600;
}

/* Two-column layout for interactions */
.interactions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.interaction-column {
  background: var(--bs-tertiary-bg);
  border-radius: 8px;
  padding: 1.25rem;
  border: 1px solid var(--bs-border-color);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #495057;
  font-weight: 600;
  margin-bottom: 1rem;
  font-size: 1rem;
}

.controls-list {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem 1rem;
  align-items: center;
}

.control-item {
  display: contents;
}

.control-icon {
  font-size: 1.25rem;
  color: #007bff;
  display: flex;
  align-items: center;
  justify-self: start;
  align-self: center;
}

.control-desc {
  font-size: 0.85rem;
  color: #6c757d;
  margin-top: 0.125rem;
}

/* Keyboard combo styling */
.kbd-combo {
  display: flex;
  gap: 0.25rem;
  justify-self: start;
  align-self: center;
  align-items: center;
}

.kbd-combo kbd {
  background: #495057;
  color: white;
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-family: monospace;
  border: 1px solid var(--bs-border-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* Tools section styling */
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
  color: #495057;
  font-weight: 600;
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid var(--bs-border-color);
}

.help-content {
  padding-left: 1.5rem;
}

.feature-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid #f1f3f4;
}

.feature-item:last-child {
  border-bottom: none;
}

.feature-item strong {
  color: #007bff;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .modal-help {
    margin: 1rem;
    height: calc(100vh - 2rem);
    max-width: none;
  }

  .interactions-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .scrollable-content {
    padding: 1rem;
  }

  .help-content {
    padding-left: 0;
  }

  .control-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .kbd-combo {
    min-width: auto;
  }
}
</style>
