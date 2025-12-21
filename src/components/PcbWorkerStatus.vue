<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'

const pcbStore = usePcbGeneratorStore()
const { workerStatus } = storeToRefs(pcbStore)

const AUTO_REFRESH_INTERVAL_MS = 30000 // 30 seconds
let refreshIntervalId: number | null = null
const isRefreshing = ref(false)

async function refreshStatus() {
  isRefreshing.value = true
  try {
    await pcbStore.fetchWorkerStatus()
  } finally {
    isRefreshing.value = false
  }
}

function startAutoRefresh() {
  // Initial fetch
  refreshStatus()

  // Set up interval
  refreshIntervalId = window.setInterval(() => {
    refreshStatus()
  }, AUTO_REFRESH_INTERVAL_MS)
}

function stopAutoRefresh() {
  if (refreshIntervalId !== null) {
    clearInterval(refreshIntervalId)
    refreshIntervalId = null
  }
}

onMounted(() => {
  startAutoRefresh()
})

onUnmounted(() => {
  stopAutoRefresh()
})

function getStatusColor(): string {
  if (!workerStatus.value) return 'secondary'
  return workerStatus.value.idle_capacity > 0 ? 'success' : 'warning'
}

function getStatusIcon(): string {
  if (!workerStatus.value) return 'bi-question-circle'
  return workerStatus.value.idle_capacity > 0
    ? 'bi-check-circle-fill'
    : 'bi-exclamation-circle-fill'
}
</script>

<template>
  <div class="pcb-worker-status">
    <div
      v-if="workerStatus"
      class="status-bar"
      :class="`status-bar-${getStatusColor()}`"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="d-flex align-items-center gap-3">
          <div class="status-badge">
            <i class="bi" :class="getStatusIcon()" aria-hidden="true"></i>
            <span class="ms-1">Backend</span>
          </div>
          <div class="status-info-inline">
            <span class="info-item">
              <strong>{{ workerStatus.idle_capacity }}</strong
              >/{{ workerStatus.total_capacity }} available
            </span>
            <span class="info-separator" aria-hidden="true">•</span>
            <span class="info-item">{{ workerStatus.active_tasks }} active</span>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-link btn-sm text-decoration-none p-0"
          :disabled="isRefreshing"
          @click="refreshStatus"
          title="Refresh status"
          aria-label="Refresh backend worker status"
        >
          <i
            class="bi bi-arrow-clockwise"
            :class="{ spinning: isRefreshing }"
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </div>

    <div v-else class="status-bar status-bar-loading" role="status" aria-live="polite">
      <small class="text-muted">Loading backend status...</small>
    </div>
  </div>
</template>

<style scoped>
.pcb-worker-status {
  margin-bottom: 1rem;
}

.status-bar {
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  border-left: 3px solid;
  font-size: 0.875rem;
}

.status-bar-success {
  background-color: #d1e7dd;
  border-left-color: #198754;
  color: #0f5132;
}

.status-bar-warning {
  background-color: #fff3cd;
  border-left-color: #ffc107;
  color: #664d03;
}

.status-bar-secondary {
  background-color: #e2e3e5;
  border-left-color: #6c757d;
  color: #41464b;
}

.status-bar-loading {
  background-color: #f8f9fa;
  border-left-color: #dee2e6;
}

.status-badge {
  display: flex;
  align-items: center;
  font-weight: 500;
}

.status-info-inline {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.info-separator {
  color: currentColor;
  opacity: 0.5;
}

.spinning {
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
