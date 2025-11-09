/**
 * RenderScheduler - Batches render operations using requestAnimationFrame
 *
 * Prevents multiple renders per frame by scheduling them to execute together
 * in the next animation frame. This is crucial for performance when multiple
 * operations trigger renders simultaneously.
 */
export class RenderScheduler {
  private pendingRender = false
  private callbacks = new Set<() => void>()
  private errorHandler?: (error: Error) => void

  /**
   * Schedule a render callback to execute in the next animation frame
   * Multiple calls within the same frame will be batched together
   */
  public schedule(callback: () => void): void {
    this.callbacks.add(callback)

    if (!this.pendingRender) {
      this.pendingRender = true
      requestAnimationFrame(() => {
        // Execute all callbacks in the order they were scheduled
        // Use a copy of the array to allow callbacks to schedule more callbacks
        const callbacksToExecute = Array.from(this.callbacks)
        this.callbacks.clear()
        this.pendingRender = false

        // Execute callbacks with error handling
        callbacksToExecute.forEach((cb) => {
          try {
            cb()
          } catch (error) {
            // Log error but continue executing other callbacks
            if (this.errorHandler) {
              this.errorHandler(error as Error)
            } else {
              console.error('Error in render callback:', error)
            }
          }
        })
      })
    }
  }

  /**
   * Get the number of pending callbacks
   * Useful for testing and debugging
   */
  public getPendingCount(): number {
    return this.callbacks.size
  }

  /**
   * Check if a render is currently scheduled
   * Useful for testing and debugging
   */
  public isPending(): boolean {
    return this.pendingRender
  }

  /**
   * Clear all pending callbacks (primarily for testing)
   */
  public clear(): void {
    this.callbacks.clear()
    this.pendingRender = false
  }

  /**
   * Set a custom error handler for callback execution errors
   * This allows integration with error tracking services (e.g., Sentry)
   *
   * @param handler - Error handler function, or undefined to use default console.error
   *
   * @example
   * ```typescript
   * // Integrate with Sentry
   * renderScheduler.setErrorHandler((error) => {
   *   Sentry.captureException(error)
   * })
   *
   * // Reset to default console.error
   * renderScheduler.setErrorHandler(undefined)
   * ```
   */
  public setErrorHandler(handler: ((error: Error) => void) | undefined): void {
    this.errorHandler = handler
  }
}

/**
 * Global render scheduler instance
 * Use this singleton for all render scheduling needs
 */
export const renderScheduler = new RenderScheduler()
