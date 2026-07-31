import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PcbBuildLog from '../PcbBuildLog.vue'
import { usePcbGeneratorStore } from '@/stores/pcbGenerator'

describe('PcbBuildLog', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('renders one line per build log entry, prefixing the source', () => {
    const store = usePcbGeneratorStore()
    store.buildLogs = [
      { source: 'worker', line: 'Generating KiCad PCB files' },
      { source: 'kbplacer', line: 'Routing SW1 with D1' },
    ]

    const wrapper = mount(PcbBuildLog)
    const lines = wrapper.findAll('.build-log-line')

    expect(lines).toHaveLength(2)
    expect(lines[0]!.text()).toContain('[worker]')
    expect(lines[0]!.text()).toContain('Generating KiCad PCB files')
    expect(lines[1]!.text()).toContain('Routing SW1 with D1')
  })

  it('shows a waiting placeholder when there are no logs', () => {
    const wrapper = mount(PcbBuildLog)
    expect(wrapper.find('.build-log-empty').exists()).toBe(true)
  })

  it('shows a live indicator while the stream is active', () => {
    const store = usePcbGeneratorStore()
    store.isLogStreamActive = true
    const wrapper = mount(PcbBuildLog)
    expect(wrapper.find('.build-log-status').exists()).toBe(true)
  })

  it('auto-scrolls to bottom on new lines while at the bottom', async () => {
    const store = usePcbGeneratorStore()
    store.buildLogs = [{ line: 'first' }]

    const wrapper = mount(PcbBuildLog)
    const el = wrapper.find('.build-log-body').element as HTMLElement

    // jsdom has no layout, so fake the scroll geometry.
    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })
    el.scrollTop = 0

    store.buildLogs.push({ line: 'second' })
    await flushPromises()

    // autoScroll defaults true → should have scrolled to the bottom.
    expect(el.scrollTop).toBe(500)
  })

  it('pauses auto-scroll when the user has scrolled up', async () => {
    const store = usePcbGeneratorStore()
    store.buildLogs = [{ line: 'first' }]

    const wrapper = mount(PcbBuildLog)
    const body = wrapper.find('.build-log-body')
    const el = body.element as HTMLElement

    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })

    // User scrolls up, away from the bottom.
    el.scrollTop = 0
    await body.trigger('scroll')

    // A jump-to-bottom affordance should appear.
    expect(wrapper.find('.jump-to-bottom').exists()).toBe(true)

    // New line arrives, but scroll position must not be forced to the bottom.
    store.buildLogs.push({ line: 'second' })
    await flushPromises()
    expect(el.scrollTop).toBe(0)
  })

  it('shows the number of new lines on the jump button while scrolled up', async () => {
    const store = usePcbGeneratorStore()
    store.buildLogs = [{ line: 'first' }]

    const wrapper = mount(PcbBuildLog)
    const body = wrapper.find('.build-log-body')
    const el = body.element as HTMLElement

    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })

    // User scrolls up → auto-follow pauses.
    el.scrollTop = 0
    await body.trigger('scroll')

    // Two lines arrive while paused.
    store.buildLogs.push({ line: 'second' })
    store.buildLogs.push({ line: 'third' })
    await flushPromises()

    const jumpBtn = wrapper.find('.jump-to-bottom')
    expect(jumpBtn.exists()).toBe(true)
    expect(jumpBtn.text()).toContain('2 new lines')
    // Position must not be forced to the bottom.
    expect(el.scrollTop).toBe(0)
  })

  it('resumes following and clears the counter when scrolled back to the bottom', async () => {
    const store = usePcbGeneratorStore()
    store.buildLogs = [{ line: 'first' }]

    const wrapper = mount(PcbBuildLog)
    const body = wrapper.find('.build-log-body')
    const el = body.element as HTMLElement

    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })

    // Scroll up (pause), accumulate a new line.
    el.scrollTop = 0
    await body.trigger('scroll')
    store.buildLogs.push({ line: 'second' })
    await flushPromises()
    expect(wrapper.find('.jump-to-bottom').exists()).toBe(true)

    // Scroll back to the bottom → follow re-engages, counter clears.
    el.scrollTop = 300 // 500 - 300 - 200 = 0, within threshold
    await body.trigger('scroll')

    expect(wrapper.find('.jump-to-bottom').exists()).toBe(false)

    // A subsequent line now auto-scrolls again.
    store.buildLogs.push({ line: 'third' })
    await flushPromises()
    expect(el.scrollTop).toBe(500)
  })

  it('resumes following after the stream is cleared and replayed on reconnect', async () => {
    const store = usePcbGeneratorStore()
    store.buildLogs = [{ line: 'a' }, { line: 'b' }, { line: 'c' }]

    const wrapper = mount(PcbBuildLog)
    const body = wrapper.find('.build-log-body')
    const el = body.element as HTMLElement

    Object.defineProperty(el, 'scrollHeight', { value: 500, configurable: true })
    Object.defineProperty(el, 'clientHeight', { value: 200, configurable: true })

    // User scrolls up → paused.
    el.scrollTop = 0
    await body.trigger('scroll')
    expect(wrapper.find('.jump-to-bottom').exists()).toBe(true)

    // Reconnect clears the buffer (length shrinks), then replays.
    store.buildLogs = []
    await flushPromises()
    store.buildLogs.push({ line: 'a' })
    await flushPromises()

    // Following resumed: no jump affordance and the tail is pinned.
    expect(wrapper.find('.jump-to-bottom').exists()).toBe(false)
    expect(el.scrollTop).toBe(500)
  })

  it('copies the joined log text to the clipboard', async () => {
    const store = usePcbGeneratorStore()
    store.buildLogs = [{ line: 'line-a' }, { line: 'line-b' }]

    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    const wrapper = mount(PcbBuildLog)
    await wrapper.find('.build-log-header button').trigger('click')

    expect(writeText).toHaveBeenCalledWith('line-a\nline-b')
  })
})
