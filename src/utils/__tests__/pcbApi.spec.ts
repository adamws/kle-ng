import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { pcbApi, ApiError } from '../pcbApi'
import type { TaskRequest, TaskStatusResponse, WorkerStatusResponse } from '@/types/pcb'

// Mock the API_CONFIG and ENDPOINTS
vi.mock('@/config/api', () => ({
  API_CONFIG: {
    baseURL: 'http://localhost:8080',
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  },
  ENDPOINTS: {
    PCB: '/api/pcb',
    WORKERS: '/api/workers',
  },
}))

describe('ApiError', () => {
  it('should create an ApiError with message and userMessage', () => {
    const error = new ApiError('Technical error', 'User-friendly message')
    expect(error.message).toBe('Technical error')
    expect(error.userMessage).toBe('User-friendly message')
    expect(error.name).toBe('ApiError')
  })

  it('should include status and originalError when provided', () => {
    const originalError = new Error('Original')
    const error = new ApiError('Technical error', 'User message', 404, originalError)
    expect(error.status).toBe(404)
    expect(error.originalError).toBe(originalError)
  })
})

describe('pcbApi', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  describe('submitTask', () => {
    it('should submit a task successfully', async () => {
      const mockRequest: TaskRequest = {
        layout: { meta: {}, keys: [] },
        settings: {
          switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
          diodeFootprint: 'Diode_SMD:D_SOD-123F',
          routing: 'Full',
        },
      }

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'PENDING',
        task_result: { percentage: 0 },
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await pcbApi.submitTask(mockRequest)

      expect(result).toEqual(mockResponse)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/pcb',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(mockRequest),
        }),
      )
    })

    it('should retry on 503 error', async () => {
      const mockRequest: TaskRequest = {
        layout: { meta: {}, keys: [] },
        settings: {
          switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
          diodeFootprint: 'Diode_SMD:D_SOD-123F',
          routing: 'Full',
        },
      }

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'PENDING',
        task_result: { percentage: 0 },
      }

      // First call fails with 503, second succeeds
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })

      const resultPromise = pcbApi.submitTask(mockRequest)

      // Advance timers for retry delay (1000ms for first retry)
      await vi.advanceTimersByTimeAsync(1000)

      const result = await resultPromise

      expect(result).toEqual(mockResponse)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should not retry on 400 error', async () => {
      const mockRequest: TaskRequest = {
        layout: { meta: {}, keys: [] },
        settings: {
          switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
          diodeFootprint: 'Diode_SMD:D_SOD-123F',
          routing: 'Full',
        },
      }

      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Invalid layout' }),
      })

      await expect(pcbApi.submitTask(mockRequest)).rejects.toThrow(ApiError)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it('should throw ApiError with user-friendly message on 400', async () => {
      const mockRequest: TaskRequest = {
        layout: { meta: {}, keys: [] },
        settings: {
          switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
          diodeFootprint: 'Diode_SMD:D_SOD-123F',
          routing: 'Full',
        },
      }

      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        json: async () => ({ message: 'Layout is empty' }),
      })

      const error = await pcbApi.submitTask(mockRequest).catch((e) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error.userMessage).toBe('Layout is empty')
      expect(error.status).toBe(400)
    })

    it.todo('should handle abort signal')
  })

  describe('getTaskStatus', () => {
    it('should fetch task status successfully', async () => {
      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'SUCCESS',
        task_result: { percentage: 100 },
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await pcbApi.getTaskStatus('test-task-123')

      expect(result).toEqual(mockResponse)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/pcb/test-task-123',
        expect.any(Object),
      )
    })

    it('should throw ApiError on 404', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      })

      const error = await pcbApi.getTaskStatus('non-existent-task').catch((e) => e)
      expect(error).toBeInstanceOf(ApiError)
      expect(error.userMessage).toBe('Resource not found. The task may have expired.')
      expect(error.status).toBe(404)
    })
  })

  describe('getTaskRenderAsBlobUrl', () => {
    it('should fetch render and return blob URL', async () => {
      const mockSvg = '<svg><rect/></svg>'

      fetchMock.mockResolvedValueOnce({
        ok: true,
        text: async () => mockSvg,
      })

      // Mock URL.createObjectURL
      const mockBlobUrl = 'blob:http://localhost/mock-blob-url'
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockBlobUrl)

      const result = await pcbApi.getTaskRenderAsBlobUrl('test-task-123', 'front')

      expect(result).toBe(mockBlobUrl)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/pcb/test-task-123/render/front',
        expect.any(Object),
      )
      expect(createObjectURLSpy).toHaveBeenCalledWith(expect.any(Blob))

      createObjectURLSpy.mockRestore()
    })

    it('should retry on 503 error', async () => {
      const mockSvg = '<svg><rect/></svg>'

      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          text: async () => mockSvg,
        })

      const mockBlobUrl = 'blob:http://localhost/mock-blob-url'
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockBlobUrl)

      const resultPromise = pcbApi.getTaskRenderAsBlobUrl('test-task-123', 'back')

      // Advance timers for retry delay
      await vi.advanceTimersByTimeAsync(1000)

      const result = await resultPromise

      expect(result).toBe(mockBlobUrl)
      expect(fetchMock).toHaveBeenCalledTimes(2)

      createObjectURLSpy.mockRestore()
    })

    it('should handle all render types', async () => {
      const mockSvg = '<svg><rect/></svg>'
      const mockBlobUrl = 'blob:http://localhost/mock-blob-url'
      const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue(mockBlobUrl)

      for (const renderType of ['front', 'back', 'schematic'] as const) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          text: async () => mockSvg,
        })

        const result = await pcbApi.getTaskRenderAsBlobUrl('test-task-123', renderType)

        expect(result).toBe(mockBlobUrl)
        expect(fetchMock).toHaveBeenCalledWith(
          `http://localhost:8080/api/pcb/test-task-123/render/${renderType}`,
          expect.any(Object),
        )
      }

      createObjectURLSpy.mockRestore()
    })
  })

  describe('getTaskResultUrl', () => {
    it('should return correct result URL', () => {
      const url = pcbApi.getTaskResultUrl('test-task-123')
      expect(url).toBe('http://localhost:8080/api/pcb/test-task-123/result')
    })
  })

  describe('getWorkerStatus', () => {
    it('should fetch worker status successfully', async () => {
      const mockResponse: WorkerStatusResponse = {
        worker_processes: 4,
        total_capacity: 4,
        active_tasks: 1,
        idle_capacity: 3,
        workers: [
          {
            id: 'worker1',
            host: 'localhost',
            pid: 12345,
            concurrency: 1,
            started: '2025-12-22T00:00:00Z',
            status: 'active',
            active_tasks: 0,
            idle_capacity: 1,
            queues: {},
          },
        ],
      }

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const result = await pcbApi.getWorkerStatus()

      expect(result).toEqual(mockResponse)
      expect(fetchMock).toHaveBeenCalledWith(
        'http://localhost:8080/api/workers',
        expect.any(Object),
      )
    })

    it('should retry on network error', async () => {
      const mockResponse: WorkerStatusResponse = {
        worker_processes: 4,
        total_capacity: 4,
        active_tasks: 0,
        idle_capacity: 4,
        workers: [],
      }

      fetchMock.mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      })

      const resultPromise = pcbApi.getWorkerStatus()

      // Advance timers for retry delay
      await vi.advanceTimersByTimeAsync(1000)

      const result = await resultPromise

      expect(result).toEqual(mockResponse)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })
  })

  describe('timeout handling', () => {
    it.todo('should timeout after configured duration')
  })

  describe('retry exponential backoff', () => {
    it('should use exponential backoff on retries', async () => {
      const mockRequest: TaskRequest = {
        layout: { meta: {}, keys: [] },
        settings: {
          switchFootprint: 'Switch_Keyboard_Cherry_MX:SW_Cherry_MX_PCB_{:.2f}u',
          diodeFootprint: 'Diode_SMD:D_SOD-123F',
          routing: 'Full',
        },
      }

      const mockResponse: TaskStatusResponse = {
        task_id: 'test-task-123',
        task_status: 'PENDING',
        task_result: { percentage: 0 },
      }

      // Fail twice with 503, then succeed
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 503,
          statusText: 'Service Unavailable',
          json: async () => ({}),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse,
        })

      const resultPromise = pcbApi.submitTask(mockRequest)

      // First retry after 1000ms
      await vi.advanceTimersByTimeAsync(1000)

      // Second retry after 2000ms (exponential)
      await vi.advanceTimersByTimeAsync(2000)

      const result = await resultPromise

      expect(result).toEqual(mockResponse)
      expect(fetchMock).toHaveBeenCalledTimes(3)
    })

    it.todo('should throw after max retries')
  })
})
