<template>
  <div class="summary-panel">
    <div class="row g-3">
      <!-- Column 1: Keys Statistics -->
      <div class="col-lg-3 col-md-6">
        <div class="property-group">
          <div class="d-flex justify-content-between align-items-center mb-0">
            <h6 class="property-group-title mb-2">Keys</h6>
            <!-- Toggle for view mode -->
            <div
              style="margin-top: -8px"
              class="btn-group"
              role="group"
              aria-label="Summary view mode"
            >
              <input
                type="radio"
                class="btn-check"
                id="view-size"
                value="size"
                v-model="viewMode"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-xs" for="view-size">By Size</label>

              <input
                type="radio"
                class="btn-check"
                id="view-size-color"
                value="size-color"
                v-model="viewMode"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-xs" for="view-size-color"
                >By Size & Color</label
              >
            </div>
          </div>

          <div v-if="totalKeys === 0" class="text-muted text-center py-3">
            <BiGrid3x3 />
            <p class="mb-0 small">No keys</p>
          </div>

          <div v-else class="table-responsive">
            <!-- Keys by Size Table -->
            <table v-if="viewMode === 'size'" class="table table-sm table-bordered mb-0">
              <thead>
                <tr>
                  <th class="fw-semibold small border-top-0">Size (U)</th>
                  <th class="fw-semibold small border-top-0">Count</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in keysBySize" :key="entry.size">
                  <td class="small align-middle">{{ entry.size }}</td>
                  <td class="small align-middle">{{ entry.count }}</td>
                </tr>
                <tr class="table-active border-top">
                  <td class="small align-middle"><strong>Total Keys</strong></td>
                  <td class="small align-middle">
                    <strong>{{ totalKeys }}</strong>
                  </td>
                </tr>
                <tr v-if="totalDecalKeys > 0" class="table-active border-top">
                  <td class="small align-middle"><strong>Regular Keys</strong></td>
                  <td class="small align-middle">
                    <strong>{{ totalKeysWithoutDecals }}</strong>
                  </td>
                </tr>
                <tr v-if="totalDecalKeys > 0" class="table-active border-top">
                  <td class="small align-middle"><strong>Decal Keys</strong></td>
                  <td class="small align-middle">
                    <strong>{{ totalDecalKeys }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>

            <!-- Keys by Size and Color Table -->
            <table v-else-if="viewMode === 'size-color'" class="table table-sm table-bordered mb-0">
              <thead>
                <tr>
                  <th class="fw-semibold small border-top-0">Size (U)</th>
                  <th class="fw-semibold small border-top-0">Color</th>
                  <th class="fw-semibold small border-top-0">Count</th>
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
                  <td class="small align-middle">{{ entry.count }}</td>
                </tr>
                <tr class="table-active border-top">
                  <td class="small align-middle"><strong>Total Keys</strong></td>
                  <td class="small align-middle"></td>
                  <td class="small align-middle">
                    <strong>{{ totalKeys }}</strong>
                  </td>
                </tr>
                <tr v-if="totalDecalKeys > 0" class="table-active border-top">
                  <td class="small align-middle"><strong>Regular Keys</strong></td>
                  <td class="small align-middle"></td>
                  <td class="small align-middle">
                    <strong>{{ totalKeysWithoutDecals }}</strong>
                  </td>
                </tr>
                <tr v-if="totalDecalKeys > 0" class="table-active border-top">
                  <td class="small align-middle"><strong>Decal Keys</strong></td>
                  <td class="small align-middle"></td>
                  <td class="small align-middle">
                    <strong>{{ totalDecalKeys }}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Column 2: Key Center Positions -->
      <div class="col-lg-3 col-md-6">
        <div class="property-group">
          <div class="d-flex justify-content-between align-items-center mb-0">
            <h6 class="property-group-title mb-2">Key Center Positions</h6>
            <!-- Toggle for unit mode -->
            <div
              style="margin-top: -8px"
              class="btn-group"
              role="group"
              aria-label="Key centers unit mode"
            >
              <input
                type="radio"
                class="btn-check"
                id="centers-units-u"
                value="U"
                v-model="keyCenterUnits"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-xs" for="centers-units-u">U</label>

              <input
                type="radio"
                class="btn-check"
                id="centers-units-mm"
                value="mm"
                v-model="keyCenterUnits"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-xs" for="centers-units-mm">mm</label>
            </div>
          </div>
          <KeyCentersTable :units="keyCenterUnits" :spacing="spacingInfo" />
        </div>
      </div>

      <!-- Column 3: Keyboard Dimensions + Export -->
      <div class="col-lg-3 col-md-6 d-flex flex-column">
        <div class="property-group">
          <div class="d-flex justify-content-between align-items-center mb-0">
            <h6 class="property-group-title mb-2">Keyboard Dimensions</h6>
            <!-- Toggle for unit mode -->
            <div
              style="margin-top: -8px"
              class="btn-group"
              role="group"
              aria-label="Dimensions unit mode"
            >
              <input
                type="radio"
                class="btn-check"
                id="dimensions-units-u"
                value="U"
                v-model="dimensionUnits"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-xs" for="dimensions-units-u">U</label>

              <input
                type="radio"
                class="btn-check"
                id="dimensions-units-mm"
                value="mm"
                v-model="dimensionUnits"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-xs" for="dimensions-units-mm">mm</label>
            </div>
          </div>
          <div v-if="keyboardDimensions" class="table-responsive">
            <!-- Show dimensions if available -->
            <table class="table table-sm table-bordered mb-0">
              <thead>
                <tr>
                  <th class="fw-semibold small border-top-0">Width ({{ dimensionUnits }})</th>
                  <th class="fw-semibold small border-top-0">Height ({{ dimensionUnits }})</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td class="small align-middle">
                    {{
                      dimensionUnits === 'U'
                        ? keyboardDimensions.widthFormatted
                        : keyboardDimensions.widthMmFormatted
                    }}
                  </td>
                  <td class="small align-middle">
                    {{
                      dimensionUnits === 'U'
                        ? keyboardDimensions.heightFormatted
                        : keyboardDimensions.heightMmFormatted
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Show empty state if no physical keys -->
          <div v-else class="text-muted text-center py-3">
            <BiGrid3x3 />
            <p class="mb-0 small">No keys</p>
          </div>
        </div>

        <!-- Export Summary -->
        <div class="property-group mt-3">
          <div class="d-flex justify-content-between align-items-center mb-0">
            <h6 class="property-group-title mb-2">Export</h6>
            <div
              style="margin-top: -8px"
              class="btn-group"
              role="group"
              aria-label="Export unit mode"
            >
              <input
                type="radio"
                class="btn-check"
                id="export-units-u"
                value="U"
                v-model="exportUnits"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-xs" for="export-units-u">U</label>

              <input
                type="radio"
                class="btn-check"
                id="export-units-mm"
                value="mm"
                v-model="exportUnits"
                autocomplete="off"
              />
              <label class="btn btn-outline-primary btn-xs" for="export-units-mm">mm</label>
            </div>
          </div>
          <div class="d-flex gap-3 mb-2">
            <div class="form-check form-check-inline mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                id="export-include-ghost"
                v-model="exportIncludeGhost"
              />
              <label class="form-check-label small" for="export-include-ghost">Include Ghost</label>
            </div>
            <div class="form-check form-check-inline mb-0">
              <input
                class="form-check-input"
                type="checkbox"
                id="export-include-decal"
                v-model="exportIncludeDecal"
              />
              <label class="form-check-label small" for="export-include-decal">Include Decal</label>
            </div>
          </div>
          <button
            class="btn btn-sm btn-outline-primary w-100"
            :disabled="totalKeys === 0"
            @click="downloadCsv"
          >
            <BiDownload class="me-1" />
            Download CSV
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKeyboardStore, Key } from '@/stores/keyboard'
import { calculateKeyboardDimensions } from '@/utils/keyboard-dimensions'
import { isIsoEnter, isBigAssEnter, isNonRectangular } from '@/utils/key-utils'
import KeyCentersTable from './KeyCentersTable.vue'
import BiGrid3x3 from 'bootstrap-icons/icons/grid-3x3.svg'
import BiDownload from 'bootstrap-icons/icons/download.svg'
import { getKeyCenter, getKeyCenterMm } from '@/utils/keyboard-geometry'
import { saveBlob } from '@/utils/download'

const keyboardStore = useKeyboardStore()

// View mode toggle
const viewMode = ref<'size' | 'size-color'>('size')

// Unit toggles for key centers and dimensions (default to 'U')
const keyCenterUnits = ref<'U' | 'mm'>('U')
const dimensionUnits = ref<'U' | 'mm'>('U')
const exportUnits = ref<'U' | 'mm'>('U')
const exportIncludeGhost = ref(false)
const exportIncludeDecal = ref(false)

// Get spacing information from metadata (default to 19.05x19.05 if missing)
const spacingInfo = computed(() => {
  return {
    x: keyboardStore.metadata.spacing_x || 19.05,
    y: keyboardStore.metadata.spacing_y || 19.05,
  }
})

// Calculate keyboard dimensions
const keyboardDimensions = computed(() => {
  return calculateKeyboardDimensions(keyboardStore.keys, spacingInfo.value)
})

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

  const isStepped = key.stepped === true
  let sizeString = ''

  if (isIsoEnter(key)) {
    sizeString = 'ISO Enter'
  } else if (isBigAssEnter(key)) {
    sizeString = 'Big-Ass Enter'
  } else {
    sizeString = `${width} × ${height}`

    if (isNonRectangular(key)) {
      const secondarySize = `${width2 || width} × ${height2 || height}`
      sizeString += `+${secondarySize}`
    }
  }

  if (isStepped) {
    sizeString += ' (stepped)'
  }

  return sizeString
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

// Format a number: up to 6 decimal places, strip trailing zeros
const formatNum = (n: number): string => n.toFixed(6).replace(/\.?0+$/, '')

const downloadCsv = () => {
  const keys = keyboardStore.keys.filter((key) => {
    if (key.ghost && !exportIncludeGhost.value) return false
    if (key.decal && !exportIncludeDecal.value) return false
    return true
  })
  if (keys.length === 0) return

  const useMm = exportUnits.value === 'mm'
  const unitLabel = useMm ? 'mm' : 'U'
  const header = `#,Center X (${unitLabel}),Center Y (${unitLabel}),Width (U),Height (U),Rotation (deg)\n`

  let csv = header
  keys.forEach((key, i) => {
    let cx: number, cy: number
    if (useMm) {
      const center = getKeyCenterMm(key, spacingInfo.value.x, spacingInfo.value.y)
      cx = center.x
      cy = center.y
    } else {
      const center = getKeyCenter(key)
      cx = center.x
      cy = center.y
    }
    csv += `${i},${formatNum(cx)},${formatNum(cy)},${formatNum(key.width || 1)},${formatNum(key.height || 1)},${formatNum(key.rotation_angle || 0)}\n`
  })

  const blob = new Blob([csv], { type: 'text/csv' })
  saveBlob(
    blob,
    `${keyboardStore.filename || keyboardStore.metadata.name || 'keyboard-layout'}-summary.csv`,
  )
}
</script>

<style scoped>
/* Override Bootstrap's responsive column behavior - use flexbox for responsive wrapping */
.summary-panel .col-lg-3.col-md-6 {
  flex: 1 1 340px;
  max-width: 500px;
}

/* On very small screens, allow property groups to be full width and remove padding */
@media (max-width: 575.98px) {
  .summary-panel .col-lg-3.col-md-6 {
    padding-left: 0px;
    padding-right: 0px;
  }
}

@media (max-width: 767.98px) {
  .summary-panel .col-lg-3.col-md-6 {
    max-width: 100%;
  }
}

.property-group {
  background: var(--bs-tertiary-bg);
  border: 1px solid var(--bs-border-color);
  border-radius: 6px;
  padding: 12px;
  height: 100%;
}

/* When stacking multiple property-groups in a flex column, don't force height */
.d-flex.flex-column > .property-group {
  height: auto;
}

.property-group-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--bs-body-color);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
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

.table-responsive {
  max-height: 400px;
  border-radius: 0.375rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

/* Table header styling with dark mode support */
.table thead th {
  background-color: var(--bs-secondary-bg);
  color: var(--bs-body-color);
  border-bottom: 1px solid var(--bs-border-color);
}

/* Extra small button size */
.btn-xs {
  --bs-btn-padding-y: 0.15rem;
  --bs-btn-padding-x: 0.4rem;
  --bs-btn-font-size: 0.7rem;
  --bs-btn-border-radius: 0.25rem;
  line-height: 1.2;
}

/* Responsive adjustments */
@media (max-width: 575.98px) {
  .property-group {
    padding: 8px;
  }

  .color-code {
    font-size: 0.7rem;
  }
}
</style>
