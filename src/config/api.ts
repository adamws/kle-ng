// Helper to get and validate backend URL
function getBackendUrl(): string {
  const url = import.meta.env.VITE_BACKEND_URL

  // Development: if empty, use same origin (Vite proxy handles /api/* requests)
  if (!url && import.meta.env.DEV) {
    console.info('Using Vite proxy for API requests (VITE_BACKEND_URL not set)')
    return '' // Empty string means same origin, Vite will proxy /api/* to localhost:8080
  }

  // Production validation
  if (!url) {
    throw new Error('VITE_BACKEND_URL environment variable is required in production')
  }

  // Enforce HTTPS in production
  if (import.meta.env.PROD && url.startsWith('http://')) {
    console.error('Production API must use HTTPS')
    throw new Error('Insecure API URL in production')
  }

  return url
}

export const API_CONFIG = {
  baseURL: getBackendUrl(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
} as const

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
