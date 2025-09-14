<template>
  <Teleport to="body">
    <Transition name="toast" appear>
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
    </Transition>
  </Teleport>
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
  position: fixed;
  top: 20px;
  right: 20px;
  min-width: 320px;
  max-width: 500px;
  background: white;
  border-radius: 8px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.15),
    0 2px 8px rgba(0, 0, 0, 0.1);
  border-left: 4px solid;
  z-index: 10001;
  overflow: hidden;
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
  color: var(--bs-secondary);
}

.toast-close {
  flex-shrink: 0;
  background: none;
  border: none;
  font-size: 16px;
  color: var(--bs-secondary);
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

/* Transitions */
.toast-enter-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-leave-active {
  transition: all 0.3s ease-in;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.toast-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .toast-notification {
    left: 20px;
    right: 20px;
    min-width: auto;
    max-width: none;
  }

  .toast-enter-from,
  .toast-leave-to {
    transform: translateY(-100%) scale(0.95);
  }
}

/* Multiple toast stacking support */
.toast-notification:nth-of-type(2) {
  top: 110px;
}

.toast-notification:nth-of-type(3) {
  top: 200px;
}

.toast-notification:nth-of-type(4) {
  top: 290px;
}

.toast-notification:nth-of-type(n + 5) {
  display: none; /* Hide excessive toasts */
}
</style>
