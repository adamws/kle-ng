import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type {
  PcbSettings,
  PcbApiSettings,
  TaskStatusResponse,
  WorkerStatusResponse,
  RenderViews,
} from '@/types/pcb'
import { pcbApi, ApiError } from '@/utils/pcbApi'
import { useKeyboardStore } from '@/stores/keyboard'

export const usePcbGeneratorStore = defineStore('pcbGenerator', () => {
  // Settings state (stored as numeric values)
  const settings = ref<PcbSettings>({
    switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
    diodeFootprint: 'Diode_SMD:D_SOD-123F',
    routing: 'Full',
  })

  // Task state
  const currentTaskId = ref<string | null>(null)
  const taskStatus = ref<TaskStatusResponse | null>(null)
  const pollingInterval = ref<number | null>(null)
  const isPolling = ref(false)

  // Results state
  const renders = ref<RenderViews>({
    front: null,
    back: null,
    schematic: null,
  })

  // Worker state
  const workerStatus = ref<WorkerStatusResponse | null>(null)
  const workerStatusError = ref<string | null>(null)

  // Rate limiting state
  const lastSubmitTime = ref<number | null>(null)
  const SUBMIT_COOLDOWN_MS = 5000

  // Polling state
  let pollFailureCount = 0
  const MAX_POLL_FAILURES = 5

  // AbortController for request cancellation
  const abortController = ref<AbortController | null>(null)

  // Computed
  const isTaskActive = computed(
    () =>
      taskStatus.value?.task_status === 'PENDING' || taskStatus.value?.task_status === 'PROGRESS',
  )

  const isTaskSuccess = computed(() => taskStatus.value?.task_status === 'SUCCESS')

  const isTaskFailed = computed(() => taskStatus.value?.task_status === 'FAILURE')

  const isBackendAvailable = computed(() => {
    // Backend is available if we have worker status and at least one worker is idle
    return workerStatus.value !== null && workerStatus.value.idle_capacity > 0
  })

  // Helper functions
  function canSubmitTask(): boolean {
    if (!lastSubmitTime.value) return true
    return Date.now() - lastSubmitTime.value > SUBMIT_COOLDOWN_MS
  }

  // Actions
  async function startTask() {
    // Check rate limiting
    if (!canSubmitTask()) {
      const remainingTime = Math.ceil(
        (SUBMIT_COOLDOWN_MS - (Date.now() - lastSubmitTime.value!)) / 1000,
      )
      throw new ApiError(
        'Rate limit',
        `Please wait ${remainingTime} seconds before submitting another task`,
      )
    }

    try {
      // Cancel any existing request
      abortController.value?.abort()
      abortController.value = new AbortController()

      const keyboardStore = useKeyboardStore()
      const layout = keyboardStore.getSerializedData('kle-internal')

      // Validate layout size
      // kle-internal format returns: { meta: {...}, keys: [...] }
      const keyCount = layout?.keys?.length || 0

      if (keyCount === 0) {
        throw new ApiError('Validation error', 'Layout is empty. Please add keys to your layout.')
      }

      if (keyCount > 150) {
        throw new ApiError(
          'Validation error',
          `Layout has ${keyCount} keys. Layouts exceeding 150 keys are not supported.`,
        )
      }

      // Convert settings to API format
      const apiSettings: PcbApiSettings = {
        switchFootprint: settings.value.switchFootprint,
        diodeFootprint: settings.value.diodeFootprint,
        routing: settings.value.routing,
      }

      const request = {
        layout,
        settings: apiSettings,
      }

      const response = await pcbApi.submitTask(request, abortController.value.signal)
      currentTaskId.value = response.task_id
      taskStatus.value = response
      lastSubmitTime.value = Date.now()

      // Reset polling failure count
      pollFailureCount = 0

      // Start polling
      startPolling()
    } catch (error) {
      console.error('Failed to start task:', error)
      throw error
    }
  }

  function startPolling() {
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value)
    }

    isPolling.value = true

    pollingInterval.value = window.setInterval(async () => {
      await pollTaskStatus()
    }, 1000)
  }

  function stopPolling() {
    if (pollingInterval.value) {
      clearInterval(pollingInterval.value)
      pollingInterval.value = null
    }
    isPolling.value = false
  }

  async function pollTaskStatus() {
    if (!currentTaskId.value) return

    try {
      const response = await pcbApi.getTaskStatus(
        currentTaskId.value,
        abortController.value?.signal,
      )
      taskStatus.value = response

      // Reset failure count on success
      pollFailureCount = 0

      if (response.task_status === 'SUCCESS') {
        stopPolling()
        await fetchRenders()
      } else if (response.task_status === 'FAILURE') {
        stopPolling()
      }
    } catch (error) {
      console.error('Failed to poll task status:', error)

      // Increment failure count
      pollFailureCount++

      // Stop polling after too many failures
      if (pollFailureCount >= MAX_POLL_FAILURES) {
        stopPolling()
        taskStatus.value = {
          task_id: currentTaskId.value!,
          task_status: 'FAILURE',
          task_result: {
            percentage: 0,
            error: 'Lost connection to server after multiple failures. Please try again.',
          },
        }
      }
    }
  }

  async function fetchRenders() {
    if (!currentTaskId.value) return

    // Revoke old blob URLs to prevent memory leaks
    if (renders.value.front) URL.revokeObjectURL(renders.value.front)
    if (renders.value.back) URL.revokeObjectURL(renders.value.back)
    if (renders.value.schematic) URL.revokeObjectURL(renders.value.schematic)

    // Fetch all renders as blob URLs, handling individual failures
    const results = await Promise.allSettled([
      pcbApi.getTaskRenderAsBlobUrl(currentTaskId.value, 'front', abortController.value?.signal),
      pcbApi.getTaskRenderAsBlobUrl(currentTaskId.value, 'back', abortController.value?.signal),
      pcbApi.getTaskRenderAsBlobUrl(
        currentTaskId.value,
        'schematic',
        abortController.value?.signal,
      ),
    ])

    // Extract successful results, null for failures
    renders.value = {
      front: results[0].status === 'fulfilled' ? results[0].value : null,
      back: results[1].status === 'fulfilled' ? results[1].value : null,
      schematic: results[2].status === 'fulfilled' ? results[2].value : null,
    }

    // Log any failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const names = ['front', 'back', 'schematic']
        console.error(`Failed to fetch ${names[index]} render:`, result.reason)
      }
    })
  }

  function getResultDownloadUrl() {
    if (!currentTaskId.value) return null
    return pcbApi.getTaskResultUrl(currentTaskId.value)
  }

  async function fetchWorkerStatus() {
    try {
      const status = await pcbApi.getWorkerStatus()
      workerStatus.value = status
      workerStatusError.value = null
    } catch (error) {
      // Don't log to console - we handle this gracefully in the UI
      workerStatus.value = null
      if (error instanceof ApiError) {
        workerStatusError.value = error.userMessage
      } else {
        workerStatusError.value = 'No online backend server found'
      }
    }
  }

  function resetTask() {
    stopPolling()

    // Cancel any in-flight requests
    abortController.value?.abort()
    abortController.value = null

    // Revoke blob URLs to prevent memory leaks
    if (renders.value.front) URL.revokeObjectURL(renders.value.front)
    if (renders.value.back) URL.revokeObjectURL(renders.value.back)
    if (renders.value.schematic) URL.revokeObjectURL(renders.value.schematic)

    // Reset state
    currentTaskId.value = null
    taskStatus.value = null
    renders.value = { front: null, back: null, schematic: null }
    pollFailureCount = 0
  }

  // Cleanup function for component unmount
  function cleanup() {
    resetTask()
  }

  // Settings persistence
  function loadSettings() {
    const saved = localStorage.getItem('kle-ng-pcb-settings')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        Object.assign(settings.value, parsed)
      } catch (error) {
        console.warn('Failed to load PCB settings:', error)
      }
    }
  }

  function saveSettings() {
    localStorage.setItem('kle-ng-pcb-settings', JSON.stringify(settings.value))
  }

  // Manual debounce helper
  function useDebounceFn<T extends (...args: unknown[]) => unknown>(fn: T, delay: number) {
    let timeoutId: number | null = null
    return (...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId)
      timeoutId = window.setTimeout(() => fn(...args), delay)
    }
  }

  // Watch settings for changes with debouncing (500ms) to prevent excessive writes
  const debouncedSave = useDebounceFn(saveSettings, 500)
  watch(settings, debouncedSave, { deep: true })

  // Load settings on store creation
  loadSettings()

  return {
    settings,
    currentTaskId,
    taskStatus,
    renders,
    workerStatus,
    workerStatusError,
    isPolling,
    isTaskActive,
    isTaskSuccess,
    isTaskFailed,
    isBackendAvailable,
    startTask,
    pollTaskStatus,
    fetchRenders,
    getResultDownloadUrl,
    fetchWorkerStatus,
    resetTask,
    stopPolling,
    cleanup,
  }
})
