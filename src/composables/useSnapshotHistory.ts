/**
 * Undo/redo over whole-state snapshots, like the layout editor's history
 * (src/stores/keyboard.ts): every committed change pushes a copy of the new
 * state, undo and redo move through the list.
 *
 * Snapshots are JSON copies: the state is plain data, and values read from a
 * Pinia store may hold Vue proxies, which structuredClone refuses.
 */
import { computed, ref, shallowRef } from 'vue'

export const DEFAULT_HISTORY_LIMIT = 100

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T

export function useSnapshotHistory<T>(limit = DEFAULT_HISTORY_LIMIT) {
  const states = shallowRef<T[]>([])
  const index = ref(-1)

  const canUndo = computed(() => index.value > 0)
  const canRedo = computed(() => index.value < states.value.length - 1)

  /** Starts over from `state`, forgetting all history. */
  function reset(state: T) {
    states.value = [copy(state)]
    index.value = 0
  }

  /** Records `state` as the result of a committed change. */
  function push(state: T) {
    const next = [...states.value.slice(0, index.value + 1), copy(state)]
    while (next.length > limit) next.shift()
    states.value = next
    index.value = next.length - 1
  }

  /**
   * Changes the current state in place, without a new step: for what the next
   * step's undo must restore that the state didn't record when it was pushed.
   */
  function amend(update: (state: T) => T) {
    if (index.value < 0) return
    const next = [...states.value]
    next[index.value] = copy(update(copy(next[index.value]!)))
    states.value = next
  }

  /** The previous state, or undefined when there is none. */
  function undo(): T | undefined {
    if (!canUndo.value) return undefined
    index.value--
    return copy(states.value[index.value]!)
  }

  /** The next state, or undefined when there is none. */
  function redo(): T | undefined {
    if (!canRedo.value) return undefined
    index.value++
    return copy(states.value[index.value]!)
  }

  return { canUndo, canRedo, reset, push, amend, undo, redo }
}
