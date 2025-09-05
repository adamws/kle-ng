<template>
  <ToastNotification
    v-for="toastItem in toasts"
    :key="toastItem.id"
    :message="toastItem.message"
    :title="toastItem.title"
    :type="toastItem.type"
    :duration="toastItem.duration"
    :show-icon="toastItem.showIcon"
    :show-close-button="toastItem.showCloseButton"
    @close="removeToast(toastItem.id)"
  />
</template>

<script setup lang="ts">
import { toast } from '@/composables/useToast'
import ToastNotification from './ToastNotification.vue'

const { toasts, removeToast } = toast
</script>
