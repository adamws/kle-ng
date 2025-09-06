<template>
  <div v-if="visible" class="rotation-point-selector">
    <!-- Simple rotation points overlay -->
    <div
      v-for="point in rotationPoints"
      :key="point.id"
      class="rotation-point"
      :class="{
        'point-corner': point.type === 'corner',
        'point-center': point.type === 'center',
        'point-hovered': hoveredPointId === point.id,
      }"
      :style="{
        left: `${point.screenX}px`,
        top: `${point.screenY}px`,
      }"
      @click="handlePointClick(point)"
      @mouseenter="hoveredPointId = point.id"
      @mouseleave="hoveredPointId = null"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useKeyboardStore } from '@/stores/keyboard'
import type { RotationPoint } from '@/utils/rotation-points'

// Props
interface Props {
  visible?: boolean
  canvasElement?: HTMLCanvasElement | null
  zoom?: number
  panX?: number
  panY?: number
  unit?: number
  coordinateOffset?: { x: number; y: number }
}

const props = withDefaults(defineProps<Props>(), {
  visible: false,
  canvasElement: null,
  zoom: 1,
  panX: 0,
  panY: 0,
  unit: 54,
  coordinateOffset: () => ({ x: 0, y: 0 }),
})

// Emits
interface Emits {
  (e: 'pointSelected', point: RotationPoint): void
}

const emit = defineEmits<Emits>()

// Store
const keyboardStore = useKeyboardStore()

// Local state
const hoveredPointId = ref<string | null>(null)

// Screen coordinate calculation
const keyToScreenCoords = (keyX: number, keyY: number) => {
  if (!props.canvasElement) return { x: 0, y: 0 }

  const rect = props.canvasElement.getBoundingClientRect()
  const coordinateOffset = props.coordinateOffset || { x: 0, y: 0 }

  // Canvas renders keys at (keyX * unit, keyY * unit) in canvas coordinates
  // Canvas transform: setTransform(zoom, 0, 0, zoom, panX + coordinateOffset.x * zoom, panY + coordinateOffset.y * zoom)
  // So final screen position is:
  const canvasX = keyX * props.unit
  const canvasY = keyY * props.unit

  const screenX = canvasX * props.zoom + props.panX + coordinateOffset.x * props.zoom + rect.left
  const screenY = canvasY * props.zoom + props.panY + coordinateOffset.y * props.zoom + rect.top

  return { x: screenX, y: screenY }
}

// Computed properties - generate simple corner and center points
const rotationPoints = computed(() => {
  if (!props.visible || keyboardStore.selectedKeys.length === 0) {
    return []
  }

  const points: Array<RotationPoint & { screenX: number; screenY: number }> = []

  keyboardStore.selectedKeys.forEach((key, keyIndex) => {
    // Key corners (4 points per key)
    const corners = [
      { x: key.x, y: key.y, corner: 'top-left' },
      { x: key.x + key.width, y: key.y, corner: 'top-right' },
      { x: key.x, y: key.y + key.height, corner: 'bottom-left' },
      { x: key.x + key.width, y: key.y + key.height, corner: 'bottom-right' },
    ]

    corners.forEach((corner, cornerIndex) => {
      const screenCoords = keyToScreenCoords(corner.x, corner.y)
      points.push({
        id: `corner-${keyIndex}-${cornerIndex}`,
        x: corner.x,
        y: corner.y,
        type: 'corner',
        screenX: screenCoords.x,
        screenY: screenCoords.y,
      })
    })

    // Key center (1 point per key)
    const centerX = key.x + key.width / 2
    const centerY = key.y + key.height / 2
    const screenCoords = keyToScreenCoords(centerX, centerY)
    points.push({
      id: `center-${keyIndex}`,
      x: centerX,
      y: centerY,
      type: 'center',
      screenX: screenCoords.x,
      screenY: screenCoords.y,
    })
  })

  return points
})

// Methods
const handlePointClick = (point: RotationPoint) => {
  emit('pointSelected', point)
}
</script>

<style scoped>
.rotation-point-selector {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 1000;
}

.rotation-point {
  position: absolute;
  pointer-events: all;
  cursor: pointer;
  border: 2px solid #007bff;
  background: rgba(255, 255, 255, 0.9);
  transition: all 0.15s ease;
  transform: translate(-50%, -50%); /* Center the point on coordinates */
}

/* Corner points - circles */
.point-corner {
  width: 12px;
  height: 12px;
  border-radius: 50%;
}

/* Center points - squares */
.point-center {
  width: 10px;
  height: 10px;
  border-radius: 2px;
  background: rgba(0, 123, 255, 0.1);
  border-color: #0056b3;
}

/* Hover states */
.point-hovered {
  transform: translate(-50%, -50%) scale(1.3);
  border-width: 3px;
  background: rgba(0, 123, 255, 0.2);
  box-shadow: 0 2px 8px rgba(0, 123, 255, 0.3);
}

.point-corner.point-hovered {
  background: rgba(0, 123, 255, 0.15);
}

.point-center.point-hovered {
  background: rgba(0, 123, 255, 0.25);
}
</style>
