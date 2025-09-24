<template>
  <div
    v-if="visible"
    class="toast-notification"
    :class="[`toast-${type}`, { 'toast-with-icon': showIcon }]"
    role="alert"
    aria-live="polite"
  >
    <div class="toast-content">
      <div v-if="showIcon" class="toast-icon">
        <i v-if="type === 'success'" class="bi bi-check-circle-fill"></i>
        <i v-else-if="type === 'error'" class="bi bi-exclamation-triangle-fill"></i>
        <i v-else-if="type === 'warning'" class="bi bi-exclamation-triangle-fill"></i>
        <i v-else class="bi bi-info-circle-fill"></i>
      </div>
      <div class="toast-message">
        <div v-if="title" class="toast-title">{{ title }}</div>
        <div class="toast-text">{{ message }}</div>
      </div>
      <button
        v-if="showCloseButton"
        @click="close"
        class="toast-close"
        type="button"
        aria-label="Close notification"
      >
        <i class="bi bi-x"></i>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

export interface ToastProps {
  message: string
  title?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  showIcon?: boolean
  showCloseButton?: boolean
}

const props = withDefaults(defineProps<ToastProps>(), {
  type: 'info',
  duration: 4000,
  showIcon: true,
  showCloseButton: true,
})

const emit = defineEmits<{
  close: []
}>()

const visible = ref(true)
let timeoutId: number | null = null

const close = () => {
  visible.value = false
  if (timeoutId) {
    clearTimeout(timeoutId)
    timeoutId = null
  }
  // Wait for exit transition to complete
  setTimeout(() => {
    emit('close')
  }, 300)
}

onMounted(() => {
  if (props.duration > 0) {
    timeoutId = window.setTimeout(() => {
      close()
    }, props.duration)
  }
})

onUnmounted(() => {
  if (timeoutId) {
    clearTimeout(timeoutId)
  }
})
</script>

<style scoped>
.toast-notification {
  position: relative;
  min-width: 320px;
  max-width: 500px;
  background: var(--bs-body-bg);
  color: var(--bs-body-color);
  border: 1px solid var(--bs-border-color);
  border-radius: 8px;
  box-shadow: var(--bs-box-shadow);
  border-left: 4px solid;
  overflow: hidden;
  pointer-events: auto;
}

.toast-content {
  display: flex;
  align-items: flex-start;
  padding: 16px;
  gap: 12px;
}

.toast-icon {
  flex-shrink: 0;
  font-size: 20px;
  margin-top: 2px;
}

.toast-message {
  flex: 1;
  min-width: 0;
}

.toast-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  line-height: 1.3;
}

.toast-text {
  font-size: 14px;
  line-height: 1.4;
  color: var(--bs-secondary-color);
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--bs-secondary-color);
  cursor: pointer;
  padding: 2px;
  border-radius: 2px;
  transition:
    color 0.15s ease,
    background-color 0.15s ease;
  margin-top: -2px;
  margin-right: -4px;
}

.toast-close:hover {
  color: var(--bs-secondary-color);
  background-color: rgba(0, 0, 0, 0.05);
}

/* Toast type variants */
.toast-success {
  border-left-color: var(--bs-success);
}

.toast-success .toast-icon {
  color: var(--bs-success);
}

.toast-success .toast-title {
  color: var(--bs-success);
}

.toast-error {
  border-left-color: var(--bs-danger);
}

.toast-error .toast-icon {
  color: var(--bs-danger);
}

.toast-error .toast-title {
  color: var(--bs-danger);
}

.toast-warning {
  border-left-color: var(--bs-warning);
}

.toast-warning .toast-icon {
  color: var(--bs-warning-text);
}

.toast-warning .toast-title {
  color: var(--bs-warning-text);
}

.toast-info {
  border-left-color: var(--bs-info);
}

.toast-info .toast-icon {
  color: var(--bs-info);
}

.toast-info .toast-title {
  color: var(--bs-info);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .toast-notification {
    min-width: auto;
    max-width: none;
  }
}
</style>
