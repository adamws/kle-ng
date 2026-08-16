import { ref } from 'vue'

export interface ToastProps {
  message: string
  title?: string
  type?: 'success' | 'error' | 'warning' | 'info'
  duration?: number
  showIcon?: boolean
  showCloseButton?: boolean
  actionLabel?: string
  actionUrl?: string
  onClose?: () => void
}

export interface Toast extends ToastProps {
  id: string
}

const toasts = ref<Toast[]>([])
let nextId = 1

export function useToast() {
  const showToast = (options: Omit<Toast, 'id'>) => {
    const toast: Toast = {
      id: `toast-${nextId++}`,
      type: 'info',
      duration: 4000,
      showIcon: true,
      showCloseButton: true,
      ...options,
    }

    toasts.value.push(toast)
    return toast.id
  }

  const removeToast = (id: string) => {
    const index = toasts.value.findIndex((toast) => toast.id === id)
    if (index > -1) {
      const removed = toasts.value.splice(index, 1)[0]
      removed?.onClose?.()
    }
  }

  const clearToasts = () => {
    toasts.value = []
  }

  // Convenience methods for different toast types
  const showSuccess = (message: string, title?: string, options?: Partial<Toast>) => {
    return showToast({
      message,
      title,
      type: 'success',
      ...options,
    })
  }

  const showError = (message: string, title?: string, options?: Partial<Toast>) => {
    return showToast({
      message,
      title,
      type: 'error',
      duration: 6000, // Longer duration for errors
      ...options,
    })
  }

  const showWarning = (message: string, title?: string, options?: Partial<Toast>) => {
    return showToast({
      message,
      title,
      type: 'warning',
      duration: 5000,
      ...options,
    })
  }

  const showInfo = (message: string, title?: string, options?: Partial<Toast>) => {
    return showToast({
      message,
      title,
      type: 'info',
      ...options,
    })
  }

  return {
    toasts,
    showToast,
    removeToast,
    clearToasts,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  }
}

// Global toast instance for use throughout the app
export const toast = useToast()

/** Delay before a loading toast appears, so quick loads never flash one. */
const LOADING_TOAST_DELAY_MS = 500
/** How long a loading toast stays up once it has appeared. */
const LOADING_TOAST_MIN_VISIBLE_MS = 1000

export interface LoadingToastHandle {
  /** Dismiss, but not before the toast has been on screen its minimum time. */
  finish: () => Promise<void>
  /** Dismiss now, without waiting. For error paths, where a message follows. */
  cancel: () => void
}

/**
 * Show a loading toast after a short delay, and dismiss it without flicker.
 *
 * Every long-running load in the keyboard store wants the same two behaviours: say
 * nothing at all if the load is quick, and once something has been said, leave it up
 * long enough to be read rather than replacing it a frame later. The minimum display
 * time runs from when the toast appeared, not from when the load started.
 */
export function beginLoadingToast(message: string, title = 'Loading'): LoadingToastHandle {
  let toastId: string | null = null
  let shownAt = 0

  const timer = setTimeout(() => {
    toastId = toast.showInfo(message, title, { duration: 0 })
    shownAt = Date.now()
  }, LOADING_TOAST_DELAY_MS)

  const cancel = () => {
    clearTimeout(timer)
    if (toastId) {
      toast.removeToast(toastId)
      toastId = null
    }
  }

  const finish = async () => {
    clearTimeout(timer)
    if (!toastId) return

    const remaining = LOADING_TOAST_MIN_VISIBLE_MS - (Date.now() - shownAt)
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining))
    }
    if (toastId) {
      toast.removeToast(toastId)
      toastId = null
    }
  }

  return { finish, cancel }
}

// Expose toast globally for e2e testing
if (typeof window !== 'undefined') {
  ;(window as typeof window & { __kleToast: typeof toast }).__kleToast = toast
}
