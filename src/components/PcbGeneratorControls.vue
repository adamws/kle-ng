<script setup lang="ts">
import { ref } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'
import { ApiError } from '@/utils/pcbApi'

const pcbStore = usePcbGeneratorStore()
const { taskStatus, isTaskActive, isTaskSuccess, isTaskFailed } = storeToRefs(pcbStore)

const errorMessage = ref<string | null>(null)
const isSubmitting = ref(false)

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

function getStatusMessage(): string {
  if (!taskStatus.value) return ''

  switch (taskStatus.value.task_status) {
    case 'PENDING':
      return 'Task is queued...'
    case 'PROGRESS': {
      const percentage = taskStatus.value.task_result?.percentage ?? 0
      return `Generating PCB... ${percentage}%`
    }
    case 'SUCCESS':
      return 'PCB generated successfully!'
    case 'FAILURE':
      return taskStatus.value.task_result?.error ?? 'Task failed'
    default:
      return ''
  }
}

function getProgressPercentage(): number {
  if (!taskStatus.value || !isTaskActive.value) return 0
  return taskStatus.value.task_result?.percentage ?? 0
}
</script>

<template>
  <div class="pcb-generator-controls">
    <!-- Error Alert -->
    <div v-if="errorMessage" class="alert alert-danger alert-dismissible" role="alert">
      {{ errorMessage }}
      <button
        type="button"
        class="btn-close"
        aria-label="Close"
        @click="errorMessage = null"
      ></button>
    </div>

    <!-- Control Buttons -->
    <div class="d-flex gap-2 mb-3">
      <button
        v-if="!taskStatus"
        type="button"
        class="btn btn-primary"
        :disabled="isSubmitting || isTaskActive"
        @click="handleGeneratePcb"
      >
        <span v-if="isSubmitting" class="spinner-border spinner-border-sm me-2" role="status">
          <span class="visually-hidden">Loading...</span>
        </span>
        Generate PCB
      </button>

      <button
        v-if="taskStatus"
        type="button"
        class="btn btn-secondary"
        :disabled="isTaskActive"
        @click="handleNewTask"
      >
        New Task
      </button>
    </div>

    <!-- Progress Bar -->
    <div v-if="isTaskActive" class="mb-3">
      <div class="progress" style="height: 25px">
        <div
          class="progress-bar progress-bar-striped progress-bar-animated"
          role="progressbar"
          :style="{ width: `${getProgressPercentage()}%` }"
          :aria-valuenow="getProgressPercentage()"
          aria-valuemin="0"
          aria-valuemax="100"
        >
          {{ getProgressPercentage() }}%
        </div>
      </div>
    </div>

    <!-- Status Message -->
    <div v-if="taskStatus" class="status-message">
      <p
        class="mb-0"
        :class="{
          'text-muted': taskStatus.task_status === 'PENDING',
          'text-primary': taskStatus.task_status === 'PROGRESS',
          'text-success': isTaskSuccess,
          'text-danger': isTaskFailed,
        }"
      >
        <i
          class="bi me-1"
          :class="{
            'bi-hourglass-split': taskStatus.task_status === 'PENDING',
            'bi-arrow-repeat': taskStatus.task_status === 'PROGRESS',
            'bi-check-circle-fill': isTaskSuccess,
            'bi-exclamation-triangle-fill': isTaskFailed,
          }"
        ></i>
        {{ getStatusMessage() }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.pcb-generator-controls {
  padding: 1rem;
}

.status-message {
  padding: 0.5rem;
  background-color: var(--bs-light);
  border-radius: 0.375rem;
}

.bi-arrow-repeat {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}
</style>
