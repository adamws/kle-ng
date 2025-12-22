<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { storeToRefs } from 'pinia'

const pcbStore = usePcbGeneratorStore()
const { workerStatus, workerStatusError } = storeToRefs(pcbStore)

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
  if (workerStatusError.value) return 'danger'
  if (!workerStatus.value) return 'secondary'
  return workerStatus.value.idle_capacity > 0 ? 'success' : 'warning'
}

function getStatusIcon(): string {
  if (workerStatusError.value) return 'bi-x-circle-fill'
  if (!workerStatus.value) return 'bi-question-circle'
  return workerStatus.value.idle_capacity > 0
    ? 'bi-check-circle-fill'
    : 'bi-exclamation-circle-fill'
}
</script>

<template>
  <div class="pcb-worker-status">
    <!-- Error state -->
    <div
      v-if="workerStatusError"
      class="alert status-bar alert-danger"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="d-flex align-items-center gap-3 flex-grow-1 min-w-0">
          <div class="status-badge flex-shrink-0">
            <i class="bi bi-x-circle-fill" aria-hidden="true"></i>
          </div>
          <div class="status-info-inline">
            <span class="info-item">{{ workerStatusError }}</span>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-link btn-sm text-decoration-none p-0 flex-shrink-0"
          :disabled="isRefreshing"
          @click="refreshStatus"
          title="Retry connection"
          aria-label="Retry backend connection"
        >
          <i
            class="bi bi-arrow-clockwise"
            :class="{ spinning: isRefreshing }"
            aria-hidden="true"
          ></i>
        </button>
      </div>
    </div>

    <!-- Success/Warning state -->
    <div
      v-else-if="workerStatus"
      class="alert status-bar"
      :class="`alert-${getStatusColor()}`"
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div class="d-flex align-items-center justify-content-between gap-2">
        <div class="d-flex align-items-center gap-3 flex-grow-1 min-w-0">
          <div class="status-badge flex-shrink-0">
            <i class="bi" :class="getStatusIcon()" aria-hidden="true"></i>
          </div>
          <div class="status-info-inline">
            <span class="info-item">
              <strong>{{ workerStatus.idle_capacity }}</strong
              >/{{ workerStatus.total_capacity }} workers available
            </span>
          </div>
        </div>
        <button
          type="button"
          class="btn btn-link btn-sm text-decoration-none p-0 flex-shrink-0"
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

    <!-- Loading state -->
    <div v-else class="status-bar status-bar-loading" role="status" aria-live="polite">
      <small class="text-muted">Loading backend status...</small>
    </div>
  </div>
</template>

<style scoped>
.pcb-worker-status {
  margin-top: 1.5rem;
}

.status-bar {
  padding: 0.2rem 0.75rem;
  border-radius: 0.375rem;
  border-left: 3px solid;
  font-size: 0.775rem;
  margin-bottom: 0 !important;
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
  min-width: 0;
  flex: 1;
}

.status-info-inline .info-item {
  word-break: break-word;
}

.info-separator {
  color: currentColor;
  opacity: 0.5;
}

.status-bar .btn-link {
  color: inherit;
  opacity: 0.8;
}

.status-bar .btn-link:hover {
  opacity: 1;
}

.status-bar .btn-link:disabled {
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
