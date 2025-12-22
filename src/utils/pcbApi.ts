import { API_CONFIG, ENDPOINTS } from '@/config/api'
import type { TaskRequest, TaskStatusResponse, WorkerStatusResponse } from '@/types/pcb'

// Custom error class with user-friendly messages
export class ApiError extends Error {
  constructor(
    message: string,
    public userMessage: string,
    public status?: number,
    public originalError?: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Check if error is retriable
function isRetryableError(status?: number): boolean {
  return status === 503 || status === 502 || status === 504 || status === undefined
}

// Exponential backoff retry wrapper
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 1000): Promise<T> {
  let lastError: Error

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      // Don't retry if not a retriable error
      if (error instanceof ApiError && !isRetryableError(error.status)) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === maxRetries - 1) {
        throw error
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt)
      console.warn(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`)
      await sleep(delay)
    }
  }

  throw lastError!
}

// Helper to combine multiple AbortSignals
function combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController()

  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort()
      break
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }

  return controller.signal
}

// Base fetch wrapper with error handling
async function fetchWithErrorHandling(url: string, options: RequestInit = {}): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.timeout)

  try {
    // Merge abort signals if provided
    const signal = options.signal
      ? combineAbortSignals(controller.signal, options.signal)
      : controller.signal

    const response = await fetch(url, {
      ...options,
      headers: {
        ...API_CONFIG.headers,
        ...options.headers,
      },
      signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      let userMessage: string

      switch (response.status) {
        case 503:
          userMessage = 'Server is busy. Please try again in a moment.'
          break
        case 500:
        case 502:
        case 504:
          userMessage = 'Backend server error. The server may be offline or misconfigured.'
          break
        case 404:
          userMessage = 'Resource not found. The task may have expired.'
          break
        case 400:
          const errorData = await response.json().catch(() => ({}))
          userMessage = errorData.message || 'Invalid request. Please check your layout.'
          break
        default:
          userMessage = 'An unexpected error occurred.'
      }

      throw new ApiError(
        `HTTP ${response.status}: ${response.statusText}`,
        userMessage,
        response.status,
      )
    }

    return response
  } catch (error) {
    clearTimeout(timeoutId)

    if (error instanceof ApiError) {
      throw error
    }

    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiError(
        'Request aborted',
        'No backend server found. Request timed out.',
        undefined,
        error,
      )
    }

    throw new ApiError(
      'Network error',
      'No online backend server found. Please start the backend or check your connection.',
      undefined,
      error,
    )
  }
}

// API Methods
export const pcbApi = {
  // Submit a new PCB generation task
  async submitTask(request: TaskRequest, signal?: AbortSignal): Promise<TaskStatusResponse> {
    return withRetry(async () => {
      const response = await fetchWithErrorHandling(`${API_CONFIG.baseURL}${ENDPOINTS.PCB}`, {
        method: 'POST',
        body: JSON.stringify(request),
        signal,
      })
      return response.json()
    })
  },

  // Get task status (no retry - frequent polling)
  async getTaskStatus(taskId: string, signal?: AbortSignal): Promise<TaskStatusResponse> {
    const response = await fetchWithErrorHandling(
      `${API_CONFIG.baseURL}${ENDPOINTS.PCB}/${taskId}`,
      { signal },
    )
    return response.json()
  },

  // Fetch SVG render and convert to blob URL for memory efficiency
  async getTaskRenderAsBlobUrl(
    taskId: string,
    name: 'front' | 'back' | 'schematic',
    signal?: AbortSignal,
  ): Promise<string> {
    return withRetry(async () => {
      const response = await fetchWithErrorHandling(
        `${API_CONFIG.baseURL}${ENDPOINTS.PCB}/${taskId}/render/${name}`,
        { signal },
      )
      const svgText = await response.text()

      // Create blob URL for memory efficiency
      // TODO: Add SVG sanitization later if rendering untrusted content
      const blob = new Blob([svgText], { type: 'image/svg+xml' })
      return URL.createObjectURL(blob)
    })
  },

  // Get download URL for task result ZIP
  getTaskResultUrl(taskId: string): string {
    return `${API_CONFIG.baseURL}${ENDPOINTS.PCB}/${taskId}/result`
  },

  // Get worker status information
  async getWorkerStatus(signal?: AbortSignal): Promise<WorkerStatusResponse> {
    return withRetry(async () => {
      const response = await fetchWithErrorHandling(`${API_CONFIG.baseURL}${ENDPOINTS.WORKERS}`, {
        signal,
      })
      return response.json()
    })
  },
}
