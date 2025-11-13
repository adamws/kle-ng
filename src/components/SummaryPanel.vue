<template>
  <div class="summary-panel">
    <div class="row g-3 h-100">
      <div class="col-md-6 col-lg-4">
        <!-- Keys by Size Table -->
        <div v-if="viewMode === 'size'" class="table-section">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="section-title mb-0">Keys</h6>
            <!-- Toggle for view mode -->
            <div class="btn-group" role="group" aria-label="Summary view mode">
              <input
                type="radio"
                class="btn-check"
                id="view-size"
                value="size"
                v-model="viewMode"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-sm" for="view-size">By Size</label>

              <input
                type="radio"
                class="btn-check"
                id="view-size-color"
                value="size-color"
                v-model="viewMode"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-sm" for="view-size-color"
                >By Size & Color</label
              >
            </div>
          </div>
          <div class="table-container">
            <table class="table table-sm table-striped mb-0">
              <thead class="table-light">
                <tr>
                  <th class="fw-semibold small border-top-0">Size (U)</th>
                  <th class="text-end fw-semibold small border-top-0">Count</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in keysBySize" :key="entry.size">
                  <td class="small align-middle">{{ entry.size }}</td>
                  <td class="text-end small align-middle">{{ entry.count }}</td>
                </tr>
                <tr class="table-active border-top">
                  <td class="small align-middle"><strong>Total Keys</strong></td>
                  <td class="text-end small align-middle">
                    <strong>{{ totalKeys }}</strong>
                  </td>
                </tr>
                <tr v-if="totalDecalKeys > 0" class="table-active border-top">
                  <td class="small align-middle"><strong>Regular Keys</strong></td>
                  <td class="text-end small align-middle">
                    <strong>{{ totalKeysWithoutDecals }}</strong>
                  </td>
                </tr>
                <tr v-if="totalDecalKeys > 0" class="table-active border-top">
                  <td class="small align-middle"><strong>Decal Keys</strong></td>
                  <td class="text-end small align-middle">
                    <strong>{{ totalDecalKeys }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Keys by Size and Color Table -->
        <div v-else-if="viewMode === 'size-color'" class="table-section">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h6 class="section-title mb-0">Keys</h6>
            <!-- Toggle for view mode -->
            <div class="btn-group" role="group" aria-label="Summary view mode">
              <input
                type="radio"
                class="btn-check"
                id="view-size-2"
                value="size"
                v-model="viewMode"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-sm" for="view-size-2">By Size</label>

              <input
                type="radio"
                class="btn-check"
                id="view-size-color-2"
                value="size-color"
                v-model="viewMode"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-sm" for="view-size-color-2"
                >By Size & Color</label
              >
            </div>
          </div>
          <div class="table-container">
            <table class="table table-sm table-striped mb-0">
              <thead class="table-light">
                <tr>
                  <th class="fw-semibold small border-top-0">Size (U)</th>
                  <th class="fw-semibold small border-top-0">Color</th>
                  <th class="text-end fw-semibold small border-top-0">Count</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in keysBySizeAndColor" :key="`${entry.size}-${entry.color}`">
                  <td class="small align-middle">{{ entry.size }}</td>
                  <td class="small align-middle">
                    <div class="d-flex align-items-center gap-2">
                      <div
                        class="color-swatch"
                        :style="{ backgroundColor: entry.color }"
                        :title="entry.color"
                      ></div>
                      <code class="color-code">{{ entry.color }}</code>
                    </div>
                  </td>
                  <td class="text-end small align-middle">{{ entry.count }}</td>
                </tr>
                <tr class="table-active border-top">
                  <td class="small align-middle"><strong>Total Keys</strong></td>
                  <td class="small align-middle"></td>
                  <td class="text-end small align-middle">
                    <strong>{{ totalKeys }}</strong>
                  </td>
                </tr>
                <tr v-if="totalDecalKeys > 0" class="table-active border-top">
                  <td class="small align-middle"><strong>Regular Keys</strong></td>
                  <td class="small align-middle"></td>
                  <td class="text-end small align-middle">
                    <strong>{{ totalKeysWithoutDecals }}</strong>
                  </td>
                </tr>
                <tr v-if="totalDecalKeys > 0" class="table-active border-top">
                  <td class="small align-middle"><strong>Decal Keys</strong></td>
                  <td class="small align-middle"></td>
                  <td class="text-end small align-middle">
                    <strong>{{ totalDecalKeys }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKeyboardStore, Key } from '@/stores/keyboard'

const keyboardStore = useKeyboardStore()

// View mode toggle
const viewMode = ref<'size' | 'size-color'>('size')

// Calculate total keys
const totalKeys = computed(() => {
  return keyboardStore.keys.length
})

// Calculate total keys without decals
const totalKeysWithoutDecals = computed(() => {
  return keyboardStore.keys.filter((key) => !key.decal).length
})

// Calculate total decal keys
const totalDecalKeys = computed(() => {
  return keyboardStore.keys.filter((key) => key.decal).length
})

// Helper function to format key size with special key detection
const formatKeySize = (key: Key): string => {
  const width = key.width || 1
  const height = key.height || 1
  const width2 = key.width2
  const height2 = key.height2
  const x2 = key.x2
  const y2 = key.y2

  // Check for ISO Enter (1.25 × 2 with 1.5 × 1 secondary)
  if (
    width === 1.25 &&
    height === 2 &&
    width2 === 1.5 &&
    height2 === 1 &&
    x2 === -0.25 &&
    y2 === 0
  ) {
    return 'ISO Enter'
  }

  // Check for Big-Ass Enter (1.5 × 2 with 2.25 × 1 secondary)
  if (
    width === 1.5 &&
    height === 2 &&
    width2 === 2.25 &&
    height2 === 1 &&
    x2 === -0.75 &&
    y2 === 1
  ) {
    return 'Big-Ass Enter'
  }

  // Check for stepped keys using the stepped property
  const isStepped = key.stepped === true

  // Check for non-rectangular keys (not stepped and has secondary dimensions or offsets)
  const isNonRectangular =
    !isStepped &&
    (width !== (width2 || width) ||
      height !== (height2 || height) ||
      (x2 !== undefined && x2 !== 0) ||
      (y2 !== undefined && y2 !== 0))

  if (isStepped) {
    const primarySize = width === height ? `${width} × ${width}` : `${width} × ${height}`
    const secondarySize =
      (width2 || width) === (height2 || height)
        ? `${width2 || width} × ${width2 || width}`
        : `${width2 || width} × ${height2 || height}`

    if (primarySize === secondarySize) {
      return `${primarySize} (stepped)`
    }
    return `${primarySize}+${secondarySize} (stepped)`
  }

  if (isNonRectangular) {
    const primarySize = width === height ? `${width} × ${width}` : `${width} × ${height}`
    const secondarySize =
      (width2 || width) === (height2 || height)
        ? `${width2 || width} × ${width2 || width}`
        : `${width2 || width} × ${height2 || height}`

    if (primarySize === secondarySize) {
      return `${primarySize} (non-rectangular)`
    }
    return `${primarySize}+${secondarySize} (non-rectangular)`
  }

  // Regular rectangular keys
  return width === height ? `${width} × ${width}` : `${width} × ${height}`
}

// Helper function to get key color (prioritize key color, fallback to default)
const getKeyColor = (key: Key): string => {
  return key.color || '#cccccc' // Default gray color
}

// Calculate keys by size (separate decals)
const keysBySize = computed(() => {
  const regularSizeMap = new Map<string, number>()
  const decalSizeMap = new Map<string, number>()

  keyboardStore.keys.forEach((key) => {
    const size = formatKeySize(key)
    if (key.decal) {
      decalSizeMap.set(size, (decalSizeMap.get(size) || 0) + 1)
    } else {
      regularSizeMap.set(size, (regularSizeMap.get(size) || 0) + 1)
    }
  })

  const result = []

  // Add regular keys
  for (const [size, count] of regularSizeMap.entries()) {
    result.push({ size, count, isDecal: false })
  }

  // Add decal keys only if there are any
  if (totalDecalKeys.value > 0) {
    for (const [size, count] of decalSizeMap.entries()) {
      result.push({ size: `${size} (decal)`, count, isDecal: true })
    }
  }

  return result.sort((a, b) => {
    // Sort by count descending, then by size name, decals after regular
    if (a.count !== b.count) return b.count - a.count
    if (a.isDecal !== b.isDecal) return a.isDecal ? 1 : -1
    return a.size.localeCompare(b.size)
  })
})

// Calculate keys by size and color (separate decals)
const keysBySizeAndColor = computed(() => {
  const regularMap = new Map<string, number>()
  const decalMap = new Map<string, number>()

  keyboardStore.keys.forEach((key) => {
    const size = formatKeySize(key)
    const color = getKeyColor(key)
    const key_combo = `${size}|||${color}`

    if (key.decal) {
      decalMap.set(key_combo, (decalMap.get(key_combo) || 0) + 1)
    } else {
      regularMap.set(key_combo, (regularMap.get(key_combo) || 0) + 1)
    }
  })

  const result = []

  // Add regular keys
  for (const [combo, count] of regularMap.entries()) {
    const [size, color] = combo.split('|||')
    result.push({ size, color, count, isDecal: false })
  }

  // Add decal keys only if there are any
  if (totalDecalKeys.value > 0) {
    for (const [combo, count] of decalMap.entries()) {
      const [size, color] = combo.split('|||')
      result.push({ size: `${size} (decal)`, color, count, isDecal: true })
    }
  }

  return result.sort((a, b) => {
    // Sort by count descending, then by size, then by color, decals after regular
    if (a.count !== b.count) return b.count - a.count
    if (a.isDecal !== b.isDecal) return a.isDecal ? 1 : -1
    if (a.size !== b.size) return (a.size || '').localeCompare(b.size || '')
    return (a.color || '').localeCompare(b.color || '')
  })
})
</script>

<style scoped>
.summary-panel {
  background: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 12px;
  height: 100%;
}

.section-title {
  color: var(--bs-secondary-color);
  font-weight: 600;
}

.color-swatch {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  border: 1px solid var(--bs-border-color);
  flex-shrink: 0;
}

.color-code {
  font-size: 0.7rem;
  color: var(--bs-secondary-color);
  background: var(--bs-tertiary-bg);
  padding: 0.1rem 0.2rem;
  border-radius: 0.25rem;
  line-height: 1;
}

.table-container {
  border-radius: 0.375rem;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Responsive adjustments */
@media (max-width: 576px) {
  .summary-panel {
    padding: 0.5rem;
  }

  .metric-value {
    font-size: 1.25rem;
  }

  .color-code {
    font-size: 0.7rem;
  }
}
</style>
