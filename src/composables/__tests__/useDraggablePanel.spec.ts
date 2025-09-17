import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDraggablePanel } from '../useDraggablePanel'

// Mock window dimensions
Object.defineProperty(window, 'innerWidth', {
  writable: true,
  configurable: true,
  value: 1200,
})

Object.defineProperty(window, 'innerHeight', {
  writable: true,
  configurable: true,
  value: 800,
})

describe('useDraggablePanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset window dimensions
    window.innerWidth = 1200
    window.innerHeight = 800
  })

  it('initializes with default position', () => {
    const { position } = useDraggablePanel()
    expect(position.value).toEqual({ x: 100, y: 100 })
  })

  it('accepts custom default position', () => {
    const customPosition = { x: 200, y: 150 }
    const { position } = useDraggablePanel({
      defaultPosition: customPosition,
    })
    expect(position.value).toEqual(customPosition)
  })

  it('provides required dragging properties', () => {
    const draggable = useDraggablePanel()

    expect(draggable.position).toBeDefined()
    expect(draggable.isDragging).toBeDefined()
    expect(draggable.panelRef).toBeDefined()
    expect(draggable.handleMouseDown).toBeDefined()
    expect(draggable.handleHeaderMouseDown).toBeDefined()
    expect(draggable.initializePosition).toBeDefined()
  })

  it('detects when header is accessible', () => {
    const { isPositionAccessible } = useDraggablePanel({ margin: 10, headerHeight: 40 })

    // Header completely inaccessible - too far in any direction
    expect(isPositionAccessible({ x: 1300, y: 100 }, { width: 400, height: 300 })).toBe(false) // Too far right
    expect(isPositionAccessible({ x: -500, y: 100 }, { width: 400, height: 300 })).toBe(false) // Too far left
    expect(isPositionAccessible({ x: 100, y: -100 }, { width: 400, height: 300 })).toBe(false) // Header above viewport
    expect(isPositionAccessible({ x: 100, y: 800 }, { width: 400, height: 300 })).toBe(false) // Header below viewport (y=800 > 800-40 in 800px viewport with 40px header)

    // Header accessible - enough header visible for interaction
    expect(isPositionAccessible({ x: 1000, y: 100 }, { width: 400, height: 300 })).toBe(true) // 100px of header visible from right
    expect(isPositionAccessible({ x: 100, y: 700 }, { width: 400, height: 300 })).toBe(true) // Panel mostly below, but header accessible
    expect(isPositionAccessible({ x: 100, y: 760 }, { width: 400, height: 300 })).toBe(true) // Right at the bottom edge (800-40=760)
    expect(isPositionAccessible({ x: 100, y: -3 }, { width: 400, height: 300 })).toBe(true) // Slight overlap up, header still accessible

    // Position fully within viewport
    expect(isPositionAccessible({ x: 100, y: 100 }, { width: 400, height: 300 })).toBe(true)
  })

  it('only constrains position when header becomes inaccessible', () => {
    const { ensureInViewport } = useDraggablePanel({ margin: 10, headerHeight: 40 })

    // Position with accessible header should remain unchanged
    const accessiblePos = { x: 100, y: 100 }
    const unchangedPos = ensureInViewport(accessiblePos, { width: 400, height: 300 })
    expect(unchangedPos).toEqual(accessiblePos)

    // Position with inaccessible header should be constrained
    const inaccessiblePos = { x: 1300, y: 100 }
    const constrainedPos = ensureInViewport(inaccessiblePos, { width: 400, height: 300 })
    expect(constrainedPos.x).toBeLessThan(1300)

    // Position moved too far up (header above viewport) should be constrained
    const tooHighPos = { x: 100, y: -100 }
    const constrainedHighPos = ensureInViewport(tooHighPos, { width: 400, height: 300 })
    expect(constrainedHighPos.y).toBeGreaterThanOrEqual(-10) // Should be brought down
  })

  it('handles elements larger than viewport', () => {
    const { ensureInViewport } = useDraggablePanel({ margin: 10, headerHeight: 40 })

    // Element width larger than viewport - position has accessible header so should remain unchanged
    const accessibleLarge = ensureInViewport({ x: 100, y: 100 }, { width: 1300, height: 200 })
    expect(accessibleLarge.x).toBe(100) // Should remain unchanged as header is accessible

    // Element completely outside viewport should be repositioned
    const inaccessibleLarge = ensureInViewport({ x: 1300, y: 100 }, { width: 1300, height: 200 })
    expect(inaccessibleLarge.x).toBeLessThan(1300) // Should be repositioned to make header accessible
  })

  it('initializes position with viewport checking', () => {
    const { initializePosition, position } = useDraggablePanel()

    // Initialize with position outside viewport
    initializePosition({ x: 1500, y: 100 })

    // Should be constrained within viewport
    expect(position.value.x).toBeLessThan(1500)
  })

  it('provides utility methods', () => {
    const { getViewport, resetPosition, setPosition } = useDraggablePanel()

    expect(getViewport).toBeDefined()
    expect(resetPosition).toBeDefined()
    expect(setPosition).toBeDefined()

    const viewport = getViewport()
    expect(viewport.width).toBe(1200)
    expect(viewport.height).toBe(800)
  })

  it('resets position towards default', () => {
    const defaultPos = { x: 50, y: 50 }
    const { position, resetPosition } = useDraggablePanel({
      defaultPosition: defaultPos,
    })

    // Change position
    position.value = { x: 500, y: 400 }

    // Reset should move position towards default (may be viewport-constrained)
    resetPosition()

    // Position should change from the moved position
    expect(position.value.x).not.toBe(500)
    expect(position.value.y).not.toBe(400)

    // Position should be within reasonable bounds
    expect(position.value.x).toBeGreaterThanOrEqual(10)
    expect(position.value.y).toBeGreaterThanOrEqual(10)
  })

  it('sets position with viewport checking by default', () => {
    const { position, setPosition } = useDraggablePanel()

    // Try to set position outside viewport
    setPosition({ x: 1500, y: 100 })

    // Should be constrained
    expect(position.value.x).toBeLessThan(1500)
  })

  it('allows setting position without viewport checking when specified', () => {
    const { position, setPosition } = useDraggablePanel()

    // Set position outside viewport without checking
    setPosition({ x: 1500, y: 100 }, true) // skipViewportCheck = true

    // Should not be constrained
    expect(position.value.x).toBe(1500)
  })
})
