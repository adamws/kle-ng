import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import LZString from 'lz-string'
import LayoutOptionToolbar from '../LayoutOptionToolbar.vue'
import { useKeyboardStore } from '@/stores/keyboard'
import { Key } from '@adamws/kle-serial'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeKey(matrixLabel: string, optionChoice: string, x = 0, y = 0): Key {
  const key = new Key()
  key.labels[0] = matrixLabel
  key.labels[8] = optionChoice
  key.x = x
  key.y = y
  return key
}

/** One option group (option 0) with choices 0 and 1. */
function makeAltLayoutKeys(): Key[] {
  const base = makeKey('0,0', '', 0, 0)
  const choice0 = makeKey('0,1', '0,0', 14, 0)
  choice0.width = 2
  const choice1Left = makeKey('0,1', '0,1', 13, 0)
  const choice1Right = makeKey('0,2', '0,1', 14, 0)
  return [base, choice0, choice1Left, choice1Right]
}

/** Two option groups: option 0 (choices 0,1) and option 1 (choices 0,1). */
function makeTwoGroupKeys(): Key[] {
  return [...makeAltLayoutKeys(), makeKey('1,0', '1,0', 0, 2), makeKey('1,1', '1,1', 1, 2)]
}

function compressViaLabels(labels: unknown[]): string {
  return LZString.compressToBase64(JSON.stringify({ layouts: { labels } }))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('LayoutOptionToolbar', () => {
  let store: ReturnType<typeof useKeyboardStore>
  let pinia: ReturnType<typeof createPinia>

  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
    store = useKeyboardStore()
    vi.clearAllMocks()
  })

  const mountToolbar = () => mount(LayoutOptionToolbar, { global: { plugins: [pinia] } })

  it('renders nothing when no alt-layout keys exist', () => {
    store.keys.push(makeKey('0,0', ''))
    const wrapper = mountToolbar()
    expect(wrapper.find('.layout-option-toolbar').exists()).toBe(false)
  })

  it('renders All button and all choices including 0', async () => {
    store.keys.push(...makeAltLayoutKeys())
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAll('button')
    // "All" + choice-0 + choice-1 = 3 buttons
    expect(buttons.length).toBe(3)
    expect(buttons[0]!.text()).toContain('all')
  })

  it('renders one option-group div per option', async () => {
    store.keys.push(...makeTwoGroupKeys())
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    expect(wrapper.findAll('.option-group').length).toBe(2)
  })

  it('"All" button is active when displayLayoutChoices is null', async () => {
    store.keys.push(...makeAltLayoutKeys())
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    expect(store.displayLayoutChoices).toBeNull()
    expect(wrapper.findAll('button')[0]!.classes()).toContain('active')
  })

  it('"All" button calls setDisplayLayoutChoices(null)', async () => {
    store.keys.push(...makeAltLayoutKeys())
    store.setDisplayLayoutChoices(new Map([[0, 1]]))
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    await wrapper.findAll('button')[0]!.trigger('click')
    expect(store.displayLayoutChoices).toBeNull()
  })

  it('clicking a choice enters preview mode with all groups initialised to 0', async () => {
    store.keys.push(...makeTwoGroupKeys())
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    // Buttons: [all] [0/0] [0/1] [1/0] [1/1]
    const choiceBtn = wrapper.findAll('button')[2]! // 0/1
    await choiceBtn.trigger('click')

    const choices = store.displayLayoutChoices
    expect(choices).not.toBeNull()
    expect(choices!.get(0)).toBe(1)
    expect(choices!.get(1)).toBe(0) // defaulted to 0
  })

  it('clicking a choice when already in preview only updates that option', async () => {
    store.keys.push(...makeTwoGroupKeys())
    store.setDisplayLayoutChoices(
      new Map([
        [0, 0],
        [1, 0],
      ]),
    )
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    // Buttons: [all] [0/0] [0/1] [1/0] [1/1] — click [1/1]
    const choiceBtn = wrapper.findAll('button')[4]!
    await choiceBtn.trigger('click')

    expect(store.displayLayoutChoices!.get(0)).toBe(0) // unchanged
    expect(store.displayLayoutChoices!.get(1)).toBe(1) // updated
  })

  it('active class on choice button matches current displayLayoutChoices', async () => {
    store.keys.push(...makeAltLayoutKeys())
    store.setDisplayLayoutChoices(new Map([[0, 1]]))
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    const buttons = wrapper.findAll('button')
    // [all] [0/0] [0/1]
    expect(buttons[0]!.classes()).not.toContain('active') // All
    expect(buttons[1]!.classes()).not.toContain('active') // 0/0
    expect(buttons[2]!.classes()).toContain('active') // 0/1
  })

  it('choice buttons show fraction tooltip using VIA labels when available', async () => {
    store.keys.push(...makeAltLayoutKeys())
    const compressed = compressViaLabels([['Backspace', 'Full', 'Split']])
    ;(store.metadata as Record<string, unknown>)._kleng_via_data = compressed
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    // buttons: [all] [0/0] [0/1]
    const choice0Btn = wrapper.findAll('button')[1]!
    const choice1Btn = wrapper.findAll('button')[2]!
    expect(choice0Btn.attributes('title')).toBe('Full')
    expect(choice1Btn.attributes('title')).toBe('Split')
  })

  it('choice tooltip falls back to "Option N · Choice M" when no VIA labels', async () => {
    store.keys.push(...makeAltLayoutKeys())
    const wrapper = mountToolbar()
    await wrapper.vm.$nextTick()

    const choice1Btn = wrapper.findAll('button')[2]! // 0/1
    expect(choice1Btn.attributes('title')).toBe('Option 0 · Choice 1')
  })
})
