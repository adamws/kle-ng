import { describe, it, expect } from 'vitest'
import { reactive } from 'vue'
import { useSnapshotHistory } from '../useSnapshotHistory'

describe('useSnapshotHistory', () => {
  it('undoes and redoes through pushed states', () => {
    const h = useSnapshotHistory<number[]>()
    h.reset([])
    h.push([1])
    h.push([1, 2])
    expect(h.undo()).toEqual([1])
    expect(h.undo()).toEqual([])
    expect(h.undo()).toBeUndefined()
    expect(h.redo()).toEqual([1])
    expect(h.canRedo.value).toBe(true)
  })

  it('drops the redo branch on a new push', () => {
    const h = useSnapshotHistory<string>()
    h.reset('a')
    h.push('b')
    h.undo()
    h.push('c')
    expect(h.canRedo.value).toBe(false)
    expect(h.undo()).toBe('a')
  })

  it('keeps copies, so later changes and Vue proxies do not leak in', () => {
    const h = useSnapshotHistory<{ items: number[] }>()
    const state = reactive({ items: [1] })
    h.reset(state)
    state.items.push(2)
    h.push(state)
    const back = h.undo()!
    expect(back).toEqual({ items: [1] })
    back.items.push(9)
    expect(h.redo()).toEqual({ items: [1, 2] })
    expect(h.undo()).toEqual({ items: [1] })
  })

  it('caps the number of states', () => {
    const h = useSnapshotHistory<number>(3)
    h.reset(0)
    for (let i = 1; i <= 5; i++) h.push(i)
    expect(h.undo()).toBe(4)
    expect(h.undo()).toBe(3)
    expect(h.undo()).toBeUndefined()
  })
})
