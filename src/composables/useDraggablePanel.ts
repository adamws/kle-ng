import { ref, onMounted, onUnmounted, nextTick } from 'vue'

interface Position {
  x: number
  y: number
}

interface ElementSize {
  width: number
  height: number
}

interface DraggableOptions {
  defaultPosition?: Position
  margin?: number
  smoothRepositioning?: boolean
  headerHeight?: number // Height of the header/title bar that must remain visible
  mobileBreakpoint?: number // Viewport width below which panels become anchored (default: 768)
}

export function useDraggablePanel(options: DraggableOptions = {}) {
  const {
    defaultPosition = { x: 100, y: 100 },
    smoothRepositioning = true,
    headerHeight = 40, // Default header height for title bar
    mobileBreakpoint = 768, // Default mobile breakpoint
  } = options

  // State
  const position = ref<Position>({ ...defaultPosition })
  const isDragging = ref(false)
  const dragOffset = ref<Position>({ x: 0, y: 0 })
  const panelRef = ref<HTMLElement>()
  const isMobile = ref(false)

  // Get current viewport dimensions and check mobile status
  const getViewport = () => {
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    }
    isMobile.value = viewport.width <= mobileBreakpoint
    return viewport
  }

  // Get panel dimensions
  const getPanelSize = (): ElementSize => {
    if (!panelRef.value) {
      // Return reasonable default dimensions when panel ref is not available
      return { width: 400, height: 300 }
    }
    const rect = panelRef.value.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  }

  // Check if position keeps header/title bar accessible
  const isPositionAccessible = (pos: Position, elementSize?: ElementSize): boolean => {
    const viewport = getViewport()
    const size = elementSize || getPanelSize()

    // Header area coordinates
    const headerBottom = pos.y + headerHeight

    // More strict criteria: ensure meaningful header interaction is possible
    const minVisibleHeaderWidth = 100 // Need at least 100px of header visible for interaction
    const headerLeftEdgeVisible = pos.x + minVisibleHeaderWidth > 0
    const headerRightEdgeVisible = pos.x < viewport.width - minVisibleHeaderWidth

    // Header must be accessible for dragging and closing
    return (
      pos.y >= -5 && // Don't allow header to go too far up (stricter)
      pos.y <= viewport.height - headerHeight && // Keep full header above viewport bottom
      headerBottom > 10 && // Header bottom must be reasonably visible
      headerLeftEdgeVisible && // Enough header visible from left side
      headerRightEdgeVisible && // Enough header visible from right side
      size.width > 0 // Ensure we have valid size data
    )
  }

  // Ensure position keeps header accessible (only when needed)
  const ensureInViewport = (pos: Position, elementSize?: ElementSize): Position => {
    const viewport = getViewport()
    const size = elementSize || getPanelSize()

    // If position is already accessible, don't change it
    if (isPositionAccessible(pos, size)) {
      return pos
    }

    // Calculate safe bounds ensuring header stays accessible
    const minVisibleWidth = 100 // Minimum header width that must be visible
    const minX = -size.width + minVisibleWidth // Allow panel to go left, but keep header visible
    const maxX = viewport.width - minVisibleWidth // Keep enough header visible from right
    const minY = -5 // Very small allowance for upward movement
    const maxY = viewport.height - headerHeight // Ensure full header stays above viewport bottom

    const constrainedX = Math.max(minX, Math.min(pos.x, maxX))
    const constrainedY = Math.max(minY, Math.min(pos.y, maxY))

    return { x: constrainedX, y: constrainedY }
  }

  // Smooth repositioning with transition
  const repositionSmoothly = (newPosition: Position) => {
    if (smoothRepositioning && panelRef.value) {
      // Add transition temporarily
      panelRef.value.style.transition = 'transform 0.2s ease-out'
      position.value = newPosition

      // Remove transition after animation completes
      setTimeout(() => {
        if (panelRef.value) {
          panelRef.value.style.transition = ''
        }
      }, 200)
    } else {
      position.value = newPosition
    }
  }

  // Handle window resize to keep panel in view and update mobile status
  const handleWindowResize = () => {
    getViewport() // This updates isMobile.value

    if (!isDragging.value) {
      // On mobile, use fixed positioning instead of dragging logic
      if (isMobile.value) {
        return
      }

      const currentPos = { ...position.value }
      const correctedPos = ensureInViewport(currentPos)

      // Only reposition if the position actually changed
      if (correctedPos.x !== currentPos.x || correctedPos.y !== currentPos.y) {
        repositionSmoothly(correctedPos)
      }
    }
  }

  // Mouse event handlers
  const handleMouseDown = (event: MouseEvent) => {
    // Only handle mousedown on the panel itself (not on interactive elements)
    if (event.target === panelRef.value) {
      event.preventDefault()
    }
  }

  const handleHeaderMouseDown = (event: MouseEvent) => {
    if (!panelRef.value) return

    // Disable dragging on mobile devices
    if (isMobile.value) {
      return
    }

    isDragging.value = true

    const rect = panelRef.value.getBoundingClientRect()
    dragOffset.value = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    }

    document.addEventListener('mousemove', handleDocumentMouseMove)
    document.addEventListener('mouseup', handleDocumentMouseUp)
    event.preventDefault()
  }

  const handleDocumentMouseMove = (event: MouseEvent) => {
    if (isDragging.value) {
      // During drag, allow free movement (no constraints)
      position.value = {
        x: event.clientX - dragOffset.value.x,
        y: event.clientY - dragOffset.value.y,
      }
    }
  }

  const handleDocumentMouseUp = async () => {
    if (isDragging.value) {
      isDragging.value = false

      // After drag ends, ensure panel is within viewport
      await nextTick() // Wait for DOM update
      const currentPos = position.value
      const correctedPosition = ensureInViewport(currentPos)

      // Only animate if position needs correction
      if (correctedPosition.x !== currentPos.x || correctedPosition.y !== currentPos.y) {
        repositionSmoothly(correctedPosition)
      }
    }

    document.removeEventListener('mousemove', handleDocumentMouseMove)
    document.removeEventListener('mouseup', handleDocumentMouseUp)
  }

  // Reset position to default or specify new position
  const resetPosition = (newPosition?: Position) => {
    const targetPosition = newPosition || defaultPosition
    const safePosition = ensureInViewport(targetPosition)
    repositionSmoothly(safePosition)
  }

  // Set position with viewport checking (useful for initial positioning)
  const setPosition = (newPosition: Position, skipViewportCheck = false) => {
    const finalPosition = skipViewportCheck ? newPosition : ensureInViewport(newPosition)
    repositionSmoothly(finalPosition)
  }

  // Initialize position for visible panels
  const initializePosition = (customPosition?: Position) => {
    const initialPos = customPosition || defaultPosition
    const safePos = ensureInViewport(initialPos)
    position.value = safePos
  }

  // Lifecycle management
  onMounted(() => {
    window.addEventListener('resize', handleWindowResize)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', handleWindowResize)
    document.removeEventListener('mousemove', handleDocumentMouseMove)
    document.removeEventListener('mouseup', handleDocumentMouseUp)
  })

  return {
    // State
    position,
    isDragging,
    panelRef,
    isMobile,

    // Methods
    handleMouseDown,
    handleHeaderMouseDown,
    resetPosition,
    setPosition,
    initializePosition,
    ensureInViewport,

    // Utilities
    getViewport,
    getPanelSize,
    isPositionAccessible,
  }
}
