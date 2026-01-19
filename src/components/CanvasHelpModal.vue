<template>
  <BaseHelpModal
    :is-visible="isVisible"
    title="Layout Editor - Help"
    :full-height="true"
    @close="close"
  >
    <!-- Interactions Section -->
    <div class="interactions-grid">
      <!-- Left Column: Mouse Controls + Tips & Hints -->
      <div class="left-column">
        <!-- Mouse Controls -->
        <div class="interaction-column">
          <h6 class="section-title">Mouse Controls</h6>
          <div class="controls-list">
            <div class="control-item">
              <i class="bi bi-mouse control-icon"></i>
              <div>
                <strong>Left Click</strong>
                <div>Select keys, drag for multi-select</div>
              </div>
            </div>
            <div class="control-item">
              <i class="bi bi-mouse control-icon"></i>
              <div>
                <strong>Middle Click and Drag</strong>
                <div>Move selected keys</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Tips & Hints Section -->
        <div class="interaction-column">
          <h6 class="section-title">Tips & Hints</h6>
          <div class="tips-grid">
            <div class="tip-item">
              <i class="bi bi-book control-icon text-primary"></i>
              <div>
                <strong>Detailed Documentation</strong>
                <div>
                  For comprehensive help, visit the
                  <a
                    href="https://github.com/adamws/kle-ng"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="github-link"
                  >
                    GitHub repository
                    <i class="bi bi-box-arrow-up-right"></i>
                  </a>
                </div>
              </div>
            </div>
            <div class="tip-item">
              <i class="bi bi-lightbulb control-icon text-warning"></i>
              <div>
                <strong>Export Resolution</strong>
                <div>Zoom in on the canvas to increase PNG export resolution</div>
              </div>
            </div>
            <div class="tip-item">
              <i class="bi bi-clipboard-plus control-icon text-info"></i>
              <div>
                <strong>Cross-Instance Copy & Paste</strong>
                <div>
                  Copy keys in one browser tab/window and paste them in another KLE-NG instance
                </div>
              </div>
            </div>
            <div class="tip-item">
              <i class="bi bi-image control-icon text-success"></i>
              <div>
                <strong>Image & SVG Labels</strong>
                <div>
                  Use <code>&lt;img src="..."&gt;</code> for external images or
                  <code>&lt;svg&gt;...&lt;/svg&gt;</code> for inline SVG graphics
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Keyboard Shortcuts -->
      <div class="interaction-column">
        <h6 class="section-title">Keyboard Shortcuts</h6>
        <div class="controls-list">
          <div class="control-item">
            <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>C</kbd></div>
            <div>
              <strong>Copy</strong>
              <div>Copy selected keys</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>V</kbd></div>
            <div>
              <strong>Paste</strong>
              <div>Paste keys from clipboard</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>X</kbd></div>
            <div>
              <strong>Cut</strong>
              <div>Cut selected keys</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Del</kbd>/<kbd>Backspace</kbd></div>
            <div>
              <strong>Delete</strong>
              <div>Remove selected keys</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>]</kbd></div>
            <div>
              <strong>Next Key</strong>
              <div>Select next key in layout order</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>[</kbd></div>
            <div>
              <strong>Previous Key</strong>
              <div>Select previous key in layout order</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Ctrl</kbd><kbd>Z</kbd></div>
            <div>
              <strong>Undo</strong>
              <div>Undo last action</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Arrows</kbd></div>
            <div>
              <strong>Move keys</strong>
              <div>Nudge selected keys</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>A</kbd></div>
            <div>
              <strong>Add key</strong>
              <div>Add new key to layout</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Shift</kbd><kbd>←</kbd><kbd>→</kbd></div>
            <div>
              <strong>Adjust width</strong>
              <div>Change width of selected keys</div>
            </div>
          </div>
          <div class="control-item">
            <div class="kbd-combo"><kbd>Shift</kbd><kbd>↑</kbd><kbd>↓</kbd></div>
            <div>
              <strong>Adjust height</strong>
              <div>Change height of selected keys</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </BaseHelpModal>
</template>

<script setup lang="ts">
import BaseHelpModal from './BaseHelpModal.vue'

interface Props {
  isVisible: boolean
}

interface Emits {
  (e: 'close'): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const close = () => {
  emit('close')
}
</script>

<style scoped>
/* Grid layout for interactions - two main columns */
.interactions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 2rem;
  margin-bottom: 1.5rem;
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
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
  font-weight: 600;
  margin-bottom: 1rem;
  font-size: 1rem;
}

.controls-list,
.tips-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.75rem 1rem;
  align-items: center;
}

.control-item,
.tip-item {
  display: contents;
}

.control-icon {
  font-size: 1.25rem;
  display: flex;
  align-items: center;
  justify-self: start;
  align-self: center;
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
  background-color: var(--bs-dark);
  color: var(--bs-light);
  padding: 0.125rem 0.375rem;
  border-radius: 3px;
  font-size: 0.75rem;
  font-family: monospace;
  border: 1px solid var(--bs-border-color);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}

/* GitHub link styling */
.github-link {
  color: var(--bs-link-color);
  text-decoration: none;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
}

.github-link:hover {
  text-decoration: underline;
  color: var(--bs-link-hover-color);
}

.github-link i {
  font-size: 0.875rem;
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .interactions-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
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
