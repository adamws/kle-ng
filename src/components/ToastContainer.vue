<template>
  <Teleport to="body">
    <div class="toast-container">
      <TransitionGroup name="toast-stack" tag="div">
        <ToastNotification
          v-for="(toastItem, index) in toasts"
          :key="toastItem.id"
          :message="toastItem.message"
          :title="toastItem.title"
          :type="toastItem.type"
          :duration="toastItem.duration"
          :show-icon="toastItem.showIcon"
          :show-close-button="toastItem.showCloseButton"
          :style="{ '--toast-index': index }"
          @close="removeToast(toastItem.id)"
        />
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { toast } from '@/composables/useToast'
import ToastNotification from './ToastNotification.vue'

const { toasts, removeToast } = toast
</script>

<style scoped>
.toast-container {
  position: fixed;
  top: 80px;
  right: 20px;
  z-index: 10001;
  pointer-events: none;
}

.toast-container > div {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Toast stack transitions */
.toast-stack-enter-active {
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.toast-stack-leave-active {
  transition: all 0.3s ease-in;
}

.toast-stack-move {
  transition: transform 0.3s ease;
}

.toast-stack-enter-from {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

.toast-stack-leave-to {
  opacity: 0;
  transform: translateX(100%) scale(0.95);
}

/* Responsive adjustments */
@media (max-width: 640px) {
  .toast-container {
    left: 20px;
    right: 20px;
  }

  .toast-stack-enter-from,
  .toast-stack-leave-to {
    transform: translateY(-100%) scale(0.95);
  }
}
</style>
