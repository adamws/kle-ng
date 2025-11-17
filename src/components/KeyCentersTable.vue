<!--
KeyCentersTable.vue

Displays a scrollable table of all keys in KLE order with their center positions.

Features:
- Shows key index, X center, Y center in units (U)
- Hover over row to highlight key on canvas
- Sticky header for better UX when scrolling
- Responsive design with mobile support
- Handles rotated and non-rectangular keys correctly

Usage:
  <KeyCentersTable />

Dependencies:
- useKeyboardStore: For key data and hover state
- getKeyCenter: For calculating key center positions
- Bootstrap 5: For table styling

Events:
- Row hover: Sets keyboardStore.hoveredKey
- Row leave: Clears keyboardStore.hoveredKey
-->

<template>
  <div class="key-centers-table-container">
    <div v-if="keyCenters.length === 0" class="text-muted text-center py-3">
      <i class="bi bi-grid-3x3"></i>
      <p class="mb-0 small">No keys</p>
    </div>

    <div v-else class="table-responsive">
      <table class="table table-sm table-bordered table-hover mb-0">
        <thead>
          <tr>
            <th
              class="fw-semibold small border-top-0 sortable-header"
              @click="handleSort('index')"
              :class="{ sorted: sortColumn === 'index' }"
            >
              <div class="d-flex align-items-center justify-content-between">
                <span>#</span>
                <i :class="['bi', getSortIcon('index')]" class="sort-icon"></i>
              </div>
            </th>
            <th
              class="fw-semibold small border-top-0 sortable-header"
              @click="handleSort('x')"
              :class="{ sorted: sortColumn === 'x' }"
            >
              <div class="d-flex align-items-center justify-content-between">
                <span>X ({{ units }})</span>
                <i :class="['bi', getSortIcon('x')]" class="sort-icon"></i>
              </div>
            </th>
            <th
              class="fw-semibold small border-top-0 sortable-header"
              @click="handleSort('y')"
              :class="{ sorted: sortColumn === 'y' }"
            >
              <div class="d-flex align-items-center justify-content-between">
                <span>Y ({{ units }})</span>
                <i :class="['bi', getSortIcon('y')]" class="sort-icon"></i>
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="item in keyCenters"
            :key="item.originalIndex"
            :class="{ 'table-active': isHovered(item.key) }"
            @mouseenter="handleRowHover(item.key)"
            @mouseleave="handleRowLeave()"
          >
            <td class="small">{{ item.originalIndex }}</td>
            <td class="small font-monospace">
              {{ formatCoordinate(item.center.x, 'x') }}
            </td>
            <td class="small font-monospace">
              {{ formatCoordinate(item.center.y, 'y') }}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useKeyboardStore, type Key } from '@/stores/keyboard'
import { getKeyCenter } from '@/utils/keyboard-geometry'
import { D } from '@/utils/decimal-math'

// Sorting types
type SortColumn = 'index' | 'x' | 'y'
type SortDirection = 'asc' | 'desc'

// Define props
interface Props {
  units: 'U' | 'mm'
  spacing: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  units: 'U',
  spacing: () => ({ x: 19.05, y: 19.05 }),
})

const keyboardStore = useKeyboardStore()

// Sorting state
const sortColumn = ref<SortColumn>('index')
const sortDirection = ref<SortDirection>('asc')

/**
 * Handle column header click for sorting
 */
const handleSort = (column: SortColumn) => {
  if (sortColumn.value === column) {
    // Toggle direction if same column
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    // Set new column with ascending direction
    sortColumn.value = column
    sortDirection.value = 'asc'
  }
}

/**
 * Get sort icon for a column
 */
const getSortIcon = (column: SortColumn): string => {
  if (sortColumn.value !== column) {
    return 'bi-arrow-down-up' // Neutral sort icon
  }
  return sortDirection.value === 'asc' ? 'bi-sort-numeric-down' : 'bi-sort-numeric-up'
}

/**
 * Format coordinate value according to selected units
 */
const formatCoordinate = (value: number, axis: 'x' | 'y'): string => {
  if (props.units === 'U') {
    // Return in units (no conversion needed)
    return value.toFixed(6).replace(/\.?0+$/, '')
  } else {
    // Convert to mm using spacing
    const spacingValue = axis === 'x' ? props.spacing.x : props.spacing.y
    const mmValue = D.mul(value, spacingValue)
    return Number(mmValue)
      .toFixed(6)
      .replace(/\.?0+$/, '')
  }
}

/**
 * Calculate center positions for all keys with sorting applied
 */
const keyCenters = computed(() => {
  const items = keyboardStore.keys.map((key, index) => ({
    key,
    center: getKeyCenter(key),
    originalIndex: index,
  }))

  // Apply sorting
  return items.sort((a, b) => {
    let valueA: number
    let valueB: number

    switch (sortColumn.value) {
      case 'index':
        valueA = a.originalIndex
        valueB = b.originalIndex
        break
      case 'x':
        valueA = a.center.x
        valueB = b.center.x
        break
      case 'y':
        valueA = a.center.y
        valueB = b.center.y
        break
    }

    const comparison = valueA - valueB
    return sortDirection.value === 'asc' ? comparison : -comparison
  })
})

/**
 * Check if a key is currently being hovered
 */
const isHovered = (key: Key): boolean => {
  return keyboardStore.tempSelectedKeys.includes(key)
}

/**
 * Handle row hover - set temporary highlight
 * Only updates if not actively rect-selecting to avoid conflicts
 */
const handleRowHover = (key: Key) => {
  // Only set tempSelectedKeys if not actively rect-selecting
  if (keyboardStore.mouseDragMode !== 'rect-select') {
    keyboardStore.tempSelectedKeys = [key]
  }
}

/**
 * Handle row leave - clear temporary highlight
 * Only clears if not actively rect-selecting to avoid conflicts
 */
const handleRowLeave = () => {
  // Only clear if not actively rect-selecting
  if (keyboardStore.mouseDragMode !== 'rect-select') {
    keyboardStore.tempSelectedKeys = []
  }
}
</script>

<style scoped>
.key-centers-table-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-responsive {
  max-height: 400px;
  border-radius: 0.375rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Sticky header */
.table thead th {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
}

/* Row hover effect */
.table tbody tr {
  cursor: pointer;
  transition: background-color 0.15s ease;
}

.table tbody tr:hover {
  background-color: var(--bs-tertiary-bg);
}

/* Active row (currently hovered key) */
.table tbody tr.table-active {
  background-color: var(--bs-primary-bg-subtle) !important;
  font-weight: 600;
}

/* Monospace for coordinates */
.font-monospace {
  font-variant-numeric: tabular-nums;
}

/* Sortable header styles */
.sortable-header {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s ease;
  position: relative;
}

.sortable-header:hover {
  background-color: var(--bs-secondary-bg-subtle);
}

.sortable-header.sorted {
  background-color: var(--bs-primary-bg-subtle);
}

/* Sort icon styles */
.sort-icon {
  font-size: 0.75rem;
  opacity: 0.6;
  transition: opacity 0.15s ease;
  min-width: 12px;
}

.sortable-header.sorted .sort-icon {
  opacity: 1;
}

.sortable-header:hover .sort-icon {
  opacity: 0.8;
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .table-wrapper {
    max-height: 300px;
  }

  /* Hide sort icons on very small screens to save space */
  .sort-icon {
    display: none;
  }
}
</style>
