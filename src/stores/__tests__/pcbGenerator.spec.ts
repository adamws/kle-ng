import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { usePcbGeneratorStore } from '../pcbGenerator'
import { pcbApi, ApiError } from '@/utils/pcbApi'
import type { TaskStatusResponse, WorkerStatusResponse } from '@/types/pcb'

// Mock the pcbApi module
vi.mock('@/utils/pcbApi', () => ({
  pcbApi: {
    submitTask: vi.fn(),
    getTaskStatus: vi.fn(),
    getTaskRenderAsBlobUrl: vi.fn(),
    getTaskResultUrl: vi.fn(),
    getWorkerStatus: vi.fn(),
  },
  ApiError: class ApiError extends Error {
    constructor(
      message: string,
      public userMessage: string,
      public status?: number,
    ) {
      super(message)
      this.name = 'ApiError'
    }
  },
}))

// Mock the keyboard store
const mockKeyboardStore = {
  getSerializedData: vi.fn(),
}

vi.mock('@/stores/keyboard', () => ({
  useKeyboardStore: () => mockKeyboardStore,
}))

describe('pcbGenerator store', () => {
  let localStorageMock: { [key: string]: string }

  beforeEach(() => {
    setActivePinia(createPinia())

    // Mock localStorage
    localStorageMock = {}
    global.localStorage = {
      getItem: vi.fn((key) => localStorageMock[key] || null),
      setItem: vi.fn((key, value) => {
        localStorageMock[key] = value
      }),
      removeItem: vi.fn((key) => {
        delete localStorageMock[key]
      }),
      clear: vi.fn(() => {
        localStorageMock = {}
      }),
      length: 0,
      key: vi.fn(),
    } as Storage

    // Reset mocks
    vi.clearAllMocks()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('initialization', () => {
    it('should initialize with default settings', () => {
      const store = usePcbGeneratorStore()

      expect(store.settings).toEqual({
        switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
        diodeFootprint: 'Diode_SMD:D_SOD-123F',
        routing: 'Full',
      })
      expect(store.currentTaskId).toBeNull()
      expect(store.taskStatus).toBeNull()
      expect(store.renders).toEqual({
        front: null,
        back: null,
        schematic: null,
      })
    })

    it('should load settings from localStorage', () => {
      const savedSettings = {
        switchFootprint: 'Switch_Keyboard_Alps_Matias:SW_Alps_Matias_{:.2f}u',
        diodeFootprint: 'Diode_SMD:D_SOD-123',
        routing: 'Disabled',
      }
      localStorageMock['kle-ng-pcb-settings'] = JSON.stringify(savedSettings)

      const store = usePcbGeneratorStore()

      expect(store.settings).toEqual(savedSettings)
    })

    it('should handle corrupted localStorage gracefully', () => {
      localStorageMock['kle-ng-pcb-settings'] = 'invalid json'

      const store = usePcbGeneratorStore()

      // Should fall back to defaults
      expect(store.settings.switchFootprint).toBe(
        'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
      )
    })
  })

  describe('settings persistence', () => {
    it('should save settings to localStorage when changed', async () => {
      const store = usePcbGeneratorStore()

      store.settings.routing = 'Switch-Diode only'

      // Wait for debounce (500ms)
      await vi.advanceTimersByTimeAsync(500)

      expect(localStorage.setItem).toHaveBeenCalledWith(
        'kle-ng-pcb-settings',
        JSON.stringify(store.settings),
      )
    })

    it('should debounce settings saves', async () => {
      const store = usePcbGeneratorStore()

      store.settings.routing = 'Disabled'
      store.settings.routing = 'Full'
      store.settings.routing = 'Switch-Diode only'

      // Should not save yet
      expect(localStorage.setItem).not.toHaveBeenCalled()

      // Wait for debounce
      await vi.advanceTimersByTimeAsync(500)

      // Should only save once
      expect(localStorage.setItem).toHaveBeenCalledTimes(1)
    })
  })

  describe('computed properties', () => {
    it('should compute isTaskActive correctly', () => {
      const store = usePcbGeneratorStore()

      expect(store.isTaskActive).toBe(false)

      store.taskStatus = {
        task_id: 'test-123',
        task_status: 'PENDING',
        task_result: { percentage: 0 },
      }
      expect(store.isTaskActive).toBe(true)

      store.taskStatus.task_status = 'PROGRESS'
      expect(store.isTaskActive).toBe(true)

      store.taskStatus.task_status = 'SUCCESS'
      expect(store.isTaskActive).toBe(false)
    })

    it('should compute isTaskSuccess correctly', () => {
      const store = usePcbGeneratorStore()

      expect(store.isTaskSuccess).toBe(false)

      store.taskStatus = {
        task_id: 'test-123',
        task_status: 'SUCCESS',
        task_result: { percentage: 100 },
      }
      expect(store.isTaskSuccess).toBe(true)
    })

    it('should compute isTaskFailed correctly', () => {
      const store = usePcbGeneratorStore()

      expect(store.isTaskFailed).toBe(false)

      store.taskStatus = {
        task_id: 'test-123',
        task_status: 'FAILURE',
        task_result: { percentage: 0, error: 'Test error' },
      }
      expect(store.isTaskFailed).toBe(true)
    })

    it('should compute isBackendAvailable correctly', () => {
      const store = usePcbGeneratorStore()

      // Initially no worker status
      expect(store.isBackendAvailable).toBe(false)

      // Backend available with idle capacity
      store.workerStatus = {
        worker_processes: 4,
        total_capacity: 4,
        active_tasks: 2,
        idle_capacity: 2,
        workers: [],
      }
      expect(store.isBackendAvailable).toBe(true)

      // All workers busy
      store.workerStatus = {
        worker_processes: 4,
        total_capacity: 4,
        active_tasks: 4,
        idle_capacity: 0,
        workers: [],
      }
      expect(store.isBackendAvailable).toBe(false)

      // Backend offline
      store.workerStatus = null
      expect(store.isBackendAvailable).toBe(false)
    })
  })

  describe('startTask', () => {
    it('should submit task successfully', async () => {
      const store = usePcbGeneratorStore()
      const mockLayout = {
        meta: {},
        keys: [{ x: 0, y: 0 }],
      }
      mockKeyboardStore.getSerializedData.mockReturnValue(mockLayout)

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'PENDING',
        task_result: { percentage: 0 },
      }
      vi.mocked(pcbApi.submitTask).mockResolvedValue(mockResponse)

      await store.startTask()

      expect(pcbApi.submitTask).toHaveBeenCalledWith(
        {
          layout: mockLayout,
          settings: {
            switchFootprint: store.settings.switchFootprint,
            diodeFootprint: store.settings.diodeFootprint,
            routing: store.settings.routing,
          },
        },
        expect.any(Object), // AbortController signal
      )
      expect(store.currentTaskId).toBe('test-task-123')
      expect(store.taskStatus).toEqual(mockResponse)
    })

    it('should validate empty layout', async () => {
      const store = usePcbGeneratorStore()
      mockKeyboardStore.getSerializedData.mockReturnValue({
        meta: {},
        keys: [],
      })

      const error = await store.startTask().catch((e) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error.userMessage).toContain('Layout is empty')
      expect(pcbApi.submitTask).not.toHaveBeenCalled()
    })

    it('should validate layout size exceeds limit', async () => {
      const store = usePcbGeneratorStore()
      const mockLayout = {
        meta: {},
        keys: Array(151).fill({ x: 0, y: 0 }),
      }
      mockKeyboardStore.getSerializedData.mockReturnValue(mockLayout)

      const error = await store.startTask().catch((e) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error.userMessage).toContain('151 keys')
      expect(pcbApi.submitTask).not.toHaveBeenCalled()
    })

    it('should enforce rate limiting', async () => {
      const store = usePcbGeneratorStore()
      const mockLayout = {
        meta: {},
        keys: [{ x: 0, y: 0 }],
      }
      mockKeyboardStore.getSerializedData.mockReturnValue(mockLayout)

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'PENDING',
        task_result: { percentage: 0 },
      }
      vi.mocked(pcbApi.submitTask).mockResolvedValue(mockResponse)

      // First submission should succeed
      await store.startTask()

      // Immediate second submission should fail
      const error = await store.startTask().catch((e) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error.userMessage).toContain('wait')

      // After cooldown, should succeed again
      await vi.advanceTimersByTimeAsync(5001)
      vi.mocked(pcbApi.submitTask).mockResolvedValue({
        ...mockResponse,
        task_id: 'test-task-456',
      })
      await store.startTask()
      expect(store.currentTaskId).toBe('test-task-456')
    })

    it('should start polling after successful submission', async () => {
      const store = usePcbGeneratorStore()
      const mockLayout = {
        meta: {},
        keys: [{ x: 0, y: 0 }],
      }
      mockKeyboardStore.getSerializedData.mockReturnValue(mockLayout)

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'PENDING',
        task_result: { percentage: 0 },
      }
      vi.mocked(pcbApi.submitTask).mockResolvedValue(mockResponse)
      vi.mocked(pcbApi.getTaskStatus).mockResolvedValue(mockResponse)

      await store.startTask()

      expect(store.isPolling).toBe(true)

      // Polling should happen every 1 second
      await vi.advanceTimersByTimeAsync(1000)
      expect(pcbApi.getTaskStatus).toHaveBeenCalledWith('test-task-123', expect.any(Object))
    })
  })

  describe('pollTaskStatus', () => {
    it('should poll task status', async () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'PROGRESS',
        task_result: { percentage: 50 },
      }
      vi.mocked(pcbApi.getTaskStatus).mockResolvedValue(mockResponse)

      await store.pollTaskStatus()

      expect(store.taskStatus).toEqual(mockResponse)
      expect(pcbApi.getTaskStatus).toHaveBeenCalledWith('test-task-123', undefined)
    })

    it('should stop polling and fetch renders on SUCCESS', async () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'SUCCESS',
        task_result: { percentage: 100 },
      }
      vi.mocked(pcbApi.getTaskStatus).mockResolvedValue(mockResponse)
      vi.mocked(pcbApi.getTaskRenderAsBlobUrl).mockResolvedValue('blob:mock-url')

      // Start polling first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).pollingInterval = window.setInterval(() => {}, 1000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).isPolling = true

      await store.pollTaskStatus()

      expect(store.taskStatus).toEqual(mockResponse)
      expect(store.isPolling).toBe(false)
      expect(pcbApi.getTaskRenderAsBlobUrl).toHaveBeenCalledTimes(3) // front, back, schematic
    })

    it('should stop polling on FAILURE', async () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'FAILURE',
        task_result: { percentage: 0, error: 'Test error' },
      }
      vi.mocked(pcbApi.getTaskStatus).mockResolvedValue(mockResponse)

      // Start polling first
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).pollingInterval = window.setInterval(() => {}, 1000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).isPolling = true

      await store.pollTaskStatus()

      expect(store.taskStatus).toEqual(mockResponse)
      expect(store.isPolling).toBe(false)
    })

    it('should stop polling after max failures', async () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'

      vi.mocked(pcbApi.getTaskStatus).mockRejectedValue(new Error('Network error'))

      // Start polling
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).pollingInterval = window.setInterval(() => {}, 1000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).isPolling = true

      // Fail 5 times (MAX_POLL_FAILURES)
      for (let i = 0; i < 5; i++) {
        await store.pollTaskStatus()
      }

      expect(store.isPolling).toBe(false)
      expect(store.taskStatus?.task_status).toBe('FAILURE')
      expect(store.taskStatus?.task_result?.error).toContain('Lost connection')
    })
  })

  describe('fetchRenders', () => {
    it('should fetch all three renders', async () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'

      vi.mocked(pcbApi.getTaskRenderAsBlobUrl)
        .mockResolvedValueOnce('blob:front-url')
        .mockResolvedValueOnce('blob:back-url')
        .mockResolvedValueOnce('blob:schematic-url')

      await store.fetchRenders()

      expect(store.renders).toEqual({
        front: 'blob:front-url',
        back: 'blob:back-url',
        schematic: 'blob:schematic-url',
      })
      expect(pcbApi.getTaskRenderAsBlobUrl).toHaveBeenCalledTimes(3)
    })

    it('should handle individual render failures', async () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'

      vi.mocked(pcbApi.getTaskRenderAsBlobUrl)
        .mockResolvedValueOnce('blob:front-url')
        .mockRejectedValueOnce(new Error('Failed to fetch back'))
        .mockResolvedValueOnce('blob:schematic-url')

      await store.fetchRenders()

      expect(store.renders).toEqual({
        front: 'blob:front-url',
        back: null,
        schematic: 'blob:schematic-url',
      })
    })

    it('should revoke old blob URLs', async () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'
      store.renders = {
        front: 'blob:old-front',
        back: 'blob:old-back',
        schematic: 'blob:old-schematic',
      }

      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')

      vi.mocked(pcbApi.getTaskRenderAsBlobUrl)
        .mockResolvedValueOnce('blob:new-front')
        .mockResolvedValueOnce('blob:new-back')
        .mockResolvedValueOnce('blob:new-schematic')

      await store.fetchRenders()

      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:old-front')
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:old-back')
      expect(revokeObjectURLSpy).toHaveBeenCalledWith('blob:old-schematic')

      revokeObjectURLSpy.mockRestore()
    })
  })

  describe('getResultDownloadUrl', () => {
    it('should return download URL', () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'

      const mockUrl = 'http://localhost:8080/api/pcb/test-task-123/result'
      vi.mocked(pcbApi.getTaskResultUrl).mockReturnValue(mockUrl)

      const url = store.getResultDownloadUrl()

      expect(url).toBe(mockUrl)
      expect(pcbApi.getTaskResultUrl).toHaveBeenCalledWith('test-task-123')
    })

    it('should return null when no task', () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = null

      const url = store.getResultDownloadUrl()

      expect(url).toBeNull()
    })
  })

  describe('fetchWorkerStatus', () => {
    it('should fetch worker status successfully', async () => {
      const store = usePcbGeneratorStore()

      const mockResponse: WorkerStatusResponse = {
        worker_processes: 4,
        total_capacity: 4,
        active_tasks: 1,
        idle_capacity: 3,
        workers: [],
      }
      vi.mocked(pcbApi.getWorkerStatus).mockResolvedValue(mockResponse)

      await store.fetchWorkerStatus()

      expect(store.workerStatus).toEqual(mockResponse)
    })

    it('should handle worker status fetch errors', async () => {
      const store = usePcbGeneratorStore()

      vi.mocked(pcbApi.getWorkerStatus).mockRejectedValue(new Error('Network error'))

      await store.fetchWorkerStatus()

      // Should not throw, just set error state
      expect(store.workerStatus).toBeNull()
      expect(store.workerStatusError).toBe('Backend is offline or unreachable')
    })

    it('should handle ApiError with user message', async () => {
      const store = usePcbGeneratorStore()

      const apiError = new ApiError(
        'HTTP 500',
        'Server is experiencing issues. Please try again later.',
        500,
      )
      vi.mocked(pcbApi.getWorkerStatus).mockRejectedValue(apiError)

      await store.fetchWorkerStatus()

      expect(store.workerStatus).toBeNull()
      expect(store.workerStatusError).toBe('Server is experiencing issues. Please try again later.')
    })

    it('should clear error on successful fetch', async () => {
      const store = usePcbGeneratorStore()

      // First, set an error
      store.workerStatusError = 'Previous error'

      const mockResponse: WorkerStatusResponse = {
        worker_processes: 4,
        total_capacity: 4,
        active_tasks: 0,
        idle_capacity: 4,
        workers: [],
      }
      vi.mocked(pcbApi.getWorkerStatus).mockResolvedValue(mockResponse)

      await store.fetchWorkerStatus()

      expect(store.workerStatus).toEqual(mockResponse)
      expect(store.workerStatusError).toBeNull()
    })
  })

  describe('resetTask', () => {
    it('should reset all task state', () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'
      store.taskStatus = {
        task_id: 'test-task-123',
        task_status: 'SUCCESS',
        task_result: { percentage: 100 },
      }
      store.renders = {
        front: 'blob:front',
        back: 'blob:back',
        schematic: 'blob:schematic',
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).pollingInterval = window.setInterval(() => {}, 1000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(store as any).isPolling = true

      const revokeObjectURLSpy = vi.spyOn(URL, 'revokeObjectURL')

      store.resetTask()

      expect(store.currentTaskId).toBeNull()
      expect(store.taskStatus).toBeNull()
      expect(store.renders).toEqual({
        front: null,
        back: null,
        schematic: null,
      })
      expect(store.isPolling).toBe(false)
      expect(revokeObjectURLSpy).toHaveBeenCalledTimes(3)

      revokeObjectURLSpy.mockRestore()
    })

    it('should handle cleanup of abort controller', () => {
      const store = usePcbGeneratorStore()

      // Just verify resetTask doesn't throw when there's no abort controller
      expect(() => store.resetTask()).not.toThrow()
    })
  })

  describe('cleanup', () => {
    it('should reset all state', () => {
      const store = usePcbGeneratorStore()
      store.currentTaskId = 'test-task-123'
      store.renders = {
        front: 'blob:front',
        back: 'blob:back',
        schematic: 'blob:schematic',
      }

      store.cleanup()

      expect(store.currentTaskId).toBeNull()
      expect(store.renders).toEqual({
        front: null,
        back: null,
        schematic: null,
      })
    })
  })
})
