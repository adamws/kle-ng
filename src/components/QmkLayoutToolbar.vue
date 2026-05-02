<script setup lang="ts">
import { computed } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { getQmkLayouts } from '@/utils/qmk-layout-options'

const keyboardStore = useKeyboardStore()

const layouts = computed(() =>
  getQmkLayouts(keyboardStore.keys, keyboardStore.metadata as Record<string, unknown>),
)

function isActive(index: number): boolean {
  return keyboardStore.displayQmkLayout === index
}

function handleLayoutClick(index: number) {
  if (keyboardStore.displayQmkLayout === index) {
    keyboardStore.setDisplayQmkLayout(null)
  } else {
    keyboardStore.setDisplayQmkLayout(index)
  }
}
</script>

<template>
  <div v-if="layouts" class="qmk-layout-toolbar" data-testid="qmk-layout-toolbar">
    <button
      class="bubble-btn"
      :class="{ active: keyboardStore.displayQmkLayout === null }"
      title="Show all QMK layouts"
      data-testid="qmk-layout-all"
      @click="keyboardStore.setDisplayQmkLayout(null)"
    >
      <span class="bubble-label all-label">all</span>
    </button>

    <div class="layout-group">
      <button
        v-for="layout in layouts"
        :key="layout.index"
        class="bubble-btn"
        :class="{ active: isActive(layout.index) }"
        :title="layout.name"
        data-testid="qmk-layout-btn"
        :data-layout-index="layout.index"
        @click="handleLayoutClick(layout.index)"
      >
        <span class="bubble-label">{{ layout.index }}</span>
      </button>
    </div>

    <span
      v-if="keyboardStore.displayQmkLayout !== null"
      class="preview-hint"
      data-testid="qmk-layout-preview-hint"
    >
      QMK layout preview (<em class="text-warning">readonly</em>) — switch to
      <strong>all</strong> to edit
    </span>
  </div>
</template>

<style scoped>
.qmk-layout-toolbar {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
}

.layout-group {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: 6px;
  padding-left: 6px;
  border-left: 1px solid var(--bs-border-color, #dee2e6);
}

.bubble-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1.5px solid var(--bs-secondary-color, #6c757d);
  background: transparent;
  color: var(--bs-secondary-color, #6c757d);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  cursor: pointer;
  transition:
    border-color 0.15s ease,
    color 0.15s ease,
    background 0.15s ease;
  flex-shrink: 0;
}

.bubble-btn:hover {
  border-color: var(--bs-primary, #0d6efd);
  color: var(--bs-primary, #0d6efd);
  background: rgba(var(--bs-primary-rgb, 13 110 253), 0.08);
}

.bubble-btn.active {
  border-color: var(--bs-secondary-color);
  background: var(--bs-secondary-color);
  color: var(--bs-body-bg);
}

.bubble-label {
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  user-select: none;
  font-size: 0.6rem;
  font-weight: 700;
}

.all-label {
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.preview-hint {
  margin-left: 8px;
  font-size: 0.75rem;
  color: var(--bs-secondary-color, #6c757d);
  white-space: nowrap;
}
</style>
