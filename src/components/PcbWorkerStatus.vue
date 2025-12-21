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
    <div class="d-flex justify-content-between align-items-center mb-3">
      <h6 class="mb-0">Worker Status</h6>
      <button
        type="button"
        class="btn btn-sm btn-outline-secondary"
        :disabled="isRefreshing"
        @click="refreshStatus"
      >
        <i class="bi bi-arrow-clockwise" :class="{ spinning: isRefreshing }"></i>
        Refresh
      </button>
    </div>

    <div v-if="workerStatus" class="status-card">
      <div class="status-indicator" :class="`bg-${getStatusColor()}`">
        <i class="bi" :class="getStatusIcon()"></i>
      </div>

      <div class="status-info">
        <div class="row g-2">
          <div class="col-6">
            <div class="info-item">
              <span class="info-label">Worker Processes:</span>
              <span class="info-value">{{ workerStatus.worker_processes }}</span>
            </div>
          </div>
          <div class="col-6">
            <div class="info-item">
              <span class="info-label">Total Capacity:</span>
              <span class="info-value">{{ workerStatus.total_capacity }}</span>
            </div>
          </div>
          <div class="col-6">
            <div class="info-item">
              <span class="info-label">Active Tasks:</span>
              <span class="info-value">{{ workerStatus.active_tasks }}</span>
            </div>
          </div>
          <div class="col-6">
            <div class="info-item">
              <span class="info-label">Idle Capacity:</span>
              <span class="info-value fw-bold" :class="`text-${getStatusColor()}`">
                {{ workerStatus.idle_capacity }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="text-muted text-center p-3">Loading worker status...</div>
  </div>
</template>

<style scoped>
.pcb-worker-status {
  padding: 1rem;
  background-color: var(--bs-light);
  border-radius: 0.375rem;
  margin-bottom: 1rem;
}

.status-card {
  display: flex;
  gap: 1rem;
  align-items: flex-start;
}

.status-indicator {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 1.25rem;
  flex-shrink: 0;
}

.status-info {
  flex: 1;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-label {
  font-size: 0.75rem;
  color: var(--bs-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 1rem;
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
