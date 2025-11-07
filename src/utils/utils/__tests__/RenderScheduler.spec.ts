import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { RenderScheduler, renderScheduler } from '../RenderScheduler'

describe('RenderScheduler', () => {
  let scheduler: RenderScheduler

  beforeEach(() => {
    scheduler = new RenderScheduler()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('constructor', () => {
    it('should create a scheduler with no pending callbacks', () => {
      expect(scheduler.getPendingCount()).toBe(0)
      expect(scheduler.isPending()).toBe(false)
    })
  })

  describe('schedule', () => {
    it('should schedule a single callback', () => {
      const callback = vi.fn()

      scheduler.schedule(callback)

      expect(scheduler.getPendingCount()).toBe(1)
      expect(scheduler.isPending()).toBe(true)
      expect(callback).not.toHaveBeenCalled()
    })

    it('should batch multiple callbacks in the same frame', () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      scheduler.schedule(callback1)
      scheduler.schedule(callback2)
      scheduler.schedule(callback3)

      expect(scheduler.getPendingCount()).toBe(3)
      expect(scheduler.isPending()).toBe(true)
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()
      expect(callback3).not.toHaveBeenCalled()
    })

    it('should execute callbacks in the next animation frame', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()

      scheduler.schedule(callback1)
      scheduler.schedule(callback2)

      // Callbacks should not execute immediately
      expect(callback1).not.toHaveBeenCalled()
      expect(callback2).not.toHaveBeenCalled()

      // Trigger requestAnimationFrame
      await vi.runAllTimersAsync()

      expect(callback1).toHaveBeenCalledOnce()
      expect(callback2).toHaveBeenCalledOnce()
    })

    it('should execute callbacks in the order they were scheduled', async () => {
      const executionOrder: number[] = []
      const callback1 = vi.fn(() => executionOrder.push(1))
      const callback2 = vi.fn(() => executionOrder.push(2))
      const callback3 = vi.fn(() => executionOrder.push(3))

      scheduler.schedule(callback1)
      scheduler.schedule(callback2)
      scheduler.schedule(callback3)

      await vi.runAllTimersAsync()

      expect(executionOrder).toEqual([1, 2, 3])
    })

    it('should clear state after executing callbacks', async () => {
      const callback = vi.fn()

      scheduler.schedule(callback)
      expect(scheduler.isPending()).toBe(true)
      expect(scheduler.getPendingCount()).toBe(1)

      await vi.runAllTimersAsync()

      expect(scheduler.isPending()).toBe(false)
      expect(scheduler.getPendingCount()).toBe(0)
      expect(callback).toHaveBeenCalledOnce()
    })

    it('should handle errors in callbacks without stopping other callbacks', async () => {
      const callback1 = vi.fn(() => {
        throw new Error('Test error')
      })
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      scheduler.schedule(callback1)
      scheduler.schedule(callback2)
      scheduler.schedule(callback3)

      // Should not throw, but continue executing other callbacks
      await vi.runAllTimersAsync()

      expect(callback1).toHaveBeenCalledOnce()
      expect(callback2).toHaveBeenCalledOnce()
      expect(callback3).toHaveBeenCalledOnce()
    })
  })

  describe('multiple batches', () => {
    it('should handle scheduling after the first batch completes', async () => {
      const batch1Callback = vi.fn()
      const batch2Callback = vi.fn()

      // Schedule first batch
      scheduler.schedule(batch1Callback)
      await vi.runAllTimersAsync()

      expect(batch1Callback).toHaveBeenCalledOnce()
      expect(scheduler.isPending()).toBe(false)

      // Schedule second batch
      scheduler.schedule(batch2Callback)
      expect(scheduler.isPending()).toBe(true)

      await vi.runAllTimersAsync()

      expect(batch2Callback).toHaveBeenCalledOnce()
      expect(scheduler.isPending()).toBe(false)
    })

    it('should create new batch if callbacks are added while processing', async () => {
      const callback1 = vi.fn()
      const callback2 = vi.fn()
      const callback3 = vi.fn()

      // Schedule callbacks that schedule more callbacks
      scheduler.schedule(() => {
        callback1()
        // Schedule more during execution
        scheduler.schedule(callback3)
      })
      scheduler.schedule(callback2)

      // Process first batch
      await vi.advanceTimersByTimeAsync(16) // One RAF

      expect(callback1).toHaveBeenCalledOnce()
      expect(callback2).toHaveBeenCalledOnce()
      expect(scheduler.isPending()).toBe(true) // New batch pending
      expect(callback3).not.toHaveBeenCalled()

      // Process second batch
      await vi.advanceTimersByTimeAsync(16) // Another RAF

      expect(callback3).toHaveBeenCalledOnce()
      expect(scheduler.isPending()).toBe(false)
    })
  })

  describe('utility methods', () => {
    it('should return correct pending count', () => {
      expect(scheduler.getPendingCount()).toBe(0)

      scheduler.schedule(vi.fn())
      expect(scheduler.getPendingCount()).toBe(1)

      scheduler.schedule(vi.fn())
      scheduler.schedule(vi.fn())
      expect(scheduler.getPendingCount()).toBe(3)
    })

    it('should return correct pending status', () => {
      expect(scheduler.isPending()).toBe(false)

      scheduler.schedule(vi.fn())
      expect(scheduler.isPending()).toBe(true)
    })

    it('should clear all pending callbacks', () => {
      scheduler.schedule(vi.fn())
      scheduler.schedule(vi.fn())

      expect(scheduler.getPendingCount()).toBe(2)
      expect(scheduler.isPending()).toBe(true)

      scheduler.clear()

      expect(scheduler.getPendingCount()).toBe(0)
      expect(scheduler.isPending()).toBe(false)
    })
  })
})

describe('renderScheduler singleton', () => {
  beforeEach(() => {
    renderScheduler.clear()
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    renderScheduler.clear()
  })

  it('should be a RenderScheduler instance', () => {
    expect(renderScheduler).toBeInstanceOf(RenderScheduler)
  })

  it('should be usable for global render scheduling', async () => {
    const callback = vi.fn()

    renderScheduler.schedule(callback)
    expect(renderScheduler.isPending()).toBe(true)

    await vi.runAllTimersAsync()

    expect(callback).toHaveBeenCalledOnce()
    expect(renderScheduler.isPending()).toBe(false)
  })

  it('should maintain state across multiple uses', async () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()

    renderScheduler.schedule(callback1)
    await vi.runAllTimersAsync()

    renderScheduler.schedule(callback2)
    await vi.runAllTimersAsync()

    expect(callback1).toHaveBeenCalledOnce()
    expect(callback2).toHaveBeenCalledOnce()
  })
})
