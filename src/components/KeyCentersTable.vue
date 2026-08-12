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
      <BiGrid3x3 />
      <p class="mb-0 small">No keys</p>
    </div>

    <div v-else class="table-responsive">
      <table class="table table-sm table-bordered table-hover mb-0 key-centers-table">
        <colgroup>
          <col class="col-index" />
          <col class="col-coord" />
          <col class="col-coord" />
        </colgroup>
        <thead>
          <tr>
            <th
              class="fw-semibold small border-top-0 sortable-header"
              @click="handleSort('index')"
              :class="{ sorted: sortColumn === 'index' }"
            >
              <div class="d-flex align-items-center justify-content-between">
                <span class="fw-semibold">#</span>
                <BiArrowDownUp v-if="sortColumn !== 'index'" />
                <BiSortNumericDown v-else-if="sortDirection === 'asc'" />
                <BiSortNumericUp v-else />
              </div>
            </th>
            <th
              class="fw-semibold small border-top-0 sortable-header"
              @click="handleSort('x')"
              :class="{ sorted: sortColumn === 'x' }"
            >
              <div class="d-flex align-items-center justify-content-between">
                <span class="fw-semibold">X ({{ units }})</span>
                <BiArrowDownUp v-if="sortColumn !== 'x'" />
                <BiSortNumericDown v-else-if="sortDirection === 'asc'" />
                <BiSortNumericUp v-else />
              </div>
            </th>
            <th
              class="fw-semibold small border-top-0 sortable-header"
              @click="handleSort('y')"
              :class="{ sorted: sortColumn === 'y' }"
            >
              <div class="d-flex align-items-center justify-content-between">
                <span class="fw-semibold">Y ({{ units }})</span>
                <BiArrowDownUp v-if="sortColumn !== 'y'" />
                <BiSortNumericDown v-else-if="sortDirection === 'asc'" />
                <BiSortNumericUp v-else />
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
            <td class="small font-monospace" :title="formatCoordinate(item.center.x)">
              {{ formatCoordinate(item.center.x) }}
            </td>
            <td class="small font-monospace" :title="formatCoordinate(item.center.y)">
              {{ formatCoordinate(item.center.y) }}
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
import { getKeyCenter, getKeyCenterMm } from '@/utils/keyboard-geometry'
import BiGrid3x3 from 'bootstrap-icons/icons/grid-3x3.svg'
import BiArrowDownUp from 'bootstrap-icons/icons/arrow-down-up.svg'
import BiSortNumericDown from 'bootstrap-icons/icons/sort-numeric-down.svg'
import BiSortNumericUp from 'bootstrap-icons/icons/sort-numeric-up.svg'

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
 * Format coordinate value for display
 */
const formatCoordinate = (value: number): string => {
  return value.toFixed(6).replace(/\.?0+$/, '')
}

/**
 * Calculate center positions for all keys with sorting applied
 */
const keyCenters = computed(() => {
  const isMm = props.units === 'mm'
  const items = keyboardStore.keys.map((key, index) => ({
    key,
    center: isMm ? getKeyCenterMm(key, props.spacing.x, props.spacing.y) : getKeyCenter(key),
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
  /* Reserved for "#": digits + sort icon + cell padding */
  --index-col-width: 4.25rem;
  /* Below this the columns would clip digits, so scroll horizontally instead */
  --table-min-width: 17rem;

  height: 100%;
  display: flex;
  flex-direction: column;
}

.table-responsive {
  max-height: 400px;
  border-radius: 0.375rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  /*
   * Always reserve the scrollbar track. Without this, a browser with classic
   * (space-taking) scrollbars resizes every column the moment the row count
   * crosses max-height and the vertical scrollbar appears or disappears.
   */
  scrollbar-gutter: stable;
}

/*
 * Fixed layout keeps column widths independent of cell content, so editing a
 * key (which reflows X/Y values) never resizes the columns. The two coordinate
 * columns split the remaining width evenly and stay equal at any panel width.
 */
.key-centers-table {
  table-layout: fixed;
  width: 100%;
  min-width: var(--table-min-width);
}

.key-centers-table .col-index {
  width: var(--index-col-width);
}

.key-centers-table .col-coord {
  width: calc((100% - var(--index-col-width)) / 2);
}

/* Safety net: never let an unusually long value push the layout around */
.key-centers-table tbody td {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.key-centers-table thead .sortable-header span {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.key-centers-table thead .sortable-header svg {
  flex: 0 0 auto;
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
</style>
