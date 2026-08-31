/**
 * Transient state for the Curve Layout tool.
 *
 * This store holds only what the tool needs while it is open — the spine, the options, and the
 * snapshot needed to cancel. Nothing here is persisted: Apply bakes plain coordinates into the
 * keys and saves one history entry, exactly like the Mirror and Rotate tools, so a curved layout
 * is just a layout and survives export, import and undo with no special handling.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { Key } from '@adamws/kle-serial'
import { useKeyboardStore } from './keyboard'
import { defaultSpineForKeys, layoutKeysOnCurve, type CurveSpine } from '@/utils/curve-layout'

/** Geometry captured so Cancel can put the selection back exactly as it was. */
interface KeyGeometry {
  x: number
  y: number
  rotation_x: number
  rotation_y: number
  rotation_angle: number
}

const geometryOf = (key: Key): KeyGeometry => ({
  x: key.x,
  y: key.y,
  rotation_x: key.rotation_x,
  rotation_y: key.rotation_y,
  rotation_angle: key.rotation_angle,
})

export const useCurveLayoutStore = defineStore('curve-layout', () => {
  const isActive = ref(false)
  const isDraggingHandle = ref(false)

  const spine = ref<CurveSpine>([
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
    { x: 3, y: 0 },
  ])

  const gap = ref(0)
  const followCurve = ref(true)
  const allowOverlaps = ref(false)

  const columnCount = ref(0)
  const collisionFree = ref(true)
  const overlapCount = ref(0)

  // The keys the tool is operating on, locked in when it opens so that changing the canvas
  // selection mid-edit cannot silently retarget the transform.
  const targets = ref<Key[]>([])
  const snapshot = ref<KeyGeometry[]>([])
  const initialSpine = ref<CurveSpine | null>(null)
  /** True when the tool opened with nothing selected and so took the whole layout. */
  const usingAllKeys = ref(false)

  const keyCount = computed(() => targets.value.length)
  // Overlaps block Apply only while the user is asking for a collision-free result. Most real
  // keyboards cannot have one — see `allowOverlaps` in the solver options.
  const canApply = computed(
    () => targets.value.length > 0 && (collisionFree.value || allowOverlaps.value),
  )

  /** Put the selection back in its pre-edit state, so the solver always reads pristine input. */
  const restoreSnapshot = () => {
    targets.value.forEach((key, index) => {
      const geometry = snapshot.value[index]
      if (geometry) Object.assign(key, geometry)
    })
  }

  /**
   * Re-solve and write the result onto the live keys.
   *
   * Restores the snapshot first so each preview is computed from the original layout rather
   * than from the previous preview — otherwise dragging a handle would compound.
   */
  const preview = () => {
    if (!targets.value.length) return
    restoreSnapshot()

    const result = layoutKeysOnCurve(targets.value, spine.value, {
      gap: gap.value,
      followCurve: followCurve.value,
      allowOverlaps: allowOverlaps.value,
    })

    // The solver already rounds to the precision the layout is stored at, and verifies those
    // exact numbers, so its verdict describes what lands on the keys.
    for (const { key, ...geometry } of result.placements) {
      Object.assign(key, geometry)
    }

    columnCount.value = result.columnCount
    collisionFree.value = result.collisionFree
    overlapCount.value = result.overlapCount

    useKeyboardStore().notifyKeysModified()
  }

  /**
   * Open the tool.
   *
   * Operates on the current selection, or on the whole layout when nothing is selected — the
   * same rule the other Extra Tools follow, so the tool is reachable without selecting first.
   */
  const begin = () => {
    const keyboard = useKeyboardStore()
    const selection = keyboard.selectedKeys
    usingAllKeys.value = selection.length === 0
    targets.value = usingAllKeys.value ? [...keyboard.keys] : [...selection]
    snapshot.value = targets.value.map(geometryOf)
    spine.value = defaultSpineForKeys(targets.value)
    initialSpine.value = spine.value.map((point) => ({ ...point })) as CurveSpine
    isActive.value = true
    preview()
  }

  /** Put the spine back to the straight default, which is an identity transform. */
  const resetSpine = () => {
    if (!initialSpine.value) return
    spine.value = initialSpine.value.map((point) => ({ ...point })) as CurveSpine
    preview()
  }

  const setSpinePoint = (index: number, point: { x: number; y: number }) => {
    const next = spine.value.map((existing) => ({ ...existing })) as CurveSpine
    next[index] = { x: point.x, y: point.y }
    setSpine(next)
  }

  /** Replace the whole spine in one step, so a multi-handle change re-solves only once. */
  const setSpine = (next: CurveSpine) => {
    spine.value = next.map((point) => ({ ...point })) as CurveSpine
    preview()
  }

  /** Discard the edit and restore the exact geometry the tool opened with. */
  const cancel = () => {
    restoreSnapshot()
    useKeyboardStore().notifyKeysModified()
    reset()
  }

  /** Keep the previewed geometry and record it as a single undoable change. */
  const apply = () => {
    const keyboardStore = useKeyboardStore()
    keyboardStore.saveState()
    reset()
  }

  const reset = () => {
    isActive.value = false
    isDraggingHandle.value = false
    targets.value = []
    snapshot.value = []
    initialSpine.value = null
    usingAllKeys.value = false
    columnCount.value = 0
    collisionFree.value = true
    overlapCount.value = 0
  }

  return {
    isActive,
    isDraggingHandle,
    spine,
    gap,
    followCurve,
    allowOverlaps,
    columnCount,
    collisionFree,
    overlapCount,
    keyCount,
    usingAllKeys,
    canApply,
    begin,
    preview,
    resetSpine,
    setSpine,
    setSpinePoint,
    cancel,
    apply,
    reset,
  }
})
