// Custom backend URL storage (session-only, not persisted)
let _customBackendUrl: string | null = null

// Set custom backend URL (call with null to reset to default)
export function setCustomBackendUrl(url: string | null) {
  _customBackendUrl = url
  _apiConfig = null // Reset cached config to use new URL
}

// Get current custom backend URL (null if using default)
export function getCustomBackendUrl(): string | null {
  return _customBackendUrl
}

// Get the default backend URL from environment
export function getDefaultBackendUrl(): string {
  const url = import.meta.env.VITE_BACKEND_URL
  if (!url && import.meta.env.DEV) {
    return ''
  }
  return url || ''
}

// Helper to get and validate backend URL
function getBackendUrl(): string | null {
  // Custom URL takes precedence
  if (_customBackendUrl !== null) {
    return _customBackendUrl
  }

  const url = import.meta.env.VITE_BACKEND_URL

  // Development: if empty, use same origin (Vite proxy handles /api/* requests)
  if (!url && import.meta.env.DEV) {
    console.info('Using Vite proxy for API requests (VITE_BACKEND_URL not set)')
    return '' // Empty string means same origin, Vite will proxy /api/* to localhost:8080
  }

  // Production: if not set, return null (PCB generator will be disabled)
  if (!url) {
    return null
  }

  // Enforce HTTPS in production
  if (import.meta.env.PROD && url.startsWith('http://')) {
    console.error('Production API must use HTTPS')
    return null
  }

  return url
}

// Lazy initialization to avoid throwing errors during app startup
let _apiConfig: { baseURL: string; timeout: number; headers: { 'Content-Type': string } } | null =
  null

function getApiConfig() {
  if (_apiConfig === null) {
    const baseURL = getBackendUrl()
    if (baseURL === null) {
      throw new Error(
        'PCB Generator backend is not configured. Set VITE_BACKEND_URL environment variable.',
      )
    }
    _apiConfig = {
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  }
  return _apiConfig
}

export const API_CONFIG = {
  get baseURL() {
    return getApiConfig().baseURL
  },
  get timeout() {
    return getApiConfig().timeout
  },
  get headers() {
    return getApiConfig().headers
  },
}

// Check if backend is available (without throwing errors)
export function isBackendConfigured(): boolean {
  return getBackendUrl() !== null
}

export const ENDPOINTS = {
  PCB: '/api/pcb',
  WORKERS: '/api/workers',
} as const

// Verify CORS configuration
export async function verifyCorsConfiguration(): Promise<boolean> {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}${ENDPOINTS.WORKERS}`, {
      method: 'OPTIONS',
    })
    return response.ok
  } catch (error) {
    console.error('CORS verification failed:', error)
    return false
  }
}
