import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { Key } from './keyboard'

export const useMatrixDrawingStore = defineStore('matrix-drawing', () => {
  // Drawing state
  const drawingType = ref<'row' | 'column' | null>(null)
  const currentSequence = ref<Key[]>([])
  const completedRows = ref<Key[][]>([])
  const completedColumns = ref<Key[][]>([])

  // Sensitivity for line intersection (0.0 = most permissive, 1.0 = strictest)
  // Default 0.5 provides good balance between catching intended keys and avoiding "barely touched" keys
  const sensitivity = ref<number>(0.5)

  // Computed
  const isDrawing = computed(() => drawingType.value !== null)
  const hasDrawings = computed(
    () => completedRows.value.length > 0 || completedColumns.value.length > 0,
  )

  // Actions
  const enableDrawing = (type: 'row' | 'column') => {
    drawingType.value = type
    currentSequence.value = []
  }

  const disableDrawing = () => {
    drawingType.value = null
    currentSequence.value = []
  }

  const addKeyToSequence = (key: Key) => {
    currentSequence.value.push(key)
  }

  const completeSequence = () => {
    if (currentSequence.value.length === 0) return

    if (drawingType.value === 'row') {
      completedRows.value.push([...currentSequence.value])
    } else if (drawingType.value === 'column') {
      completedColumns.value.push([...currentSequence.value])
    }

    currentSequence.value = []
  }

  const clearCurrentSequence = () => {
    currentSequence.value = []
  }

  const clearDrawings = () => {
    completedRows.value = []
    completedColumns.value = []
    currentSequence.value = []
  }

  const getCompletedDrawings = () => {
    return {
      rows: completedRows.value,
      columns: completedColumns.value,
    }
  }

  const setSensitivity = (value: number) => {
    // Clamp between 0 and 1
    sensitivity.value = Math.max(0, Math.min(1, value))
  }

  return {
    // State
    drawingType,
    currentSequence,
    completedRows,
    completedColumns,
    sensitivity,

    // Computed
    isDrawing,
    hasDrawings,

    // Actions
    enableDrawing,
    disableDrawing,
    addKeyToSequence,
    completeSequence,
    clearCurrentSequence,
    clearDrawings,
    getCompletedDrawings,
    setSensitivity,
  }
})
