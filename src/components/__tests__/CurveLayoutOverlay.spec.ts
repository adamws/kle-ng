import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import CurveLayoutOverlay from '../CurveLayoutOverlay.vue'
import { useCurveLayoutStore } from '@/stores/curveLayout'

/** One layout unit in pixels, and a 1:1 zoom, so screen pixels map to units by division. */
const UNIT = 54

const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve))

/**
 * Pointer events carry their coordinates on read-only properties, so they have to be built by
 * the constructor rather than assigned after the fact the way `trigger` does it.
 */
const pointerEvent = (type: string, clientX = 0, clientY = 0) =>
  new MouseEvent(type, { clientX, clientY, bubbles: true, cancelable: true })

/** Move the pointer the way a real drag does: on the window, not on the handle. */
const movePointer = async (clientX: number, clientY: number) => {
  window.dispatchEvent(pointerEvent('pointermove', clientX, clientY))
  await nextFrame()
}

describe('CurveLayoutOverlay', () => {
  let wrapper: VueWrapper
  let curve: ReturnType<typeof useCurveLayoutStore>

  const handle = (index: number) => wrapper.get(`[data-testid="curve-layout-handle-${index}"]`)

  /** Press a handle at a screen position, which may be off its centre. */
  const press = async (index: number, clientX: number, clientY: number) => {
    handle(index).element.dispatchEvent(pointerEvent('pointerdown', clientX, clientY))
    await wrapper.vm.$nextTick()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    curve = useCurveLayoutStore()
    curve.setSpine([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ])

    wrapper = mount(CurveLayoutOverlay, {
      props: {
        visible: true,
        canvasWidth: 800,
        canvasHeight: 600,
        zoom: 1,
        unit: UNIT,
        coordinateOffset: { x: 0, y: 0 },
        scrollLeft: 0,
        scrollTop: 0,
      },
      attachTo: document.body,
    })
  })

  afterEach(() => {
    wrapper.unmount()
  })

  it('tracks the canvas as it scrolls', () => {
    // The overlay is positioned against the canvas *wrapper*, which does not scroll, so it has
    // to be shifted by hand or the spine drifts away from the keys it is bending.
    const container = wrapper.get('.curve-layout-overlay-container')
    expect(container.attributes('style')).toContain('translate(0px, 0px)')

    return wrapper.setProps({ scrollLeft: 40, scrollTop: 25 }).then(() => {
      expect(container.attributes('style')).toContain('translate(-40px, -25px)')
    })
  })

  describe('dragging a handle', () => {
    it('does not move the spine on press alone', async () => {
      const before = curve.spine.map((point) => ({ ...point }))

      // Pressed 5px right of the handle centre — inside the target, but not on its centre.
      await press(3, 3 * UNIT + 5, 4)
      await nextFrame()

      expect(curve.spine.map((point) => ({ ...point }))).toEqual(before)
      expect(curve.isDraggingHandle).toBe(true)
    })

    it('moves the handle by the pointer delta, not to the pointer', async () => {
      await press(3, 3 * UNIT + 5, 4)
      await movePointer(200, 0)

      // The grab offset is carried through: the handle keeps the 5px/4px the user grabbed it by.
      expect(curve.spine[3].x).toBeCloseTo((200 - 5) / UNIT, 6)
      expect(curve.spine[3].y).toBeCloseTo((0 - 4) / UNIT, 6)
    })

    it('keeps the final position when the pointer is released between frames', async () => {
      await press(1, 1 * UNIT, 0)
      window.dispatchEvent(pointerEvent('pointermove', 90, -60))
      window.dispatchEvent(pointerEvent('pointerup'))

      expect(curve.spine[1].x).toBeCloseTo(90 / UNIT, 6)
      expect(curve.spine[1].y).toBeCloseTo(-60 / UNIT, 6)
      expect(curve.isDraggingHandle).toBe(false)
    })

    it('ends the drag when the tool closes mid-drag', async () => {
      await press(2, 2 * UNIT, 0)
      expect(curve.isDraggingHandle).toBe(true)

      await wrapper.setProps({ visible: false })

      // The canvas suppresses every resize while this is set, so a stuck flag freezes it for
      // the rest of the session.
      expect(curve.isDraggingHandle).toBe(false)
      const dragStates = wrapper.emitted('dragStateChange') ?? []
      expect(dragStates[dragStates.length - 1]).toEqual([false])
    })

    it('stops listening once the drag ends', async () => {
      await press(0, 0, 0)
      window.dispatchEvent(pointerEvent('pointerup'))
      const settled = curve.spine.map((point) => ({ ...point }))

      await movePointer(400, 400)

      expect(curve.spine.map((point) => ({ ...point }))).toEqual(settled)
    })
  })
})
