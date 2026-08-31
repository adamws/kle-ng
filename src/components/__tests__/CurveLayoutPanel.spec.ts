import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { Key } from '@adamws/kle-serial'
import CurveLayoutPanel from '../CurveLayoutPanel.vue'
import { useCurveLayoutStore } from '@/stores/curveLayout'
import { useKeyboardStore } from '@/stores/keyboard'

const geometryOf = (key: Key) => ({
  x: key.x,
  y: key.y,
  rotation_x: key.rotation_x,
  rotation_y: key.rotation_y,
  rotation_angle: key.rotation_angle,
})

const row = (count: number): Key[] =>
  Array.from({ length: count }, (_, index) => Object.assign(new Key(), { x: index, y: 0 }))

/**
 * Dispatch a keydown the way the browser does — on an element, bubbling up to the document
 * listener the panel installs — so `event.target` is the focused control rather than `document`.
 */
const pressKey = async (target: Element, key: string) => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  await Promise.resolve()
}

describe('CurveLayoutPanel', () => {
  let wrapper: VueWrapper
  let curve: ReturnType<typeof useCurveLayoutStore>
  let keyboard: ReturnType<typeof useKeyboardStore>

  const bendField = () => wrapper.get('[data-testid="curve-layout-bend-value"] input')
  const bendSlider = () => wrapper.get('[data-testid="curve-layout-bend"]')
  const gapField = () => wrapper.get('[data-testid="curve-layout-gap"] input')

  beforeEach(async () => {
    setActivePinia(createPinia())
    keyboard = useKeyboardStore()
    keyboard.keys = row(6)
    curve = useCurveLayoutStore()
    curve.begin()

    wrapper = mount(CurveLayoutPanel, {
      props: { visible: false },
      attachTo: document.body,
    })
    await wrapper.setProps({ visible: true })
  })

  afterEach(() => {
    wrapper.unmount()
  })

  describe('bend value field', () => {
    it('bends the layout to a typed curvature', async () => {
      const before = keyboard.keys.map(geometryOf)

      await bendField().setValue('40')

      expect(keyboard.keys.map(geometryOf)).not.toEqual(before)
      // The spine's inner handles left the chord, which is what "bend" means.
      expect(curve.spine[1].y).not.toBeCloseTo(curve.spine[0].y, 6)
    })

    it('accepts a precision the slider cannot express', async () => {
      await bendField().setValue('12.5')
      const fine = curve.spine.map((point) => ({ ...point }))

      await bendField().setValue('13')
      expect(curve.spine[1].y).not.toBeCloseTo(fine[1]!.y, 6)
    })

    it('reads back what the slider set, and the slider what it set', async () => {
      await bendSlider().setValue('25')
      await bendSlider().trigger('input')
      expect((bendField().element as HTMLInputElement).value).toBe('25')

      await bendField().setValue('-60')
      expect((bendSlider().element as HTMLInputElement).value).toBe('-60')
    })

    it('clearing the field straightens the spine instead of leaving a stale curve', async () => {
      const straight = curve.spine.map((point) => ({ ...point }))
      await bendField().setValue('40')
      expect(curve.spine[1].y).not.toBeCloseTo(straight[1]!.y, 6)

      await bendField().setValue('')

      expect(curve.spine[1].y).toBeCloseTo(straight[1]!.y, 6)
    })

    it('is re-derived from the handles after a direct handle drag', async () => {
      // The overlay drags the spine and toggles this flag; the field has to follow, or the two
      // controls disagree about the same curve.
      curve.isDraggingHandle = true
      await wrapper.vm.$nextTick()
      curve.setSpine([
        { x: 0, y: 0 },
        { x: 1, y: -0.5 },
        { x: 2, y: -0.5 },
        { x: 3, y: 0 },
      ])
      curve.isDraggingHandle = false
      await wrapper.vm.$nextTick()

      expect(Number((bendField().element as HTMLInputElement).value)).not.toBe(0)
    })

    it('Reset returns the field to zero along with the spine', async () => {
      await bendField().setValue('40')
      await wrapper.get('[data-testid="curve-layout-reset"]').trigger('click')

      expect((bendField().element as HTMLInputElement).value).toBe('0')
    })
  })

  describe('keyboard shortcuts', () => {
    it('Escape inside a number field dismisses the field, not the edit', async () => {
      await bendField().setValue('40')
      const bent = keyboard.keys.map(geometryOf)

      await pressKey(gapField().element, 'Escape')

      expect(curve.isActive).toBe(true)
      expect(wrapper.emitted('close')).toBeUndefined()
      expect(keyboard.keys.map(geometryOf)).toEqual(bent)
    })

    it('Enter inside a number field commits the number, not the tool', async () => {
      await pressKey(gapField().element, 'Enter')

      expect(curve.isActive).toBe(true)
      expect(wrapper.emitted('close')).toBeUndefined()
    })

    it('Escape outside a text field cancels', async () => {
      const before = keyboard.keys.map(geometryOf)
      await bendField().setValue('40')

      await pressKey(document.body, 'Escape')

      expect(curve.isActive).toBe(false)
      expect(wrapper.emitted('close')).toHaveLength(1)
      expect(keyboard.keys.map(geometryOf)).toEqual(before)
    })

    it('Escape on the slider cancels, since a range does nothing with it', async () => {
      await pressKey(bendSlider().element, 'Escape')

      expect(curve.isActive).toBe(false)
      expect(wrapper.emitted('close')).toHaveLength(1)
    })

    it('Enter outside a text field applies', async () => {
      await bendField().setValue('40')
      const bent = keyboard.keys.map(geometryOf)

      await pressKey(document.body, 'Enter')

      expect(curve.isActive).toBe(false)
      expect(wrapper.emitted('close')).toHaveLength(1)
      // Apply keeps the previewed geometry rather than restoring anything.
      expect(keyboard.keys.map(geometryOf)).toEqual(bent)
    })

    it('ignores keys once the panel is hidden', async () => {
      await wrapper.setProps({ visible: false })

      await pressKey(document.body, 'Escape')

      expect(wrapper.emitted('close')).toBeUndefined()
    })
  })
})
