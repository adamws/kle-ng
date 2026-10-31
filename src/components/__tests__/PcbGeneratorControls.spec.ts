import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PcbGeneratorControls from '../PcbGeneratorControls.vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'
import { useKeyboardStore, Key } from '@/stores/keyboard'

const makeKey = (x: number, label: string) => {
  const key = new Key()
  key.x = x
  key.labels[0] = label
  return key
}

describe('PcbGeneratorControls', () => {
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    localStorage.clear()
    pinia = createPinia()
    setActivePinia(pinia)
  })

  const mountWithKeys = async (labels: string[], annotateAutomatically?: boolean) => {
    useKeyboardStore().keys = labels.map((label, i) => makeKey(i, label))
    if (annotateAutomatically !== undefined) {
      usePcbGeneratorStore().annotateAutomatically = annotateAutomatically
    }
    const wrapper = mount(PcbGeneratorControls, { global: { plugins: [pinia] } })
    await wrapper.vm.$nextTick()
    return wrapper
  }

  const button = (wrapper: Awaited<ReturnType<typeof mountWithKeys>>) =>
    wrapper.get('button.btn-primary')

  it('checks Annotate automatically by default', async () => {
    const wrapper = await mountWithKeys(['Q', 'W'])
    const checkbox = wrapper.get('[data-testid="pcb-annotate-automatically"]')
    expect((checkbox.element as HTMLInputElement).checked).toBe(true)
  })

  it('puts the checkbox next to the Generate button with the explanation on hover', async () => {
    const wrapper = await mountWithKeys(['Q', 'W'])
    expect(button(wrapper).text()).toBe('Generate')
    const check = wrapper.get('[data-testid="pcb-annotate-automatically"]').element.parentElement!
    expect(check.parentElement).toBe(button(wrapper).element.parentElement)
    expect(check.getAttribute('title')).toContain('Your layout is not changed')
    expect(wrapper.find('[data-testid="pcb-annotation-required"]').exists()).toBe(false)
    expect(button(wrapper).attributes('title')).not.toContain('VIA annotations')
  })

  it('requires annotations when automatic annotation is off', async () => {
    const wrapper = await mountWithKeys(['Q', 'W'], false)
    expect(wrapper.find('[data-testid="pcb-annotation-required"]').exists()).toBe(true)
    expect(button(wrapper).attributes('disabled')).toBeDefined()
    expect(button(wrapper).attributes('title')).toContain('VIA annotations')
  })

  it('shows neither message for an annotated layout', async () => {
    const wrapper = await mountWithKeys(['0,0', '0,1'])
    expect(wrapper.find('[data-testid="pcb-annotation-required"]').exists()).toBe(false)
  })

  it('toggles the store option from the checkbox', async () => {
    const wrapper = await mountWithKeys(['Q'])
    await wrapper.get('[data-testid="pcb-annotate-automatically"]').setValue(false)
    expect(usePcbGeneratorStore().annotateAutomatically).toBe(false)
    expect(wrapper.find('[data-testid="pcb-annotation-required"]').exists()).toBe(true)
  })
})
