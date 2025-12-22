<script setup lang="ts">
import { ref, computed } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/utils/pcbApi'

const pcbStore = usePcbGeneratorStore()
const { taskStatus, isTaskActive } = storeToRefs(pcbStore)

const errorMessage = ref<string | null>(null)
const isSubmitting = ref(false)

const isGenerateDisabled = computed(() => isSubmitting.value || isTaskActive.value)

async function handleGeneratePcb() {
  errorMessage.value = null
  isSubmitting.value = true

  try {
    await pcbStore.startTask()
  } catch (error) {
    if (error instanceof ApiError) {
      errorMessage.value = error.userMessage
    } else {
      errorMessage.value = 'An unexpected error occurred. Please try again.'
    }
  } finally {
    isSubmitting.value = false
  }
}

function handleNewTask() {
  errorMessage.value = null
  pcbStore.resetTask()
}
</script>

<template>
  <div class="pcb-generator-controls">
    <!-- Error Alert -->
    <div v-if="errorMessage" class="alert alert-danger alert-dismissible py-2 mb-2" role="alert">
      <small>{{ errorMessage }}</small>
      <button
        type="button"
        class="btn-close btn-close-sm"
        aria-label="Close"
        @click="errorMessage = null"
      ></button>
    </div>

    <!-- Control Buttons -->
    <div class="d-grid gap-2">
      <button
        v-if="!taskStatus"
        type="button"
        class="btn btn-primary btn-sm"
        :disabled="isGenerateDisabled"
        @click="handleGeneratePcb"
        title="Generate PCB from current layout"
      >
        <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </span>
        Generate PCB
      </button>

      <button
        v-if="taskStatus"
        type="button"
        class="btn btn-secondary btn-sm"
        :disabled="isTaskActive"
        @click="handleNewTask"
      >
        New Task
      </button>
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-controls {
  padding: 0;
  margin-top: 1.5rem;
}
</style>
